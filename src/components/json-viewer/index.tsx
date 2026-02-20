// JSON ツリービューワー。
// 折りたたみ、行番号、検索(Enter確定)、機密情報スキャン、ミニマップ付き。

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronsDownUp,
  ShieldCheck,
  X,
  Search,
} from "lucide-react";
import { scanSensitiveData, type SensitiveFinding } from "../../lib/json";
import { TreeContent } from "./JsonNode";
import ScanResultPanel from "./ScanResultPanel";
import { scrollInContainer, flashAndScroll } from "./helpers";
import type { JsonViewerProps } from "./types";

export default function JsonViewer({
  data,
  defaultExpandDepth = Infinity,
  maskedPaths,
  onMaskedPathsChange,
}: JsonViewerProps) {
  const [resetKey, setResetKey] = useState(0);
  const [currentDepth, setCurrentDepth] = useState(defaultExpandDepth);
  const [findings, setFindings] = useState<SensitiveFinding[] | null>(null);
  const [rawSearch, setRawSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [markers, setMarkers] = useState<{ ratio: number }[]>([]);
  const [viewport, setViewport] = useState({ top: 0, height: 100 });
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const highlightPaths = useMemo(
    () =>
      findings ? new Set(findings.map((f) => f.path)) : new Set<string>(),
    [findings],
  );

  // --- expand / collapse ---

  const expandAll = useCallback(() => {
    setCurrentDepth(Infinity);
    setResetKey((k) => k + 1);
  }, []);

  const collapseAll = useCallback(() => {
    setCurrentDepth(0);
    setResetKey((k) => k + 1);
  }, []);

  // --- scan ---

  const runScan = useCallback(() => {
    const result = scanSensitiveData(data);
    setFindings(result);
    if (result.length > 0) {
      setCurrentDepth(Infinity);
      setResetKey((k) => k + 1);
    }
  }, [data]);

  const closeScan = useCallback(() => {
    setFindings(null);
    setMarkers([]);
  }, []);

  // --- jump to path ---

  const jumpToPath = useCallback((path: string) => {
    const container = scrollRef.current;
    if (!container) return;

    const el = container.querySelector(`[data-path="${CSS.escape(path)}"]`);

    if (!el) {
      setCurrentDepth(Infinity);
      setResetKey((k) => k + 1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const found =
            scrollRef.current?.querySelector(
              `[data-path="${CSS.escape(path)}"]`,
            ) ?? null;
          flashAndScroll(found as HTMLElement | null, scrollRef.current);
        });
      });
    } else {
      flashAndScroll(el as HTMLElement, container);
    }
  }, []);

  // --- minimap markers ---

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (!scrollRef.current || !findings || findings.length === 0) {
        setMarkers([]);
        return;
      }
      const container = scrollRef.current;
      const total = container.scrollHeight;
      if (total <= 0) return;
      const els = container.querySelectorAll('[data-highlighted="true"]');
      setMarkers(
        Array.from(els).map((el) => ({
          ratio: (el as HTMLElement).offsetTop / total,
        })),
      );
    });
    return () => cancelAnimationFrame(timer);
  }, [findings, resetKey]);

  // --- viewport tracking ---

  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= 0) return;
    setViewport({
      top: (el.scrollTop / el.scrollHeight) * 100,
      height: (el.clientHeight / el.scrollHeight) * 100,
    });
  }, []);

  useEffect(() => {
    updateViewport();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateViewport);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateViewport, resetKey]);

  // --- search match tracking ---

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (!searchText) {
        setSearchMatchCount(0);
        setCurrentMatchIdx(-1);
        return;
      }
      const count =
        scrollRef.current?.querySelectorAll("[data-search-match]").length ?? 0;
      setSearchMatchCount(count);
    });
    return () => cancelAnimationFrame(timer);
  }, [searchText, resetKey]);

  // 現在フォーカス中のマッチをオレンジで強調
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const els = container.querySelectorAll("[data-search-match]");
    els.forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.backgroundColor = "";
    });
    if (currentMatchIdx >= 0 && currentMatchIdx < els.length) {
      const current = els[currentMatchIdx] as HTMLElement;
      current.style.outline = "2px solid #f97316";
      current.style.backgroundColor = "rgba(249,115,22,0.3)";
    }
  }, [currentMatchIdx, searchText, resetKey]);

  const goToMatch = useCallback(
    (dir: 1 | -1) => {
      const container = scrollRef.current;
      const els = container?.querySelectorAll("[data-search-match]");
      if (!container || !els || els.length === 0) return;
      const next =
        dir === 1
          ? (currentMatchIdx + 1) % els.length
          : currentMatchIdx <= 0
            ? els.length - 1
            : currentMatchIdx - 1;
      setCurrentMatchIdx(next);
      scrollInContainer(els[next] as HTMLElement, container);
    },
    [currentMatchIdx],
  );

  // --- render ---

  return (
    <div className="flex flex-1 min-h-0 flex-col font-mono text-xs leading-relaxed">
      {/* ツールバー（固定） */}
      <div className="shrink-0 border-b border-gray-200 bg-gray-50/50 px-1 pb-2 pt-1">
        <div className="flex flex-wrap items-center gap-1">
          <button
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
            onClick={expandAll}
          >
            <ChevronsUpDown size={12} />
            Expand All
          </button>
          <button
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
            onClick={collapseAll}
          >
            <ChevronsDownUp size={12} />
            Collapse All
          </button>
          <button
            className="flex items-center gap-1 rounded border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-100"
            onClick={runScan}
          >
            <ShieldCheck size={12} />
            機密情報チェック
          </button>

          {/* 検索 */}
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <Search
                size={12}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = rawSearch.trim();
                    if (q !== searchText) {
                      setSearchText(q);
                      setCurrentMatchIdx(-1);
                    } else {
                      goToMatch(e.shiftKey ? -1 : 1);
                    }
                  }
                }}
                placeholder="検索（Enterで実行）..."
                className="w-44 rounded border border-gray-300 py-0.5 pl-7 pr-7 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
              {rawSearch && (
                <button
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setRawSearch("");
                    setSearchText("");
                    setCurrentMatchIdx(-1);
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
            {searchText && searchMatchCount > 0 && (
              <>
                <span className="whitespace-nowrap text-[10px] text-gray-500">
                  {currentMatchIdx >= 0 ? currentMatchIdx + 1 : "–"} /{" "}
                  {searchMatchCount}
                </span>
                <button
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => goToMatch(-1)}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => goToMatch(1)}
                >
                  <ChevronDown size={12} />
                </button>
              </>
            )}
            {searchText && searchMatchCount === 0 && (
              <span className="text-[10px] text-gray-400">0 件</span>
            )}
          </div>
        </div>

        {/* スキャン結果パネル（ツールバー内に固定表示） */}
        {findings !== null && (
          <div className="mt-2">
            <ScanResultPanel
              findings={findings}
              onClose={closeScan}
              maskedPaths={maskedPaths}
              onMaskedPathsChange={onMaskedPathsChange}
              onJumpTo={jumpToPath}
            />
          </div>
        )}
      </div>

      {/* ツリー + ミニマップ */}
      <div className="flex flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-1"
          onScroll={updateViewport}
        >
          <TreeContent
            key={resetKey}
            data={data}
            currentDepth={currentDepth}
            highlightPaths={highlightPaths}
            maskedPaths={maskedPaths}
            searchText={searchText}
          />
        </div>

        {/* ミニマップ */}
        {markers.length > 0 && (
          <div className="relative w-3 shrink-0 border-l border-gray-200 bg-gray-50/50">
            {markers.map((m, i) => (
              <div
                key={i}
                className="absolute left-0.5 h-1 w-2 rounded-full bg-red-400"
                style={{ top: `${m.ratio * 100}%` }}
              />
            ))}
            <div
              className="absolute left-0 w-full rounded bg-gray-400/30"
              style={{
                top: `${viewport.top}%`,
                height: `${Math.max(viewport.height, 2)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
