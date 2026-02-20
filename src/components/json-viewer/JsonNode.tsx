// 再帰 JsonNode + TreeContent メモコンポーネント。

import { useState, useRef, memo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Row, PrimitiveValue, HighlightText } from "./primitives";

// ---------- internal types ----------

interface JsonNodeInternalProps {
  value: unknown;
  path: string;
  depth: number;
  defaultExpandDepth: number;
  highlightPaths: Set<string>;
  maskedPaths?: Map<string, string>;
  searchText: string;
  getNextLine: () => number;
  keyName?: string;
  isLast?: boolean;
}

// ---------- TreeContent (メモ化ラッパー) ----------

export const TreeContent = memo(function TreeContent({
  data,
  currentDepth,
  highlightPaths,
  maskedPaths,
  searchText,
}: {
  data: unknown;
  currentDepth: number;
  highlightPaths: Set<string>;
  maskedPaths?: Map<string, string>;
  searchText: string;
}) {
  const counterRef = useRef(0);
  // eslint-disable-next-line react-hooks/refs -- render-time line counter (intentional)
  counterRef.current = 0;
  const getNextLine = () => ++counterRef.current;
  return (
    <JsonNode
      value={data}
      path="$"
      depth={0}
      defaultExpandDepth={currentDepth}
      highlightPaths={highlightPaths}
      maskedPaths={maskedPaths}
      searchText={searchText}
      getNextLine={getNextLine}
    />
  );
});

// ---------- JsonNode (再帰) ----------

export function JsonNode({
  value,
  path,
  depth,
  defaultExpandDepth,
  highlightPaths,
  maskedPaths,
  searchText,
  getNextLine,
  keyName,
  isLast = true,
}: JsonNodeInternalProps) {
  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const isHighlighted = highlightPaths.has(path);
  const isMasked = maskedPaths?.has(path) ?? false;

  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);

  const keyLabel =
    keyName !== undefined ? (
      <span>
        <span className="text-purple-600">
          &quot;
          <HighlightText text={keyName} search={searchText} />
          &quot;
        </span>
        <span className="text-gray-500">: </span>
      </span>
    ) : null;

  const comma = isLast ? "" : ",";

  // --- leaf ---
  if (!isExpandable) {
    return (
      <Row
        lineNum={getNextLine()}
        depth={depth}
        path={path}
        highlighted={isHighlighted}
        masked={isMasked}
      >
        {keyLabel}
        <PrimitiveValue
          value={isMasked ? maskedPaths!.get(path)! : value}
          highlighted={isHighlighted && !isMasked}
          masked={isMasked}
          searchText={searchText}
        />
        <span className="text-gray-500">{comma}</span>
      </Row>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: v,
      }));

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  // --- collapsed ---
  if (!expanded) {
    return (
      <Row lineNum={getNextLine()} depth={depth} path={path}>
        <span className="inline-flex items-center">
          <button
            className="mr-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            onClick={() => setExpanded(true)}
          >
            <ChevronRight size={12} />
          </button>
          {keyLabel}
          <span className="text-gray-500">
            {openBracket} ... {closeBracket}
          </span>
          <span className="ml-1 text-gray-400">
            {entries.length} {isArray ? "items" : "keys"}
          </span>
          <span className="text-gray-500">{comma}</span>
        </span>
      </Row>
    );
  }

  // --- expanded ---
  return (
    <>
      <Row lineNum={getNextLine()} depth={depth} path={path}>
        <span className="inline-flex items-center">
          <button
            className="mr-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            onClick={() => setExpanded(false)}
          >
            <ChevronDown size={12} />
          </button>
          {keyLabel}
          <span className="text-gray-500">{openBracket}</span>
        </span>
      </Row>
      {entries.map((entry, i) => {
        const childPath = isArray
          ? `${path}[${entry.key}]`
          : `${path}.${entry.key}`;
        return (
          <JsonNode
            key={entry.key}
            keyName={isArray ? undefined : entry.key}
            value={entry.value}
            path={childPath}
            depth={depth + 1}
            defaultExpandDepth={defaultExpandDepth}
            highlightPaths={highlightPaths}
            maskedPaths={maskedPaths}
            searchText={searchText}
            getNextLine={getNextLine}
            isLast={i === entries.length - 1}
          />
        );
      })}
      <Row lineNum={getNextLine()} depth={depth}>
        <span className="text-gray-500">
          {closeBracket}
          {comma}
        </span>
      </Row>
    </>
  );
}
