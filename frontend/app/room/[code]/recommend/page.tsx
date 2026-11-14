"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Recommendation, won } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, Notice, Shell } from "@/components/ui";

const ICON: Record<string, string> = { "가장 가까운 곳": "📍", "평점이 높은 곳": "⭐", "가성비 좋은 곳": "💰" };

export default function Recommend() {
  const { code } = useParams<{ code: string }>();
  const { state } = useRoom(code, ["recommend"]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const run = useCallback(async (refresh = false) => {
    setLoading(true); setErr("");
    try { setRec(await api.recommend(code, refresh)); } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [code]);
  useEffect(() => { run(); }, [run]);

  async function share(name: string) {
    const text = `[${state?.name}] 오늘은 ${rec?.menu}! 추천 식당: ${name}`;
    const url = `${location.origin}/room/${code}/recommend`;
    if (navigator.share) await navigator.share({ title: "아무거나", text, url }).catch(() => {});
    else { await navigator.clipboard.writeText(`${text}\n${url}`); alert("채팅방에 붙여넣을 문구를 복사했어요!"); }
  }

  return (
    <Shell title="AI 맞춤 식당 추천"
      sub={`${state?.final_menu ?? ""} · 예산 ${state?.budget ? won(state.budget) + " 이하" : "제한 없음"} · ${state?.place ?? ""}`}
      footer={<Btn disabled={loading} onClick={() => run(true)}>AI 추천 다시 받기</Btn>}>
      <Err msg={err} />
      {loading && <Notice>AI가 조건에 맞는 식당을 찾고 있어요…</Notice>}
      {!loading && rec && !rec.grounded && <Notice>⚠️ 지도 데이터 없이 생성된 추천이에요. 가기 전에 지도에서 영업 여부를 확인하세요.</Notice>}
      {!loading && rec?.restaurants.map((r) => (
        <Card key={r.category}>
          <b>{ICON[r.category]} {r.category}</b>
          <p className="my-1 text-base font-bold">[{r.name}]</p>
          <p className="text-xs text-stone-500">{r.rating != null && `★ ${r.rating} / `}도보 {r.walk_minutes}분 / 평균 {won(r.avg_price)}</p>
          <p className="my-2 text-sm italic">“{r.reason}”</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <a className="rounded-full border border-stone-400 py-1" target="_blank" href={`https://map.kakao.com/link/search/${encodeURIComponent(r.name)}`}>카카오맵</a>
            <a className="rounded-full border border-stone-400 py-1" target="_blank" href={`https://map.naver.com/p/search/${encodeURIComponent(r.name)}`}>네이버지도</a>
            <button className="rounded-full border border-stone-400 py-1" onClick={() => share(r.name)}>공유</button>
          </div>
        </Card>
      ))}
    </Shell>
  );
}
