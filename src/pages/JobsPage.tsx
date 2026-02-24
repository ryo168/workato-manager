// ジョブ履歴ページ。レシピ選択してジョブ一覧を表示。

import { RefreshCw, Download, ListChecks } from "lucide-react";
import { useJobs } from "../hooks/useJobs";
import StatusBadge from "../components/StatusBadge";
import NoTokenNotice from "../components/NoTokenNotice";
import SortableTableHead from "../components/SortableTableHead";
import EmptyTableRow from "../components/EmptyTableRow";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import { exportJobsCsv } from "../lib/csv-exports";
import { formatDateJP } from "../lib/format";
import {
  BTN_OUTLINED_SM_BLUE,
  BTN_OUTLINED_SM_GREEN,
  CARD,
  PAGE,
  HEADER_ROW,
  BTN_GROUP,
  TABLE,
  TD,
  TR_HOVER,
  SELECT_SM,
  LABEL,
} from "../lib/tw";
import type { ColumnDef } from "../components/SortableTableHead";

const COLUMNS: ColumnDef[] = [
  { key: "id", label: "Job ID" },
  { key: "status", label: "ステータス" },
  { key: "started_at", label: "開始日時" },
  { key: "completed_at", label: "完了日時" },
  { label: "エラー" },
];

export default function JobsPage() {
  const {
    hasToken,
    selectedRecipeId,
    setSelectedRecipeId,
    sort,
    onSort,
    recipesQuery,
    jobsQuery,
    sortedJobs,
  } = useJobs();

  if (!hasToken) return <NoTokenNotice />;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-500">
            <ListChecks size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-emerald-600">Jobs</h1>
            {jobsQuery.data && (
              <p className="text-sm text-gray-400">
                {jobsQuery.data.length} 件
              </p>
            )}
          </div>
        </div>
        <div className={BTN_GROUP}>
          <button
            className={BTN_OUTLINED_SM_GREEN}
            disabled={!sortedJobs.length}
            onClick={() => {
              const recipeName =
                recipesQuery.data?.find((r) => r.id === selectedRecipeId)
                  ?.name ?? "jobs";
              exportJobsCsv(sortedJobs, recipeName);
            }}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            className={BTN_OUTLINED_SM_BLUE}
            disabled={recipesQuery.isFetching || jobsQuery.isFetching}
            onClick={() => {
              recipesQuery.refetch();
              if (selectedRecipeId !== null) jobsQuery.refetch();
            }}
          >
            <RefreshCw
              size={16}
              className={recipesQuery.isFetching || jobsQuery.isFetching ? "animate-spin" : ""}
            />
            更新
          </button>
        </div>
      </div>

      {/* レシピ選択 */}
      <div className="mb-5 w-80">
        <label className={LABEL}>レシピ</label>
        <select
          className={SELECT_SM}
          value={selectedRecipeId ?? ""}
          onChange={(e) =>
            setSelectedRecipeId(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">レシピを選択してください</option>
          {(recipesQuery.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* レシピ未選択時のプロンプト */}
      {selectedRecipeId === null && (
        <p className="py-20 text-center text-gray-400">
          {recipesQuery.data
            ? "レシピを選択するとジョブ履歴が表示されます"
            : "更新ボタンを押してレシピを取得してください"}
        </p>
      )}

      {/* エラー */}
      {jobsQuery.error && (
        <AlertBanner severity="error" className="mb-5">
          {String(jobsQuery.error)}
        </AlertBanner>
      )}

      {/* テーブル */}
      {selectedRecipeId !== null &&
        (jobsQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <div className={CARD}>
            <table className={TABLE}>
              <SortableTableHead
                columns={COLUMNS}
                sort={sort}
                onSort={onSort}
              />
              <tbody>
                {sortedJobs.length === 0 ? (
                  <EmptyTableRow
                    colSpan={COLUMNS.length}
                    message="ジョブ履歴がありません"
                  />
                ) : (
                  sortedJobs.map((job) => (
                    <tr key={job.id} className={TR_HOVER}>
                      <td className={`${TD} font-mono text-xs text-gray-500`}>
                        {job.id}
                      </td>
                      <td className={TD}>
                        <StatusBadge
                          status={job.is_error ? "failed" : "succeeded"}
                        />
                      </td>
                      <td className={`${TD} text-gray-500`}>
                        {formatDateJP(job.started_at)}
                      </td>
                      <td className={`${TD} text-gray-500`}>
                        {formatDateJP(job.completed_at)}
                      </td>
                      <td
                        className={`${TD} max-w-[300px] truncate text-xs text-red-600`}
                      >
                        {job.error ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
