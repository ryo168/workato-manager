// レシピ一覧ページ。検索、ソート、起動/停止、CSV出力。

import { RefreshCw, Play, Square, Download, Search } from "lucide-react";
import { useRecipes } from "../hooks/useRecipes";
import StatusBadge from "../components/StatusBadge";
import NoTokenNotice from "../components/NoTokenNotice";
import SortableTableHead from "../components/SortableTableHead";
import EmptyTableRow from "../components/EmptyTableRow";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import { exportRecipesCsv } from "../lib/csv-exports";
import { formatDateJP } from "../lib/format";
import {
  BTN_OUTLINED_SM,
  BTN_OUTLINED_SM_ERROR,
  BTN_OUTLINED_SM_SUCCESS,
  CARD,
  PAGE,
  HEADER_ROW,
  BTN_GROUP,
  TABLE,
  TD,
  TR_HOVER,
  INPUT_SM,
} from "../lib/tw";
import type { ColumnDef } from "../components/SortableTableHead";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "名前" },
  { key: "running", label: "状態" },
  { key: "succeeded", label: "成功", align: "right" },
  { key: "failed", label: "失敗", align: "right" },
  { key: "last_run_at", label: "最終実行" },
  { label: "" },
];

export default function RecipesPage() {
  const {
    hasToken,
    data,
    isLoading,
    isFetching,
    error,
    actionError,
    search,
    setSearch,
    sort,
    onSort,
    filtered,
    refetch,
    startMut,
    stopMut,
    isPending,
  } = useRecipes();

  if (!hasToken) return <NoTokenNotice />;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div>
          <h1 className="text-xl font-bold">Recipes</h1>
          {data && (
            <p className="mt-0.5 text-sm text-gray-500">{data.length} 件</p>
          )}
        </div>
        <div className={BTN_GROUP}>
          <button
            className={BTN_OUTLINED_SM}
            disabled={!filtered.length}
            onClick={() => exportRecipesCsv(filtered)}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            className={BTN_OUTLINED_SM}
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            更新
          </button>
        </div>
      </div>

      {/* 検索 */}
      <div className="relative mb-2">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          className={`${INPUT_SM} pl-9`}
          placeholder="レシピ名で絞り込み"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* エラー */}
      {(error || actionError) && (
        <AlertBanner severity="error" className="mb-4">
          {String(error ?? actionError)}
        </AlertBanner>
      )}

      {/* テーブル */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !data ? (
        <p className="py-20 text-center text-gray-400">
          更新ボタンを押してデータを取得してください
        </p>
      ) : (
        <div className={CARD}>
          <table className={TABLE}>
            <SortableTableHead columns={COLUMNS} sort={sort} onSort={onSort} />
            <tbody>
              {filtered.length === 0 ? (
                <EmptyTableRow
                  colSpan={COLUMNS.length}
                  message="レシピが見つかりません"
                />
              ) : (
                filtered.map((recipe) => (
                  <tr key={recipe.id} className={TR_HOVER}>
                    <td className={`${TD} font-medium`}>{recipe.name}</td>
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
                    <td className={`${TD} text-gray-500`}>
                      {formatDateJP(recipe.last_run_at)}
                    </td>
                    <td className={`${TD} text-right`}>
                      {recipe.running ? (
                        <button
                          className={BTN_OUTLINED_SM_ERROR}
                          disabled={isPending(recipe.id)}
                          onClick={() => stopMut.mutate(recipe.id)}
                        >
                          <Square size={14} />
                          停止
                        </button>
                      ) : (
                        <button
                          className={BTN_OUTLINED_SM_SUCCESS}
                          disabled={isPending(recipe.id)}
                          onClick={() => startMut.mutate(recipe.id)}
                        >
                          <Play size={14} />
                          開始
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
