import { shortIf } from "@/lib/labs/engine/device";
import type { LabDefinition } from "@/lib/labs/engine/lab";

function portLabel(port: string) {
  if (port === "FastEthernet0" || port.startsWith("Port")) return "";
  return shortIf(port);
}

/** "Gi1/0/1" and "Gi1/0/2" become "Gi1/0/1-2" when a bundle is drawn as parallel lines. */
function bundleLabel(ports: string[]) {
  const labels = ports.map(portLabel);
  if (labels.length < 2 || !labels[0]) return labels[0];
  const last = labels[labels.length - 1].match(/(\d+)$/)?.[1];
  return `${labels[0]}-${last}`;
}

const nodeWidth = (name: string) => Math.max(54, name.length * 10 + 22);
const NODE_HEIGHT = 34;

/** Static network diagram drawn from the lab's layout and cabling. */
export function LabTopology({ lab }: { lab: LabDefinition }) {
  const names = lab.devices.map((device) => device.name).filter((name) => lab.layout[name]);
  const groups = new Map<string, LabDefinition["links"]>();
  for (const item of lab.links) {
    const key = [item.a[0], item.b[0]].sort().join("|");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const describe = [...groups.values()].map((items) => `${items[0].a[0]} ${bundleLabel(items.map((item) => item.a[1]))} to ${items[0].b[0]} ${bundleLabel(items.map((item) => item.b[1]))}`.replace(/\s+/g, " ")).join("; ");

  return (
    <figure className="lab-topology-figure">
      <svg className="lab-topology-svg" viewBox="0 0 640 390" role="img" aria-label={`Topology: ${describe}`}>
        {[...groups.entries()].map(([key, items]) => {
          const a = lab.layout[items[0].a[0]];
          const b = lab.layout[items[0].b[0]];
          if (!a || !b) return null;
          const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const unit = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
          const normal = { x: -unit.y, y: unit.x };
          // Port labels sit just outside each device, nudged off the line so they never cover it.
          const reach = (name: string) => Math.min(length / 2 - 6, Math.abs(unit.x) > 0.6 ? nodeWidth(name) / 2 + 26 : NODE_HEIGHT / 2 + 26);
          const place = (from: typeof a, direction: number, distance: number) => ({
            x: from.x + unit.x * direction * distance + normal.x * 13,
            y: from.y + unit.y * direction * distance + normal.y * 13 + 5,
          });
          const labelA = place(a, 1, reach(items[0].a[0]));
          const labelB = place(b, -1, reach(items[0].b[0]));
          const textA = bundleLabel(items.map((item) => item.a[1]));
          const textB = bundleLabel(items.map((item) => item.b[1]));
          return (
            <g key={key}>
              {items.map((item, index) => {
                const shift = (index - (items.length - 1) / 2) * 7;
                return <line key={item.a[1]} x1={a.x + normal.x * shift} y1={a.y + normal.y * shift} x2={b.x + normal.x * shift} y2={b.y + normal.y * shift} className={item.a[1].startsWith("Serial") ? "topology-link topology-link-serial" : "topology-link"} />;
              })}
              {textA && <text x={labelA.x} y={labelA.y} className="topology-port">{textA}</text>}
              {textB && <text x={labelB.x} y={labelB.y} className="topology-port">{textB}</text>}
            </g>
          );
        })}
        {names.map((name) => {
          const node = lab.layout[name];
          const locked = lab.devices.find((device) => device.name === name)?.locked;
          const width = nodeWidth(name);
          const radius = node.kind === "router" || node.kind === "cloud" ? NODE_HEIGHT / 2 : node.kind === "pc" || node.kind === "server" ? 3 : 7;
          return (
            <g key={name} className={`topology-node topology-${node.kind}${locked ? " topology-locked" : ""}`} transform={`translate(${node.x} ${node.y})`}>
              <rect x={-width / 2} y={-NODE_HEIGHT / 2} width={width} height={NODE_HEIGHT} rx={radius} className="topology-shape" />
              <text y={6} className="topology-name">{name}</text>
              {node.label && <text y={NODE_HEIGHT / 2 + 18} className="topology-caption">{node.label}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
