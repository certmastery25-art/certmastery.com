import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

/** Renders the small Markdown subset used in study notes. React escapes everything, so notes can't inject HTML. */
export function StudyNotes({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const key = blocks.length;
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const code: string[] = [];
      for (index += 1; index < lines.length && !lines[index].startsWith("```"); index += 1) code.push(lines[index]);
      index += 1;
      blocks.push(<pre key={key} tabIndex={0}><code>{code.join("\n")}</code></pre>);
    } else if (line.startsWith("### ")) {
      blocks.push(<h3 key={key}>{inline(line.slice(4))}</h3>);
      index += 1;
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      for (; index < lines.length && lines[index].startsWith("|"); index += 1) rows.push(lines[index]);
      const body = rows.slice(2);
      blocks.push(<div className="nse-table-wrap" key={key} tabIndex={0}><table><thead><tr>{cells(rows[0]).map((cell, cellIndex) => <th key={cellIndex}>{inline(cell)}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{cells(row).map((cell, cellIndex) => <td key={cellIndex}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>);
    } else if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line);
      const items: string[] = [];
      for (; index < lines.length && /^(- |\d+\. )/.test(lines[index]); index += 1) items.push(lines[index].replace(/^(- |\d+\. )/, ""));
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>);
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
    } else {
      blocks.push(<p key={key}>{inline(line)}</p>);
      index += 1;
    }
  }
  return <div className="nse-notes">{blocks}</div>;
}
