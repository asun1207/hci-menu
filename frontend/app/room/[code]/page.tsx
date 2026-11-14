"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Btn, Card, Err, Shell } from "@/components/ui";

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const { state, error, refresh } = useRoom(code, ["lobby"]);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const link = typeof window !== "undefined" ? `${location.origin}/room/${code}` : "";

  async function copy() { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  async function start() { try { await api.start(code); await refresh(); } catch (e) { setErr((e as Error).message); } }

  return (
    <Shell title={state?.name ?? "방 불러오는 중…"} sub={state ? `📍 ${state.place}` : ""}
      right={<span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white">현재 {state?.members ?? 0}명 접속 중</span>}
      footer={state?.is_host
        ? <Btn variant="pri" onClick={start}>메뉴 제안 시작하기</Btn>
        : <p className="text-center text-sm text-stone-500">방장이 시작하면 자동으로 이동해요</p>}>
      <Err msg={error || err} />
      <Card className="bg-orange-50">
        <p className="text-xs text-stone-500">초대 링크</p>
        <p className="break-all font-semibold">{link}</p>
        <button onClick={copy} className="mt-2 rounded-full border border-stone-400 bg-white px-3 py-1 text-xs">
          {copied ? "✓ 복사됨" : "링크 복사하기"}
        </button>
      </Card>
      {process.env.NODE_ENV === "development" && (
        <button className="text-xs text-stone-400 underline" onClick={async () => { await api.devFill(code); refresh(); }}>
          🧪 개발용: 데모 친구 3명 채우기
        </button>
      )}
    </Shell>
  );
}
