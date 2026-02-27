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
  requestBody: string | null;
  setRequestBody: (v: string | null) => void;
  responseBody: string | null;
  setResponseBody: (v: string | null) => void;
}

const DifyContext = createContext<DifyState | null>(null);

export function DifyProvider({ children }: { children: ReactNode }) {
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [requestBody, setRequestBody] = useState<string | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);

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
        requestBody,
        setRequestBody,
        responseBody,
        setResponseBody,
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
