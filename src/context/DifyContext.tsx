// Dify ページの状態を保持する Context。
// AnimatePresence が key={pathname} でアンマウントしても状態を維持する。

import { createContext, useContext, useState, type ReactNode } from "react";
import type { WorkflowResult } from "../types/workato";

interface DifyState {
  jsonInput: string;
  setJsonInput: (v: string) => void;
  result: WorkflowResult | null;
  setResult: (v: WorkflowResult | null) => void;
  error: string | null;
  setError: (v: string | null) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  fileUploadRequest: string | null;
  setFileUploadRequest: (v: string | null) => void;
  fileUploadResponse: string | null;
  setFileUploadResponse: (v: string | null) => void;
  fileUploadCurl: string | null;
  setFileUploadCurl: (v: string | null) => void;
  workflowRequest: string | null;
  setWorkflowRequest: (v: string | null) => void;
  workflowResponse: string | null;
  setWorkflowResponse: (v: string | null) => void;
  workflowCurl: string | null;
  setWorkflowCurl: (v: string | null) => void;
  diagnosticLog: string | null;
  setDiagnosticLog: (v: string | null) => void;
}

const DifyContext = createContext<DifyState | null>(null);

export function DifyProvider({ children }: { children: ReactNode }) {
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fileUploadRequest, setFileUploadRequest] = useState<string | null>(null);
  const [fileUploadResponse, setFileUploadResponse] = useState<string | null>(null);
  const [fileUploadCurl, setFileUploadCurl] = useState<string | null>(null);
  const [workflowRequest, setWorkflowRequest] = useState<string | null>(null);
  const [workflowResponse, setWorkflowResponse] = useState<string | null>(null);
  const [workflowCurl, setWorkflowCurl] = useState<string | null>(null);
  const [diagnosticLog, setDiagnosticLog] = useState<string | null>(null);

  return (
    <DifyContext.Provider
      value={{
        jsonInput,
        setJsonInput,
        result,
        setResult,
        error,
        setError,
        running,
        setRunning,
        fileUploadRequest,
        setFileUploadRequest,
        fileUploadResponse,
        setFileUploadResponse,
        fileUploadCurl,
        setFileUploadCurl,
        workflowRequest,
        setWorkflowRequest,
        workflowResponse,
        setWorkflowResponse,
        workflowCurl,
        setWorkflowCurl,
        diagnosticLog,
        setDiagnosticLog,
      }}
    >
      {children}
    </DifyContext.Provider>
  );
}

export function useDify(): DifyState {
  const ctx = useContext(DifyContext);
  if (!ctx) throw new Error("useDify must be used within DifyProvider");
  return ctx;
}
