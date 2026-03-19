// プロジェクト詳細ページ。レシピ・コネクション一覧、外部依存、JSONエクスポート。

import { useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  RefreshCw,
  Download,
  Eye,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Undo2,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import NoTokenNotice from "../components/NoTokenNotice";
import EmptyTableRow from "../components/EmptyTableRow";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import JsonViewer from "../components/json-viewer";
import ExternalLinkButton from "../components/ExternalLinkButton";
import ExternalDependencyTable from "../components/ExternalDependencyTable";
import type { ColumnDef } from "../components/ExternalDependencyTable";
import type { Recipe, Connection } from "../types/workato";
import {
  BTN_OUTLINED_SM,
  BTN_OUTLINED_SM_BLUE,
  BTN_OUTLINED_SM_PURPLE,
  CARD,
  PAGE,
  BTN_GROUP,
  TABLE,
  TH,
  TD,
  TR_HOVER,
} from "../lib/tw";

/** バイト数を読みやすい文字列に変換 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? Number(id) : undefined;
  const isValidId = projectId != null && !Number.isNaN(projectId);

  const {
    hasToken,
    isLoading,
    isRecipesLoading,
    selectedProject,
    projectRecipes,
    filteredConnections,
    baseUrl,
    refetchAll,
    isFetching,
    handleOpenProject,
    handleOpenRecipe,
    handleOpenConnection,
    handleDownloadJson,
    handleCopyJson,
    previewOpen,
    openPreview,
    closePreview,
    maskedPaths,
    setMaskedPaths,
    // クレンジング
    activePayload,
    isCleansed,
    handleCleanse,
    handleUncleanse,
    cleanseStats,
    // プロジェクト内チェック
    projectRecipeChecked,
    setProjectRecipeChecked,
    projectConnectionChecked,
    setProjectConnectionChecked,
    // 外部依存
    externalRecipes,
    externalRecipesLoading,
    externalConnections,
    externalRecipeChecked,
    setExternalRecipeChecked,
    externalConnectionChecked,
    setExternalConnectionChecked,
    // プロジェクト名逆引き
    projectNameById,
  } = useProjects(isValidId ? projectId : undefined);

  // 外部レシピテーブルのカラム定義
  const externalRecipeColumns: ColumnDef<Recipe>[] = useMemo(
    () => [
      {
        header: "名前",
        className: "font-medium",
        render: (r) => (
          <ExternalLinkButton onClick={() => handleOpenRecipe(r)}>
            {r.name}
          </ExternalLinkButton>
        ),
      },
      {
        header: "プロジェクト",
        className: "text-gray-500",
        render: (r) => (
          <>{(r.project_id != null && projectNameById.get(r.project_id)) || "-"}</>
        ),
      },
    ],
    [handleOpenRecipe, projectNameById],
  );

  // 外部コネクションテーブルのカラム定義
  const externalConnectionColumns: ColumnDef<Connection>[] = useMemo(
    () => [
      {
        header: "名前",
        className: "font-medium",
        render: (c) => (
          <ExternalLinkButton onClick={() => handleOpenConnection(c)}>
            {c.name}
          </ExternalLinkButton>
        ),
      },
      {
        header: "プロジェクト",
        className: "text-gray-500",
        render: (c) => (
          <>{(c.project_id != null && projectNameById.get(c.project_id)) || "-"}</>
        ),
      },
      {
        header: "サービス",
        className: "capitalize text-gray-500",
        render: (c) => <>{c.application ?? "-"}</>,
      },
    ],
    [handleOpenConnection, projectNameById],
  );

  // レシピ全選択/全解除
  const recipeList = projectRecipes ?? [];
  const allRecipesChecked = recipeList.length > 0 && recipeList.every((r) => projectRecipeChecked.has(r.id));
  const noneRecipesChecked = recipeList.every((r) => !projectRecipeChecked.has(r.id));
  const toggleAllRecipes = () => {
    if (allRecipesChecked) {
      const next = new Set(projectRecipeChecked);
      for (const r of recipeList) next.delete(r.id);
      setProjectRecipeChecked(next);
    } else {
      const next = new Set(projectRecipeChecked);
      for (const r of recipeList) next.add(r.id);
      setProjectRecipeChecked(next);
    }
  };
  const toggleRecipe = (id: number) => {
    const next = new Set(projectRecipeChecked);
    next.has(id) ? next.delete(id) : next.add(id);
    setProjectRecipeChecked(next);
  };

  // コネクション全選択/全解除
  const allConnsChecked = filteredConnections.length > 0 && filteredConnections.every((c) => projectConnectionChecked.has(c.id));
  const noneConnsChecked = filteredConnections.every((c) => !projectConnectionChecked.has(c.id));
  const toggleAllConns = () => {
    if (allConnsChecked) {
      const next = new Set(projectConnectionChecked);
      for (const c of filteredConnections) next.delete(c.id);
      setProjectConnectionChecked(next);
    } else {
      const next = new Set(projectConnectionChecked);
      for (const c of filteredConnections) next.add(c.id);
      setProjectConnectionChecked(next);
    }
  };
  const toggleConn = (id: number) => {
    const next = new Set(projectConnectionChecked);
    next.has(id) ? next.delete(id) : next.add(id);
    setProjectConnectionChecked(next);
  };

  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    await handleCopyJson();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [handleCopyJson]);

  if (!hasToken) return <NoTokenNotice />;

  // 不正 ID またはプロジェクト未発見
  if (!isValidId || (!isLoading && !selectedProject)) {
    return (
      <div className={PAGE}>
        <div className="py-20 text-center">
          <p className="text-gray-500 mb-4">
            {!isValidId ? "無効なプロジェクト ID です" : "プロジェクトが見つかりません"}
          </p>
          <Link to="/projects" className="text-violet-600 hover:underline">
            プロジェクト一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={PAGE}>
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      {/* パンくず */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm">
        <Link to="/projects" className="text-violet-500 hover:text-violet-700 transition-colors">
          Projects
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="truncate font-medium text-gray-700">{selectedProject!.name}</span>
      </nav>

      {/* プロジェクト情報カード */}
      <div className="mb-8 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/40 p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <span className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25">
              <FolderKanban size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-violet-600 truncate">
                {selectedProject!.name}
              </h1>
              {selectedProject!.description && (
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed line-clamp-2">
                  {selectedProject!.description}
                </p>
              )}
              {baseUrl && (
                <button
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 transition-colors"
                  onClick={handleOpenProject}
                >
                  <ExternalLink size={14} />
                  Workatoで開く
                </button>
              )}
            </div>
          </div>
          <div className={`${BTN_GROUP} shrink-0`}>
            <button className={BTN_OUTLINED_SM_PURPLE} onClick={openPreview}>
              <Eye size={16} />
              プレビュー
            </button>
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
      </div>

      <div className="flex flex-col gap-10">
        {/* レシピテーブル */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <span className="h-5 w-1 rounded-full bg-violet-400" />
            Recipes
            {!isRecipesLoading && (
              <span className="text-sm font-normal text-gray-400">
                {(projectRecipes ?? []).length} 件
              </span>
            )}
          </h2>
          {isRecipesLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size={28} />
            </div>
          ) : (
            <div className={CARD}>
              <table className={`${TABLE} table-fixed`}>
                <thead>
                  <tr>
                    <th className={`${TH} w-10`}>
                      <input
                        type="checkbox"
                        checked={allRecipesChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = !allRecipesChecked && !noneRecipesChecked;
                        }}
                        onChange={toggleAllRecipes}
                        className="accent-violet-400"
                      />
                    </th>
                    <th className={`${TH} w-1/3`}>名前</th>
                    <th className={TH}>説明</th>
                  </tr>
                </thead>
                <tbody>
                  {recipeList.length === 0 ? (
                    <EmptyTableRow
                      colSpan={3}
                      message="レシピが見つかりません"
                    />
                  ) : (
                    recipeList.map((recipe) => (
                      <tr key={recipe.id} className={TR_HOVER}>
                        <td className={`${TD} w-10`}>
                          <input
                            type="checkbox"
                            checked={projectRecipeChecked.has(recipe.id)}
                            onChange={() => toggleRecipe(recipe.id)}
                            className="accent-violet-400"
                          />
                        </td>
                        <td className={`${TD} font-medium`}>
                          <ExternalLinkButton
                            onClick={() => handleOpenRecipe(recipe)}
                          >
                            {recipe.name}
                          </ExternalLinkButton>
                        </td>
                        <td className={`${TD} text-gray-500 truncate`}>
                          {recipe.description || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* コネクションテーブル */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <span className="h-5 w-1 rounded-full bg-violet-400" />
            Connections
            <span className="text-sm font-normal text-gray-400">
              {filteredConnections.length} 件
            </span>
          </h2>
          <div className={CARD}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={`${TH} w-10`}>
                    <input
                      type="checkbox"
                      checked={allConnsChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allConnsChecked && !noneConnsChecked;
                      }}
                      onChange={toggleAllConns}
                      className="accent-violet-400"
                    />
                  </th>
                  <th className={TH}>名前</th>
                  <th className={TH}>サービス</th>
                </tr>
              </thead>
              <tbody>
                {filteredConnections.length === 0 ? (
                  <EmptyTableRow
                    colSpan={3}
                    message="コネクションが見つかりません"
                  />
                ) : (
                  filteredConnections.map((conn) => (
                    <tr key={conn.id} className={TR_HOVER}>
                      <td className={`${TD} w-10`}>
                        <input
                          type="checkbox"
                          checked={projectConnectionChecked.has(conn.id)}
                          onChange={() => toggleConn(conn.id)}
                          className="accent-violet-400"
                        />
                      </td>
                      <td className={`${TD} font-medium`}>
                        <ExternalLinkButton
                          onClick={() => handleOpenConnection(conn)}
                        >
                          {conn.name}
                        </ExternalLinkButton>
                      </td>
                      <td className={`${TD} capitalize text-gray-500`}>
                        {conn.application ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 外部レシピ */}
        {externalRecipesLoading && (
          <div className="flex justify-center py-6">
            <Spinner size={28} />
          </div>
        )}
        <ExternalDependencyTable
          title="Other Project Recipes"
          note="プロジェクト外ですが依存性のあるレシピです"
          barColor="bg-amber-400"
          items={externalRecipes}
          checkedIds={externalRecipeChecked}
          onCheckedChange={setExternalRecipeChecked}
          columns={externalRecipeColumns}
        />

        {/* 外部コネクション */}
        <ExternalDependencyTable
          title="Other Project Connections"
          note="プロジェクト外ですが依存性のあるコネクションです"
          barColor="bg-amber-400"
          items={externalConnections}
          checkedIds={externalConnectionChecked}
          onCheckedChange={setExternalConnectionChecked}
          columns={externalConnectionColumns}
        />
      </div>

      {/* JSON プレビューモーダル */}
      <Modal
        open={previewOpen}
        onClose={closePreview}
        title={
          <span className="inline-flex items-center gap-2">
            JSON プレビュー
            {isCleansed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                <Sparkles size={11} fill="#2563eb" />
                クレンジング済
              </span>
            )}
          </span>
        }
        maxWidth="max-w-6xl"
        scrollContent={false}
        footer={
          <div className="flex w-full flex-col gap-2">
            {/* 削減率パネル — クレンジング中のみ表示 */}
            {isCleansed && cleanseStats && (
              <div
                className="relative overflow-hidden rounded-lg px-4 py-2.5"
                style={{
                  background: "linear-gradient(135deg, #1e3a5f, #1e40af, #2563eb, #1e40af, #1e3a5f)",
                  backgroundSize: "300% 100%",
                }}
              >
                {/* シマーオーバーレイ */}
                <span
                  className="pointer-events-none absolute inset-0 animate-shimmer"
                  style={{
                    background: "linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)",
                    backgroundSize: "200% 100%",
                  }}
                />
                <div className="relative z-10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-bold text-white">
                      <TrendingDown size={13} />
                      {cleanseStats.percent}% 削減
                    </span>
                    <span className="text-blue-200">
                      {formatBytes(cleanseStats.originalSize)} → {formatBytes(cleanseStats.cleansedSize)}
                    </span>
                    <span className="text-blue-300">
                      ({cleanseStats.originalChars.toLocaleString()} → {cleanseStats.cleansedChars.toLocaleString()} 文字)
                    </span>
                  </div>
                  <span className="font-bold text-amber-300">
                    -{formatBytes(cleanseStats.reduced)} / -{cleanseStats.reducedChars.toLocaleString()} 文字
                  </span>
                </div>
                {/* プログレスバー */}
                <div className="relative z-10 mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${100 - cleanseStats.percent}%`,
                      background: "linear-gradient(90deg, #60a5fa, #38bdf8, #67e8f9)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ボタン行 */}
            <div className="flex items-center justify-between">
              <div className="relative">
                {!isCleansed ? (
                  <>
                    <button
                      onClick={handleCleanse}
                      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg px-4 py-2 text-sm font-bold text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 peer"
                      style={{
                        background: "linear-gradient(135deg, #1e3a5f, #1e40af, #2563eb, #3b82f6, #2563eb, #1e40af, #1e3a5f)",
                        backgroundSize: "300% 100%",
                      }}
                    >
                      {/* シマー光沢オーバーレイ */}
                      <span
                        className="pointer-events-none absolute inset-0 animate-shimmer"
                        style={{
                          background: "linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.3) 50%, transparent 75%)",
                          backgroundSize: "200% 100%",
                        }}
                      />
                      <Sparkles size={15} fill="#fbbf24" className="relative z-10 animate-sparkle" style={{ color: "#fbbf24" }} />
                      <span className="relative z-10">クレンジング</span>
                    </button>
                    {/* ツールチップ吹き出し */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max max-w-xs opacity-0 peer-hover:opacity-100 transition-all duration-200 peer-hover:translate-y-0 translate-y-1">
                      <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-lg">
                        <span className="font-semibold text-blue-600">LLM用</span>に不要なプロパティをクレンジングします
                        {/* 三角矢印 */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-blue-200 bg-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <button className={BTN_OUTLINED_SM} onClick={handleUncleanse}>
                    <Undo2 size={14} className="text-blue-500" />
                    元に戻す
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className={BTN_OUTLINED_SM} onClick={onCopy}>
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-blue-500" />}
                  {copied ? "コピーしました！" : "コピー"}
                </button>
                <button className={BTN_OUTLINED_SM} onClick={handleDownloadJson}>
                  <Download size={14} className="text-blue-500" />
                  ダウンロード
                </button>
              </div>
            </div>
          </div>
        }
      >
        {activePayload && (
          <JsonViewer
            data={activePayload}
            maskedPaths={maskedPaths}
            onMaskedPathsChange={setMaskedPaths}
          />
        )}
      </Modal>
    </div>
  );
}
