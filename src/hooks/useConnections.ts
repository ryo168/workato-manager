/**
 * @file コネクションページ用カスタムフック
 * 4種フィルタ（名前・アプリ・認証状態・プロジェクト）、ソート、
 * レシピ使用数集計、プロジェクト紐付けをまとめて管理する。
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConnections, getProjects, getRecipes } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { sortRows } from "../lib/sort";
import { useTableSort } from "./useTableSort";
import type { Project, Connection } from "../types/workato";

export interface ConnectionFilters {
  name: string;
  application: string;
  authorization_status: string;
  project: string;
}

const INITIAL_FILTERS: ConnectionFilters = {
  name: "",
  application: "",
  authorization_status: "",
  project: "",
};

/** コネクションページのデータ取得・フィルタ・ソートを一括管理するフック */
export function useConnections() {
  const { activeProfile } = useConfig();
  const [filters, setFilters] = useState<ConnectionFilters>(INITIAL_FILTERS);
  const { sort, onSort } = useTableSort();

  const hasToken = !!activeProfile?.api_token;

  const { data, isLoading, error, refetch: refetchConn, isFetching } = useQuery({
    queryKey: ["connections"],
    queryFn: getConnections,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: projects, refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: recipes, refetch: refetchRecipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: getRecipes,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // コネクション ID → 使用レシピ数のマップを構築する。
  // レシピの config 配列内の account_id がコネクション ID に対応する。
  // 同一レシピ内で同じコネクションが複数回参照されても 1回 としてカウントする（seen で重複排除）。
  const recipeCountMap = useMemo(() => {
    const map = new Map<number, number>();
    (recipes ?? []).forEach((recipe) => {
      const seen = new Set<number>();
      recipe.config.forEach((entry) => {
        if (entry.account_id != null) {
          // account_id は API レスポンスで string の場合があるため数値に変換
          const id =
            typeof entry.account_id === "string"
              ? parseInt(entry.account_id, 10)
              : Number(entry.account_id);
          if (!isNaN(id) && !seen.has(id)) {
            seen.add(id);
            map.set(id, (map.get(id) ?? 0) + 1);
          }
        }
      });
    });
    return map;
  }, [recipes]);

  // プロジェクト ID → Project オブジェクトの逆引きマップ。
  // コネクションの project_id からプロジェクト名を高速に取得するために使用。
  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    (projects ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const uniqueApps = useMemo(() => {
    const vals = new Set(
      (data ?? []).map((c) => c.application ?? "").filter(Boolean),
    );
    return Array.from(vals).sort();
  }, [data]);

  const uniqueProjects = useMemo(() => {
    const vals = new Set(
      (data ?? [])
        .map((c) =>
          c.project_id ? projectMap.get(c.project_id)?.name : undefined,
        )
        .filter((v): v is string => v !== undefined && v !== ""),
    );
    return Array.from(vals).sort();
  }, [data, projectMap]);

  const getConnValue = useMemo(
    () =>
      (c: Connection, col: string): string | number | null | undefined => {
        switch (col) {
          case "name":
            return c.name;
          case "application":
            return c.application ?? null;
          case "authorization_status":
            return c.authorization_status ?? null;
          case "recipe_count":
            return recipeCountMap.get(c.id) ?? 0;
          case "project":
            return c.project_id
              ? (projectMap.get(c.project_id)?.name ?? null)
              : null;
          case "created_at":
            return c.created_at ?? null;
          default:
            return null;
        }
      },
    [projectMap, recipeCountMap],
  );

  const filtered = useMemo(() => {
    const base = (data ?? []).filter((conn) => {
      if (
        filters.name &&
        !conn.name.toLowerCase().includes(filters.name.toLowerCase())
      )
        return false;
      if (
        filters.application &&
        (conn.application ?? "") !== filters.application
      )
        return false;
      if (filters.authorization_status) {
        const ok =
          filters.authorization_status === "success"
            ? conn.authorization_status === "success"
            : conn.authorization_status !== "success";
        if (!ok) return false;
      }
      if (filters.project) {
        const name = conn.project_id
          ? (projectMap.get(conn.project_id)?.name ?? "")
          : "";
        if (name !== filters.project) return false;
      }
      return true;
    });
    return sortRows(base, sort.col, sort.dir, getConnValue);
  }, [data, filters, projectMap, sort, getConnValue]);

  const hasFilter = Object.values(filters).some(Boolean);
  const clearFilters = () => setFilters(INITIAL_FILTERS);

  // 更新ボタンで全データまとめて取得
  const refetch = useCallback(() => {
    refetchConn();
    refetchProjects();
    refetchRecipes();
  }, [refetchConn, refetchProjects, refetchRecipes]);

  return {
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
  } as const;
}
