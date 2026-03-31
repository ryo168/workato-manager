// マークダウンエディタページ。
// 左にテキストエリア、右にプレビューの分割ペイン。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileEdit,
  Eye,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Bold,
  Type,
  Printer,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useGemini } from "../context/GeminiContext";
import { saveMarkdownFile } from "../lib/tauri";
import { PAGE, HEADER_ROW, CARD } from "../lib/tw";

// Undo/Redo 用のスナップショット
interface Snapshot {
  text: string;
  selStart: number;
  selEnd: number;
}

const MAX_HISTORY = 200;

/** プレビューの HTML を iframe に流し込んで印刷ダイアログ（PDF保存）を開く */
function printPreview(previewEl: HTMLElement) {
  const css = `
    @page { margin: 15mm 15mm; }
    * { box-sizing: border-box; }
    body {
      background: #fff;
      color: #1f2937;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, h5, h6 { color: #111827; margin-top: 1.25em; margin-bottom: 0.5em; }
    h1 { font-size: 1.4em; padding-bottom: 0.25em; border-bottom: 1px solid #e5e7eb; }
    h2 { font-size: 1.25em; }
    h3 { font-size: 1.1em; }
    p { margin: 0 0 0.5em; }
    ul { list-style-type: disc; padding-left: 1.5em; margin: 0 0 0.5em; }
    ol { list-style-type: decimal; padding-left: 1.5em; margin: 0 0 0.5em; }
    li { margin-bottom: 0.15em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 0.75em; }
    th, td { border: 1px solid #d1d5db; padding: 6px 12px; font-size: 0.875em; }
    th { background: #f9fafb; font-weight: 600; font-size: 0.75em; text-align: left; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
    code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; font-family: monospace; }
    pre { background: #111827; color: #f3f4f6; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 0.75em; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #d1d5db; padding-left: 1em; margin: 0 0 0.5em; font-style: italic; color: #6b7280; }
    a { color: #3b82f6; text-decoration: underline; }
    img { max-width: 100%; }
  `;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${previewEl.innerHTML}</body></html>`);
  doc.close();

  iframe.contentWindow?.addEventListener("afterprint", () => {
    document.body.removeChild(iframe);
  });

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 3000);
  }, 300);
}

export default function MarkdownEditorPage() {
  const { pendingMarkdown, setPendingMarkdown } = useGemini();

  const [text, setText] = useState("");
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  // ref の長さをレンダリングで参照するための state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncStackState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  // pendingMarkdown を受け取る（GeminiContext からの外部値反映）
  useEffect(() => {
    if (pendingMarkdown != null) {
      setText(pendingMarkdown); // eslint-disable-line react-hooks/set-state-in-effect
      undoStack.current = [];
      redoStack.current = [];
      syncStackState();
      setPendingMarkdown(null);
    }
  }, [pendingMarkdown, setPendingMarkdown, syncStackState]);

  // Undo スナップショット保存（現在の text を明示的に受け取る）
  const pushUndo = useCallback((currentText: string) => {
    const ta = textareaRef.current;
    undoStack.current.push({
      text: currentText,
      selStart: ta?.selectionStart ?? 0,
      selEnd: ta?.selectionEnd ?? 0,
    });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    syncStackState();
  }, [syncStackState]);

  const handleUndo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    const ta = textareaRef.current;
    redoStack.current.push({
      text,
      selStart: ta?.selectionStart ?? 0,
      selEnd: ta?.selectionEnd ?? 0,
    });
    setText(snap.text);
    syncStackState();
    requestAnimationFrame(() => {
      if (ta) {
        ta.selectionStart = snap.selStart;
        ta.selectionEnd = snap.selEnd;
        ta.focus();
      }
    });
  }, [text, syncStackState]);

  const handleRedo = useCallback(() => {
    const snap = redoStack.current.pop();
    if (!snap) return;
    const ta = textareaRef.current;
    undoStack.current.push({
      text,
      selStart: ta?.selectionStart ?? 0,
      selEnd: ta?.selectionEnd ?? 0,
    });
    setText(snap.text);
    syncStackState();
    requestAnimationFrame(() => {
      if (ta) {
        ta.selectionStart = snap.selStart;
        ta.selectionEnd = snap.selEnd;
        ta.focus();
      }
    });
  }, [text, syncStackState]);

  // 選択テキストをラップするヘルパー
  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.substring(start, end);

    pushUndo(text);
    const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
    setText(newText);

    requestAnimationFrame(() => {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = end + prefix.length;
      ta.focus();
    });
  }, [text, pushUndo]);

  // テーブル挿入
  const insertTable = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;

    pushUndo(text);
    const table = "\n| 列1 | 列2 | 列3 |\n|---|---|---|\n| | | |\n| | | |\n";
    const newText = text.substring(0, pos) + table + text.substring(pos);
    setText(newText);

    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = pos + table.length;
      ta.focus();
    });
  }, [text, pushUndo]);

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
            break;
          case "y":
            e.preventDefault();
            handleRedo();
            break;
          case "b":
            e.preventDefault();
            wrapSelection("**", "**");
            break;
          case "s":
            e.preventDefault();
            if (text.trim()) saveMarkdownFile("output.md", text);
            break;
          case "t":
            e.preventDefault();
            insertTable();
            break;
        }
      }
    },
    [handleUndo, handleRedo, wrapSelection, insertTable, text],
  );

  // テキスト変更
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      pushUndo(text);
      setText(e.target.value);
    },
    [text, pushUndo],
  );

  const handleClear = useCallback(() => {
    if (text.trim()) pushUndo(text);
    setText("");
  }, [text, pushUndo]);

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25">
            <FileEdit size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">Markdown Editor</h1>
            <p className="text-xs text-gray-400 mt-0.5">マークダウンの編集・プレビュー・PDF出力</p>
          </div>
          {text && (
            <span className="text-xs text-gray-400">{text.length.toLocaleString()} 文字</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (previewRef.current) printPreview(previewRef.current); }}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            title="PDF出力（印刷ダイアログ）"
          >
            <Printer size={14} />
            PDF
          </button>
          <button
            onClick={() => { if (text.trim()) saveMarkdownFile("output.md", text); }}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download size={14} />
            保存
          </button>
          <button
            onClick={handleClear}
            disabled={!text}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <Trash2 size={16} />
            クリア
          </button>
        </div>
      </div>

      {/* ツールバー */}
      <div className="flex items-center gap-1 mb-3 px-1">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
          title="やり直し (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          onClick={() => wrapSelection("**", "**")}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200"
          title="太字 (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={insertTable}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200"
          title="テーブル挿入 (Ctrl+T)"
        >
          <Type size={16} />
        </button>
        <button
          onClick={() => wrapSelection('<span style="color:red">', "</span>")}
          className="rounded p-1.5 text-red-400 hover:bg-red-50"
          title="赤文字"
        >
          <span className="text-xs font-bold">A</span>
        </button>
      </div>

      {/* エディタ + プレビュー分割ペイン */}
      <div className="flex gap-3 h-[calc(100vh-200px)]">
        {/* エディタペイン */}
        {!editorCollapsed ? (
          <div className={`${CARD} flex flex-col ${previewCollapsed ? "flex-1" : "w-1/2"}`}>
            <div className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-t-lg border-b border-gray-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <FileEdit size={12} />
                エディタ
              </div>
              <button
                onClick={() => setEditorCollapsed(true)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-200"
                title="エディタを閉じる"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="flex-1 w-full resize-none border-0 bg-white px-4 py-3 font-mono text-sm focus:outline-none rounded-b-lg"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="マークダウンを入力..."
              spellCheck={false}
            />
          </div>
        ) : (
          <button
            onClick={() => setEditorCollapsed(false)}
            className="flex items-center rounded-lg border border-gray-200 bg-white px-1 hover:bg-gray-50"
            title="エディタを開く"
          >
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        )}

        {/* プレビューペイン */}
        {!previewCollapsed ? (
          <div className={`${CARD} flex flex-col ${editorCollapsed ? "flex-1" : "w-1/2"}`}>
            <div className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-t-lg border-b border-gray-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <Eye size={12} />
                プレビュー
              </div>
              <button
                onClick={() => setPreviewCollapsed(true)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-200"
                title="プレビューを閉じる"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-b-lg">
              {text.trim() ? (
                <div ref={previewRef} className="prose prose-sm max-w-none px-5 py-4 text-gray-700 prose-headings:text-gray-800 prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-5 prose-h1:pb-1 prose-h1:border-b prose-h1:border-gray-200 prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-base prose-h3:mb-2 prose-h3:mt-3 prose-h4:text-sm prose-h4:mt-3 prose-p:mb-2 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-2 prose-li:mb-0.5 prose-table:border-collapse prose-table:w-full prose-table:mb-3 prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-1.5 prose-td:text-sm prose-hr:my-4 prose-hr:border-gray-300 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:mb-3 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:mb-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {text}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  プレビューがここに表示されます
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPreviewCollapsed(false)}
            className="flex items-center rounded-lg border border-gray-200 bg-white px-1 hover:bg-gray-50"
            title="プレビューを開く"
          >
            <ChevronLeft size={16} className="text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
