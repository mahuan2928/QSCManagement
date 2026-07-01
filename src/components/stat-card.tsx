import type { ReactNode } from "react";

export function StatCard(props: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.7)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between text-zinc-300">
        <span className="text-sm">{props.label}</span>
        <span className="rounded-2xl bg-white/8 p-2 text-sky-200">{props.icon}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{props.value}</div>
      <p className="mt-2 text-xs text-zinc-400">{props.hint}</p>
    </article>
  );
}
