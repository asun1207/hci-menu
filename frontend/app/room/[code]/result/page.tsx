"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ResultData } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, MENU_ICON, Shell } from "@/components/ui";

export default function Result() {
  const { code } = useParams<{ code: string }>();
  const { state } = useRoom(code, ["result"]);
  const [data, setData] = useState<ResultData | null>(null);
  const [modal, setModal] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.result(code).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [code]);   // eslint-disable-line

  async function confirm() { try { await api.confirm(code); } catch (e) { setErr((e as Error).message); } }  // 이후 훅이 recommend로 이동
  async function addComment() { if (!text.trim()) return; await api.comment(code, text); setText(""); load(); }

  const top = data?.ranking[0];
  const max = Math.max(8, top?.score ?? 0);
  return (
    <Shell title="익명 합산 결과" sub="누가 무엇을 눌렀는지는 공개되지 않아요."
      right={<span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white">{state?.votes_done ?? 0}명 투표 완료</span>}
      footer={<>
        <Err msg={err} />
        <Link href={`/room/${code}/compare`} className="block rounded-xl border-2 border-zinc-800 p-3 text-center font-semibold">투표 결과 조건 비교 &gt;</Link>
        {state?.is_host
          ? <Btn variant="green" onClick={confirm}>최종 메뉴 &lsquo;{top?.menu}&rsquo; 확정 &amp; AI 식당 추천받기 &gt;</Btn>
          : <p className="text-center text-xs text-stone-500">방장이 확정하면 자동으로 이동해요</p>}
      </>}>
      {top && <div className="mb-3 rounded-2xl bg-zinc-900 p-4 text-white">
        <p className="text-sm opacity-70">1위 {MENU_ICON[top.menu]} {top.menu}</p><p className="text-5xl font-bold">{top.score}점</p></div>}
      {data?.ranking.map((r, i) => (
        <Card key={r.menu}>
          <div className="flex justify-between"><b>{i + 1}위 {r.menu}</b><b>{r.score}점</b></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-emerald-700" style={{ width: `${(r.score / max) * 100}%` }} /></div>
        </Card>
      ))}
      <Btn onClick={() => setModal(true)}>{data?.tie ? "동점이에요! " : ""}마지막 한 마디 (익명)</Btn>
      {modal && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/50 p-5" onClick={() => setModal(false)}>
          <div className="w-full max-w-[350px] rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <b>마지막 한 마디</b>
            <div className="my-3 space-y-2">{data?.comments.length ? data.comments.map((c, i) => <p key={i} className="rounded-xl bg-orange-50 p-2 text-sm">“{c}”</p>) : <p className="text-sm text-stone-500">아직 의견이 없어요.</p>}</div>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="마지막 한 마디 (익명)" className="w-full rounded-xl border border-stone-300 p-2" />
            <div className="mt-2 grid grid-cols-2 gap-2"><Btn variant="pri" onClick={addComment}>남기기</Btn><Btn onClick={() => setModal(false)}>닫기</Btn></div>
          </div>
        </div>
      )}
    </Shell>
  );
}
