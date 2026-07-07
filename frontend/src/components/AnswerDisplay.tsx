"use client";

interface AnswerDisplayProps {
  answer: string | null;
  loading: boolean;
  error: string;
  loadingLabel?: string;
  sourceAnchorPrefix?: string;
  /** When true, shows a blinking cursor after the last character */
  isStreaming?: boolean;
}

function LoadingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      {label && <span>{label}</span>}
      <span className="flex items-center gap-1">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </span>
    </div>
  );
}

function CitationChip({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent-light)] px-1.5 align-super font-mono text-[11px] font-semibold leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      title={`View source ${label}`}
    >
      {label.replace("[", "").replace("]", "")}
    </a>
  );
}

function renderInline(text: string, sourceAnchorPrefix?: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g);

  return parts.map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/);
    if (citation) {
      const sourceNumber = citation[1];
      const href = sourceAnchorPrefix
        ? `#${sourceAnchorPrefix}-source-${sourceNumber}`
        : `#source-${sourceNumber}`;
      return <CitationChip key={index} label={part} href={href} />;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-[var(--accent-light)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function isTableBlock(lines: string[]) {
  return (
    lines.length >= 2 &&
    lines[0].includes("|") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1])
  );
}

function MarkdownTable({
  lines,
  sourceAnchorPrefix,
}: {
  lines: string[];
  sourceAnchorPrefix?: string;
}) {
  const rows = lines
    .filter((_, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
    );

  const [head = [], ...body] = rows;

  return (
    <div className="my-4 w-full overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-[var(--accent-light)] text-[var(--text-primary)]">
          <tr>
            {head.map((cell, index) => (
              <th key={index} className="border-b border-[var(--border)] px-3 py-2">
                {renderInline(cell, sourceAnchorPrefix)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-[var(--bg-page)]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-t border-[var(--border-light)] px-3 py-2">
                  {renderInline(cell, sourceAnchorPrefix)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownAnswer({
  text,
  sourceAnchorPrefix,
}: {
  text: string;
  sourceAnchorPrefix?: string;
}) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <div key={blocks.length} className="my-4 w-full overflow-x-auto rounded-2xl bg-[#2a2522]">
          <pre className="min-w-fit p-3 text-xs leading-5 text-[#faf9f7]">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    const tableLines: string[] = [];
    let tableIndex = i;
    while (tableIndex < lines.length && lines[tableIndex].includes("|")) {
      tableLines.push(lines[tableIndex]);
      tableIndex += 1;
    }
    if (isTableBlock(tableLines)) {
      blocks.push(
        <MarkdownTable
          key={blocks.length}
          lines={tableLines}
          sourceAnchorPrefix={sourceAnchorPrefix}
        />
      );
      i = tableIndex;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
      const className =
        level === 1
          ? "mt-5 mb-2 text-lg font-semibold text-[var(--text-primary)]"
          : level === 2
            ? "mt-4 mb-2 text-base font-semibold text-[var(--text-primary)]"
            : "mt-3 mb-1 text-sm font-semibold text-[var(--text-primary)]";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      blocks.push(
        <Tag key={blocks.length} className={className}>
          {renderInline(content, sourceAnchorPrefix)}
        </Tag>
      );
      i += 1;
      continue;
    }

    const listItems: string[] = [];
    let listIndex = i;
    while (listIndex < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[listIndex])) {
      listItems.push(lines[listIndex].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
      listIndex += 1;
    }
    if (listItems.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="my-3 space-y-1.5 pl-5">
          {listItems.map((item, index) => (
            <li key={index} className="list-disc pl-1">
              {renderInline(item, sourceAnchorPrefix)}
            </li>
          ))}
        </ul>
      );
      i = listIndex;
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^(#{1,3})\s+(.+)$/) &&
      !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={blocks.length} className="my-2 text-sm leading-7 text-[var(--text-primary)]">
        {renderInline(paragraphLines.join(" "), sourceAnchorPrefix)}
      </p>
    );
  }

  return <div className="break-words">{blocks}</div>;
}

export default function AnswerDisplay({
  answer,
  loading,
  error,
  loadingLabel,
  sourceAnchorPrefix,
  isStreaming = false,
}: AnswerDisplayProps) {
  if (loading) {
    return (
      <div className="py-2">
        <LoadingDots label={loadingLabel || "思考中"} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!answer) return null;

  return (
    <div className="markdown-content text-[var(--text-primary)]">
      <MarkdownAnswer text={answer} sourceAnchorPrefix={sourceAnchorPrefix} />
      {isStreaming && <span className="typing-cursor" aria-hidden="true" />}
    </div>
  );
}
