// Workato 仕様書生成ページの状態を保持する Context。
// AnimatePresence が key={pathname} でアンマウントしても状態を維持する。

import { createContext, useContext, useState, type ReactNode } from "react";

export type WorkatoSpecRunPhase = "idle" | "uploading" | "workflow";

interface WorkatoSpecState {
  jsonInput: string;
  setJsonInput: (v: string) => void;
  error: string | null;
  setError: (v: string | null) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  runPhase: WorkatoSpecRunPhase;
  setRunPhase: (v: WorkatoSpecRunPhase) => void;
  // 結果
  markdownText: string | null;
  setMarkdownText: (v: string | null) => void;
  drawioXml: string | null;
  setDrawioXml: (v: string | null) => void;
  httpStatus: number;
  setHttpStatus: (v: number) => void;
  resultStatus: string | null;
  setResultStatus: (v: string | null) => void;
  resultElapsed: number | undefined;
  setResultElapsed: (v: number | undefined) => void;
  resultTokens: number | undefined;
  setResultTokens: (v: number | undefined) => void;
  resultError: string | undefined;
  setResultError: (v: string | undefined) => void;
  // APIタブ
  fileUploadCurl: string | null;
  setFileUploadCurl: (v: string | null) => void;
  fileUploadResponse: string | null;
  setFileUploadResponse: (v: string | null) => void;
  workflowCurl: string | null;
  setWorkflowCurl: (v: string | null) => void;
  workflowResponse: string | null;
  setWorkflowResponse: (v: string | null) => void;
}

const WorkatoSpecContext = createContext<WorkatoSpecState | null>(null);

export function WorkatoSpecProvider({ children }: { children: ReactNode }) {
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runPhase, setRunPhase] = useState<WorkatoSpecRunPhase>("idle");
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [drawioXml, setDrawioXml] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState(0);
  const [resultStatus, setResultStatus] = useState<string | null>(null);
  const [resultElapsed, setResultElapsed] = useState<number | undefined>();
  const [resultTokens, setResultTokens] = useState<number | undefined>();
  const [resultError, setResultError] = useState<string | undefined>();
  const [fileUploadCurl, setFileUploadCurl] = useState<string | null>(null);
  const [fileUploadResponse, setFileUploadResponse] = useState<string | null>(null);
  const [workflowCurl, setWorkflowCurl] = useState<string | null>(null);
  const [workflowResponse, setWorkflowResponse] = useState<string | null>(null);

  return (
    <WorkatoSpecContext.Provider
      value={{
        jsonInput, setJsonInput,
        error, setError,
        running, setRunning,
        runPhase, setRunPhase,
        markdownText, setMarkdownText,
        drawioXml, setDrawioXml,
        httpStatus, setHttpStatus,
        resultStatus, setResultStatus,
        resultElapsed, setResultElapsed,
        resultTokens, setResultTokens,
        resultError, setResultError,
        fileUploadCurl, setFileUploadCurl,
        fileUploadResponse, setFileUploadResponse,
        workflowCurl, setWorkflowCurl,
        workflowResponse, setWorkflowResponse,
      }}
    >
      {children}
    </WorkatoSpecContext.Provider>
  );
}

export function useWorkatoSpec(): WorkatoSpecState {
  const ctx = useContext(WorkatoSpecContext);
  if (!ctx) throw new Error("useWorkatoSpec must be used within WorkatoSpecProvider");
  return ctx;
}
