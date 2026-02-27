// アプリ全体のレイアウト。左にサイドバー、右にメインコンテンツ。

import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Plug,
  FolderKanban,
  Workflow,
  Settings,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

const STORAGE_KEY = "sidebar-collapsed";

const navItems = [
  { to: "/recipes", icon: BookOpen, label: "Recipes", color: "text-orange-400" },
  { to: "/jobs", icon: ListChecks, label: "Jobs", color: "text-emerald-400" },
  { to: "/connections", icon: Plug, label: "Connections", color: "text-sky-400" },
  { to: "/projects", icon: FolderKanban, label: "Projects", color: "text-violet-400" },
  { to: "/dify", icon: Workflow, label: "Dify", color: "text-blue-400" },
];

const linkActive = "!bg-primary !text-white";

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // 開発者モードの状態（カスタムイベントで同期）
  const [isDev, setIsDev] = useState(
    () => localStorage.getItem("developer-mode") === "true",
  );
  useEffect(() => {
    const handler = () =>
      setIsDev(localStorage.getItem("developer-mode") === "true");
    window.addEventListener("developer-mode-changed", handler);
    return () => window.removeEventListener("developer-mode-changed", handler);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const linkBase = `flex items-center ${collapsed ? "justify-center" : "gap-2.5"} rounded-md px-3 py-2 text-sm text-sidebar-text hover:bg-sidebar-hover`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー */}
      <nav
        className={`flex ${collapsed ? "w-16" : "w-56"} shrink-0 flex-col bg-sidebar-bg text-white transition-all duration-200`}
      >
        {/* ブランドロゴ */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} border-b border-sidebar-border px-4 py-3.5`}>
          <Activity size={20} className="text-orange-400 shrink-0" />
          {!collapsed && (
            <span className="text-sm font-semibold tracking-wide">
              Workato Manager
            </span>
          )}
        </div>

        {/* メインナビゲーション */}
        <div className="flex-1 space-y-1 px-2 py-4">
          {navItems.map(({ to, icon: Icon, label, color }) => (
            <NavLink
              key={to}
              to={to}
              end={to !== "/projects"}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={`shrink-0 ${isActive ? "" : color}`} />
                  {!collapsed && label}
                </>
              )}
            </NavLink>
          ))}
          {isDev && (
            <NavLink
              to="/developer"
              end
              title={collapsed ? "Developer" : undefined}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <Wrench size={18} className={`shrink-0 ${isActive ? "" : "text-amber-400"}`} />
                  {!collapsed && "Developer"}
                </>
              )}
            </NavLink>
          )}
        </div>

        <hr className="border-sidebar-border" />

        {/* 設定リンク */}
        <div className="px-2 py-4">
          <NavLink
            to="/settings"
            title={collapsed ? "Settings" : undefined}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={18} className={`shrink-0 ${isActive ? "" : "text-gray-400"}`} />
                {!collapsed && "Settings"}
              </>
            )}
          </NavLink>
        </div>

        {/* 折り畳みトグルボタン */}
        <div className="px-2 pb-4">
          <button
            onClick={toggleCollapsed}
            className={`flex w-full items-center ${collapsed ? "justify-center" : ""} rounded-md px-3 py-2 text-sm text-sidebar-text hover:bg-sidebar-hover`}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto bg-gray-100">{children}</main>
    </div>
  );
}
