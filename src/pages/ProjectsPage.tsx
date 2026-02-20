// プロジェクト詳細ページ。レシピ・コネクション一覧とJSONエクスポート。

import { RefreshCw, Download, Eye, Copy } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import StatusBadge from "../components/StatusBadge";
import NoTokenNotice from "../components/NoTokenNotice";
import EmptyTableRow from "../components/EmptyTableRow";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import Modal from "../components/Modal";
import JsonViewer from "../components/json-viewer";
import AuthStatusBadge from "../components/AuthStatusBadge";
import ExternalLinkButton from "../components/ExternalLinkButton";
import {
  BTN_OUTLINED_SM,
  CARD,
  PAGE,
  HEADER_ROW,
  BTN_GROUP,
  TABLE,
  TH,
  TD,
  TR_HOVER,
  SELECT_SM,
  LABEL,
} from "../lib/tw";

export default function ProjectsPage() {
  const {
    hasToken,
    projects,
    projectsError,
    isFetching,
    isLoading,
    isRecipesLoading,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    projectRecipes,
    filteredConnections,
    baseUrl,
    refetchAll,
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
  } = useProjects();

  if (!hasToken) return <NoTokenNotice />;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          {projects && (
            <p className="mt-0.5 text-sm text-gray-500">{projects.length} 件</p>
          )}
        </div>
        <div className={BTN_GROUP}>
          {selectedProject && (
            <>
              <button className={BTN_OUTLINED_SM} onClick={openPreview}>
                <Eye size={16} />
                プレビュー
              </button>
              <button className={BTN_OUTLINED_SM} onClick={handleDownloadJson}>
                <Download size={16} />
                JSON
              </button>
            </>
          )}
          <button
            className={BTN_OUTLINED_SM}
            disabled={isFetching}
            onClick={refetchAll}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            更新
          </button>
        </div>
      </div>

      {/* プロジェクト選択 */}
      <div className="mb-6 flex items-center gap-4">
        <div className="min-w-[280px]">
          <label className={LABEL}>プロジェクト</label>
          <select
            className={SELECT_SM}
            value={selectedProjectId}
            onChange={(e) =>
              setSelectedProjectId(
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          >
            <option value="">プロジェクトを選択...</option>
            {(projects ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, "ja"))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        {selectedProject && baseUrl && (
          <button
            className="inline-flex items-center gap-1 self-end pb-1 text-sm text-primary hover:underline"
            onClick={handleOpenProject}
          >
            Workatoで開く
          </button>
        )}
      </div>

      {/* エラー */}
      {projectsError && (
        <AlertBanner severity="error" className="mb-4">
          {String(projectsError)}
        </AlertBanner>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !selectedProject ? (
        <p className="py-20 text-center text-gray-400">
          プロジェクトを選択してください
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* レシピテーブル */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Recipes
              {!isRecipesLoading && (
                <span className="ml-2 text-sm font-normal text-gray-500">
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
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>名前</th>
                      <th className={TH}>状態</th>
                      <th className={`${TH} text-right`}>成功</th>
                      <th className={`${TH} text-right`}>失敗</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(projectRecipes ?? []).length === 0 ? (
                      <EmptyTableRow
                        colSpan={4}
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
                          <td className={TD}>
                            <StatusBadge
                              status={recipe.running ? "running" : "stopped"}
                            />
                          </td>
                          <td className={`${TD} text-right text-green-600`}>
                            {recipe.job_succeeded_count ?? "-"}
                          </td>
                          <td className={`${TD} text-right text-red-600`}>
                            {recipe.job_failed_count ?? "-"}
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
            <h2 className="mb-3 text-lg font-semibold">
              Connections
              <span className="ml-2 text-sm font-normal text-gray-500">
                {filteredConnections.length} 件
              </span>
            </h2>
            <div className={CARD}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>名前</th>
                    <th className={TH}>サービス</th>
                    <th className={TH}>認証状態</th>
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
                        <td className={TD}>
                          <AuthStatusBadge
                            status={conn.authorization_status}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
