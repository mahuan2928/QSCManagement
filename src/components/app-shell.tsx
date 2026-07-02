"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LogOut,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
} from "lucide-react";

import type { SessionUser } from "../lib/domain";
import { appConfig } from "../lib/config";
import { cn } from "../lib/utils";

const navMap = {
  sv: [
    { href: "/dashboard", label: "ダッシュボード", icon: BarChart3 },
    { href: "/sv/dashboard", label: "店舗一覧", icon: StoreIcon },
    { href: "/sv/audits/new", label: "検査記録", icon: ShieldCheck },
    { href: "/tasks", label: "改善タスク", icon: ClipboardList },
    { href: "#", label: "設定", icon: Settings2, disabled: true },
  ],
  store: [
    { href: "/store/my-5c", label: "マイ 5C", icon: StoreIcon },
    { href: "/tasks", label: "改善タスク", icon: ClipboardList },
  ],
} as const;

export function AppShell(props: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = navMap[props.user.role];

  return (
    <div className="min-h-screen bg-[#1A2029] text-[#F2F4F7]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-[#2C333F] bg-[#1E2530] px-5 py-6 lg:flex lg:flex-col">
          <div>
            <h1 className="text-xl font-semibold text-[#F2F4F7]">{appConfig.title}</h1>
            <p className="mt-2 text-sm text-[#98A2B3]">
              {props.user.mode === "demo" ? "デモモード" : "本番モード"} · {props.user.name}
            </p>
          </div>

          <nav className="mt-8 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href !== "#" && (pathname === item.href || pathname.startsWith(`${item.href}/`));

              if ("disabled" in item && item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#667085]"
                    aria-disabled="true"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-[#3B82F6] text-[#F2F4F7]"
                      : "text-[#98A2B3] hover:bg-[#262E3A] hover:text-[#F2F4F7]",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-lg border border-[#323B48] bg-[#262E3A] p-4">
            <div className="rounded-full border border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.12)] px-3 py-1 text-xs font-medium text-[#3B82F6]">
              {props.user.role === "sv" ? "SVビュー" : "店舗ビュー"}
            </div>
            <form action="/api/auth/logout" method="post" className="mt-4">
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#323B48] bg-[#1E2530] px-4 py-2.5 text-sm text-[#F2F4F7] transition hover:bg-[#262E3A]">
                <LogOut className="size-4" />
                ログアウト
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-[#2C333F] bg-[#1E2530] px-4 py-4 sm:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-[#F2F4F7]">{appConfig.title}</h1>
              </div>
              <form action="/api/auth/logout" method="post">
                <button className="inline-flex items-center gap-2 rounded-lg border border-[#323B48] bg-[#262E3A] px-3 py-2 text-sm text-[#F2F4F7]">
                  <LogOut className="size-4" />
                  ログアウト
                </button>
              </form>
            </div>
            <nav className="mt-4 flex flex-wrap gap-2">
              {navItems
                .filter((item) => !("disabled" in item && item.disabled))
                .map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
                        active
                          ? "border-[#3B82F6] bg-[#3B82F6] text-[#F2F4F7]"
                          : "border-[#323B48] bg-[#262E3A] text-[#98A2B3]",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
            </nav>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
