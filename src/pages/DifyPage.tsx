// Dify ワークフロー実行ページ。
// ロジックは useDifyWorkflow フック、UI は dify/ サブコンポーネントに分離している。

import { useNavigate } from "react-router-dom";
import {
  Workflow,
  Play,
  AlertCircle,
  Trash2,
  Clock,
} from "lucide-react";

import { useDifyWorkflow } from "../hooks/useDifyWorkflow";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import DifyFileApiSection from "../components/dify/DifyFileApiSection";
import DifyWorkflowSection from "../components/dify/DifyWorkflowSection";
import DifyResultSection from "../components/dify/DifyResultSection";
import { PAGE, HEADER_ROW, CARD, BTN_PRIMARY, BTN_OUTLINED_SM } from "../lib/tw";

export default function DifyPage() {
  const navigate = useNavigate();
  const wf = useDifyWorkflow();

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
            <Workflow size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">Dify</h1>
            <p className="text-xs text-gray-400 mt-0.5">JSON を入力してワークフローを実行</p>
          </div>
        </div>
        <button
          onClick={wf.handleClear}
          disabled={wf.running}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <Trash2 size={16} />
          クリア
        </button>
      </div>

      {/* Dify 未設定の場合の案内 */}
      {!wf.difyConfigured && (
        <AlertBanner severity="warning" className="mb-5">
          Dify API の設定がされていません。Settings ページで API URL と API キーを設定してください。
        </AlertBanner>
      )}

      {/* パラメータ設定 */}
      {wf.activeDify && (
        <>
          <DifyFileApiSection
            localFileInput={wf.localFileInput}
            setLocalFileInput={wf.setLocalFileInput}
            jsonInput={wf.jsonInput}
            setJsonInput={wf.setJsonInput}
            running={wf.running}
            paramSaved={wf.paramSaved}
          />

          <DifyWorkflowSection
            localUser={wf.localUser}
            setLocalUser={wf.setLocalUser}
            localResponseMode={wf.localResponseMode}
            setLocalResponseMode={wf.setLocalResponseMode}
            localParam1Name={wf.localParam1Name}
            setLocalParam1Name={wf.setLocalParam1Name}
            localParam1Value={wf.localParam1Value}
            setLocalParam1Value={wf.setLocalParam1Value}
            localParam2Name={wf.localParam2Name}
            setLocalParam2Name={wf.setLocalParam2Name}
            localParam2Value={wf.localParam2Value}
            setLocalParam2Value={wf.setLocalParam2Value}
            localParam3Name={wf.localParam3Name}
            setLocalParam3Name={wf.setLocalParam3Name}
            localParam3Value={wf.localParam3Value}
            setLocalParam3Value={wf.setLocalParam3Value}
            localParam4Name={wf.localParam4Name}
            setLocalParam4Name={wf.setLocalParam4Name}
            localParam4Value={wf.localParam4Value}
            setLocalParam4Value={wf.setLocalParam4Value}
            localMdOutput={wf.localMdOutput}
            setLocalMdOutput={wf.setLocalMdOutput}
            localDrawioOutput={wf.localDrawioOutput}
            setLocalDrawioOutput={wf.setLocalDrawioOutput}
          />
        </>
      )}

      {/* 実行ボタン */}
      <div className={`${CARD} mb-5`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            className={BTN_PRIMARY}
            disabled={!wf.jsonInput.trim() || wf.running || !wf.difyConfigured}
            onClick={wf.handleRunClick}
          >
            {wf.running ? <Spinner size={16} /> : <Play size={16} />}
            {wf.running
              ? wf.runPhase === "uploading" ? "アップロード中" : "ワークフロー実行中"
              : "実行"}
          </button>
          {wf.running && (
            <span className="text-xs text-gray-400">
              {wf.runPhase === "uploading"
                ? "ファイルをアップロードしています..."
                : "ワークフローを実行しています..."}
            </span>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {wf.error && (
        <AlertBanner severity="error" className="mb-5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{wf.error}</span>
          </div>
        </AlertBanner>
      )}

      {/* 実行中アニメーション */}
      {wf.running && (
        <div className={`${CARD} mb-5`}>
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size={48} />
            <p className="mt-4 text-sm text-gray-500 animate-pulse">
              {wf.runPhase === "uploading"
                ? "ファイルをアップロードしています..."
                : "ワークフローを実行しています..."}
            </p>
            <span className="mt-1 text-xs font-medium text-blue-500">
              {wf.runPhase === "uploading" ? "Step 1/2 — ファイルAPI" : "Step 2/2 — ワークフロー"}
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} />
              {wf.elapsed.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      <DifyResultSection
        hasResult={wf.hasResult}
        result={wf.result}
        error={wf.error}
        tabs={wf.tabs}
        effectiveTab={wf.effectiveTab}
        setActiveTab={wf.setActiveTab}
        markdownText={wf.markdownText}
        drawioHtml={wf.drawioHtml}
        drawioXml={wf.drawioXml}
        drawioZoom={wf.drawioZoom}
        setDrawioZoom={wf.setDrawioZoom}
        fileUploadCurl={wf.fileUploadCurl}
        fileUploadResponse={wf.fileUploadResponse}
        workflowCurl={wf.workflowCurl}
        workflowResponse={wf.workflowResponse}
        onOpenEditor={() => {
          if (wf.markdownText) {
            wf.setPendingMarkdown(wf.markdownText);
            navigate("/markdown-editor");
          }
        }}
      />

      {/* 実行確認モーダル */}
      <Modal
        open={wf.confirmOpen}
        onClose={() => wf.setConfirmOpen(false)}
        title="実行確認"
        maxWidth="max-w-sm"
        footer={
          <>
            <button className={BTN_OUTLINED_SM} onClick={() => wf.setConfirmOpen(false)}>
              キャンセル
            </button>
            <button className={BTN_PRIMARY} onClick={wf.handleRunConfirm}>
              <Play size={16} />
              実行
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Dify ワークフローを実行しますか？
        </p>
      </Modal>
    </div>
  );
}
