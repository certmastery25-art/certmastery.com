type Segment = { kind: "text" | "code"; value: string };

const FENCE = /```\n?([\s\S]*?)\n?```/g;

// Splits a question prompt into text and ```fenced``` exhibit blocks (show output, configs, code).
export function splitPrompt(prompt: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of prompt.matchAll(FENCE)) {
    const before = prompt.slice(last, match.index).trim();
    if (before) segments.push({ kind: "text", value: before });
    segments.push({ kind: "code", value: match[1] });
    last = (match.index ?? 0) + match[0].length;
  }
  const rest = prompt.slice(last).trim();
  if (rest) segments.push({ kind: "text", value: rest });
  return segments;
}

// Plain-text version of a prompt for previews and tables.
export function promptPreview(prompt: string) {
  return prompt.replace(/```/g, " ").replace(/\s+/g, " ").trim();
}

// Renders the first text segment as the heading and any exhibits after it in monospace,
// so column-aligned CLI output keeps its spacing.
export function QuestionPrompt({ prompt, headingId, as: Heading = "h1", className = "question-prompt" }: {
  prompt: string;
  headingId?: string;
  as?: "h1" | "p";
  className?: string;
}) {
  const segments = splitPrompt(prompt);
  const headingIndex = segments.findIndex((segment) => segment.kind === "text");
  return (
    <>
      {headingIndex >= 0 && <Heading id={headingId} className={className}>{segments[headingIndex].value}</Heading>}
      {segments.map((segment, index) => {
        if (index === headingIndex) return null;
        return segment.kind === "code"
          ? <pre key={index} className="question-exhibit"><code>{segment.value}</code></pre>
          : <p key={index} className={`${className} question-prompt-followup`}>{segment.value}</p>;
      })}
    </>
  );
}
