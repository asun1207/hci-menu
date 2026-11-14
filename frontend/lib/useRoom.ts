"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Phase, RoomState } from "./api";

const PATH: Record<Phase, string> = { lobby: "", propose: "/propose", vote: "/vote", result: "/result", recommend: "/recommend" };

/** 방 상태를 1.5초마다 가져오고, 현재 phase가 이 페이지의 허용 phase가 아니면 알맞은 페이지로 자동 이동 */
export function useRoom(code: string, allowed: Phase[]) {
  const router = useRouter();
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const allowedRef = useRef(allowed);

  const refresh = useCallback(async () => {
    try {
      const s = await api.state(code);
      setState(s); setError("");
      if (!allowedRef.current.includes(s.phase)) router.replace(`/room/${code}${PATH[s.phase]}`);
    } catch (e) { setError((e as Error).message); }
  }, [code, router]);

  useEffect(() => {
    api.join(code).catch((e) => setError(e.message)).finally(refresh);
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [code, refresh]);

  return { state, error, refresh };
}

/** 서버가 준 남은 초를 화면에서 부드럽게 카운트다운 */
export function useCountdown(secondsLeft: number | null | undefined) {
  const [left, setLeft] = useState(secondsLeft ?? 0);
  const target = useRef(0);
  useEffect(() => {
    if (secondsLeft == null) return;
    target.current = Date.now() + secondsLeft * 1000;
  }, [secondsLeft]);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((target.current - Date.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, []);
  return left;
}
