import { formatIpv4 } from "./addr";
import { shortIf } from "./device";
import { bpduguardActive, l2Domain, macsBehind, peerOf, physUp } from "./l2";
import { computeRouterId, hsrpPriority, hsrpVip, ifStatus, logTo, ospfAdjacency } from "./l3";
import type { LabState } from "./types";

export type Snapshot = { up: Map<string, "up" | "down" | "admin">; adjacencies: Set<string>; problems: Set<string> };

export function snapshot(state: LabState): Snapshot {
  const up = new Map<string, "up" | "down" | "admin">();
  const adjacencies = new Set<string>();
  const problems = new Set<string>();
  for (const device of Object.values(state.devices)) {
    if (device.kind === "host" || device.kind === "hub" || device.locked) continue;
    for (const name of Object.keys(device.interfaces)) {
      const status = ifStatus(state, device.name, name);
      up.set(`${device.name}|${name}`, !status.admin ? "admin" : status.line ? "up" : "down");
    }
    if (device.ospf) {
      const result = ospfAdjacency(state, device.name);
      for (const neighbor of result.neighbors) if (neighbor.state === "FULL" || neighbor.state === "2WAY") adjacencies.add(`${device.name}|${neighbor.local.iface}|${neighbor.rid}`);
      for (const problem of result.problems) problems.add(`${problem.dev}|${problem.message}`);
    }
  }
  return { up, adjacencies, problems };
}

function errDisable(state: LabState, dev: string, port: string, reason: string, cause: string) {
  const device = state.devices[dev];
  device.errDisabled[port] = reason;
  if (cause) logTo(state, dev, cause);
  logTo(state, dev, `%PM-4-ERR_DISABLE: ${reason} error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`);
}

function convergeSecurity(state: LabState) {
  for (const device of Object.values(state.devices)) {
    if (device.kind !== "switch" && device.kind !== "l3switch") continue;
    for (const iface of Object.values(device.interfaces)) {
      if (!iface.physical || device.errDisabled[iface.name]) continue;
      if (!physUp(state, device.name, iface.name)) {
        if (iface.shutdown && !iface.portSecurity.sticky) delete device.psecLearned[iface.name];
        continue;
      }
      const peer = peerOf(state, device.name, iface.name);
      const peerDevice = peer ? state.devices[peer[0]] : undefined;
      if (iface.switchport && bpduguardActive(state, device.name, iface.name) && (peerDevice?.kind === "switch" || peerDevice?.kind === "l3switch")) {
        errDisable(state, device.name, iface.name, "bpduguard", `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${shortIf(iface.name)} with BPDU Guard enabled. Disabling port.`);
        continue;
      }
      if (!iface.portSecurity.enabled) {
        delete device.psecLearned[iface.name];
        continue;
      }
      const learned = device.psecLearned[iface.name] ?? [];
      const offenders: string[] = [];
      for (const mac of macsBehind(state, device.name, iface.name)) {
        if (learned.includes(mac)) continue;
        if (learned.length < iface.portSecurity.max) learned.push(mac);
        else offenders.push(mac);
      }
      device.psecLearned[iface.name] = learned;
      if (!offenders.length) continue;
      const message = `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${offenders[0]} on port ${iface.name}.`;
      if (iface.portSecurity.violation === "shutdown") errDisable(state, device.name, iface.name, "psecure-violation", message);
      else if (iface.portSecurity.violation === "restrict" && (device.psecViolations[iface.name] ?? 0) < offenders.length) {
        device.psecViolations[iface.name] = offenders.length;
        logTo(state, device.name, message);
      }
    }
  }
}

function convergeHsrp(state: LabState) {
  type Member = { dev: string; iface: string; group: number };
  const seen = new Set<string>();
  for (const device of Object.values(state.devices)) {
    if (device.kind === "host" || device.kind === "hub") continue;
    for (const iface of Object.values(device.interfaces)) {
      for (const group of Object.keys(iface.standby).map(Number)) {
        const key = `${device.name}|${iface.name}|${group}`;
        if (seen.has(key)) continue;
        const members: Member[] = [{ dev: device.name, iface: iface.name, group }];
        for (const reached of l2Domain(state, device.name, iface.name)) {
          const peerIface = state.devices[reached.dev].interfaces[reached.iface];
          if (peerIface?.standby[group] && peerIface.standbyVersion === iface.standbyVersion) members.push({ dev: reached.dev, iface: reached.iface, group });
        }
        for (const member of members) seen.add(`${member.dev}|${member.iface}|${group}`);
        const stateKey = (member: Member) => `${member.iface}:${group}`;
        const current = (member: Member) => state.devices[member.dev].hsrp[stateKey(member)] ?? "Init";
        const eligible = members.filter((member) => {
          const status = ifStatus(state, member.dev, member.iface);
          return status.admin && status.line && state.devices[member.dev].interfaces[member.iface].ipv4 && hsrpVip(state, member.dev, member.iface, group) !== undefined;
        });
        const rank = (member: Member) => hsrpPriority(state, member.dev, member.iface, group);
        const ip = (member: Member) => state.devices[member.dev].interfaces[member.iface].ipv4!.addr;
        const ranked = [...eligible].sort((a, b) => rank(b) - rank(a) || (ip(b) > ip(a) ? 1 : ip(b) < ip(a) ? -1 : 0));
        let active = eligible.find((member) => current(member) === "Active");
        const best = ranked[0];
        if (!active) active = best;
        else if (best && best !== active && state.devices[best.dev].interfaces[best.iface].standby[group].preempt && rank(best) > rank(active)) active = best;
        const standby = ranked.find((member) => member !== active);
        for (const member of members) {
          const next = !eligible.includes(member) ? "Init" : member === active ? "Active" : member === standby ? "Standby" : "Listen";
          const previous = current(member);
          if (previous === next) continue;
          state.devices[member.dev].hsrp[stateKey(member)] = next;
          if (next !== "Init" || previous !== "Init") {
            logTo(state, member.dev, `%HSRP-5-STATECHANGE: ${member.iface} Grp ${group} state ${previous === "Init" ? "Speak" : previous} -> ${next}`);
          }
        }
      }
    }
  }
}

/** Applies the stateful side effects of a configuration change and logs what changed. */
export function converge(state: LabState, before?: Snapshot) {
  for (const device of Object.values(state.devices)) {
    if (device.ospf && device.ospf.activeRid === undefined) device.ospf.activeRid = computeRouterId(state, device.name);
  }
  convergeSecurity(state);
  if (!before) {
    convergeHsrp(state);
    return;
  }

  // Link changes are logged before the HSRP and OSPF reactions they cause.
  const after = snapshot(state);
  for (const [key, status] of after.up) {
    const previous = before.up.get(key);
    if (!previous || previous === status) continue;
    const [dev, name] = key.split("|");
    if (status === "admin") {
      logTo(state, dev, `%LINK-5-CHANGED: Interface ${name}, changed state to administratively down`);
      if (previous === "up") logTo(state, dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to down`);
    } else if (status === "up") {
      if (previous === "admin" && name.includes(".")) continue;
      logTo(state, dev, `%LINK-3-UPDOWN: Interface ${name}, changed state to up`);
      logTo(state, dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to up`);
    } else if (previous === "up") {
      logTo(state, dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to down`);
    }
  }
  convergeHsrp(state);
  for (const key of after.adjacencies) {
    if (before.adjacencies.has(key)) continue;
    const [dev, iface, rid] = key.split("|");
    logTo(state, dev, `%OSPF-5-ADJCHG: Process ${state.devices[dev].ospf?.pid}, Nbr ${formatIpv4(BigInt(rid))} on ${iface} from LOADING to FULL, Loading Done`);
  }
  for (const key of before.adjacencies) {
    if (after.adjacencies.has(key)) continue;
    const [dev, iface, rid] = key.split("|");
    if (state.devices[dev].ospf) logTo(state, dev, `%OSPF-5-ADJCHG: Process ${state.devices[dev].ospf!.pid}, Nbr ${formatIpv4(BigInt(rid))} on ${iface} from FULL to DOWN, Neighbor Down: Dead timer expired`);
  }
  for (const key of after.problems) {
    if (before.problems.has(key)) continue;
    const split = key.indexOf("|");
    logTo(state, key.slice(0, split), key.slice(split + 1));
  }
}
