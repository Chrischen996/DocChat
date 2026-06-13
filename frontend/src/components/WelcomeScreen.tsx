"use client";

interface WelcomeScreenProps {
  hasDocs: boolean;
  onSuggestionClick: (text: string) => void;
}

const chatSuggestions = [
  { text: "帮我规划一个项目", icon: "📋" },
  { text: "总结一段文章要点", icon: "📝" },
  { text: "解释一个复杂概念", icon: "💡" },
  { text: "写一首诗或故事", icon: "✍️" },
];

const docSuggestions = [
  { text: "文档说了什么？请全面总结", icon: "📚" },
  { text: "提炼三个关键要点", icon: "🎯" },
  { text: "用表格整理核心数据", icon: "📊" },
  { text: "这篇文档的主要结论是什么", icon: "🔍" },
];

export default function WelcomeScreen({
  hasDocs,
  onSuggestionClick,
}: WelcomeScreenProps) {
  const suggestions = hasDocs ? docSuggestions : chatSuggestions;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[var(--border)]">
        <span className="text-lg font-bold text-[var(--accent)]">D</span>
      </div>

      {/* Title */}
      <h1 className="text-center text-xl font-semibold text-[var(--text-primary)] tracking-tight">
        {hasDocs ? "基于已上传文档提问" : "今天想聊点什么？"}
      </h1>

      {/* Subtitle */}
      <p className="mt-1.5 max-w-md text-center text-sm text-[var(--text-secondary)]">
        {hasDocs
          ? "我已经读取了你上传的文档，可以直接提问文档中的内容"
          : "我是 DocChat AI，可以聊天、分析文档、甚至画图"}
      </p>

      {/* Suggestion prompts */}
      <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((item) => (
          <button
            key={item.text}
            type="button"
            onClick={() => onSuggestionClick(item.text)}
            className="group flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-3.5 py-1.5 text-sm text-[var(--text-secondary)] transition-all hover:bg-white hover:border-[var(--border)] hover:text-[var(--text-primary)] hover:shadow-sm"
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
