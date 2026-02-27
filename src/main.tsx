// エントリーポイント。各種 Provider を重ねてアプリを起動する。
// QueryClient: リトライ1回、キャッシュ30秒。

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "./context/ConfigContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import "./index.css";

// 起動時にズーム設定を復元
const savedZoom = localStorage.getItem("app-zoom");
if (savedZoom) {
  const factor = parseFloat(savedZoom) / 100;
  if (factor > 0) getCurrentWebviewWindow().setZoom(factor);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
