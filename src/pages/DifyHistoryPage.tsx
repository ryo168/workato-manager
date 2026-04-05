// Dify 実行履歴ページ。
// 過去の実行結果を一覧表示し、詳細閲覧・削除ができる。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  History,
  Eye,
  Trash2,
  RefreshCw,
  Clock,
  Coins,
  FileText,
  GitGraph,
  AlertCircle,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Workflow,
  FileEdit,
  Server,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  loadHistoryList,
  loadHistoryDetail,
  deleteHistoryEntry,
  saveMarkdownFile,
  saveDrawioFile,
} from "../lib/tauri";
import Modal from "../components/Modal";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import { useGemini } from "../context/GeminiContext";
import {
  PAGE,
  HEADER_ROW,
  CARD,
  TABLE,
  TH,
  TD,
  TR_HOVER,
  BTN_OUTLINED_SM,
  BTN_OUTLINED_SM_ERROR,
  PROSE_MARKDOWN,
} from "../lib/tw";
import type { HistoryEntry, HistoryDetail } from "../types/workato";

/** draw.io viewer 用の HTML を生成 */
function buildDrawioHtml(xml: string): string {
  let s = xml
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  s = s
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;overflow:hidden">
<div class="mxgraph" data-mxgraph='{"highlight":"#0000ff","nav":true,"resize":true,"xml":"${s}"}'>
</div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body></html>`;
}

type SourceFilter = "all" | "dify" | "gemini" | "workato";

export default function DifyHistoryPage() {
  const navigate = useNavigate();
  const { setPendingMarkdown } = useGemini();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // 詳細モーダル
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"markdown" | "drawio">("markdown");
  const [drawioZoom, setDrawioZoom] = useState(100);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadHistoryList();
      setEntries(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleViewDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetail(null);
    setDetailTab("markdown");
    setDrawioZoom(100);
    try {
      const d = await loadHistoryDetail(id);
      setDetail(d);
      // MD がなければ drawio タブを選択
      if (!d.markdown && d.drawio) {
        setDetailTab("drawio");
      }
    } catch (e) {
      setError(String(e));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteHistoryEntry(deleteTarget);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget));
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // フィルタリング
  const filteredEntries = useMemo(() => {
    if (sourceFilter === "all") return entries;
    return entries.filter((e) => {
      const src = e.source || "dify"; // 旧データは dify 扱い
      return src === sourceFilter;
    });
  }, [entries, sourceFilter]);

  const drawioHtml = useMemo(
    () => (detail?.drawio ? buildDrawioHtml(detail.drawio) : null),
    [detail?.drawio],
  );

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-lg shadow-blue-400/25">
            <History size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">History</h1>
            <p className="text-xs text-gray-400 mt-0.5">Dify・Gemini・Workato の実行履歴</p>
          </div>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            {filteredEntries.length}件
          </span>
        </div>
        <button className={BTN_OUTLINED_SM} onClick={fetchList} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          更新
        </button>
      </div>

      {/* ソースフィルタ */}
      <div className="flex items-center gap-1 mb-4">
        {([
          { id: "all" as SourceFilter, label: "すべて", icon: <History size={13} /> },
          { id: "dify" as SourceFilter, label: "Dify", icon: <Workflow size={13} /> },
          { id: "gemini" as SourceFilter, label: "Gemini", icon: <Sparkles size={13} /> },
          { id: "workato" as SourceFilter, label: "Workato", icon: <Server size={13} /> },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setSourceFilter(f.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sourceFilter === f.id
                ? "bg-primary text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <AlertBanner severity="error" className="mb-5">
          {error}
        </AlertBanner>
      )}

      {loading && filteredEntries.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center py-20`}>
          <History size={48} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">実行履歴がありません</p>
        </div>
      ) : (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>日時</th>
                  <th className={TH}>ソース</th>
                  <th className={TH}>ステータス</th>
                  <th className={TH}>実行時間</th>
                  <th className={TH}>トークン</th>
                  <th className={TH}>出力</th>
                  <th className={TH}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className={TR_HOVER}>
                    <td className={`${TD} whitespace-nowrap text-xs text-gray-600`}>
                      {entry.timestamp}
                    </td>
                    <td className={TD}>
                      {(() => {
                        const src = entry.source || "dify";
                        const badge = src === "gemini"
                          ? { bg: "bg-purple-50 text-purple-600", icon: <Sparkles size={10} />, label: "Gemini" }
                          : src === "workato"
                            ? { bg: "bg-cyan-50 text-cyan-600", icon: <Server size={10} />, label: "Workato" }
                            : { bg: "bg-blue-50 text-blue-600", icon: <Workflow size={10} />, label: "Dify" };
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className={TD}>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.status === "succeeded"
                            ? "bg-green-100 text-green-700"
                            : entry.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className={`${TD} text-xs text-gray-500`}>
                      {entry.elapsed_time != null ? (
                        <span className="flex items-center justify-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          {entry.elapsed_time.toFixed(2)}s
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={`${TD} text-xs text-gray-500`}>
                      {entry.total_tokens != null ? (
                        <span className="flex items-center justify-center gap-1">
                          <Coins size={12} className="text-gray-400" />
                          {entry.total_tokens.toLocaleString()}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-1.5">
                        {entry.has_markdown && (
                          <span title="Markdown">
                            <FileText size={14} className="text-blue-400" />
                          </span>
                        )}
                        {entry.has_drawio && (
                          <span title="draw.io">
                            <GitGraph size={14} className="text-emerald-400" />
                          </span>
                        )}
                        {!entry.has_markdown && !entry.has_drawio && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => handleViewDetail(entry.id)}
                          title="詳細を見る"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          onClick={() => setDeleteTarget(entry.id)}
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-500" />
            <span>実行詳細</span>
            {detail && (
              <span className="text-xs font-normal text-gray-400">
                {detail.entry.timestamp}
              </span>
            )}
          </div>
        }
        maxWidth="max-w-4xl"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : detail ? (
          <div>
            {/* メタ情報 */}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  detail.entry.status === "succeeded"
                    ? "bg-green-100 text-green-700"
                    : detail.entry.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {detail.entry.status}
              </span>
              {detail.entry.elapsed_time != null && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  {detail.entry.elapsed_time.toFixed(2)}s
                </span>
              )}
              {detail.entry.total_tokens != null && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Coins size={12} />
                  {detail.entry.total_tokens.toLocaleString()} tokens
                </span>
              )}
            </div>

            {detail.entry.error && (
              <AlertBanner severity="error" className="mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span className="text-sm">{detail.entry.error}</span>
                </div>
              </AlertBanner>
            )}

            {/* タブ */}
            {(detail.markdown || detail.drawio) && (
              <>
                <div className="flex gap-1 border-b border-gray-200 mb-4">
                  {detail.markdown && (
                    <button
                      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                        detailTab === "markdown"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                      onClick={() => setDetailTab("markdown")}
                    >
                      <FileText size={14} />
                      マークダウン
                    </button>
                  )}
                  {detail.drawio && (
                    <button
                      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                        detailTab === "drawio"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                      onClick={() => setDetailTab("drawio")}
                    >
                      <GitGraph size={14} />
                      draw.io
                    </button>
                  )}
                </div>

                {/* マークダウン表示 */}
                {detailTab === "markdown" && detail.markdown && (
                  <div>
                    <div className="flex justify-end gap-2 mb-2">
                      <button
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-600 hover:bg-teal-100/60"
                        onClick={() => {
                          setPendingMarkdown(detail.markdown!);
                          setDetailOpen(false);
                          navigate("/markdown-editor");
                        }}
                      >
                        <FileEdit size={14} />
                        編集
                      </button>
                      <button
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100/60"
                        onClick={() => saveMarkdownFile("output.md", detail.markdown!)}
                      >
                        <Download size={14} />
                        保存
                      </button>
                    </div>
                    <div className={PROSE_MARKDOWN}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {detail.markdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* draw.io 表示 */}
                {detailTab === "drawio" && drawioHtml && detail.drawio && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1">
                        <button
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          onClick={() => setDrawioZoom((z) => Math.max(20, z - 10))}
                          title="縮小"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <span className="min-w-[3rem] text-center text-xs font-medium text-gray-600">
                          {drawioZoom}%
                        </span>
                        <button
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          onClick={() => setDrawioZoom((z) => Math.min(300, z + 10))}
                          title="拡大"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          onClick={() => setDrawioZoom(100)}
                          title="リセット"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                      <button
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-100/60"
                        onClick={() => saveDrawioFile("output.drawio", detail.drawio!)}
                      >
                        <Download size={14} />
                        保存
                      </button>
                    </div>
                    <div className="overflow-auto" style={{ maxHeight: 500 }}>
                      <div style={{ zoom: drawioZoom / 100 }}>
                        <iframe
                          srcDoc={drawioHtml}
                          referrerPolicy="no-referrer"
                          className="w-full rounded border border-gray-200"
                          style={{ height: 1200, pointerEvents: "none" }}
                          title="draw.io Preview"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 出力なし */}
            {!detail.markdown && !detail.drawio && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FileText size={32} className="mb-2" />
                <p className="text-sm">出力データがありません</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 削除確認モーダル */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="削除確認"
        maxWidth="max-w-sm"
        footer={
          <>
            <button className={BTN_OUTLINED_SM} onClick={() => setDeleteTarget(null)}>
              キャンセル
            </button>
            <button className={BTN_OUTLINED_SM_ERROR} onClick={handleDelete}>
              <Trash2 size={14} />
              削除
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          この実行履歴を削除しますか？この操作は取り消せません。
        </p>
      </Modal>
    </div>
  );
}
