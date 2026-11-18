import type { Metadata } from "next";
import "./globals.css";
import "./motion.css";

export const metadata: Metadata = { title: "아무거나", description: "눈치 없이 함께 정하는 메뉴" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body className="text-zinc-900 antialiased">{children}</body></html>;
}
