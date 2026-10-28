import type { LabDefinition } from "./engine/lab";
import { ospfLab, ospfTroubleshootingLab, ipv6Lab, hsrpLab } from "./ccna/routing";
import { aclLab, ipServicesLab, layer2SecurityLab } from "./ccna/services";
import { createVlanLab, etherchannelLab, rapidPvstLab, routerOnAStickLab } from "./ccna/switching";

export type { LabDefinition, LabTask } from "./engine/lab";
export { createLabState, isLabComplete, isLabTaskComplete, promptForState, runLabCommand } from "./engine/lab";

/** CCNA 200-301 v1.1 labs, in the order of the exam blueprint. */
export const ccnaLabs: LabDefinition[] = [
  createVlanLab,
  routerOnAStickLab,
  etherchannelLab,
  rapidPvstLab,
  ipv6Lab,
  ospfLab,
  ospfTroubleshootingLab,
  hsrpLab,
  ipServicesLab,
  aclLab,
  layer2SecurityLab,
];

export const ccnaLabDomains = ["Network Access", "IP Connectivity", "IP Services", "Security Fundamentals"] as const;

export function findCcnaLab(slug: string) {
  return ccnaLabs.find((lab) => lab.slug === slug);
}

/** Devices the learner can open a console on. */
export function consoleDevices(lab: LabDefinition) {
  return lab.devices.filter((device) => !device.locked && device.kind !== "hub").map((device) => ({ name: device.name, kind: device.kind }));
}
