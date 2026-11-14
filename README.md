# 아무거나 (Amugeona) — 로컬 실행 가이드

## 0. 준비물
Node.js 20+, Python 3.11+, OpenAI API 키 (선택: 카카오 REST API 키)

## 1. 백엔드
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # OPENAI_API_KEY 입력
uvicorn main:app --reload --port 8000                  # http://localhost:8000/docs 에서 API 확인
```

## 2. 프론트엔드 (처음부터)
```bash
npx create-next-app@latest frontend --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
cd frontend
```
이 압축 파일의 `frontend/` 안 파일(`app/`, `lib/`, `components/`, `next.config.mjs`)을 위 폴더에 덮어쓰기 한 뒤:
```bash
npm run dev      # http://localhost:3000
```
(`app/globals.css`, `app/favicon.ico`는 기본값 그대로 둡니다.)

## 3. 혼자서 시연하기 (4명 흉내)
1. 브라우저 A에서 방 생성 → 로비에서 "🧪 데모 친구 3명 채우기" 클릭 → 방 시작
2. 메뉴 제안: 건너뛰기 또는 "돈가스" 입력, 예산 10,000원 이하 설정 → 파스타(12,000원) 자동 제외
3. 투표에서 국밥 😐 / 우동 👍 / 볶음밥 😐 / 돈가스 😐 로 투표 → 국밥 7 · 우동 6 · 볶음밥 5 · 돈가스 3
4. 결과 → 조건 비교 → 확정 → AI 추천
(진짜 여러 명 테스트: 시크릿 창이나 휴대폰에서 같은 초대 링크로 접속)

## 페이지 ↔ 화면
| 경로 | 화면 |
|---|---|
| `/` , `/room/[code]` | 1. 방 생성 / 초대 링크 |
| `/room/[code]/propose` | 2. 메뉴 1개 제안 + 비공개 조건 |
| `/room/[code]/vote` | 3. 이모지 투표 |
| `/room/[code]/result`, `/compare` | 4. 합산 결과 / 조건 비교 |
| `/room/[code]/recommend` | 5. LLM 식당 추천 |
