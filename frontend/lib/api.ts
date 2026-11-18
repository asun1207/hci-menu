export type Emoji = "good" | "soso" | "bad";
export type Phase = "lobby" | "propose" | "vote" | "result" | "recommend";

export interface Candidate { menu: string; price: number | null; walk_min: number | null }
export interface RoomState {
  name: string; place: string; phase: Phase; is_host: boolean; members: number;
  seconds_left: number | null; proposals_done: number; votes_done: number;
  candidates: Candidate[]; filtered_out: string[]; final_menu: string | null; budget: number | null;
  my: { menu: string | null; skipped: boolean; voted: boolean; max_budget: number | null; excluded_tags: string[] };
}
export interface Ranked extends Candidate { score: number; good: number; soso: number; bad: number }
export interface ResultData {
  ranking: Ranked[]; tie: boolean; comments: string[]; budget: number | null;
  comparison: { first: Ranked; second: Ranked; reason: string } | null;
}
export interface Restaurant {
  category: string; name: string; walk_minutes: number; avg_price: number | null; rating: number | null; reason: string; url?: string | null;
}
export interface Recommendation { menu: string; mode: "rules" | "llm"; grounded: boolean; restaurants: Restaurant[] }

// 이름 대신 브라우저마다 만드는 익명 토큰 (시크릿 창 = 다른 사람으로 테스트 가능)
export function memberId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("amugeona_mid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("amugeona_mid", id); }
  return id;
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "요청에 실패했어요.");
  return res.json();
}

const R = (code: string) => `/rooms/${code}`;
export const api = {
  createRoom: (name: string, place: string) => call<{ code: string }>("/rooms", "POST", { member_id: memberId(), name, place }),
  join: (code: string) => call(`${R(code)}/join`, "POST", { member_id: memberId() }),
  state: (code: string) => call<RoomState>(`${R(code)}/state?member_id=${memberId()}`),
  start: (code: string) => call(`${R(code)}/start`, "POST", { member_id: memberId() }),
  conditions: (code: string, max_budget: number | null, excluded_tags: string[]) =>
    call(`${R(code)}/conditions`, "POST", { member_id: memberId(), max_budget, excluded_tags }),
  menu: (code: string, menu: string | null, skip = false) =>
    call(`${R(code)}/menu`, "POST", { member_id: memberId(), menu, skip }),
  vote: (code: string, votes: Record<string, Emoji>, wildcard_menu: string | null) =>
    call(`${R(code)}/vote`, "POST", { member_id: memberId(), votes, wildcard_menu }),
  result: (code: string) => call<ResultData>(`${R(code)}/result`),
  comment: (code: string, text: string) => call(`${R(code)}/comments`, "POST", { member_id: memberId(), text }),
  confirm: (code: string) => call(`${R(code)}/confirm`, "POST", { member_id: memberId() }),
  recommend: (code: string, refresh = false) => call<Recommendation>(`${R(code)}/recommend?refresh=${refresh}`, "POST"),
};

export const won = (n: number | null) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");
