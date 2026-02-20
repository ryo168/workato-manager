// JsonViewer 共有インターフェース。

export interface JsonViewerProps {
  data: unknown;
  defaultExpandDepth?: number;
  maskedPaths?: Map<string, string>;
  onMaskedPathsChange?: (paths: Map<string, string>) => void;
}
