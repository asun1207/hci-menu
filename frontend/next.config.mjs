/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 브라우저의 /api/* 요청을 FastAPI로 전달 (같은 도메인이라 CORS 불필요)
    // 배포: Vercel 환경변수 BACKEND_URL = https://xxxx.onrender.com (끝에 / 없이)
    const backend = process.env.BACKEND_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};
export default nextConfig;
