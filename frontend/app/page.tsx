"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Btn, Err, Shell } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("HCI 팀플 점심");
  const [place, setPlace] = useState("숭실대 정문");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try { const { code } = await api.createRoom(name, place); router.push(`/room/${code}`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const input = "w-full rounded-xl border border-stone-300 p-3";
  return (
    <Shell title="아무거나" sub="눈치 보지 않고 함께 메뉴를 정해요"
      footer={<Btn variant="pri" disabled={busy || !name || !place} onClick={create}>방 만들기 &amp; 초대 링크 생성</Btn>}>
      <label className="mb-1 block text-xs text-stone-500">모임 이름</label>
      <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mb-1 mt-4 block text-xs text-stone-500">현재 위치</label>
      <input className={input} value={place} onChange={(e) => setPlace(e.target.value)} />
      <Err msg={err} />
    </Shell>
  );
}
