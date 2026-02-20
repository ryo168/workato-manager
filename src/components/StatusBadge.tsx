// 状態を色付きバッジで表示（running, stopped, succeeded, failed とか）

interface Props {
  status: string;
}

const colorMap: Record<string, string> = {
  succeeded: "border-green-400 text-green-700 bg-green-50",
  failed: "border-red-400 text-red-700 bg-red-50",
  pending: "border-amber-400 text-amber-700 bg-amber-50",
  timeout: "border-amber-400 text-amber-700 bg-amber-50",
  running: "border-blue-400 text-blue-700 bg-blue-50",
  stopped: "border-gray-300 text-gray-600 bg-gray-50",
};

const DEFAULT_COLOR = "border-gray-300 text-gray-600 bg-gray-50";

export default function StatusBadge({ status }: Props) {
  const color = colorMap[status.toLowerCase()] ?? DEFAULT_COLOR;
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}
