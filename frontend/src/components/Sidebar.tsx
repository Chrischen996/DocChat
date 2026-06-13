"use client";

import { useState } from "react";

interface SidebarProps {
  onNewChat: () => void;
  onToggle: () => void;
  isOpen: boolean;
}

export default function Sidebar({
  onNewChat,
  onToggle,
  isOpen,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[#e8e4df] text-sm transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 顶部: 新对话按钮 */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-2.5 rounded-lg border border-[#d5cdc2] bg-white/70 px-3 py-2.5 text-sm font-medium text-[#403a34] transition-colors hover:bg-white hover:border-[#c4b9ab]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        {/* 搜索框 */}
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9c9289]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="w-full rounded-lg border border-[#d5cdc2] bg-white/50 py-2 pl-8 pr-3 text-sm text-[#403a34] placeholder:text-[#9c9289] transition-colors hover:border-[#c4b9ab] focus:bg-white focus:border-[#b8ada2]"
            />
          </div>
        </div>

        {/* 对话历史列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3">
          <div className="space-y-0.5">
            <div className="rounded-lg px-3 py-2.5 text-[#8b8178] text-xs font-medium">
              暂无历史对话
            </div>
          </div>
        </div>

        {/* 底部：已上传文档提示 */}
        <div className="shrink-0 border-t border-[#d5cdc2]/60 px-3 py-3">
          <div className="rounded-lg bg-[#ddd6cc]/40 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-[#6f675f]">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>上传文档后自动检索问答</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
