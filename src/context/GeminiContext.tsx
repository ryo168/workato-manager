// Gemini ページの一時的な状態を保持する Context。
// ページ遷移してもプロンプトや結果を保持する。

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { GeminiRunResult } from "../types/workato";

interface GeminiState {
  prompt: string;
  setPrompt: (v: string) => void;
  jsonInput: string;
  setJsonInput: (v: string) => void;
  result: GeminiRunResult | null;
  setResult: (v: GeminiRunResult | null) => void;
  error: string | null;
  setError: (v: string | null) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  /** マークダウンエディタに渡すテキスト */
  pendingMarkdown: string | null;
  setPendingMarkdown: (v: string | null) => void;
}

const GeminiContext = createContext<GeminiState | null>(null);

export function GeminiProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<GeminiRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pendingMarkdown, setPendingMarkdown] = useState<string | null>(null);

  return (
    <GeminiContext.Provider
      value={{
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
        pendingMarkdown,
        setPendingMarkdown,
      }}
    >
      {children}
    </GeminiContext.Provider>
  );
}

export const useGemini = (): GeminiState => {
  const ctx = useContext(GeminiContext);
  if (!ctx) {
    throw new Error("useGemini must be used within a GeminiProvider");
  }
  return ctx;
};
