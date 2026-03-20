// Gemini マークダウン生成ページ。
// JSON + プロンプトを送信してマークダウンを生成する。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Play,
  AlertCircle,
  Download,
  Trash2,
  Clock,
  Coins,
  Terminal,
  Braces,
  Copy,
  FileText,
  Save,
  BookmarkPlus,
  FolderOpen,
  CheckCircle,
  FileEdit,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { geminiRun, saveMarkdownFile, loadGeminiPrompts, saveGeminiPrompts, saveHistoryEntry } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { useGemini } from "../context/GeminiContext";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import { PAGE, HEADER_ROW, CARD, BTN_PRIMARY, BTN_OUTLINED_SM, INPUT_SM } from "../lib/tw";
import type { SavedPrompt } from "../types/workato";

/** テキストをクリップボードにコピー */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function GeminiPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const {
    prompt,
    setPrompt,
    jsonInput,
    setJsonInput,
    result,
    setResult,
    error,
    setError,
    running,
    setRunning,
    setPendingMarkdown,
  } = useGemini();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState("markdown");
  const [copied, setCopied] = useState(false);

  // プロンプト保存（Tauri ファイル）
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [activePromptName, setActivePromptName] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);
  const [overwriteSaved, setOverwriteSaved] = useState(false);

  // 起動時にプロンプト読み込み
  useEffect(() => {
    loadGeminiPrompts().then(setSavedPrompts).catch(() => {});
  }, []);

  // プロンプト保存
  const handleSavePrompt = useCallback(async () => {
    const name = savePromptName.trim();
    if (!name || !prompt.trim()) return;
    const updated = savedPrompts.filter((p) => p.name !== name);
    updated.push({ name, content: prompt });
    await saveGeminiPrompts(updated).catch(() => {});
    setSavedPrompts(updated);
    setActivePromptName(name);
    setSaveModalOpen(false);
    setSavePromptName("");
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  }, [savePromptName, prompt, savedPrompts]);

  // プロンプト上書き保存
  const handleOverwritePrompt = useCallback(async () => {
    if (!activePromptName || !prompt.trim()) return;
    const updated = savedPrompts.map((p) =>
      p.name === activePromptName ? { ...p, content: prompt } : p,
    );
    await saveGeminiPrompts(updated).catch(() => {});
    setSavedPrompts(updated);
    setOverwriteSaved(true);
    setTimeout(() => setOverwriteSaved(false), 1500);
  }, [activePromptName, prompt, savedPrompts]);

  // プロンプト読み込み
  const handleLoadPrompt = useCallback((sp: SavedPrompt) => {
    setPrompt(sp.content);
    setActivePromptName(sp.name);
    setLoadModalOpen(false);
  }, [setPrompt]);

  // プロンプト削除
  const handleDeletePrompt = useCallback(async (name: string) => {
    const updated = savedPrompts.filter((p) => p.name !== name);
    await saveGeminiPrompts(updated).catch(() => {});
    setSavedPrompts(updated);
    if (activePromptName === name) setActivePromptName(null);
  }, [savedPrompts, activePromptName]);

  // 実行中の経過秒数タイマー
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [running]);

  const activeGemini = config?.gemini_profiles?.find(
    (p) => p.name === config.active_gemini_profile,
  );
  const geminiConfigured = !!(activeGemini?.api_key);

  // タブ定義
  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: React.ReactNode }[] = [];
    if (result?.markdown) t.push({ id: "markdown", label: "マークダウン", icon: <FileText size={14} /> });
    t.push({ id: "api", label: "API", icon: <Terminal size={14} /> });
    return t;
  }, [result]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const handleRunClick = useCallback(() => {
    if (!jsonInput.trim() || !prompt.trim()) return;
    try { JSON.parse(jsonInput); } catch {
      setError("入力された JSON が不正です。正しい JSON を入力してください。");
      return;
    }
    setConfirmOpen(true);
  }, [jsonInput, prompt, setError]);

  const handleRunConfirm = useCallback(async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await geminiRun(prompt, jsonInput);
      setResult(res);
      if (res.error) setError(res.error);

      // 履歴保存
      saveHistoryEntry({
        status: res.error ? "failed" : "succeeded",
        error: res.error,
        elapsed_time: res.elapsed_ms ? res.elapsed_ms / 1000 : undefined,
        total_tokens: res.total_tokens ? Number(res.total_tokens) : undefined,
        markdown: res.markdown || undefined,
        source: "gemini",
      }).catch(() => {});
    } catch (e) {
      setError(String(e));
      saveHistoryEntry({
        status: "failed",
        error: String(e),
        source: "gemini",
      }).catch(() => {});
    } finally {
      setRunning(false);
    }
  }, [prompt, jsonInput, setRunning, setResult, setError]);

  const handleClear = useCallback(() => {
    setJsonInput("");
    setPrompt("");
    setResult(null);
    setError(null);
    setActivePromptName(null);
  }, [setJsonInput, setPrompt, setResult, setError]);

  const handleCopyRequest = useCallback(() => {
    if (!result?.request_body) return;
    copyToClipboard(result.request_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  // エディタにジャンプ
  const handleOpenEditor = useCallback((md: string) => {
    setPendingMarkdown(md);
    navigate("/markdown-editor");
  }, [setPendingMarkdown, navigate]);

  const hasResult = result || error;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">Gemini</h1>
            <p className="text-xs text-gray-400 mt-0.5">プロンプトと JSON からマークダウンを生成</p>
          </div>
          {activeGemini?.model && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
              {activeGemini.model || "gemini-2.5-flash"}
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          disabled={running}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <Trash2 size={16} />
          クリア
        </button>
      </div>

      {!geminiConfigured && (
        <AlertBanner severity="warning" className="mb-5">
          Gemini API の設定がされていません。Settings ページで API キーを設定してください。
        </AlertBanner>
      )}

      {/* プロンプト入力 */}
      <div className={`${CARD} mb-5`}>
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-3 rounded-t-lg">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">1</span>
            <span className="text-sm font-semibold text-gray-700">プロンプト</span>
            {activePromptName && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600">{activePromptName}</span>
            )}
            {(promptSaved || overwriteSaved) && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 animate-fade-in">
                <CheckCircle size={11} />
                保存しました
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLoadModalOpen(true)}
              disabled={running}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200/60 transition-colors disabled:opacity-40"
              title="保存済みプロンプトを読込"
            >
              <FolderOpen size={13} />
              読込
              {savedPrompts.length > 0 && (
                <span className="ml-0.5 rounded-full bg-gray-300 px-1.5 text-[10px] text-white">{savedPrompts.length}</span>
              )}
            </button>
            {activePromptName && (
              <button
                onClick={handleOverwritePrompt}
                disabled={!prompt.trim() || running}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100/60 transition-colors disabled:opacity-40"
                title="上書き保存"
              >
                <Save size={13} />
                {overwriteSaved ? "保存しました" : "上書き保存"}
              </button>
            )}
            <button
              onClick={() => { setSavePromptName(""); setSaveModalOpen(true); }}
              disabled={!prompt.trim() || running}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100/60 transition-colors disabled:opacity-40"
              title="名前を付けて保存"
            >
              <BookmarkPlus size={13} />
              名前を付けて保存
            </button>
          </div>
        </div>
        <div className="p-4">
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300/30 disabled:opacity-50"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Gemini に送信するプロンプトを入力してください...&#10;例: 以下のJSON情報をもとに、Workatoレシピの仕様書をマークダウン形式で作成してください。"
            disabled={running}
          />
        </div>
      </div>

      {/* JSON 入力エリア */}
      <div className={`${CARD} mb-5`}>
        <div className="flex items-center gap-2.5 border-b border-gray-200 bg-gray-100 px-4 py-3 rounded-t-lg">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">2</span>
          <span className="text-sm font-semibold text-gray-700">JSON 入力</span>
        </div>
        <div className="p-4">
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300/30 disabled:opacity-50"
            rows={10}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="ここに JSON をペーストしてください..."
            disabled={running}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
          <button className={BTN_PRIMARY} disabled={!jsonInput.trim() || !prompt.trim() || running || !geminiConfigured} onClick={handleRunClick}>
            {running ? <Spinner size={16} /> : <Play size={16} />}
            {running ? "生成中" : "生成"}
          </button>
          {running && <span className="text-xs text-gray-400">Gemini でマークダウンを生成しています...</span>}
        </div>
      </div>

      {/* エラー */}
      {error && (
        <AlertBanner severity="error" className="mb-5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </AlertBanner>
      )}

      {/* 実行中 */}
      {running && (
        <div className={`${CARD} mb-5`}>
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size={48} />
            <p className="mt-4 text-sm text-gray-500 animate-pulse">Gemini でマークダウンを生成しています...</p>
            <span className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} />
              {elapsed.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* 結果 */}
      {hasResult && !running && (
        <div className={`${CARD} mb-5`}>
          <div className="flex items-center justify-between bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">3</span>
              <span className="text-sm font-semibold text-gray-700">生成結果</span>
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {result.elapsed_ms != null && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-gray-400" />
                      {(result.elapsed_ms / 1000).toFixed(2)}s
                    </span>
                  )}
                  {result.total_tokens != null && (
                    <span className="flex items-center gap-1">
                      <Coins size={12} className="text-gray-400" />
                      {result.total_tokens.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {result && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${result.error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {result.error ? "failed" : "succeeded"}
                </span>
              )}
            </div>
          </div>

          {tabs.length > 0 && (
            <div className="flex border-b border-gray-200 bg-gray-50/50 px-2 gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* マークダウン */}
          {activeTab === "markdown" && result?.markdown && (
            <div>
              <div className="flex items-center justify-end gap-2 px-4 pt-3">
                <button
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-600 hover:bg-teal-100/60"
                  onClick={() => handleOpenEditor(result.markdown)}
                  title="マークダウンエディタで編集"
                >
                  <FileEdit size={14} />
                  編集
                </button>
                <button
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100/60"
                  onClick={() => saveMarkdownFile("gemini-output.md", result.markdown)}
                  title="Markdownファイルとして保存"
                >
                  <Download size={14} />
                  保存
                </button>
              </div>
              <div className="prose prose-sm max-w-none px-5 py-4 text-gray-700 prose-headings:text-gray-800 prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-5 prose-h1:pb-1 prose-h1:border-b prose-h1:border-gray-200 prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-base prose-h3:mb-2 prose-h3:mt-3 prose-h4:text-sm prose-h4:mt-3 prose-p:mb-2 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-2 prose-li:mb-0.5 prose-table:border-collapse prose-table:w-full prose-table:mb-3 prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-1.5 prose-td:text-sm prose-hr:my-4 prose-hr:border-gray-300 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:mb-3 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:mb-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {result.markdown}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* API タブ */}
          {activeTab === "api" && result && (
            <div className="divide-y divide-gray-100">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                    <Braces size={12} />
                    リクエスト
                  </div>
                  <button onClick={handleCopyRequest} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100/60 transition-colors">
                    <Copy size={12} />
                    {copied ? "コピーしました" : "コピー"}
                  </button>
                </div>
                <pre className="rounded-lg bg-gray-900 text-gray-100 px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                  {result.request_body}
                </pre>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500">
                  <Braces size={12} />
                  レスポンス
                </div>
                <pre className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[600px] overflow-y-auto">
                  {result.response_body}
                </pre>
              </div>
              {(result.prompt_tokens != null || result.completion_tokens != null) && (
                <div className="p-4">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500">
                    <Coins size={12} />
                    トークン使用量
                  </div>
                  <div className="flex gap-6 text-sm text-gray-600">
                    {result.prompt_tokens != null && <span>Prompt: <strong>{result.prompt_tokens.toLocaleString()}</strong></span>}
                    {result.completion_tokens != null && <span>Completion: <strong>{result.completion_tokens.toLocaleString()}</strong></span>}
                    {result.total_tokens != null && <span>Total: <strong>{result.total_tokens.toLocaleString()}</strong></span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 実行確認モーダル */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="実行確認" maxWidth="max-w-sm"
        footer={<>
          <button className={BTN_OUTLINED_SM} onClick={() => setConfirmOpen(false)}>キャンセル</button>
          <button className={BTN_PRIMARY} onClick={handleRunConfirm}><Play size={16} />生成</button>
        </>}
      >
        <p className="text-sm text-gray-600">
          Gemini でマークダウンを生成しますか？<br />
          <span className="text-xs text-gray-400">モデル: {activeGemini?.model || "gemini-2.5-flash"}</span>
        </p>
      </Modal>

      {/* プロンプト保存モーダル */}
      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="名前を付けて保存" maxWidth="max-w-sm"
        footer={<>
          <button className={BTN_OUTLINED_SM} onClick={() => setSaveModalOpen(false)}>キャンセル</button>
          <button className={BTN_PRIMARY} disabled={!savePromptName.trim()} onClick={handleSavePrompt}><Save size={16} />保存</button>
        </>}
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">プロンプト名</label>
          <input type="text" className={INPUT_SM} value={savePromptName}
            onChange={(e) => setSavePromptName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && savePromptName.trim()) handleSavePrompt(); }}
            placeholder="例: レシピ仕様書生成" autoFocus
          />
          {savedPrompts.some((p) => p.name === savePromptName.trim()) && (
            <p className="mt-1.5 text-xs text-amber-500">同名のプロンプトが既に存在します。上書きされます。</p>
          )}
        </div>
      </Modal>

      {/* プロンプト読込モーダル */}
      <Modal open={loadModalOpen} onClose={() => setLoadModalOpen(false)} title="保存済みプロンプト" maxWidth="max-w-2xl">
        {savedPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BookmarkPlus size={32} className="mb-2" />
            <p className="text-sm">保存済みプロンプトがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedPrompts.map((sp) => (
              <div key={sp.name} className="group rounded-lg border border-gray-200 bg-white hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{sp.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleLoadPrompt(sp)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      読込
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(sp.name)}
                      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <pre className="px-4 py-2.5 text-xs text-gray-500 max-h-[80px] overflow-y-auto whitespace-pre-wrap">
                  {sp.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
