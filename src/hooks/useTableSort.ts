// テーブルのソート状態を管理するフック。各ページ共通。

import { useState, useCallback } from "react";
import { toggleSort, type SortState } from "../lib/sort";

export function useTableSort(
  initialCol: string | null = null,
  initialDir: "asc" | "desc" = "asc",
) {
  const [sort, setSort] = useState<SortState>({
    col: initialCol,
    dir: initialDir,
  });

  const onSort = useCallback((col: string) => {
    setSort((s) => toggleSort(s, col));
  }, []);

  return { sort, onSort } as const;
}
