"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Ranked, ResultData, won } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { Card, Shell, btnCls } from "@/components/ui";

const dist = (r: Ranked) => [r.good && `👍 ${r.good}명`, r.soso && `😐 ${r.soso}명`, r.bad && `❌ ${r.bad}명`].filter(Boolean).join(", ");

export default function Compare() {
  const { code } = useParams<{ code: string }>();
  const { state } = useRoom(code, ["result"]);
  const [data, setData] = useState<ResultData | null>(null);
  useEffect(() => { api.result(code).then(setData).catch(() => {}); }, [code]);
  const c = data?.comparison;
  const cell = (v: string, win: boolean) => <td className={`p-2 text-center ${win ? "font-bold text-emerald-700" : ""}`}>{v}</td>;

  return (
    <Shell title="후보별 조건 비교" sub={c ? `${c.first.menu} vs ${c.second.menu}` : ""}
      footer={<Link href={`/room/${code}/result`} className={btnCls("line")}>&lt; 뒤로 (투표 결과)</Link>}>
      {c && <>
        <table className="w-full text-sm"><thead><tr><th /><th>{c.first.menu}</th><th>{c.second.menu}</th></tr></thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-stone-200">
            <tr><td className="p-2 text-xs text-stone-500">총점</td>{cell(`${c.first.score}점`, c.first.score > c.second.score)}{cell(`${c.second.score}점`, c.second.score > c.first.score)}</tr>
            <tr><td className="p-2 text-xs text-stone-500">이모지</td>{cell(dist(c.first), false)}{cell(dist(c.second), false)}</tr>
            <tr><td className="p-2 text-xs text-stone-500">평균 가격</td>
              {cell(won(c.first.price), (c.first.price ?? 0) < (c.second.price ?? 0))}{cell(won(c.second.price), (c.second.price ?? 0) < (c.first.price ?? 0))}</tr>
            <tr><td className="p-2 text-xs text-stone-500">거리</td>
              {cell(`도보 ${c.first.walk_min ?? "-"}분`, (c.first.walk_min ?? 99) < (c.second.walk_min ?? 99))}{cell(`도보 ${c.second.walk_min ?? "-"}분`, (c.second.walk_min ?? 99) < (c.first.walk_min ?? 99))}</tr>
          </tbody></table>
        <Card className="mt-4">✅ 두 후보 모두 필수 조건({state?.budget ? `예산 ${won(state.budget)} 이하` : "예산 제한 없음"}) 충족</Card>
        <div className="rounded-2xl bg-orange-50 p-3 text-sm">“{c.reason}”</div>
      </>}
    </Shell>
  );
}
