import { AlertTriangle, ArrowRight, Building2, ShieldCheck } from "lucide-react";

import { appConfig } from "../lib/config";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorValue = resolvedSearchParams.error;
  const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(30,144,255,0.28),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.16),_transparent_24%),linear-gradient(180deg,_#07101d_0%,_#0f1728_42%,_#131e33_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-white/10 bg-white/6 p-6 backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">Lark Base Workflow</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {appConfig.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
            「SVによる評価開始 → 運営基準のゲート判定 → 問題是正 → 店舗フィードバック → SVフォロー」を軸にした、実運用向けのクローズドループです。
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "本番は Lark OAuth + user_access_token を利用",
              "デモと本番のデータアクセス層を完全分離",
              "運営基準が満点でない場合は是正フローへ強制遷移",
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-zinc-200">
                {item}
              </div>
            ))}
          </div>
          {error ? (
            <div className="mt-6 flex items-start gap-3 rounded-3xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>ログインに失敗しました。{decodeURIComponent(error)}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[36px] border border-white/10 bg-slate-950/45 p-6 backdrop-blur sm:p-8">
          <div className="grid gap-4">
            <form action="/api/auth/demo" method="post" className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <input type="hidden" name="profileId" value="demo-sv" />
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-sky-200" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Demo · SVダッシュボード</h2>
                  <p className="text-sm text-zinc-400">5C評価の開始、ゲート制御、是正起票、フォローアップを体験できます。</p>
                </div>
              </div>
              <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-100">
                Demo SV に入る
                <ArrowRight className="size-4" />
              </button>
            </form>

            <form action="/api/auth/demo" method="post" className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <input type="hidden" name="profileId" value="demo-store" />
              <div className="flex items-center gap-3">
                <Building2 className="size-5 text-emerald-200" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Demo · 店舗画面</h2>
                  <p className="text-sm text-zinc-400">自店の 5C 結果確認、是正一覧確認、改善後写真付きの報告ができます。</p>
                </div>
              </div>
              <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12">
                Demo 店舗に入る
                <ArrowRight className="size-4" />
              </button>
            </form>

            <a
              href="/api/auth/lark/login"
              className="rounded-[28px] border border-sky-300/20 bg-sky-400/8 p-5 transition hover:bg-sky-400/12"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-sky-100/70">Production</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Lark SSO で本番環境にログイン</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                本番モードではサーバーサイドからのみ Base OpenAPI を呼び出し、`user_access_token` と Base の実権限を継承します。
              </p>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
