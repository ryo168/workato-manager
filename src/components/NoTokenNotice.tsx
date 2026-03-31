/**
 * @file APIトークン未設定時の案内コンポーネント
 * トークンが設定されていない場合に各ページで共通表示する。
 */

import { AlertCircle } from "lucide-react";

/** APIトークン未設定時にSettings画面への誘導メッセージを表示する */
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
