"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api, Emoji, won } from "@/lib/api";
import { useCountdown, useRoom } from "@/lib/useRoom";
import { Btn, Card, Chip, Err, MENU_ICON, Shell } from "@/components/ui";

// 이모지 옆 점수 표기는 제거 (점수 체계는 그대로 👍2 / 😐1 / ❌0)
const OPTIONS: [Emoji, string][] = [["good", "👍 좋아요"], ["soso", "😐 먹을 수 있어요"], ["bad", "❌ 피하고 싶어요"]];
// 선택 색: 좋아요=초록, 보통=노랑, 피하고 싶어요=빨강 (모두 연한 배경 + 진한 글씨)
const PICKED: Record<Emoji, string> = {
  good: "border-emerald-700 bg-emerald-50 !text-emerald-800",
  soso: "border-amber-500 bg-amber-50 !text-amber-800",
  bad: "border-red-500 bg-red-50 !text-red-700",
};

export default function Vote() {
  const { code } = useParams<{ code: string }>();
  const { state, refresh } = useRoom(code, ["vote"]);
  const left = useCountdown(state?.seconds_left);
  const [votes, setVotes] = useState<Record<string, Emoji>>({});
  const [wild, setWild] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const cands = state?.candidates ?? [];
  const complete = cands.length > 0 && cands.every((c) => votes[c.menu]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const timer = <span className={`text-2xl font-bold tabular-nums ${left <= 10 ? "text-red-600" : ""}`}>{mm}:{ss}</span>;

  function pick(menu: string, e: Emoji) {
    setVotes((v) => ({ ...v, [menu]: e }));
    if (e === "soso" && wild === menu) setWild(null);     // 와일드카드는 👍(+1) 또는 ❌(-1) 준 메뉴에만
  }
  async function submit() {
    try { await api.vote(code, votes, wild); await refresh(); } catch (e) { setErr((e as Error).message); }
  }

  if (state?.my.voted) return (
    <Shell title="투표 완료" sub="다른 친구들을 기다리고 있어요" right={timer}>
      <p className="text-center text-lg">⏳ {state.votes_done} / {state.members}명 투표 완료</p>
    </Shell>
  );
  return (
    <Shell title="이모지 투표" sub="올라온 모든 메뉴에 투표해요. 시간이 끝나면 투표한 사람 기준으로 집계돼요."
      right={timer}
      footer={<><Err msg={err} /><Btn variant="pri" disabled={!complete} onClick={submit}>{complete ? "투표 완료" : `${Object.keys(votes).length} / ${cands.length}개 투표함`}</Btn></>}>
      {cands.map((c) => (
        <Card key={c.menu}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-2xl">{MENU_ICON[c.menu] ?? "🍽"}</div>
            <div><b>{c.menu}</b><p className="text-xs text-stone-500">{won(c.price)}{c.walk_min != null && ` · 도보 ${c.walk_min}분`}</p></div>
          </div>
          <div className="mt-3 grid gap-2">
            {OPTIONS.map(([e, label]) => (
              <button key={e} onClick={() => pick(c.menu, e)}
                className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm transition duration-150 active:scale-[0.98] ${votes[c.menu] === e ? `am-pop font-semibold ${PICKED[e]}` : "border-stone-200 bg-white !text-zinc-800 hover:border-stone-400"}`}>
                <span>{label}</span>{votes[c.menu] === e && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
          {(votes[c.menu] === "good" || votes[c.menu] === "bad") && (
            <Chip on={wild === c.menu} className="mt-2" onClick={() => setWild(wild === c.menu ? null : c.menu)}>
              🃏 와일드카드 (1회) {wild === c.menu ? (votes[c.menu] === "good" ? "· 좋아요 +1" : "· 피하고 싶어요 -1") : ""}
            </Chip>
          )}
        </Card>
      ))}
    </Shell>
  );
}
