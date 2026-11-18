"""아무거나 (Amugeona) FastAPI 백엔드
로컬 실행: uvicorn main:app --reload --port 8000
배포 실행: uvicorn main:app --host 0.0.0.0 --port $PORT
"""
import json, logging, os, secrets, time
from typing import Literal

import httpx
from dotenv import load_dotenv

load_dotenv()  # 아래에서 환경변수를 읽기 전에 먼저 실행

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

log = logging.getLogger("amugeona")

# ---------- 설정 (환경변수) ----------
PROPOSE_SECONDS = int(os.getenv("PROPOSE_SECONDS", "60"))
VOTE_SECONDS = int(os.getenv("VOTE_SECONDS", "60"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
ROOM_TTL = 6 * 3600        # 방은 6시간 뒤 삭제 (메모리 보호)
MAX_MEMBERS = 12
REC_COOLDOWN = 10          # '추천 다시 받기' 최소 간격(초) — Gemini 무료 한도 보호

app = FastAPI(title="Amugeona")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

SCORE = {"good": 2, "soso": 1, "bad": 0}
# 메뉴 기본 정보 (가격, 도보 분). 목록에 없는 메뉴는 가격 미상 → 예산 필터를 통과
MENU_DB = {"국밥": (9000, 3), "우동": (8500, 8), "볶음밥": (8000, 6), "돈가스": (9500, 10), "파스타": (12000, 4)}
SPICY = {"김치찌개", "떡볶이", "마라탕", "닭갈비", "불닭"}
# 비공개 '피하고 싶은 조건' 태그. 목록에 없는 메뉴는 태그 없음으로 취급
TAGS = {"국밥": {"국물", "고기"}, "우동": {"국물", "밀가루"}, "볶음밥": set(),
        "돈가스": {"튀김", "고기"}, "파스타": {"밀가루"}}
POPULAR = ["볶음밥", "돈가스", "국밥", "우동"]   # 후보가 4개 미만이면 보충

ROOMS: dict[str, dict] = {}   # 메모리 저장소: 서버가 재시작되면 방이 사라짐

# ---------- 스키마 ----------
MemberId = Field(min_length=8, max_length=64)

class RoomIn(BaseModel):
    member_id: str = MemberId
    name: str
    place: str

class Who(BaseModel):
    member_id: str = MemberId

class CondIn(BaseModel):
    member_id: str = MemberId
    max_budget: int | None = None
    excluded_tags: list[str] = []   # 태그("매운","국물"…) 또는 메뉴 이름

class MenuIn(BaseModel):
    member_id: str = MemberId
    menu: str | None = None
    skip: bool = False

class VoteIn(BaseModel):
    member_id: str = MemberId
    votes: dict[str, Literal["good", "soso", "bad"]]
    wildcard_menu: str | None = None

class CommentIn(BaseModel):
    member_id: str = MemberId
    text: str

class Pick(BaseModel):          # Gemini가 돌려주는 구조 (식당 이름은 후보 목록에서만)
    category: Literal["가장 가까운 곳", "검색 인기 있는 곳", "조금 더 걸으면"]
    name: str
    reason: str

class Picks(BaseModel):
    picks: list[Pick]

# ---------- 도메인 로직 ----------
def purge() -> None:
    now = time.time()
    for code in [c for c, r in ROOMS.items() if now - r["created"] > ROOM_TTL]:
        del ROOMS[code]

def get_room(code: str) -> dict:
    r = ROOMS.get(code)
    if r is None:
        raise HTTPException(404, "존재하지 않거나 만료된 방이에요. 새 방을 만들어 주세요.")
    advance(r)
    return r

def advance(r: dict) -> None:
    """단계 자동 전환: propose → vote → result (확정하면 recommend)"""
    if r["phase"] == "propose":
        done = set(r["menus"]) | r["skipped"]
        if time.time() > r["deadline"] or r["members"] <= done:
            r["phase"], r["vote_deadline"] = "vote", time.time() + VOTE_SECONDS
    if r["phase"] == "vote" and (r["members"] <= set(r["votes"]) or time.time() > r["vote_deadline"]):
        r["phase"] = "result"      # 모두 투표했거나 시간이 끝나면 종료 (미투표자는 집계에서 제외)

def info(m: str):
    return MENU_DB.get(m, (None, None))

def budget_cap(r: dict) -> int | None:
    caps = [c["max_budget"] for c in r["conds"].values() if c["max_budget"]]
    return min(caps) if caps else None

def passes(r: dict, m: str) -> bool:
    cap, price = budget_cap(r), info(m)[0]
    if cap is not None and price is not None and price > cap:
        return False
    banned = {t for c in r["conds"].values() for t in c["excluded_tags"]}
    tags = TAGS.get(m, set()) | ({"매운"} if m in SPICY else set())
    return not (banned & tags) and m not in banned

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
        if v.wildcard_menu in t:        # 👍엔 +1, ❌엔 -1 (1회)
            e = v.votes.get(v.wildcard_menu)
            t[v.wildcard_menu]["score"] += 1 if e == "good" else -1 if e == "bad" else 0
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

# ---------- API (빠른 처리는 async: 이벤트 루프에서 순차 실행되어 동시 수정 충돌이 없음) ----------
@app.get("/healthz")
async def healthz():
    return {"ok": True, "rooms": len(ROOMS)}

@app.post("/api/rooms")
async def create_room(b: RoomIn):
    name, place = b.name.strip()[:30], b.place.strip()[:50]
    if not name or not place:
        raise HTTPException(400, "모임 이름과 위치를 입력해 주세요.")
    purge()
    code = secrets.token_urlsafe(4).replace("_", "x").replace("-", "y")
    ROOMS[code] = {"name": name, "place": place, "host": b.member_id, "phase": "lobby", "created": time.time(),
                   "members": {b.member_id}, "menus": {}, "skipped": set(), "conds": {}, "votes": {},
                   "comments": [], "deadline": 0.0, "vote_deadline": 0.0, "final": None, "rec": None, "rec_at": 0.0}
    return {"code": code}

@app.post("/api/rooms/{code}/join")
async def join(code: str, b: Who):
    r = get_room(code)
    if b.member_id not in r["members"] and len(r["members"]) >= MAX_MEMBERS:
        raise HTTPException(409, f"방이 가득 찼어요 (최대 {MAX_MEMBERS}명).")
    r["members"].add(b.member_id)
    return {"ok": True}

@app.get("/api/rooms/{code}/state")
async def state(code: str, member_id: str):
    r = get_room(code)
    ok, out = candidates(r)
    cond = r["conds"].get(member_id, {})
    return {
        "name": r["name"], "place": r["place"], "phase": r["phase"],
        "is_host": r["host"] == member_id, "members": len(r["members"]),
        "seconds_left": (max(0, int(r["deadline"] - time.time())) if r["phase"] == "propose"
                         else max(0, int(r["vote_deadline"] - time.time())) if r["phase"] == "vote" else None),
        "proposals_done": len(set(r["menus"]) | r["skipped"]), "votes_done": len(r["votes"]),
        "candidates": [{"menu": m, "price": info(m)[0], "walk_min": info(m)[1]} for m in ok],
        "filtered_out": out, "final_menu": r["final"], "budget": budget_cap(r),
        "my": {"menu": r["menus"].get(member_id), "skipped": member_id in r["skipped"],
               "voted": member_id in r["votes"], "max_budget": cond.get("max_budget"),
               "excluded_tags": cond.get("excluded_tags", [])},
    }

@app.post("/api/rooms/{code}/start")
async def start(code: str, b: Who):
    r = get_room(code)
    if r["host"] != b.member_id:
        raise HTTPException(403, "방장만 시작할 수 있어요.")
    if r["phase"] == "lobby":
        r["phase"], r["deadline"] = "propose", time.time() + PROPOSE_SECONDS
    return {"ok": True}

@app.post("/api/rooms/{code}/conditions")
async def set_conditions(code: str, b: CondIn):
    r = get_room(code)
    if r["phase"] not in ("lobby", "propose"):
        raise HTTPException(409, "조건은 메뉴 제안 단계에서만 바꿀 수 있어요.")
    if b.max_budget is not None and not (1000 <= b.max_budget <= 100000):
        raise HTTPException(400, "예산은 1,000원 ~ 100,000원 사이로 입력해 주세요.")
    tags = list(dict.fromkeys(t.strip()[:10] for t in b.excluded_tags if t.strip()))[:10]
    r["conds"][b.member_id] = {"max_budget": b.max_budget, "excluded_tags": tags}
    return {"ok": True}

@app.post("/api/rooms/{code}/menu")
async def propose(code: str, b: MenuIn):
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
async def vote(code: str, b: VoteIn):
    r = get_room(code)
    if r["phase"] != "vote":
        raise HTTPException(409, "지금은 투표 단계가 아니에요.")
    ok, _ = candidates(r)
    if set(b.votes) != set(ok):
        raise HTTPException(400, "모든 후보에 투표해 주세요.")
    if b.wildcard_menu and b.votes.get(b.wildcard_menu) not in ("good", "bad"):
        raise HTTPException(400, "와일드카드는 👍 또는 ❌ 준 메뉴에만 쓸 수 있어요.")
    r["votes"][b.member_id] = b       # 같은 사람이 다시 보내면 덮어씀 → 와일드카드 1회 보장
    advance(r)
    return {"ok": True}

@app.get("/api/rooms/{code}/result")
async def result(code: str):
    r = get_room(code)
    if r["phase"] not in ("result", "recommend"):
        raise HTTPException(409, "아직 투표가 끝나지 않았어요.")
    rank = tally(r)                   # 개인별 선택은 절대 반환하지 않음(익명)
    tie = len(rank) > 1 and rank[0]["score"] == rank[1]["score"]
    return {"ranking": rank, "tie": tie, "comparison": comparison(rank),
            "comments": r["comments"], "budget": budget_cap(r)}

@app.post("/api/rooms/{code}/comments")
async def comment(code: str, b: CommentIn):
    r = get_room(code)
    if r["phase"] != "result":
        raise HTTPException(409, "결과 단계에서만 의견을 남길 수 있어요.")
    text = b.text.strip()[:60]
    if not text:
        raise HTTPException(400, "내용을 입력해 주세요.")
    if len(r["comments"]) >= 30:
        raise HTTPException(409, "의견은 최대 30개까지 남길 수 있어요.")
    r["comments"].append(text)        # 작성자 정보는 저장하지 않음
    return {"ok": True}

@app.post("/api/rooms/{code}/confirm")
async def confirm(code: str, b: Who):
    r = get_room(code)
    if r["host"] != b.member_id:
        raise HTTPException(403, "방장만 확정할 수 있어요.")
    if r["phase"] == "result":
        rank = tally(r)
        if not rank:
            raise HTTPException(409, "후보가 없어요. 조건을 완화해 다시 시도해 주세요.")
        r["final"], r["phase"] = rank[0]["menu"], "recommend"
    return {"final": r["final"]}

# ---------- 식당 추천: 카카오 로컬 검색 + Gemini (실패 시 규칙 기반) ----------
def kakao_search(place: str, menu: str) -> tuple[list[dict], list[dict]]:
    """위치명 → 좌표 → 메뉴 주변 식당. (거리순, 정확도순) 반환. 카카오는 평점·가격을 제공하지 않음."""
    key = os.getenv("KAKAO_REST_KEY")
    if not key:
        raise HTTPException(503, "서버에 KAKAO_REST_KEY가 설정되지 않았어요.")
    h, url = {"Authorization": f"KakaoAK {key}"}, "https://dapi.kakao.com/v2/local/search/keyword.json"

    def get(params: dict) -> list[dict]:
        try:
            res = httpx.get(url, headers=h, params=params, timeout=5)
        except httpx.HTTPError:
            raise HTTPException(502, "카카오 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.")
        if res.status_code == 429:
            raise HTTPException(502, "카카오 API 무료 사용량을 초과했어요.")
        if res.status_code != 200:
            log.error("kakao %s %s", res.status_code, res.text[:200])
            raise HTTPException(502, f"카카오 API 오류({res.status_code}). 앱 키 종류와 [카카오맵] 사용 설정을 확인하세요.")
        return res.json()["documents"]

    geo = get({"query": place, "size": 1})
    if not geo:
        raise HTTPException(404, f"'{place}' 위치를 찾지 못했어요. 카카오맵에서 검색되는 이름으로 방을 만들어 주세요.")
    base = {"query": menu, "x": geo[0]["x"], "y": geo[0]["y"], "radius": 1500, "category_group_code": "FD6", "size": 10}

    def conv(docs):
        return [{"name": d["place_name"], "distance_m": int(d["distance"] or 0),
                 "address": d["road_address_name"], "url": d["place_url"]} for d in docs]

    near, best = conv(get({**base, "sort": "distance"})), conv(get({**base, "sort": "accuracy"}))
    if not near:
        raise HTTPException(404, f"'{place}' 근처 1.5km 안에서 '{menu}' 식당을 찾지 못했어요.")
    return near, best

def card(cat: str, p: dict, why: str) -> dict:
    # 평점·가격은 데이터 출처가 없으므로 비워 둠 (화면에서 카카오맵 링크로 확인)
    return {"category": cat, "name": p["name"], "walk_minutes": max(1, round(p["distance_m"] / 80)),
            "avg_price": None, "rating": None, "reason": why, "url": p["url"]}

def rule_based(top: dict, near: list[dict], best: list[dict]) -> list[dict]:
    used: set[str] = set()

    def pick(cands: list[dict]) -> dict | None:
        for c in cands:
            if c["name"] not in used:
                used.add(c["name"])
                return c
        return None

    m = top["menu"]
    vote = f"투표 1위는 {m}({top['score']}점, 👍 {top['good']}명)예요."
    spec = [("가장 가까운 곳", pick(near), "이동 거리가 가장 짧은 곳이에요."),
            ("검색 인기 있는 곳", pick(best), f"카카오맵 검색에서 '{m}'와 가장 잘 맞는 곳이에요."),
            ("조금 더 걸으면", pick(near[1:]), "한 곳 더 비교해 보고 싶을 때 좋아요.")]
    return [card(c, p, f"{vote} {w}") for c, p, w in spec if p]

def gemini_cards(r: dict, top: dict, cmp_: dict | None, near: list[dict], best: list[dict]) -> list[dict] | None:
    """Gemini가 후보 목록 안에서 3곳을 고르고 투표 근거 문장을 씀. 실패하면 None → 규칙 기반으로 대체."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    rank_of = {p["name"]: i + 1 for i, p in enumerate(best)}
    listing = [{"name": p["name"], "walk_minutes": max(1, round(p["distance_m"] / 80)),
                "search_rank": rank_of.get(p["name"])} for p in near]
    system = ("너는 대학생 그룹의 점심 식당 추천 도우미야. 반드시 '후보 식당 목록'에 있는 이름을 글자 그대로 사용해 서로 다른 최대 3곳을 골라. "
              "category는 '가장 가까운 곳'(walk_minutes가 가장 작은 곳), '검색 인기 있는 곳'(search_rank가 가장 작은 곳), "
              "'조금 더 걸으면'(그 밖의 한 곳) 중에서 각각 하나씩 배정해. reason은 투표 결과(점수, 👍 인원, 예산, 거리)를 근거로 한 "
              "한국어 한 문장이야. 평점·가격·메뉴·영업시간처럼 목록에 없는 정보는 절대 말하지 마.")
    user = {"최종 메뉴": top["menu"], "예산 상한(원)": budget_cap(r), "현재 위치": r["place"],
            "투표 요약": {"점수": top["score"], "👍": top["good"], "😐": top["soso"], "❌": top["bad"],
                          "2위와 비교": cmp_["reason"] if cmp_ else None},
            "후보 식당 목록": listing}
    try:
        client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=15000))
        res = client.models.generate_content(
            model=GEMINI_MODEL, contents=json.dumps(user, ensure_ascii=False),
            config=types.GenerateContentConfig(system_instruction=system, response_mime_type="application/json",
                                               response_schema=Picks, temperature=0.3))
        parsed = res.parsed
    except Exception as e:                         # 한도 초과, 네트워크, 모델명 오류 등
        log.warning("Gemini 호출 실패 → 규칙 기반으로 대체: %r", e)
        return None
    by_name, seen, cards = {p["name"]: p for p in near}, set(), []
    for pk in (parsed.picks if parsed else []):
        p = by_name.get(pk.name)                   # 목록에 없는 이름(지어낸 식당)은 버림
        if p and pk.name not in seen:
            seen.add(pk.name)
            cards.append(card(pk.category, p, pk.reason.strip()[:120]))
    if not cards:
        log.warning("Gemini 응답에 유효한 식당이 없어 규칙 기반으로 대체")
        return None
    return cards[:3]

@app.post("/api/rooms/{code}/recommend")
def recommend(code: str, refresh: bool = False):    # 외부 API를 기다리므로 일부러 def (스레드풀에서 실행)
    r = get_room(code)
    if r["phase"] != "recommend":
        raise HTTPException(409, "메뉴가 아직 확정되지 않았어요.")
    if r["rec"] and (not refresh or time.time() - r["rec_at"] < REC_COOLDOWN):
        return r["rec"]
    rank = tally(r)
    top, cmp_ = rank[0], comparison(rank)
    near, best = kakao_search(r["place"], top["menu"])
    cards = gemini_cards(r, top, cmp_, near, best)
    mode = "llm" if cards else "rules"
    r["rec"] = {"menu": top["menu"], "mode": mode, "grounded": True,
                "restaurants": cards or rule_based(top, near, best)}
    r["rec_at"] = time.time()
    return r["rec"]
