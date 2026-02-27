// JsonViewer 共有インターフェース。

export interface JsonViewerProps {
  data: unknown;
  defaultExpandDepth?: number;
  maskedPaths?: Map<string, string>;
  onMaskedPathsChange?: (paths: Map<string, string>) => void;
  /** 機密情報チェックボタンを非表示にする */
  hideScan?: boolean;
  /** コピーボタンを表示する */
  showCopy?: boolean;
}
