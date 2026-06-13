"use client";

import { useEffect, useRef, useState } from "react";

interface UploadMenuProps {
  loading?: boolean;
  onFileUpload: () => void;
  onImageUpload: () => void;
  buttonClassName?: string;
  menuClassName?: string;
  buttonTitle?: string;
  menuPlacement?: "top" | "bottom";
  menuAlign?: "start" | "center";
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  );
}

export default function UploadMenu({
  loading = false,
  onFileUpload,
  onImageUpload,
  buttonClassName = "",
  menuClassName = "",
  buttonTitle = "Add files",
  menuPlacement = "bottom",
  menuAlign = "start",
}: UploadMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function closeAnd(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        disabled={loading}
        className={buttonClassName}
        title={buttonTitle}
        aria-expanded={open}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-1/2 z-20 min-w-52 overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[var(--bg-surface-strong)] shadow-[0_18px_40px_rgba(0,0,0,0.26)] ${
            menuAlign === "start"
              ? "left-0"
              : "left-1/2 -translate-x-1/2"
          } ${
            menuPlacement === "bottom"
              ? "top-full mt-2 origin-top"
              : "bottom-full mb-2 origin-bottom"
          } ${menuClassName}`}
        >
          <button
            type="button"
            onClick={() => closeAnd(onFileUpload)}
            className="flex w-full items-center gap-3 px-3.5 py-2.75 text-left text-[15px] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in srgb, var(--bg-surface) 72%, transparent)]">
              <FileIcon />
            </span>
            <span className="font-medium">File upload</span>
          </button>
          <button
            type="button"
            onClick={() => closeAnd(onImageUpload)}
            className="flex w-full items-center gap-3 px-3.5 py-2.75 text-left text-[15px] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in srgb, var(--bg-surface) 72%, transparent)]">
              <ImageIcon />
            </span>
            <span className="font-medium">Image upload</span>
          </button>
        </div>
      )}
    </div>
  );
}
