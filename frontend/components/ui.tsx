import { ReactNode, ButtonHTMLAttributes } from "react";

// 참고: globals.css의 `button { color: ... }`가 Tailwind 글자색보다 우선하므로
// 버튼 글자색은 모두 `!text-…`(important)로 지정한다.

export function Shell({ title, sub, right, children, footer }: {
  title: string; sub?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-stone-100 text-zinc-900 sm:py-6">
      <div className="relative mx-auto flex h-[100dvh] max-w-[390px] flex-col overflow-hidden bg-white text-zinc-900 sm:h-[780px] sm:rounded-[40px] sm:border-4 sm:border-zinc-800 sm:shadow-2xl">
        <header className="am-fade z-10 border-b border-stone-200 bg-white px-5 pb-3 pt-5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">{title}</h1>{right}
          </div>
          {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
        </header>
        <div className="am-page flex-1 overflow-y-auto px-4 pb-6 pt-4">{children}</div>
        {footer && (
          <footer className="am-sheet relative z-10 grid gap-2 rounded-t-[28px] border-t border-stone-200 bg-white px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(35,32,27,0.12)]">
            <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-stone-200" aria-hidden />
            {footer}
          </footer>
        )}
      </div>
    </main>
  );
}

type Variant = "line" | "pri" | "green";
const BTN: Record<Variant, string> = {
  line: "border-stone-300 bg-white !text-zinc-900 hover:border-stone-500",
  pri: "border-transparent bg-orange-600 !text-white shadow-[0_6px_16px_rgba(200,71,43,0.3)] hover:brightness-105",
  green: "border-transparent bg-emerald-700 !text-white shadow-[0_6px_16px_rgba(47,107,90,0.3)] hover:brightness-110",
};
export const btnCls = (variant: Variant = "line") =>
  `block w-full rounded-2xl border-2 px-4 py-3.5 text-center font-semibold transition duration-150 active:scale-[0.97] ${BTN[variant]}`;

export function Btn({ variant = "line", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  // 비활성 버튼은 흐리게(opacity) 하지 않고 회색 배경 + 읽을 수 있는 회색 글씨로
  return <button {...p} className={`${btnCls(variant)} disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:!text-stone-500 disabled:shadow-none disabled:active:scale-100 ${className}`} />;
}

/** 켜고 끄는 칩 (예산, 피하고 싶은 것 등). 선택 시 검정 대신 주황 톤 + 체크 */
export function Chip({ on, className = "", children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button {...p} aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-150 active:scale-95 ${on
        ? "am-pop border-orange-600 bg-[#fbe9e3] !text-[#9a3214]"
        : "border-stone-300 bg-white !text-zinc-800 hover:border-stone-500"} ${className}`}>
      {on && <span aria-hidden>✓</span>}{children}
    </button>
  );
}

/** 작은 보조 버튼 (링크 복사, 불러오기 등) */
export const pillCls = "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium !text-zinc-800 transition hover:border-stone-500 active:scale-95";

export const inputCls = "w-full rounded-xl border border-stone-300 bg-white p-3 outline-none transition focus:border-orange-600 focus:ring-4 focus:ring-orange-600/15 disabled:bg-stone-100 disabled:text-stone-500";

/** 헤더 오른쪽 상태 배지 */
export const Badge = ({ children }: { children: ReactNode }) =>
  <span className="rounded-full bg-[#fbe9e3] px-3 py-1 text-xs font-semibold text-[#9a3214]">{children}</span>;

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <div className={`mb-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_1px_2px_rgba(35,32,27,0.04)] ${className}`}>{children}</div>;

export const Notice = ({ children }: { children: ReactNode }) =>
  <div className="mb-3 rounded-2xl bg-orange-50 p-3 text-sm text-stone-700">{children}</div>;

export const Err = ({ msg }: { msg: string }) => msg ? <p className="am-fade mb-2 rounded-xl bg-red-50 p-2 text-sm text-red-700">{msg}</p> : null;

export const EMOJI = { good: "👍", soso: "😐", bad: "❌" } as const;
export const MENU_ICON: Record<string, string> = { 국밥: "🍲", 우동: "🍜", 볶음밥: "🍳", 돈가스: "🍛", 파스타: "🍝" };
