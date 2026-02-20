// APIトークン未設定のときに出す案内。各ページで共通で使う。

import { AlertCircle } from "lucide-react";

export default function NoTokenNotice() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-gray-500">
        <AlertCircle size={40} className="mx-auto mb-3 text-primary" />
        <p className="font-medium">APIトークンが設定されていません</p>
        <p className="mt-1 text-sm">Settings ページで設定してください。</p>
      </div>
    </div>
  );
}
