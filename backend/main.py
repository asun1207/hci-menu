"""아무거나 (Amugeona) FastAPI 백엔드 — 실행: uvicorn main:app --reload --port 8000"""
import os, secrets, time
from typing import Literal
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()
app = FastAPI(title="Amugeona")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])
llm = OpenAI()  # OPENAI_API_KEY 환경변수 사용

PROPOSE_SECONDS = int(os.getenv("PROPOSE_SECONDS", "60"))
SCORE = {"good": 2, "soso": 1, "bad": 0}
# 메뉴 기본 정보 (가격, 도보 분). 모르는 메뉴는 가격 미상 → 예산 필터 통과
MENU_DB = {"국밥": (9000, 3), "우동": (8500, 8), "볶음밥": (8000, 6), "돈가스": (9500, 10), "파스타": (12000, 4)}
SPICY = {"김치찌개", "떡볶이", "마라탕", "닭갈비", "불닭"}
POPULAR = ["볶음밥", "돈가스", "국밥", "우동"]   # 후보가 4개 미만이면 보충

ROOMS: dict[str, dict] = {}   # 메모리 저장소 (재시작 시 초기화) → 필요하면 SQLite/DB로 교체

# ---------- 스키마 ----------
class RoomIn(BaseModel):
    member_id: str
    name: str
    place: str

class Who(BaseModel):
    member_id: str

class CondIn(BaseModel):
    member_id: str
    max_budget: int | None = None
    exclude_spicy: bool = False

class MenuIn(BaseModel):
    member_id: str
    menu: str | None = None
    skip: bool = False

class VoteIn(BaseModel):
    member_id: str
    votes: dict[str, Literal["good", "soso", "bad"]]
    wildcard_menu: str | None = None

class CommentIn(BaseModel):
    member_id: str
    text: str

class Restaurant(BaseModel):
    category: Literal["가장 가까운 곳", "평점이 높은 곳", "가성비 좋은 곳"]
    name: str
    walk_minutes: int
    avg_price: int
    rating: float | None
    reason: str

class Recommendation(BaseModel):
    restaurants: list[Restaurant]

# ---------- 도메인 로직 ----------
def get_room(code: str) -> dict:
    if code not in ROOMS:
        raise HTTPException(404, "존재하지 않는 방이에요.")
    r = ROOMS[code]
    advance(r)
    return r

def advance(r: dict) -> None:
    """phase 자동 전환: propose → vote → result (confirm 시 recommend)"""
    if r["phase"] == "propose":
        done = set(r["menus"]) | r["skipped"]
        if time.time() > r["deadline"] or r["members"] <= done:
            r["phase"] = "vote"
    if r["phase"] == "vote" and r["members"] <= set(r["votes"]):
        r["phase"] = "result"

def info(m: str):
    return MENU_DB.get(m, (None, None))

def budget_cap(r: dict) -> int | None:
    caps = [c["max_budget"] for c in r["conds"].values() if c["max_budget"]]
    return min(caps) if caps else None

def passes(r: dict, m: str) -> bool:
    cap, price = budget_cap(r), info(m)[0]
    if cap is not None and price is not None and price > cap:
        return False
    if any(c["exclude_spicy"] for c in r["conds"].values()) and m in SPICY:
        return False
    return True

def candidates(r: dict) -> tuple[list[str], list[str]]:
    proposed = list(dict.fromkeys(r["menus"].values()))
    ok = [m for m in proposed if passes(r, m)]
    out = [m for m in proposed if not passes(r, m)]
    for m in POPULAR:
        if len(ok) < 4 and m not in ok and m not in out and passes(r, m):
            ok.append(m)
    return ok, out

def tally(r: dict) -> list[dict]:
    ok, _ = candidates(r)
    t = {m: {"menu": m, "score": 0, "good": 0, "soso": 0, "bad": 0,
             "price": info(m)[0], "walk_min": info(m)[1]} for m in ok}
    for v in r["votes"].values():
        for m, e in v.votes.items():
            if m in t:
                t[m]["score"] += SCORE[e]
                t[m][e] += 1
        if v.wildcard_menu in t and v.votes.get(v.wildcard_menu) == "good":
            t[v.wildcard_menu]["score"] += 1
    return sorted(t.values(), key=lambda x: (-x["score"], x["walk_min"] if x["walk_min"] is not None else 99))

def comparison(rank: list[dict]) -> dict | None:
    if len(rank) < 2:
        return None
    a, b = rank[0], rank[1]
    parts = []
    if a["score"] > b["score"]:
        parts.append(f"선호 점수 합산이 {a['score'] - b['score']}점 더 높고")
    if a["walk_min"] is not None and b["walk_min"] is not None and a["walk_min"] < b["walk_min"]:
        parts.append(f"이동 거리가 도보 {b['walk_min'] - a['walk_min']}분 더 가깝습니다.")
    reason = (f"{b['menu']}도 모두 먹을 수 있지만, {a['menu']}의 " + " ".join(parts)) if parts \
        else "두 메뉴의 점수와 거리가 같아 동점이에요."
    return {"first": a, "second": b, "reason": reason}

# ---------- API ----------
@app.post("/api/rooms")
def create_room(b: RoomIn):
    code = secrets.token_urlsafe(4).replace("_", "x").replace("-", "y")
    ROOMS[code] = {"name": b.name, "place": b.place, "host": b.member_id, "phase": "lobby",
                   "members": {b.member_id}, "menus": {}, "skipped": set(), "conds": {},
                   "votes": {}, "comments": [], "deadline": 0.0, "final": None, "rec": None}
    return {"code": code}

@app.post("/api/rooms/{code}/join")
def join(code: str, b: Who):
    r = get_room(code)
    r["members"].add(b.member_id)
    return {"ok": True}

@app.get("/api/rooms/{code}/state")
def state(code: str, member_id: str):
    r = get_room(code)
    ok, out = candidates(r)
    cond = r["conds"].get(member_id, {})
    return {
        "name": r["name"], "place": r["place"], "phase": r["phase"],
        "is_host": r["host"] == member_id, "members": len(r["members"]),
        "seconds_left": max(0, int(r["deadline"] - time.time())) if r["phase"] == "propose" else None,
        "proposals_done": len(set(r["menus"]) | r["skipped"]), "votes_done": len(r["votes"]),
        "candidates": [{"menu": m, "price": info(m)[0], "walk_min": info(m)[1]} for m in ok],
        "filtered_out": out, "final_menu": r["final"], "budget": budget_cap(r),
        "my": {"menu": r["menus"].get(member_id), "skipped": member_id in r["skipped"],
               "voted": member_id in r["votes"], "max_budget": cond.get("max_budget"),
               "exclude_spicy": cond.get("exclude_spicy", False)},
    }

@app.post("/api/rooms/{code}/start")
def start(code: str, b: Who):
    r = get_room(code)
    if r["host"] != b.member_id:
        raise HTTPException(403, "방장만 시작할 수 있어요.")
    if r["phase"] == "lobby":
        r["phase"], r["deadline"] = "propose", time.time() + PROPOSE_SECONDS
    return {"ok": True}

@app.post("/api/rooms/{code}/conditions")
def set_conditions(code: str, b: CondIn):
    r = get_room(code)
    if r["phase"] not in ("lobby", "propose"):
        raise HTTPException(409, "조건은 메뉴 제안 단계에서만 바꿀 수 있어요.")
    r["conds"][b.member_id] = {"max_budget": b.max_budget, "exclude_spicy": b.exclude_spicy}
    return {"ok": True}

@app.post("/api/rooms/{code}/menu")
def propose(code: str, b: MenuIn):
    r = get_room(code)
    if r["phase"] != "propose":
        raise HTTPException(409, "제한 시간이 끝났어요. 투표에는 계속 참여할 수 있어요.")
    if b.member_id in r["menus"] or b.member_id in r["skipped"]:
        raise HTTPException(409, "메뉴는 1인 1개만 제안할 수 있어요.")
    if b.skip or not (b.menu and b.menu.strip()):
        r["skipped"].add(b.member_id)            # 제안 권한만 포기, 투표는 가능
    else:
        r["menus"][b.member_id] = b.menu.strip()[:20]
    advance(r)
    return {"ok": True}

@app.post("/api/rooms/{code}/vote")
def vote(code: str, b: VoteIn):
    r = get_room(code)
    if r["phase"] != "vote":
        raise HTTPException(409, "지금은 투표 단계가 아니에요.")
    ok, _ = candidates(r)
    if set(b.votes) != set(ok):
        raise HTTPException(400, "모든 후보에 투표해 주세요.")
    if b.wildcard_menu and b.votes.get(b.wildcard_menu) != "good":
        raise HTTPException(400, "와일드카드는 👍 준 메뉴에만 쓸 수 있어요.")
    r["votes"][b.member_id] = b       # 같은 사람이 다시 보내면 덮어씀 → 와일드카드 1회 보장
    advance(r)
    return {"ok": True}

@app.get("/api/rooms/{code}/result")
def result(code: str):
    r = get_room(code)
    if r["phase"] not in ("result", "recommend"):
        raise HTTPException(409, "아직 투표가 끝나지 않았어요.")
    rank = tally(r)                   # 개인별 선택은 절대 반환하지 않음(익명)
    tie = len(rank) > 1 and rank[0]["score"] == rank[1]["score"]
    return {"ranking": rank, "tie": tie, "comparison": comparison(rank),
            "comments": r["comments"], "budget": budget_cap(r)}

@app.post("/api/rooms/{code}/comments")
def comment(code: str, b: CommentIn):
    r = get_room(code)
    if r["phase"] != "result":
        raise HTTPException(409, "결과 단계에서만 의견을 남길 수 있어요.")
    r["comments"].append(b.text.strip()[:60])   # 작성자 정보는 저장하지 않음
    return {"ok": True}

@app.post("/api/rooms/{code}/confirm")
def confirm(code: str, b: Who):
    r = get_room(code)
    if r["host"] != b.member_id:
        raise HTTPException(403, "방장만 확정할 수 있어요.")
    if r["phase"] == "result":
        r["final"], r["phase"] = tally(r)[0]["menu"], "recommend"
    return {"final": r["final"]}

def kakao_places(place: str, menu: str) -> list[dict]:
    """실제 식당 후보. 키가 없으면 빈 리스트(LLM 일반 지식 의존). 카카오는 평점/가격을 제공하지 않음."""
    key = os.getenv("KAKAO_REST_KEY")
    if not key:
        return []
    h, url = {"Authorization": f"KakaoAK {key}"}, "https://dapi.kakao.com/v2/local/search/keyword.json"
    try:
        with httpx.Client(timeout=5) as c:
            geo = c.get(url, headers=h, params={"query": place, "size": 1}).json()["documents"]
            if not geo:
                return []
            docs = c.get(url, headers=h, params={"query": menu, "x": geo[0]["x"], "y": geo[0]["y"],
                                                 "radius": 1500, "sort": "distance", "size": 10}).json()["documents"]
        return [{"name": d["place_name"], "distance_m": int(d["distance"]), "address": d["road_address_name"]} for d in docs]
    except Exception:
        return []

@app.post("/api/rooms/{code}/recommend")
def recommend(code: str, refresh: bool = False):
    r = get_room(code)
    if r["phase"] != "recommend":
        raise HTTPException(409, "메뉴가 아직 확정되지 않았어요.")
    if r["rec"] and not refresh:
        return r["rec"]
    rank = tally(r)
    top, cmp_ = rank[0], comparison(rank)
    places = kakao_places(r["place"], top["menu"])
    system = ("너는 대학생 그룹의 점심 식당 추천 도우미야. 제공된 '후보 식당 목록' 안에서만 고르고, 목록에 없는 "
              "식당·평점·가격을 지어내지 마. 값을 모르면 rating은 null, 가격은 메뉴 평균가로 추정하되 reason에 '추정'이라고 적어. "
              "각 reason은 투표 결과(점수, 👍 인원, 거리, 예산)를 근거로 한 한국어 한 문장으로 써.")
    user = {"최종 메뉴": top["menu"], "예산 상한(원)": budget_cap(r), "현재 위치": r["place"],
            "투표 요약": {"점수": top["score"], "👍": top["good"], "😐": top["soso"], "❌": top["bad"],
                          "비교": cmp_["reason"] if cmp_ else None},
            "후보 식당 목록": places or "없음 (일반 지식으로 추천하되 불확실하면 reason에 밝혀)",
            "요청": "가장 가까운 곳 / 평점이 높은 곳 / 가성비 좋은 곳 각 1곳"}
    try:
        res = llm.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": str(user)}],
            response_format=Recommendation)
    except Exception as e:
        raise HTTPException(502, f"LLM 호출 실패: {e}")
    parsed = res.choices[0].message.parsed
    if parsed is None:
        raise HTTPException(502, "LLM이 답변을 거절했어요.")
    r["rec"] = {"menu": top["menu"], "grounded": bool(places), **parsed.model_dump()}
    return r["rec"]

@app.post("/api/rooms/{code}/dev/fill")
def dev_fill(code: str):
    """데모용: 친구 3명(제안 국밥/우동/파스타 + 스토리보드 3 투표)을 자동 참여시킴"""
    if os.getenv("DEV", "1") != "1":
        raise HTTPException(404)
    r = get_room(code)
    others = {"국밥": "GGG", "우동": "SSG", "볶음밥": "GGX", "돈가스": "GXX", "파스타": "GSS"}
    e = {"G": "good", "S": "soso", "X": "bad"}
    for i, (bot, menu) in enumerate(zip(["bot1", "bot2", "bot3"], ["국밥", "우동", "파스타"])):
        r["members"].add(bot)
        r["menus"].setdefault(bot, menu)
        r["votes"][bot] = VoteIn(member_id=bot, votes={m: e[s[i]] for m, s in others.items()})
    return {"ok": True}
