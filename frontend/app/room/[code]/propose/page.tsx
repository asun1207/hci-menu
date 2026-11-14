"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, won } from "@/lib/api";
import { useCountdown, useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, Notice, Shell } from "@/components/ui";

const PREF_KEY = "amugeona_pref";

export default function Propose() {
  const { code } = useParams<{ code: string }>();
  const { state, refresh } = useRoom(code, ["propose"]);
  const left = useCountdown(state?.seconds_left);
  const [text, setText] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [spicy, setSpicy] = useState(false);
  const [err, setErr] = useState("");

  const locked = !!state && (!!state.my.menu || state.my.skipped);   // 1인 1메뉴: 제출/건너뛰기 후 입력 잠금

  async function saveCond(b: number | null, s: boolean) {
    setBudget(b); setSpicy(s);
    localStorage.setItem(PREF_KEY, JSON.stringify({ b, s }));
    try { await api.conditions(code, b, s); refresh(); } catch (e) { setErr((e as Error).message); }
  }
  function loadPreset() {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{"b":10000,"s":false}');
    saveCond(p.b ?? 10000, !!p.s);
  }
  async function submit(skip: boolean) {
    try { await api.menu(code, skip ? null : text, skip); await refresh(); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { if (state) { setBudget(state.my.max_budget); setSpicy(state.my.exclude_spicy); } }, [state?.my.max_budget, state?.my.exclude_spicy]); // eslint-disable-line

  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <Shell title="메뉴 1개 제안" sub="제한 시간 안에 딱 1개만! 건너뛰어도 투표엔 참여해요."
      right={<span className={`text-2xl font-bold tabular-nums ${left <= 10 ? "text-red-600" : ""}`}>{mm}:{ss}</span>}>
      <Notice>제안 완료 {state?.proposals_done ?? 0} / {state?.members ?? 0}명 · 나는 {state?.my.menu ? "제안 완료" : state?.my.skipped ? "건너뜀" : "입력 중"}</Notice>
      <input disabled={locked} value={state?.my.menu ?? text} onChange={(e) => setText(e.target.value)} maxLength={20}
        placeholder="예: 돈가스" className="w-full rounded-xl border border-stone-300 p-3 disabled:bg-stone-100" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn disabled={locked || !text.trim()} onClick={() => submit(false)}>{state?.my.menu ? "✓ 제안 완료" : "제안하기"}</Btn>
        <Btn disabled={locked} onClick={() => submit(true)}>건너뛰기 (아무거나)</Btn>
      </div>
      <Err msg={err} />

      <Card className="mt-5">
        <b>내 조건 · 비공개</b>
        <p className="mb-2 text-xs text-stone-500">내가 설정한 조건은 익명으로 후보 필터링에만 반영되며 친구들에게 이름이 공개되지 않습니다.</p>
        <button onClick={loadPreset} className="mb-2 rounded-full border border-stone-400 px-3 py-1 text-xs">저장한 내 조건 불러오기</button>
        <select value={budget ?? ""} onChange={(e) => saveCond(e.target.value ? +e.target.value : null, spicy)}
          className="w-full rounded-xl border border-stone-300 p-3">
          <option value="">예산 제한 없음</option><option value="10000">10,000원 이하</option><option value="12000">12,000원 이하</option>
        </select>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spicy} onChange={(e) => saveCond(budget, e.target.checked)} /> 🌶 매운 음식 제외
        </label>
        {!!state?.filtered_out.length && <p className="mt-2 text-xs text-stone-500">
          자동 제외: <s>{state.filtered_out.join(", ")}</s> {state.budget ? `(예산 ${won(state.budget)} 이하)` : ""}</p>}
      </Card>
    </Shell>
  );
}
