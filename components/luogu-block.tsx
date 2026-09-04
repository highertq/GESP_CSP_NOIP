// 编程大题的外链/说明块（灰阶风）
// externalUrl 有值 = 真题卷，洛谷有原题 → 黑色外链按钮
// 无值 = 模拟卷自编题，洛谷无对应 → 只做站内说明，不挂链接（方案 A：只挂真题卷）
export default function LuoguBlock({ externalUrl, compact }: { externalUrl?: string | null; compact?: boolean }) {
  if (externalUrl) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
          去洛谷做原题
        </a>
        <span className="text-xs text-ink-3">本站不判编程题 · 洛谷官方真题，可在线提交验证</span>
      </div>
    );
  }
  return (
    <div
      className={`mt-3 rounded-lg bg-surface-2 border border-line ${
        compact ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-xs"
      } text-ink-2`}
    >
      编程大题：本站只展示题面不判分。模拟卷自编题无洛谷原题，请按题面要求自写代码验证。
    </div>
  );
}
