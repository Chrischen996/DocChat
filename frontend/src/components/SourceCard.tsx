"use client";

import { useState } from "react";
import { SourceNode } from "@/types";

interface SourceCardProps {
  index: number;
  source: SourceNode;
  anchorPrefix?: string;
  active?: boolean;
  onSelect?: (sourceId: string) => void;
}

function getSnippet(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

export default function SourceCard({
  index,
  source,
  anchorPrefix,
  active,
  onSelect,
}: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sourceId = source.source_id || `${anchorPrefix ?? "source"}-${index}`;
  const snippet = getSnippet(source.text);
  const isLong = source.text.replace(/\s+/g, " ").trim().length > 180;

  const anchorId = anchorPrefix ? `${anchorPrefix}-source-${index}` : `source-${index}`;

  return (
    <div
      id={anchorId}
      className={`cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-light)]"
          : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
      }`}
      onClick={() => onSelect?.(sourceId)}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)]">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
            <span className="truncate">{source.file_name || source.document_title || "Source"}</span>
            {source.page_number != null && <span>Page {source.page_number}</span>}
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-[var(--text-primary)]">
            {expanded ? source.text : snippet}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(!expanded);
              }}
              className="mt-2 text-xs font-medium text-[var(--accent)]"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
