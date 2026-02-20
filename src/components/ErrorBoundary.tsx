// アプリ全体のエラーキャッチ。
// 何か壊れたらリロードボタン付きのエラー画面を出す。

import { Component, type ReactNode, type ErrorInfo } from "react";
import { BTN_PRIMARY } from "../lib/tw";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="max-w-md px-6 text-center">
            <h2 className="mb-2 text-xl font-bold">
              予期しないエラーが発生しました
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              {this.state.error?.message ?? "不明なエラー"}
            </p>
            <button className={BTN_PRIMARY} onClick={this.handleReload}>
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
