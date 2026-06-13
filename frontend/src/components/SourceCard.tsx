"use client";

import { useState } from "react";
import { SourceNode } from "@/types";

interface SourceCardProps {
  index: number;
  source: SourceNode;
  anchorPrefix?: string;
}

function getSnippet(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean;
}

export default function SourceCard({
  index,
  source,
  anchorPrefix,
}: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const snippet = getSnippet(source.text);
  const isLong = source.text.replace(/\s+/g, " ").trim().length > 120;

  const anchorId = anchorPrefix
    ? `${anchorPrefix}-source-${index}`
    : `source-${index}`;

  return (
    <div
      id={anchorId}
      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--accent-light)] text-[10px] font-semibold text-[var(--text-secondary)]">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="truncate">{source.file_name}</span>
          </div>
          <p className="mt-1 leading-relaxed text-[var(--text-primary)]">
            {expanded ? source.text : snippet}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
