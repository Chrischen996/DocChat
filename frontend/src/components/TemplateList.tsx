"use client";

import { TemplateInfo } from "@/types";

interface TemplateListProps {
  templates: TemplateInfo[];
  activeTemplateId: string | null;
  onSelect: (template: TemplateInfo) => void;
}

export default function TemplateList({
  templates,
  activeTemplateId,
  onSelect,
}: TemplateListProps) {
  return (
    <div className="space-y-2">
      {templates.map((template) => {
        const active = template.id === activeTemplateId;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] bg-white hover:bg-[var(--accent-light)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {template.name}
              </span>
              <span className="rounded-full bg-[var(--bg-page)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                {template.workflow_id}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
              {template.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

