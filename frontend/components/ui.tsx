import { ReactNode, ButtonHTMLAttributes } from "react";

export function Shell({ title, sub, right, children, footer }: {
  title: string; sub?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-stone-100 text-zinc-900 sm:py-6">
      <div className="mx-auto flex min-h-screen max-w-[390px] flex-col overflow-hidden bg-white text-zinc-900 sm:min-h-[780px] sm:rounded-[40px] sm:border-4 sm:border-zinc-800">
        <header className="border-b border-stone-200 px-5 pb-3 pt-5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">{title}</h1>{right}
          </div>
          {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="grid gap-2 border-t border-stone-200 px-4 pb-5 pt-3">{footer}</footer>}
      </div>
    </main>
  );
}

export function Btn({ variant = "line", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "line" | "pri" | "green" }) {
  const v = { line: "border-zinc-800 bg-white text-zinc-900", pri: "border-orange-600 bg-orange-600 text-white", green: "border-emerald-700 bg-emerald-700 text-white" }[variant];
  return <button {...p} className={`w-full rounded-xl border-2 px-3 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`} />;
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <div className={`mb-3 rounded-2xl border border-stone-200 bg-white p-3 ${className}`}>{children}</div>;

export const Notice = ({ children }: { children: ReactNode }) =>
  <div className="mb-3 rounded-2xl bg-orange-50 p-3 text-sm text-stone-700">{children}</div>;

export const Err = ({ msg }: { msg: string }) => msg ? <p className="mb-2 text-sm text-red-600">{msg}</p> : null;

export const EMOJI = { good: "👍", soso: "😐", bad: "❌" } as const;
export const MENU_ICON: Record<string, string> = { 국밥: "🍲", 우동: "🍜", 볶음밥: "🍳", 돈가스: "🍛", 파스타: "🍝" };
