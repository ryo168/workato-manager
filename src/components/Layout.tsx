// アプリ全体のレイアウト。左にサイドバー、右にメインコンテンツ。

import { useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Plug,
  FolderKanban,
  Workflow,
  History,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  FileEdit,
  Server,
} from "lucide-react";
import type { ReactNode } from "react";

const STORAGE_KEY = "sidebar-collapsed";

// Workato 管理系
const navItemsMain = [
  { to: "/recipes", icon: BookOpen, label: "Recipes", color: "text-amber-400" },
  { to: "/jobs", icon: ListChecks, label: "Jobs", color: "text-emerald-400" },
  { to: "/connections", icon: Plug, label: "Connections", color: "text-sky-300" },
  { to: "/projects", icon: FolderKanban, label: "Projects", color: "text-rose-300" },
  { to: "/markdown-editor", icon: FileEdit, label: "MD Editor", color: "text-teal-300" },
];

// 仕様書生成系
const navItemsSpec = [
  { to: "/gemini", icon: Sparkles, label: "Gemini", color: "text-purple-300" },
  { to: "/dify", icon: Workflow, label: "Dify", color: "text-amber-300" },
  { to: "/workato-spec", icon: Server, label: "Workato", color: "text-cyan-300" },
  { to: "/dify/history", icon: History, label: "History", color: "text-amber-200" },
];

const linkActive = "!bg-primary !text-white";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const linkBase = `flex items-center ${collapsed ? "justify-center" : "gap-2.5"} rounded-md px-3 py-2.5 text-sm text-sidebar-text hover:bg-sidebar-hover`;

  /** Settings ページにいる時、ナビゲーション前にガードイベントを発火 */
  const guardedNavigate = useCallback(
    (to: string, e: React.MouseEvent) => {
      if (location.pathname !== "/settings" || to === "/settings") return;
      const event = new CustomEvent("settings-nav-guard", {
        cancelable: true,
        detail: { proceed: () => navigate(to) },
      });
      const allowed = window.dispatchEvent(event);
      if (!allowed) {
        e.preventDefault();
      }
    },
    [location.pathname, navigate],
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー */}
      <nav
        className={`flex ${collapsed ? "w-14" : "w-44"} shrink-0 flex-col bg-sidebar-bg text-white transition-all duration-200`}
      >

        {/* メインナビゲーション */}
        <div className="flex-1 space-y-1 px-2 py-4">
          {navItemsMain.map(({ to, icon: Icon, label, color }) => (
            <NavLink
              key={to}
              to={to}
              end={to !== "/projects"}
              onClick={(e) => guardedNavigate(to, e)}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : ""} ${collapsed ? "relative group" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={`shrink-0 ${isActive ? "" : color}`} />
                  {!collapsed && label}
                  {collapsed && (
                    <span className="absolute left-full ml-2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* 区切り線 */}
          <div className="!my-3 border-t border-white/10" />
          {!collapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              仕様書生成
            </div>
          )}

          {navItemsSpec.map(({ to, icon: Icon, label, color }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={(e) => guardedNavigate(to, e)}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : ""} ${collapsed ? "relative group" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={`shrink-0 ${isActive ? "" : color}`} />
                  {!collapsed && label}
                  {collapsed && (
                    <span className="absolute left-full ml-2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <hr className="border-sidebar-border" />

        {/* 設定リンク */}
        <div className="px-2 py-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : ""} ${collapsed ? "relative group" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={18} className={`shrink-0 ${isActive ? "" : "text-gray-400"}`} />
                {!collapsed && "Settings"}
                {collapsed && (
                  <span className="absolute left-full ml-2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
                    Settings
                  </span>
                )}
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
      <main className="flex-1 overflow-auto bg-surface">{children}</main>
    </div>
  );
}
