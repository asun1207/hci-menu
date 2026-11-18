# 아무거나 (Amugeona)

여럿이 메뉴를 눈치 없이 정하는 웹앱. Next.js(TypeScript) + FastAPI + 카카오 로컬 API + Gemini.

## 로컬 실행
터미널 1 (백엔드)
```
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
`.env`에 `KAKAO_REST_KEY`, `GEMINI_API_KEY`를 입력한 뒤 (Gemini는 비워도 카카오 기반 추천으로 동작)
```
uvicorn main:app --reload --port 8000
```
터미널 2 (프론트)
```
cd frontend
npm install
npm run dev
```
http://localhost:3000 — 여러 명 테스트는 시크릿 창이나 다른 기기에서 같은 초대 링크로 접속.
(`.env`를 바꾸면 백엔드를 껐다 켜야 반영됩니다.)

## 배포 (무료)
1. Render: Web Service, Root `backend`, Build `pip install -r requirements.txt`,
   Start `uvicorn main:app --host 0.0.0.0 --port $PORT`, 환경변수 `KAKAO_REST_KEY`, `GEMINI_API_KEY`
2. Vercel: Root `frontend`, 환경변수 `BACKEND_URL` = Render 주소 → 배포 후 나온 vercel 주소가 서비스 링크
3. Render 무료는 15분 무요청 시 잠들고(깨우는 데 약 1분), 서버 재시작 시 방 데이터가 사라집니다.
   평가 5분 전에 한 번 접속해 깨워 두세요. 헬스체크: `/healthz`

## 주의
- `.env`는 절대 커밋하지 않기 (키 유출)
- 가격·도보시간·태그는 `backend/main.py`의 `MENU_DB`, `TAGS`에 있는 5개 메뉴만 지원
- 카카오 API는 평점·가격을 주지 않아 추천 카드에는 표시하지 않고 카카오맵 링크로 연결
