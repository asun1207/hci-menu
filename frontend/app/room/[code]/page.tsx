"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Badge, Btn, Card, Err, Shell, pillCls } from "@/components/ui";

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
      right={<Badge>현재 {state?.members ?? 0}명 접속 중</Badge>}
      footer={state?.is_host
        ? <Btn variant="pri" onClick={start}>메뉴 제안 시작하기</Btn>
        : <p className="text-center text-sm text-stone-500">방장이 시작하면 자동으로 이동해요</p>}>
      <Err msg={error || err} />
      <Card className="bg-orange-50">
        <p className="text-xs text-stone-500">초대 링크</p>
        <p className="break-all font-semibold">{link}</p>
        <button onClick={copy} className={`mt-2 ${pillCls}`}>
          {copied ? "✓ 복사됨" : "링크 복사하기"}
        </button>
      </Card>
    </Shell>
  );
}
