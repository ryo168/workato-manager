// ワークフロー設定カード。ユーザー・レスポンスモード・入力変数（カスタムパラメータ1-4）と出力変数を含む。

import { CARD, INPUT_SM, SELECT_SM } from "../../lib/tw";

interface DifyWorkflowSectionProps {
  localUser: string;
  setLocalUser: (v: string) => void;
  localResponseMode: string;
  setLocalResponseMode: (v: string) => void;
  localParam1Name: string;
  setLocalParam1Name: (v: string) => void;
  localParam1Value: string;
  setLocalParam1Value: (v: string) => void;
  localParam2Name: string;
  setLocalParam2Name: (v: string) => void;
  localParam2Value: string;
  setLocalParam2Value: (v: string) => void;
  localParam3Name: string;
  setLocalParam3Name: (v: string) => void;
  localParam3Value: string;
  setLocalParam3Value: (v: string) => void;
  localParam4Name: string;
  setLocalParam4Name: (v: string) => void;
  localParam4Value: string;
  setLocalParam4Value: (v: string) => void;
  localMdOutput: string;
  setLocalMdOutput: (v: string) => void;
  localDrawioOutput: string;
  setLocalDrawioOutput: (v: string) => void;
}

export default function DifyWorkflowSection({
  localUser,
  setLocalUser,
  localResponseMode,
  setLocalResponseMode,
  localParam1Name,
  setLocalParam1Name,
  localParam1Value,
  setLocalParam1Value,
  localParam2Name,
  setLocalParam2Name,
  localParam2Value,
  setLocalParam2Value,
  localParam3Name,
  setLocalParam3Name,
  localParam3Value,
  setLocalParam3Value,
  localParam4Name,
  setLocalParam4Name,
  localParam4Value,
  setLocalParam4Value,
  localMdOutput,
  setLocalMdOutput,
  localDrawioOutput,
  setLocalDrawioOutput,
}: DifyWorkflowSectionProps) {
  return (
    <div className={`${CARD} mb-5 overflow-hidden`}>
      <div className="flex items-center gap-2.5 bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
        <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">2</span>
        <span className="text-sm font-semibold text-gray-700">ワークフロー設定</span>
      </div>
      <div className="px-4 pb-4 pt-3">
        {/* 必須パラメータ */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 mb-3">
          <span className="text-[11px] font-semibold text-gray-500 mb-2 block">実行パラメータ <span className="text-red-400 font-normal">（必須）</span></span>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">ユーザー <span className="text-red-400">*</span></label>
              <input type="text" className={INPUT_SM} value={localUser} onChange={(e) => setLocalUser(e.target.value)} placeholder="user-001" />
            </div>
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">レスポンスモード <span className="text-red-400">*</span></label>
              <select className={SELECT_SM} value={localResponseMode} onChange={(e) => setLocalResponseMode(e.target.value)}>
                <option value="streaming">Streaming</option>
                <option value="blocking">Blocking</option>
              </select>
            </div>
          </div>
        </div>

        {/* 入力変数（カスタムパラメータ 1-4） */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 mb-3">
          <span className="text-[11px] font-semibold text-gray-500 mb-2 block">入力変数</span>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 1</label>
              <div className="flex items-center gap-1.5">
                <input type="text" className={INPUT_SM} value={localParam1Name} onChange={(e) => setLocalParam1Name(e.target.value)} placeholder="変数名" />
                <span className="text-gray-300">=</span>
                <input type="text" className={INPUT_SM} value={localParam1Value} onChange={(e) => setLocalParam1Value(e.target.value)} placeholder="値" />
              </div>
            </div>
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 2</label>
              <div className="flex items-center gap-1.5">
                <input type="text" className={INPUT_SM} value={localParam2Name} onChange={(e) => setLocalParam2Name(e.target.value)} placeholder="変数名" />
                <span className="text-gray-300">=</span>
                <input type="text" className={INPUT_SM} value={localParam2Value} onChange={(e) => setLocalParam2Value(e.target.value)} placeholder="値" />
              </div>
            </div>
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 3</label>
              <div className="flex items-center gap-1.5">
                <input type="text" className={INPUT_SM} value={localParam3Name} onChange={(e) => setLocalParam3Name(e.target.value)} placeholder="変数名" />
                <span className="text-gray-300">=</span>
                <input type="text" className={INPUT_SM} value={localParam3Value} onChange={(e) => setLocalParam3Value(e.target.value)} placeholder="値" />
              </div>
            </div>
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 4</label>
              <div className="flex items-center gap-1.5">
                <input type="text" className={INPUT_SM} value={localParam4Name} onChange={(e) => setLocalParam4Name(e.target.value)} placeholder="変数名" />
                <span className="text-gray-300">=</span>
                <input type="text" className={INPUT_SM} value={localParam4Value} onChange={(e) => setLocalParam4Value(e.target.value)} placeholder="値" />
              </div>
            </div>
          </div>
        </div>

        {/* 出力変数 */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5">
          <span className="text-[11px] font-semibold text-gray-500 mb-2 block">出力変数</span>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">マークダウンの出力変数</label>
              <input type="text" className={INPUT_SM} value={localMdOutput} onChange={(e) => setLocalMdOutput(e.target.value)} placeholder="text" />
            </div>
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500">drawの出力変数</label>
              <input type="text" className={INPUT_SM} value={localDrawioOutput} onChange={(e) => setLocalDrawioOutput(e.target.value)} placeholder="drawio_xml" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
