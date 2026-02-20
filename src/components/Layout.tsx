// アプリ全体のレイアウト。左にサイドバー、右にメインコンテンツ。

import { NavLink } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Plug,
  FolderKanban,
  Settings,
  Activity,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { to: "/recipes", icon: BookOpen, label: "Recipes" },
  { to: "/jobs", icon: ListChecks, label: "Jobs" },
  { to: "/connections", icon: Plug, label: "Connections" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
];

const linkBase =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-text hover:bg-sidebar-hover";
const linkActive = "!bg-primary !text-white";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー */}
      <nav className="flex w-56 shrink-0 flex-col bg-sidebar-bg text-white">
        {/* ブランドロゴ */}
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3.5">
          <Activity size={20} className="text-orange-400" />
          <span className="text-sm font-semibold tracking-wide">
            Workato Manager
          </span>
        </div>

        {/* メインナビゲーション */}
        <div className="flex-1 space-y-1 px-2 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : ""}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>

        <hr className="border-sidebar-border" />

        {/* 設定リンク */}
        <div className="px-2 py-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : ""}`
            }
          >
            <Settings size={18} />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto bg-gray-100">{children}</main>
    </div>
  );
}
