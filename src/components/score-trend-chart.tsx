"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "../lib/business-rules";
import type { FiveCResult } from "../lib/domain";

export function ScoreTrendChart({ results }: { results: FiveCResult[] }) {
  const data = results.map((item) => ({
    date: formatDate(item.auditDate),
    total: item.totalScore,
    operation: item.operationScore,
    value: item.valueScore,
  }));

  return (
    <div className="h-72 rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">推移チャート</h3>
          <p className="text-xs text-zinc-400">店舗にとって重要なスコア推移だけを表示します。</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "#101828",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <Line type="monotone" dataKey="operation" stroke="#38bdf8" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="total" stroke="#fbbf24" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
