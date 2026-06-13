# DocChat Claude-Style Redesign

## Design Goal
Transform the DocChat chat UI to match Anthropic Claude's clean, minimal, efficient design.

## Visual Specs

### Color Palette
- Page background: #f5f5f0 (warm off-white)
- Message area: same as page, no cards/borders
- User message text: #2d2d2d, no bubble
- Assistant avatar: #d9d9d9 bg with #5a5a5a icon
- Input box: white bg, #d9d9d9 border, #f9f9f9 on hover
- Accent: #5a5a5a (dark gray), hover: #404040
- Divider: #e8e8e3
- Text muted: #a0a0a0

### Layout Structure
```
┌──────────────────────────────────┐
│ Top Bar (thin, just logo+menu)   │
├──────────────────────────────────┤
│                                  │
│   Welcome/Message Area           │
│   (centered, max-w-3xl)          │
│                                  │
│   ┌─ Input Bar ──────────────┐   │
│   │  Type message...    [→]  │   │
│   └──────────────────────────┘   │
│   (attachments shown as chips)   │
└──────────────────────────────────┘
```

### Message Style (Claude-like)
- **User messages**: No bubble. Just plain text, left-aligned, slightly larger (15px), normal weight. Maybe a very subtle right margin/alignment difference.
- **Assistant messages**: Small square avatar (28px) with "D" monogram left of text. Text flows next to it. No card border, no background, no shadow. Just text on the page.
- **Sources**: Small collapsible section below the answer, not a card.

### Input Box (Claude-like)
- Centered, max-w-3xl
- Clean white bg with subtle border
- No plus button popover — use small inline icons
- File upload: small paperclip icon on the left
- Send button: simple arrow icon, only lights up with text
- Auto-resizing textarea (like current)
- No footer hint text

### Top Bar
- Very thin (~40px)
- Left: hamburger (sidebar toggle) + "DocChat" text
- Right: small gear/ellipsis icon for settings (model selector hidden here)

### Welcome Screen (empty state)
- Claude-style: just centered logo + tagline + maybe 2-3 suggestion pills
- Very clean, lots of whitespace

## Files to Modify

1. **globals.css** — Update color scheme, remove message-enter animations, simplify
2. **page.tsx** — Refactor layout, simplify message rendering, remove UserMessage bubble
3. **Header.tsx** — Simplify to minimal top bar
4. **QuerySection.tsx** — Complete Claude-style input rewrite
5. **AnswerDisplay.tsx** — Remove card borders/background, plain text rendering
6. **WelcomeScreen.tsx** — Simplify to minimal welcome
7. **SourceList.tsx** — Remove card styling, make collapsible section
8. **SourceCard.tsx** — Simplify to inline snippet
9. **Sidebar.tsx** — Keep as-is (already reasonable)

## Implementation Notes

- Use existing Tailwind classes, no new dependencies
- Keep all existing functionality (RAG, chat, image gen, file upload)
- Preserve streaming behavior
- Preserve the citation [1], [2] link behavior
- The sidebar, header toggle, and all callbacks must remain functional
- Don't break the upload document flow or delete document functionality
- Use the existing `font-sans` Geist font family
