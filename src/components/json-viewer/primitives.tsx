// Row, PrimitiveValue, HighlightText プリミティブコンポーネント。

import { memo, type ReactNode } from "react";

// ---------- Row ----------

export const Row = memo(function Row({
  lineNum,
  depth,
  path,
  highlighted,
  masked,
  children,
}: {
  lineNum: number;
  depth: number;
  path?: string;
  highlighted?: boolean;
  masked?: boolean;
  children: ReactNode;
}) {
  const bgClass = masked
    ? "bg-yellow-100/60"
    : highlighted
      ? "bg-red-100/60"
      : "";

  return (
    <div
      className={`flex items-start hover:bg-gray-100/40 ${bgClass}`}
      data-path={path}
      data-highlighted={highlighted ? "true" : undefined}
    >
      <span className="w-10 shrink-0 select-none border-r border-gray-200 pr-2 text-right text-[10px] leading-[1.65rem] text-gray-400">
        {lineNum}
      </span>
      <div
        className="min-w-0 flex-1 pl-1"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {children}
      </div>
    </div>
  );
});

// ---------- PrimitiveValue ----------

export function PrimitiveValue({
  value,
  highlighted,
  masked,
  searchText,
}: {
  value: unknown;
  highlighted?: boolean;
  masked?: boolean;
  searchText: string;
}) {
  if (value === null) {
    return <span className="text-gray-400">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-orange-500">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-blue-600">{String(value)}</span>;
  }
  if (typeof value === "string") {
    const colorClass = masked
      ? "font-semibold text-yellow-700"
      : highlighted
        ? "font-semibold text-red-600"
        : "text-green-600";
    return (
      <span className={colorClass}>
        &quot;
        <HighlightText text={value} search={searchText} />
        &quot;
      </span>
    );
  }
  return <span className="text-gray-500">{String(value)}</span>;
}

// ---------- HighlightText ----------

export function HighlightText({
  text,
  search,
}: {
  text: string;
  search: string;
}) {
  if (!search) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let pos = lowerText.indexOf(lowerSearch, lastIdx);
  let key = 0;

  while (pos !== -1) {
    if (pos > lastIdx) {
      parts.push(<span key={key++}>{text.slice(lastIdx, pos)}</span>);
    }
    parts.push(
      <mark
        key={key++}
        data-search-match
        className="rounded-sm bg-yellow-300/70 text-inherit"
      >
        {text.slice(pos, pos + search.length)}
      </mark>,
    );
    lastIdx = pos + search.length;
    pos = lowerText.indexOf(lowerSearch, lastIdx);
  }

  if (parts.length === 0) return <>{text}</>;
  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  }
  return <>{parts}</>;
}
