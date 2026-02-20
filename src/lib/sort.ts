// テーブルのソートロジック。全ページ共通で使う。

export type SortDir = "asc" | "desc";

export interface SortState {
  col: string | null;
  dir: SortDir;
}

// 同じカラムクリックで asc ⇔ desc 切り替え、別カラムなら asc にリセット
export function toggleSort(state: SortState, col: string): SortState {
  if (state.col === col)
    return { col, dir: state.dir === "asc" ? "desc" : "asc" };
  return { col, dir: "asc" };
}

// 行配列をソートして新しい配列で返す（元は壊さない）
export function sortRows<T>(
  rows: T[],
  col: string | null,
  dir: SortDir,
  getValue: (r: T, c: string) => string | number | null | undefined,
): T[] {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const va = getValue(a, col),
      vb = getValue(b, col);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp =
      typeof va === "string"
        ? va.localeCompare(vb as string, "ja")
        : (va as number) - (vb as number);
    return dir === "asc" ? cmp : -cmp;
  });
}
