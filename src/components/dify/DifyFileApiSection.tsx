// ファイルAPI設定カード。ファイル入力変数・Workato File API トグル・JSON 入力を含む。

import { CheckCircle } from "lucide-react";

import { CARD, INPUT_SM } from "../../lib/tw";

interface DifyFileApiSectionProps {
  localFileApiMode: string;
  setLocalFileApiMode: (v: string) => void;
  localFileInput: string;
  setLocalFileInput: (v: string) => void;
  localWorkatoFileIdParam: string;
  setLocalWorkatoFileIdParam: (v: string) => void;
  jsonInput: string;
  setJsonInput: (v: string) => void;
  running: boolean;
  paramSaved: boolean;
}

export default function DifyFileApiSection({
  localFileApiMode,
  setLocalFileApiMode,
  localFileInput,
  setLocalFileInput,
  localWorkatoFileIdParam,
  setLocalWorkatoFileIdParam,
  jsonInput,
  setJsonInput,
  running,
  paramSaved,
}: DifyFileApiSectionProps) {
  return (
    <div className={`${CARD} mb-5 overflow-hidden`}>
      <div className="flex items-center gap-2.5 bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
        <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">1</span>
        <span className="text-sm font-semibold text-gray-700">ファイルAPI設定</span>
        {paramSaved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-500 animate-fade-in">
            <CheckCircle size={11} />
            保存しました
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {localFileApiMode === "workato" ? (
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">ファイルIDの入力変数名</label>
              <input type="text" className={INPUT_SM} value={localWorkatoFileIdParam} onChange={(e) => setLocalWorkatoFileIdParam(e.target.value)} placeholder="workato_file_id" />
            </div>
          ) : (
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">Json情報の入力変数</label>
              <input type="text" className={INPUT_SM} value={localFileInput} onChange={(e) => setLocalFileInput(e.target.value)} placeholder="file" />
            </div>
          )}
        </div>

        {/* Workato File API トグル */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Workato File API</span>
            <button
              onClick={() => setLocalFileApiMode(localFileApiMode === "workato" ? "dify" : "workato")}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:ring-offset-1 ${
                localFileApiMode === "workato" ? "bg-purple-500" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${localFileApiMode === "workato" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            {localFileApiMode === "workato"
              ? "ON: Workato File API を使用してファイルをアップロードします。"
              : "OFF: Dify File API を使用してファイルをアップロードします。"}
          </p>
        </div>

        {/* JSON 入力 */}
        <textarea
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300/30 disabled:opacity-50"
          rows={12}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="ここに JSON をペーストしてください..."
          disabled={running}
        />
      </div>
    </div>
  );
}
