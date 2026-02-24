// プロジェクト詳細ページ。レシピ・コネクション一覧、外部依存、JSONエクスポート。

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  RefreshCw,
  Download,
  Eye,
  Copy,
  ChevronRight,
  ExternalLink,
  FolderKanban,
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
    exportPayload,
    handleDownloadJson,
    handleCopyJson,
    previewOpen,
    openPreview,
    closePreview,
    maskedPaths,
    setMaskedPaths,
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
            <span className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
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
                    <th className={`${TH} w-1/3`}>名前</th>
                    <th className={TH}>説明</th>
                  </tr>
                </thead>
                <tbody>
                  {(projectRecipes ?? []).length === 0 ? (
                    <EmptyTableRow
                      colSpan={2}
                      message="レシピが見つかりません"
                    />
                  ) : (
                    (projectRecipes ?? []).map((recipe) => (
                      <tr key={recipe.id} className={TR_HOVER}>
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
                  <th className={TH}>名前</th>
                  <th className={TH}>サービス</th>
                </tr>
              </thead>
              <tbody>
                {filteredConnections.length === 0 ? (
                  <EmptyTableRow
                    colSpan={2}
                    message="コネクションが見つかりません"
                  />
                ) : (
                  filteredConnections.map((conn) => (
                    <tr key={conn.id} className={TR_HOVER}>
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
          items={externalRecipes}
          checkedIds={externalRecipeChecked}
          onCheckedChange={setExternalRecipeChecked}
          columns={externalRecipeColumns}
        />

        {/* 外部コネクション */}
        <ExternalDependencyTable
          title="Other Project Connections"
          note="プロジェクト外ですが依存性のあるコネクションです"
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
        title="JSON プレビュー"
        maxWidth="max-w-6xl"
        scrollContent={false}
        footer={
          <>
            <button className={BTN_OUTLINED_SM} onClick={handleCopyJson}>
              <Copy size={14} />
              コピー
            </button>
            <button className={BTN_OUTLINED_SM} onClick={handleDownloadJson}>
              <Download size={14} />
              ダウンロード
            </button>
          </>
        }
      >
        {exportPayload && (
          <JsonViewer
            data={exportPayload}
            maskedPaths={maskedPaths}
            onMaskedPathsChange={setMaskedPaths}
          />
        )}
      </Modal>
    </div>
  );
}
