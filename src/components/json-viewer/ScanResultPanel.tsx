// 機密データスキャン結果パネル。

import { useCallback, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  X,
  EyeOff,
  Eye,
} from "lucide-react";
import { maskValue, type SensitiveFinding } from "../../lib/json";

// kind の表示優先順（小さいほど上）
const KIND_ORDER: Record<string, number> = {
  "AWS キー疑い": 0,
  "Bearer トークン": 1,
  "APIキー/トークン疑い": 2,
  "メールアドレス": 3,
};

function kindPriority(kind: string): number {
  return KIND_ORDER[kind] ?? 99;
}

interface ScanResultPanelProps {
  findings: SensitiveFinding[];
  onClose: () => void;
  maskedPaths?: Map<string, string>;
  onMaskedPathsChange?: (paths: Map<string, string>) => void;
  onJumpTo: (path: string) => void;
}

export default function ScanResultPanel({
  findings,
  onClose,
  maskedPaths,
  onMaskedPathsChange,
  onJumpTo,
}: ScanResultPanelProps) {
  const isClean = findings.length === 0;
  const hasMaskSupport = !!maskedPaths && !!onMaskedPathsChange;

  const sortedFindings = useMemo(
    () => [...findings].sort((a, b) => kindPriority(a.kind) - kindPriority(b.kind)),
    [findings],
  );

  const toggleMask = useCallback(
    (f: SensitiveFinding) => {
      if (!maskedPaths || !onMaskedPathsChange) return;
      const next = new Map(maskedPaths);
      if (next.has(f.path)) {
        next.delete(f.path);
      } else {
        next.set(f.path, maskValue(f.fullValue, f.kind));
      }
      onMaskedPathsChange(next);
    },
    [maskedPaths, onMaskedPathsChange],
  );

  const maskAll = useCallback(() => {
    if (!onMaskedPathsChange) return;
    const next = new Map<string, string>();
    for (const f of findings) {
      next.set(f.path, maskValue(f.fullValue, f.kind));
    }
    onMaskedPathsChange(next);
  }, [findings, onMaskedPathsChange]);

  const unmaskAll = useCallback(() => {
    if (!onMaskedPathsChange) return;
    onMaskedPathsChange(new Map());
  }, [onMaskedPathsChange]);

  return (
    <div
      className={`rounded-lg border p-3 ${
        isClean ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-sans text-sm font-medium">
          {isClean ? (
            <>
              <ShieldCheck size={16} className="text-green-600" />
              <span className="text-green-700">
                機密情報は検出されませんでした
              </span>
            </>
          ) : (
            <>
              <ShieldAlert size={16} className="text-red-600" />
              <span className="text-red-700">
                {findings.length} 件の機密情報の疑いがあります
              </span>
            </>
          )}
        </div>
        <button
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {!isClean && hasMaskSupport && (
        <div className="mt-2 flex gap-1 font-sans">
          <button
            className="flex items-center gap-1 rounded border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-100"
            onClick={maskAll}
          >
            <EyeOff size={12} />
            全てマスク
          </button>
          <button
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
            onClick={unmaskAll}
          >
            <Eye size={12} />
            全て解除
          </button>
        </div>
      )}

      {!isClean && (
        <div className="mt-2 max-h-36 space-y-1 overflow-y-auto font-sans text-xs">
          {sortedFindings.map((f, i) => {
            const isMasked = maskedPaths?.has(f.path) ?? false;
            return (
              <div
                key={i}
                className={`cursor-pointer rounded border px-2 py-1.5 transition-colors hover:ring-1 hover:ring-blue-300 ${
                  isMasked
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-red-100 bg-white"
                }`}
                onClick={() => onJumpTo(f.path)}
                title="クリックで該当行にジャンプ"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      isMasked
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {f.kind}
                  </span>
                  <span className="flex-1 truncate text-gray-500">
                    {f.path}
                  </span>
                  {hasMaskSupport && (
                    <button
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isMasked
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMask(f);
                      }}
                    >
                      {isMasked ? (
                        <>
                          <Eye size={10} />
                          解除
                        </>
                      ) : (
                        <>
                          <EyeOff size={10} />
                          マスク
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="mt-0.5 truncate text-gray-600">
                  {isMasked ? maskedPaths!.get(f.path) : f.preview}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
