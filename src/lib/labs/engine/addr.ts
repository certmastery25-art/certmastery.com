// IPv4/IPv6 helpers. Addresses are bigints so both families share prefix logic.

export type Family = 4 | 6;
export type Cidr = { family: Family; addr: bigint; len: number };

const ZERO = BigInt(0);
const ONE = BigInt(1);
const bits = (family: Family) => (family === 4 ? 32 : 128);

export function maskBits(family: Family, len: number) {
  const width = BigInt(bits(family));
  const all = (ONE << width) - ONE;
  return len === 0 ? ZERO : (all >> BigInt(bits(family) - len)) << BigInt(bits(family) - len);
}

export function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => (value << BigInt(8)) + BigInt(Number(part)), ZERO);
}

export function formatIpv4(value: bigint) {
  return [24, 16, 8, 0].map((shift) => Number((value >> BigInt(shift)) & BigInt(255))).join(".");
}

export function maskToLen(mask: bigint): number | null {
  for (let len = 0; len <= 32; len += 1) if (maskBits(4, len) === mask) return len;
  return null;
}

export function lenToMask(len: number) {
  return formatIpv4(maskBits(4, len));
}

export function wildcardOf(len: number) {
  return formatIpv4(maskBits(4, len) ^ ((ONE << BigInt(32)) - ONE));
}

export function parseIpv6(text: string): bigint | null {
  const value = text.toLowerCase();
  if (!/^[0-9a-f:]+$/.test(value) || (value.match(/::/g) ?? []).length > 1) return null;
  const [head, tail] = value.includes("::") ? value.split("::") : [value, null];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if ([...headParts, ...tailParts].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const missing = 8 - headParts.length - tailParts.length;
  if (tail === null ? missing !== 0 : missing < 1) return null;
  const groups = [...headParts, ...Array<string>(tail === null ? 0 : missing).fill("0"), ...tailParts];
  return groups.reduce((acc, group) => (acc << BigInt(16)) + BigInt(parseInt(group, 16)), ZERO);
}

export function formatIpv6(value: bigint, upper = true) {
  const groups = Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & BigInt(0xffff)));
  let bestStart = -1;
  let bestLength = 0;
  for (let start = 0; start < 8;) {
    if (groups[start] !== 0) { start += 1; continue; }
    let end = start;
    while (end < 8 && groups[end] === 0) end += 1;
    if (end - start > bestLength && end - start > 1) { bestStart = start; bestLength = end - start; }
    start = end;
  }
  const hex = groups.map((group) => group.toString(16));
  const text = bestStart < 0
    ? hex.join(":")
    : `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
  return upper ? text.toUpperCase() : text;
}

export function parseIpv6Prefix(text: string): { addr: bigint; len: number } | null {
  const [address, length] = text.split("/");
  if (length === undefined || !/^\d{1,3}$/.test(length) || Number(length) > 128) return null;
  const addr = parseIpv6(address);
  return addr === null ? null : { addr, len: Number(length) };
}

export function network(family: Family, addr: bigint, len: number) {
  return addr & maskBits(family, len);
}

export function sameSubnet(family: Family, a: bigint, b: bigint, len: number) {
  return network(family, a, len) === network(family, b, len);
}

export function formatAddr(family: Family, value: bigint, upper = true) {
  return family === 4 ? formatIpv4(value) : formatIpv6(value, upper);
}

export function parseAddr(text: string): { family: Family; addr: bigint } | null {
  const v4 = parseIpv4(text);
  if (v4 !== null) return { family: 4, addr: v4 };
  const v6 = parseIpv6(text);
  return v6 === null ? null : { family: 6, addr: v6 };
}

export function isLinkLocal(addr: bigint) {
  return addr >> BigInt(118) === BigInt(0x3fa);
}

const LINK_LOCAL_PREFIX = BigInt(0xfe80) << BigInt(112);

export function eui64(mac: string) {
  const hex = mac.replace(/[^0-9a-f]/gi, "").padStart(12, "0");
  const bytes = hex.match(/../g)!.map((pair) => parseInt(pair, 16));
  bytes[0] ^= 0x02;
  const id = [...bytes.slice(0, 3), 0xff, 0xfe, ...bytes.slice(3)];
  return id.reduce((acc, byte) => (acc << BigInt(8)) + BigInt(byte), ZERO);
}

export function linkLocalFor(mac: string) {
  return LINK_LOCAL_PREFIX | eui64(mac);
}

/** Matches an address against an IPv4 wildcard pair (as used in ACLs and OSPF network statements). */
export function wildcardMatch(addr: bigint, base: bigint, wildcard: bigint) {
  return (addr & ~wildcard) === (base & ~wildcard);
}

export function hashString(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** Cisco dotted MAC derived from a seed, stable across runs. */
export function macFor(seed: string) {
  const a = hashString(seed);
  const b = hashString(`${seed}#`);
  const hex = (((a >>> 0).toString(16).padStart(8, "0")) + (b >>> 0).toString(16).padStart(8, "0")).slice(0, 12);
  const bytes = hex.match(/../g)!;
  bytes[0] = (parseInt(bytes[0], 16) & 0xfc).toString(16).padStart(2, "0");
  const joined = bytes.join("");
  return `${joined.slice(0, 4)}.${joined.slice(4, 8)}.${joined.slice(8, 12)}`;
}
