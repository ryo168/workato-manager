// ファイルAPI設定カード。Dify File API の入力変数設定と JSON 入力を含む。

import { CheckCircle } from "lucide-react";

import { CARD, INPUT_SM } from "../../lib/tw";

interface DifyFileApiSectionProps {
  localFileInput: string;
  setLocalFileInput: (v: string) => void;
  jsonInput: string;
  setJsonInput: (v: string) => void;
  running: boolean;
  paramSaved: boolean;
}

export default function DifyFileApiSection({
  localFileInput,
  setLocalFileInput,
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
        <div className="grid grid-cols-1 gap-2 mb-3">
          <div>
            <label className="mb-1 text-[11px] font-medium text-gray-500">Json情報の入力変数</label>
            <input type="text" className={INPUT_SM} value={localFileInput} onChange={(e) => setLocalFileInput(e.target.value)} placeholder="file" />
          </div>
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
