"use client";

interface HeaderProps {
  onSidebarToggle: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center border-b border-[var(--border)] bg-[var(--bg-page)]/80 px-3 backdrop-blur-sm">
      {/* Left: sidebar toggle + brand */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSidebarToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-sidebar)]"
          title="Toggle sidebar"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-medium text-[var(--text-secondary)]">DocChat</span>
      </div>
    </header>
  );
}
