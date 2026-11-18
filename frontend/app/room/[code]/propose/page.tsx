"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, won } from "@/lib/api";
import { useCountdown, useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, Notice, Shell } from "@/components/ui";

const PREF_KEY = "amugeona_pref";
// 조건 선택 창에 미리 적어 둔 예시 조건 (탭하면 켜짐/꺼짐)
const PRESET_TAGS = ["매운", "해산물", "국물", "튀김", "고기", "밀가루"];

export default function Propose() {
  const { code } = useParams<{ code: string }>();
  const { state, refresh } = useRoom(code, ["propose"]);
  const left = useCountdown(state?.seconds_left);
  const [text, setText] = useState("");
  const [budget, setBudget] = useState("");          // 직접 입력 (빈 값 = 제한 없음)
  const [tags, setTags] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const locked = !!state && (!!state.my.menu || state.my.skipped);

  async function save(b: string, t: string[]) {
    const n = b ? parseInt(b.replace(/\D/g, ""), 10) : null;
    try {
      await api.conditions(code, n && n > 0 ? n : null, t);
      localStorage.setItem(PREF_KEY, JSON.stringify({ b, t }));
      setSaved(true); setErr(""); refresh();
    } catch (e) { setErr((e as Error).message); }
  }
  function toggle(tag: string) {
    const next = tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag];
    setTags(next); save(budget, next);
  }
  function addCustom() {
    const v = custom.trim();
    if (!v || tags.includes(v)) return;
    const next = [...tags, v]; setTags(next); setCustom(""); save(budget, next);
  }
  function loadPreset() {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{"b":"10000","t":[]}');
    setBudget(p.b ?? ""); setTags(p.t ?? []); save(p.b ?? "", p.t ?? []);
  }
  async function submit(skip: boolean) {
    try { await api.menu(code, skip ? null : text, skip); await refresh(); } catch (e) { setErr((e as Error).message); }
  }
  // 새로고침해도 내가 저장한 조건 유지
  useEffect(() => {
    if (!state) return;
    if (state.my.max_budget != null) setBudget(String(state.my.max_budget));
    if (state.my.excluded_tags.length) setTags(state.my.excluded_tags);
  }, [state?.my.max_budget, state?.my.excluded_tags.join(",")]); // eslint-disable-line

  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-stone-300"}`;
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
        <button onClick={loadPreset} className="mb-3 rounded-full border border-stone-400 px-3 py-1 text-xs">저장한 내 조건 불러오기</button>

        <label className="mb-1 block text-xs text-stone-500">예산 상한 (원)</label>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" value={budget} placeholder="예: 10000 (비우면 제한 없음)"
            onChange={(e) => { setBudget(e.target.value.replace(/\D/g, "")); setSaved(false); }}
            onBlur={() => save(budget, tags)}
            className="w-full rounded-xl border border-stone-300 p-3" />
          <span className="whitespace-nowrap text-sm">원 이하</span>
        </div>
        <div className="mt-2 flex gap-2">
          {[8000, 10000, 12000].map((n) => (
            <button key={n} className={chip(budget === String(n))} onClick={() => { setBudget(String(n)); save(String(n), tags); }}>{n.toLocaleString()}원</button>
          ))}
        </div>

        <label className="mb-1 mt-4 block text-xs text-stone-500">피하고 싶은 것 (눌러서 선택)</label>
        <div className="flex flex-wrap gap-2">
          {[...PRESET_TAGS, ...tags.filter((t) => !PRESET_TAGS.includes(t))].map((t) => (
            <button key={t} className={chip(tags.includes(t))} onClick={() => toggle(t)}>{t}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()}
            maxLength={10} placeholder="직접 입력 (예: 오이, 우동)" className="w-full rounded-xl border border-stone-300 p-2 text-sm" />
          <button className="whitespace-nowrap rounded-xl border border-stone-400 px-3 text-sm" onClick={addCustom}>추가</button>
        </div>
        <p className="mt-2 text-xs text-stone-500">{saved ? "✓ 저장됨 · " : ""}메뉴 이름을 써도 그 메뉴가 후보에서 빠져요.</p>
        {!!state?.filtered_out.length && <p className="mt-1 text-xs text-stone-500">
          자동 제외: <s>{state.filtered_out.join(", ")}</s></p>}
        {state?.budget ? <p className="text-xs text-stone-500">현재 방 예산 상한: {won(state.budget)}</p> : null}
      </Card>
    </Shell>
  );
}
