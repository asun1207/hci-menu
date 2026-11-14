/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 브라우저의 /api/* 요청을 FastAPI로 전달 (CORS 문제 없음)
    return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }];
  },
};
export default nextConfig;
