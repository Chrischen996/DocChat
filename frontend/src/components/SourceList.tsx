import { SourceNode } from "@/types";
import SourceCard from "./SourceCard";

interface SourceListProps {
  sources: SourceNode[];
  anchorPrefix?: string;
}

export default function SourceList({ sources, anchorPrefix }: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          来源
        </h2>
        <span className="rounded-full bg-[var(--bg-sidebar)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
          {sources.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {sources.map((source, index) => (
          <SourceCard
            key={`${source.file_name}-${index}`}
            index={index + 1}
            source={source}
            anchorPrefix={anchorPrefix}
          />
        ))}
      </div>
    </div>
  );
}
