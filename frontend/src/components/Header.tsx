"use client";

interface HeaderProps {
  onSidebarToggle: () => void;
  onNewChat: () => void;
  sidebarOpen: boolean;
}

export default function Header({
  onSidebarToggle,
  onNewChat,
  sidebarOpen,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in srgb, var(--bg-page) 78%, transparent)] px-3 backdrop-blur-xl sm:px-4 lg:px-6">
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="hidden h-9 items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface-strong)] px-4 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-sidebar-hover)] sm:inline-flex"
          title="New chat"
        >
          New chat
        </button>
        <button
          type="button"
          className="surface-panel flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-sidebar-hover)]"
          title="Settings"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.5 1.5 0 012.35 0l.45.6a1.5 1.5 0 001.587.58l.73-.213a1.5 1.5 0 011.835 1.835l-.213.73a1.5 1.5 0 00.58 1.587l.6.45a1.5 1.5 0 010 2.35l-.6.45a1.5 1.5 0 00-.58 1.587l.213.73a1.5 1.5 0 01-1.835 1.835l-.73-.213a1.5 1.5 0 00-1.587.58l-.45.6a1.5 1.5 0 01-2.35 0l-.45-.6a1.5 1.5 0 00-1.587-.58l-.73.213a1.5 1.5 0 01-1.835-1.835l.213-.73a1.5 1.5 0 00-.58-1.587l-.6-.45a1.5 1.5 0 010-2.35l.6-.45a1.5 1.5 0 00.58-1.587l-.213-.73a1.5 1.5 0 011.835-1.835l.73.213a1.5 1.5 0 001.587-.58l.45-.6z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
