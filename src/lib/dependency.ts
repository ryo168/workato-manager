// プロジェクト外依存の検出ユーティリティ。
// レシピの code / config から flow_id / account_id を抽出する。

import { normalizeRecipeCode } from "./json";
import type { Recipe } from "../types/workato";

// --- flow_id 抽出 ---

// code JSON を再帰的に走査し、"flow_id" キーの値を全て収集する
export function extractFlowIds(recipes: Recipe[]): Set<number> {
  const ids = new Set<number>();
  for (const recipe of recipes) {
    const code = normalizeRecipeCode(recipe.code);
    if (code && typeof code === "object") {
      walkForKey(code, "flow_id", ids);
    }
  }
  return ids;
}

function walkForKey(
  value: unknown,
  targetKey: string,
  result: Set<number>,
): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      walkForKey(item, targetKey, result);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === targetKey) {
        const num = toNumber(val);
        if (num !== null) result.add(num);
      } else {
        walkForKey(val, targetKey, result);
      }
    }
  }
}

// --- account_id 抽出 ---

// レシピの config[] から account_id を収集する
export function extractAccountIds(recipes: Recipe[]): Set<number> {
  const ids = new Set<number>();
  for (const recipe of recipes) {
    for (const entry of recipe.config) {
      const num = toNumber(entry.account_id);
      if (num !== null) ids.add(num);
    }
  }
  return ids;
}

// --- 外部 ID 判定 ---

// allIds のうち projectIds に含まれないものを返す
export function findExternalIds(
  allIds: Set<number>,
  projectIds: Set<number>,
): number[] {
  const external: number[] = [];
  for (const id of allIds) {
    if (!projectIds.has(id)) external.push(id);
  }
  return external.sort((a, b) => a - b);
}

// --- ヘルパー ---

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
