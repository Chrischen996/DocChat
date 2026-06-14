"use client";

import { TemplateInfo } from "@/types";

interface SidebarProps {
  onNewChat: () => void;
  onToggle: () => void;
  isOpen: boolean;
  templates: TemplateInfo[];
  activeTemplateId: string | null;
  onSelectTemplate: (template: TemplateInfo) => void;
}

export default function Sidebar({
  onNewChat,
  onToggle,
  isOpen,
  templates,
  activeTemplateId,
  onSelectTemplate,
}: SidebarProps) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] lg:hidden" onClick={onToggle} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[300px] max-w-[86vw] flex-col border-r border-[var(--border)] bg-[var(--bg-page)] text-sm shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform duration-200 backdrop-blur-2xl lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0 px-5 pt-5">
          <div className="flex items-center gap-2">
            <div className="surface-panel flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--text-primary)]">
              D
            </div>
            <div>
              <div className="font-semibold tracking-tight text-[var(--text-primary)]">DocChat</div>
              <div className="text-xs text-[var(--text-secondary)]">Agentic RAG workspace</div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 pt-5">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            <span className="text-base leading-none">+</span>
            New chat
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6">
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Templates
              </div>
              <div className="space-y-1">
                {templates.map((template) => {
                  const active = template.id === activeTemplateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onSelectTemplate(template)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-[var(--accent)] bg-[var(--bg-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                          : "border-transparent bg-transparent hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: active ? "var(--accent)" : "var(--text-tertiary)" }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-[var(--text-primary)]">
                          {template.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-secondary)]">
                          {template.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Modes
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                Use the composer controls to switch mode and model.
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
