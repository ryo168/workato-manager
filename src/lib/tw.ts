/**
 * @file Tailwind CSS 共通クラス定数
 * 各コンポーネントで繰り返し使う Tailwind クラスを定数化し、
 * スタイルの一貫性を保つ。カテゴリごとにセクション分け。
 */

// --- ボタン ---

// 汎用の小ボタン（CSV, 更新 とか）
export const BTN_OUTLINED_SM =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";

// 赤い小ボタン（停止とか）
export const BTN_OUTLINED_SM_ERROR =
  "inline-flex items-center gap-1.5 rounded-lg border border-error/40 bg-white px-3 py-1.5 text-sm font-medium text-error hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed";

// 緑の小ボタン（開始とか）
export const BTN_OUTLINED_SM_SUCCESS =
  "inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-white px-3 py-1.5 text-sm font-medium text-success hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed";

// 青い小ボタン（更新とか）
export const BTN_OUTLINED_SM_BLUE =
  "inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed";

// 緑の小ボタン（CSV出力とか）
export const BTN_OUTLINED_SM_GREEN =
  "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed";

// 紫の小ボタン（プレビューとか）
export const BTN_OUTLINED_SM_PURPLE =
  "inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed";

// オレンジの小ボタン（JSON DLとか）
export const BTN_OUTLINED_SM_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed";

// メインカラーのボタン（保存とか）
export const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[#B05838] disabled:opacity-50 disabled:cursor-not-allowed";

// テキストだけの小ボタン（編集、クリアとか）
export const BTN_TEXT_SM =
  "inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

// テキストだけの小ボタン（薄めカラー）
export const BTN_TEXT_SM_INHERIT =
  "inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

// --- カード ---

// 影付きカード
export const CARD = "rounded-lg border border-gray-200 bg-white shadow-sm";

// 影なしカード（枠線だけ）
export const CARD_OUTLINED = "rounded-lg border border-gray-200 bg-white";

// --- レイアウト ---

export const PAGE = "p-8";
export const HEADER_ROW = "flex items-center justify-between mb-6";
export const BTN_GROUP = "flex items-center gap-2";

// --- テーブル ---

export const TABLE = "w-full text-sm table-auto";

export const TH =
  "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200";

export const TD = "px-4 py-3 text-center border-b border-gray-100";

export const TR_HOVER = "hover:bg-gray-50 transition-colors";

// --- フォーム ---

export const INPUT_SM =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50";

export const SELECT_SM =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-8";

export const LABEL = "block text-xs font-medium text-gray-500 mb-1";

// --- モーダル ---

/** 半透明オーバーレイ背景。z-50 で最前面に配置 */
export const MODAL_BACKDROP =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/40";

/** モーダル本体パネル。最大高さ 92vh でスクロール対応 */
export const MODAL_PANEL =
  "relative flex max-h-[92vh] flex-col rounded-xl border border-gray-200 bg-white shadow-xl";
