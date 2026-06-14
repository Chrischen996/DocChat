"use client";

import { SourceNode } from "@/types";
import SourceCard from "./SourceCard";

interface SourceListProps {
  sources: SourceNode[];
  anchorPrefix?: string;
  activeSourceId?: string | null;
  onSourceClick?: (sourceId: string) => void;
}

export default function SourceList({
  sources,
  anchorPrefix,
  activeSourceId,
  onSourceClick,
}: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          来源
        </h2>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
          {sources.length}
        </span>
      </div>
      <div className="space-y-2">
        {sources.map((source, index) => (
          <SourceCard
            key={`${source.source_id ?? source.file_name}-${index}`}
            index={index + 1}
            source={source}
            anchorPrefix={anchorPrefix}
            active={source.source_id === activeSourceId}
            onSelect={onSourceClick}
          />
        ))}
      </div>
    </div>
  );
}
