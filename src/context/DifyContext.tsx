// Dify ページの状態を保持する Context。
// AnimatePresence が key={pathname} でアンマウントしても状態を維持する。

import { createContext, useContext, useState, type ReactNode } from "react";
import type { WorkflowResult } from "../types/workato";

export type DifyRunPhase = "idle" | "uploading" | "workflow";

interface DifyState {
  jsonInput: string;
  setJsonInput: (v: string) => void;
  result: WorkflowResult | null;
  setResult: (v: WorkflowResult | null) => void;
  error: string | null;
  setError: (v: string | null) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  runPhase: DifyRunPhase;
  setRunPhase: (v: DifyRunPhase) => void;
  startedAt: number | null;
  setStartedAt: (v: number | null) => void;
  fileUploadResponse: string | null;
  setFileUploadResponse: (v: string | null) => void;
  fileUploadCurl: string | null;
  setFileUploadCurl: (v: string | null) => void;
  workflowResponse: string | null;
  setWorkflowResponse: (v: string | null) => void;
  workflowCurl: string | null;
  setWorkflowCurl: (v: string | null) => void;
}

const DifyContext = createContext<DifyState | null>(null);

export function DifyProvider({ children }: { children: ReactNode }) {
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runPhase, setRunPhase] = useState<DifyRunPhase>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [fileUploadResponse, setFileUploadResponse] = useState<string | null>(null);
  const [fileUploadCurl, setFileUploadCurl] = useState<string | null>(null);
  const [workflowResponse, setWorkflowResponse] = useState<string | null>(null);
  const [workflowCurl, setWorkflowCurl] = useState<string | null>(null);

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
        runPhase,
        setRunPhase,
        startedAt,
        setStartedAt,
        fileUploadResponse,
        setFileUploadResponse,
        fileUploadCurl,
        setFileUploadCurl,
        workflowResponse,
        setWorkflowResponse,
        workflowCurl,
        setWorkflowCurl,
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
