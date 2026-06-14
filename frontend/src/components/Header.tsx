"use client";

interface HeaderProps {
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
}

export default function Header({
  onSidebarToggle,
  sidebarOpen,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-page)] px-3 backdrop-blur-xl sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onSidebarToggle}
          className="surface-panel flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-sidebar-hover)] lg:hidden"
          title="Toggle sidebar"
          aria-pressed={sidebarOpen}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span className="truncate">DocChat</span>
        </div>
      </div>
    </header>
  );
}
