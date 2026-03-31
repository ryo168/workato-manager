/**
 * JsonNode.tsx — 再帰的JSONツリー表示コンポーネント
 *
 * JSON データを受け取り、ツリー構造として展開・折りたたみ可能な形で描画する。
 * JsonNode が自身を再帰呼び出しすることで、ネストの深さに関係なく任意の JSON を表示できる。
 * TreeContent はエントリーポイントとして行番号カウンタを初期化し、memo 化により
 * 不要な再レンダーを防止する。
 */

import { useState, useRef, memo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Row, PrimitiveValue, HighlightText } from "./primitives";

// ---------- internal types ----------

interface JsonNodeInternalProps {
  value: unknown;
  /** JSONPath 形式のパス（例: "$.foo[0].bar"）。highlight / mask の照合に使う */
  path: string;
  /** 現在のネスト深度。インデントと初期展開判定に利用 */
  depth: number;
  /** この深度未満のノードを初期状態で展開する閾値 */
  defaultExpandDepth: number;
  /** ハイライト対象のパス集合。検索ヒット箇所などを視覚的に強調するために使う */
  highlightPaths: Set<string>;
  /** マスク対象のパス→表示文字列のマップ。APIキー等の機密値を隠すために使う */
  maskedPaths?: Map<string, string>;
  searchText: string;
  /** 呼び出すたびにインクリメントされた行番号を返すクロージャ */
  getNextLine: () => number;
  keyName?: string;
  isLast?: boolean;
}

// ---------- TreeContent (メモ化ラッパー) ----------

/**
 * ツリー描画のエントリーポイント。
 * memo 化することで、data / currentDepth / highlightPaths 等が変わらない限り
 * 再帰ツリー全体の再レンダーをスキップし、大きな JSON でもパフォーマンスを維持する。
 */
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
  /**
   * 行番号カウンタ。useRef で保持し、毎レンダー先頭で 0 にリセットする。
   * レンダー中に getNextLine() を呼ぶたびにインクリメントされるため、
   * 再帰的に描画される全ノードに通し番号が振られる。
   * useState ではなく useRef を使うのは、カウンタ更新で再レンダーを誘発させないため。
   */
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

/**
 * JSON の 1 ノードを描画するコンポーネント。
 * - プリミティブ値（string / number / boolean / null）はリーフとして描画
 * - オブジェクト・配列は子要素ごとに JsonNode を再帰呼び出しして描画
 * この再帰構造により、任意の深さの JSON を統一的に扱える。
 */
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
  /** パスが highlightPaths に含まれていれば、行全体を強調表示する */
  const isHighlighted = highlightPaths.has(path);
  /** マスク対象の場合、実際の値の代わりに maskedPaths の代替文字列を表示する */
  const isMasked = maskedPaths?.has(path) ?? false;

  /**
   * 展開状態の管理。depth が defaultExpandDepth 未満なら初期展開する。
   * これにより「最初の N 階層だけ開いた状態」を実現している。
   */
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

  /** 末尾要素以外はカンマを付与して JSON らしい見た目にする */
  const comma = isLast ? "" : ",";

  // --- leaf（プリミティブ値）: 再帰の終端条件 ---
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

  /**
   * オブジェクト・配列の子要素を統一的な { key, value } 形式に変換する。
   * 配列はインデックスを key に、オブジェクトはプロパティ名を key にする。
   */
  const entries = isArray
    ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: v,
      }));

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  // --- collapsed（折りたたみ時）: 要素数だけ表示して中身を省略 ---
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

  // --- expanded（展開時）: 開き括弧 → 子ノードを再帰描画 → 閉じ括弧 ---
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
        /** 子ノードの JSONPath を構築。配列は [index]、オブジェクトは .key 形式 */
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
