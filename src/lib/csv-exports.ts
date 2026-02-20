// 各ページの CSV エクスポートロジックを集約。

import { downloadCsv } from "./csv";
import { formatDateJP, todayISO } from "./format";
import type { Recipe, Job, Connection, Project } from "../types/workato";

export function exportRecipesCsv(recipes: Recipe[]): void {
  downloadCsv(
    `recipes_${todayISO()}.csv`,
    ["ID", "名前", "状態", "成功数", "失敗数", "最終実行"],
    recipes.map((r) => [
      r.id,
      r.name,
      r.running ? "running" : "stopped",
      r.job_succeeded_count ?? "",
      r.job_failed_count ?? "",
      formatDateJP(r.last_run_at, ""),
    ]),
  );
}

export function exportJobsCsv(jobs: Job[], recipeName: string): void {
  downloadCsv(
    `${recipeName}_${todayISO()}.csv`,
    ["Job ID", "ステータス", "開始日時", "完了日時", "エラー"],
    jobs.map((j) => [
      j.id,
      j.is_error ? "failed" : "succeeded",
      formatDateJP(j.started_at, ""),
      formatDateJP(j.completed_at, ""),
      j.error ?? "",
    ]),
  );
}

export function exportConnectionsCsv(
  connections: Connection[],
  recipeCountMap: Map<number, number>,
  projectMap: Map<number, Project>,
): void {
  downloadCsv(
    `connections_${todayISO()}.csv`,
    [
      "コネクションID",
      "名前",
      "サービス/プロバイダー",
      "認証状態",
      "使用レシピ数",
      "プロジェクト名",
      "プロジェクトID",
      "フォルダID",
      "作成日時",
    ],
    connections.map((c) => [
      c.id,
      c.name,
      c.application ?? "",
      c.authorization_status === "success"
        ? "認証済み"
        : (c.authorization_status ?? "未認証"),
      recipeCountMap.get(c.id) ?? 0,
      c.project_id ? (projectMap.get(c.project_id)?.name ?? "") : "",
      c.project_id ?? "",
      c.folder_id ?? "",
      formatDateJP(c.created_at, ""),
    ]),
  );
}
