// プロジェクト一覧ページ。カードクリックで詳細ページへ遷移。

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search, FolderKanban } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import NoTokenNotice from "../components/NoTokenNotice";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import {
  BTN_OUTLINED_SM_BLUE,
  PAGE,
  HEADER_ROW,
  BTN_GROUP,
  INPUT_SM,
} from "../lib/tw";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const {
    hasToken,
    projects,
    projectsError,
    isFetching,
    isLoading,
    refetchAll,
  } = useProjects();

  const [projectFilter, setProjectFilter] = useState("");

  const filteredProjects = useMemo(() => {
    const sorted = (projects ?? [])
      .filter((p) => p.name !== "Home")
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    if (!projectFilter) return sorted;
    const lower = projectFilter.toLowerCase();
    return sorted.filter((p) => p.name.toLowerCase().includes(lower));
  }, [projects, projectFilter]);

  if (!hasToken) return <NoTokenNotice />;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <FolderKanban size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-violet-600">Projects</h1>
            {projects && (
              <p className="text-sm text-gray-400">{projects.length} 件</p>
            )}
          </div>
        </div>
        <div className={BTN_GROUP}>
          <button
            className={BTN_OUTLINED_SM_BLUE}
            disabled={isFetching}
            onClick={refetchAll}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            更新
          </button>
        </div>
      </div>

      {/* エラー */}
      {projectsError && (
        <AlertBanner severity="error" className="mb-5">
          {String(projectsError)}
        </AlertBanner>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !projects ? (
        <p className="py-20 text-center text-gray-400">
          プロジェクトを取得できませんでした
        </p>
      ) : (
        <div>
          {/* 検索フィルター */}
          <div className="relative mb-5 max-w-sm">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              className={`${INPUT_SM} pl-9`}
              placeholder="プロジェクト名で絞り込み"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            />
          </div>

          {/* カードグリッド */}
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="group relative rounded-xl border border-gray-200 bg-white p-4 text-left
                    overflow-hidden transition-all duration-200
                    hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 to-fuchsia-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-500 transition-colors group-hover:bg-violet-100">
                      <FolderKanban size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-800 truncate group-hover:text-violet-700 transition-colors">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filteredProjects.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-gray-400">
                  該当するプロジェクトがありません
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
