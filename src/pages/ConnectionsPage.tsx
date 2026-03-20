// コネクション一覧ページ。4種フィルタ、ソート、CSV出力。

import { RefreshCw, Layers, Download, Search, Plug } from "lucide-react";
import { useConnections } from "../hooks/useConnections";
import NoTokenNotice from "../components/NoTokenNotice";
import SortableTableHead from "../components/SortableTableHead";
import EmptyTableRow from "../components/EmptyTableRow";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import AuthStatusBadge from "../components/AuthStatusBadge";
import ExternalLinkButton from "../components/ExternalLinkButton";
import { exportConnectionsCsv } from "../lib/csv-exports";
import { normalizeBaseUrl, openWorkatoUrl, workatoUrls } from "../lib/workato-url";
import { formatDateJP } from "../lib/format";
import {
  BTN_OUTLINED_SM_BLUE,
  BTN_OUTLINED_SM_GREEN,
  BTN_TEXT_SM,
  CARD,
  CARD_OUTLINED,
  PAGE,
  HEADER_ROW,
  BTN_GROUP,
  TABLE,
  TD,
  TR_HOVER,
  INPUT_SM,
  SELECT_SM,
  LABEL,
} from "../lib/tw";
import type { ColumnDef } from "../components/SortableTableHead";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "名前" },
  { key: "application", label: "サービス / プロバイダー" },
  { key: "authorization_status", label: "認証状態" },
  { key: "recipe_count", label: "使用レシピ数", align: "right" },
  { key: "project", label: "プロジェクト" },
  { key: "created_at", label: "作成日時" },
];

export default function ConnectionsPage() {
  const {
    hasToken,
    activeProfile,
    data,
    isLoading,
    isFetching,
    error,
    filters,
    setFilters,
    sort,
    onSort,
    recipeCountMap,
    projectMap,
    uniqueApps,
    uniqueProjects,
    filtered,
    hasFilter,
    clearFilters,
    refetch,
  } = useConnections();

  if (!hasToken) return <NoTokenNotice />;

  const baseUrl = normalizeBaseUrl(activeProfile?.base_url);

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25">
            <Plug size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-sky-600">Connections</h1>
            <p className="text-xs text-gray-400 mt-0.5">Workato コネクションの一覧・認証状態</p>
            {data && (
              <p className="text-sm text-gray-400">
                {hasFilter
                  ? `${filtered.length} / ${data.length} 件`
                  : `${data.length} 件`}
              </p>
            )}
          </div>
        </div>
        <div className={BTN_GROUP}>
          <button
            className={BTN_OUTLINED_SM_GREEN}
            disabled={!filtered.length}
            onClick={() =>
              exportConnectionsCsv(filtered, recipeCountMap, projectMap)
            }
          >
            <Download size={16} />
            CSV
          </button>
          <button
            className={BTN_OUTLINED_SM_BLUE}
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            更新
          </button>
        </div>
      </div>

      {/* フィルタ */}
      <div className={`${CARD_OUTLINED} mb-5`}>
        <div className="grid grid-cols-4 gap-4 p-4">
          <div>
            <label className={LABEL}>コネクション名</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                className={`${INPUT_SM} pl-9`}
                placeholder="部分一致"
                value={filters.name}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className={LABEL}>サービス / プロバイダー</label>
            <select
              className={SELECT_SM}
              value={filters.application}
              onChange={(e) =>
                setFilters((f) => ({ ...f, application: e.target.value }))
              }
            >
              <option value="">すべて</option>
              {uniqueApps.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>認証状態</label>
            <select
              className={SELECT_SM}
              value={filters.authorization_status}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  authorization_status: e.target.value,
                }))
              }
            >
              <option value="">すべて</option>
              <option value="success">認証済み</option>
              <option value="failure">未認証 / エラー</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className={LABEL}>プロジェクト</label>
              <select
                className={SELECT_SM}
                value={filters.project}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, project: e.target.value }))
                }
              >
                <option value="">すべて</option>
                {uniqueProjects.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {hasFilter && (
              <button
                className={`${BTN_TEXT_SM} whitespace-nowrap`}
                onClick={clearFilters}
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <AlertBanner severity="error" className="mb-5">
          {String(error)}
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
                  message="コネクションが見つかりません"
                />
              ) : (
                filtered.map((conn) => {
                  const count = recipeCountMap.get(conn.id) ?? 0;
                  return (
                    <tr key={conn.id} className={TR_HOVER}>
                      <td className={`${TD} font-medium`}>
                        <ExternalLinkButton
                          onClick={() =>
                            openWorkatoUrl(
                              baseUrl,
                              workatoUrls.connection(conn.id),
                            )
                          }
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
                      <td
                        className={`${TD} text-right tabular-nums ${count > 0 ? "" : "text-gray-400"}`}
                      >
                        {count}
                      </td>
                      <td className={`${TD} text-xs text-gray-500`}>
                        {conn.project_id
                          ? (() => {
                              const proj = projectMap.get(conn.project_id!);
                              return proj ? (
                                <span className="inline-flex items-center gap-1">
                                  <Layers size={14} />
                                  {proj.name}
                                </span>
                              ) : (
                                <span className="text-primary">{`ID: ${conn.project_id}`}</span>
                              );
                            })()
                          : "-"}
                      </td>
                      <td className={`${TD} text-gray-500`}>
                        {formatDateJP(conn.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
