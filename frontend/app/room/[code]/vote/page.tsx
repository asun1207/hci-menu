"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api, Emoji, won } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, MENU_ICON, Shell } from "@/components/ui";

const OPTIONS: [Emoji, string][] = [["good", "👍 좋아요 (2점)"], ["soso", "😐 먹을 수 있어요 (1점)"], ["bad", "❌ 피하고 싶어요 (0점)"]];

export default function Vote() {
  const { code } = useParams<{ code: string }>();
  const { state, refresh } = useRoom(code, ["vote"]);
  const [votes, setVotes] = useState<Record<string, Emoji>>({});
  const [wild, setWild] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const cands = state?.candidates ?? [];
  const complete = cands.length > 0 && cands.every((c) => votes[c.menu]);

  function pick(menu: string, e: Emoji) {
    setVotes((v) => ({ ...v, [menu]: e }));
    if (e !== "good" && wild === menu) setWild(null);      // 와일드카드는 👍 준 메뉴에만
  }
  async function submit() {
    try { await api.vote(code, votes, wild); await refresh(); } catch (e) { setErr((e as Error).message); }
  }

  if (state?.my.voted) return (
    <Shell title="투표 완료" sub="다른 친구들을 기다리고 있어요">
      <p className="text-center text-lg">⏳ {state.votes_done} / {state.members}명 투표 완료</p>
    </Shell>
  );
  return (
    <Shell title="이모지 투표" sub="올라온 모든 메뉴에 투표해요. 누가 제안했는지는 공개되지 않아요."
      right={<span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white">{state?.members ?? 0}명 참여 중</span>}
      footer={<><Err msg={err} /><Btn variant="pri" disabled={!complete} onClick={submit}>투표 완료</Btn></>}>
      {cands.map((c) => (
        <Card key={c.menu}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-2xl">{MENU_ICON[c.menu] ?? "🍽"}</div>
            <div><b>{c.menu}</b><p className="text-xs text-stone-500">{won(c.price)}{c.walk_min != null && ` · 도보 ${c.walk_min}분`}</p></div>
          </div>
          <div className="mt-3 grid gap-2">
            {OPTIONS.map(([e, label]) => (
              <button key={e} onClick={() => pick(c.menu, e)}
                className={`rounded-xl border p-2 text-left text-sm ${votes[c.menu] === e ? "border-2 border-emerald-700 bg-emerald-50 font-semibold" : "border-stone-300"}`}>{label}</button>
            ))}
          </div>
          {votes[c.menu] === "good" && (
            <button onClick={() => setWild(wild === c.menu ? null : c.menu)}
              className={`mt-2 rounded-full border px-3 py-1 text-xs ${wild === c.menu ? "bg-zinc-900 text-white" : ""}`}>
              🃏 와일드카드 (1회) {wild === c.menu && "· +1점"}
            </button>
          )}
        </Card>
      ))}
    </Shell>
  );
}
