// JSON まわりのユーティリティ。

// Workato API が code を二重シリアライズした文字列で返すことがある。
// 文字列なら JSON.parse してオブジェクトに戻す。失敗したらそのまま返す。
export function normalizeRecipeCode(code: unknown): unknown {
  if (typeof code === "string") {
    try {
      return JSON.parse(code);
    } catch {
      return code;
    }
  }
  return code;
}

// --- 機密情報スキャン（値のパターンマッチのみ） ---

export interface SensitiveFinding {
  path: string;
  kind: string;
  preview: string;
  fullValue: string;
}

const VALUE_RULES: { kind: string; pattern: RegExp }[] = [
  { kind: "メールアドレス", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { kind: "Bearer トークン", pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/ },
  // 長めの16進文字列（32文字以上）
  { kind: "APIキー/トークン疑い", pattern: /\b[0-9a-fA-F]{32,}\b/ },
  // base64 っぽい長文字列（40文字以上）
  { kind: "APIキー/トークン疑い", pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/ },
  // AWS アクセスキー
  { kind: "AWS キー疑い", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

// JSON を再帰的に歩いて値だけチェック
export function scanSensitiveData(data: unknown): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  walk(data, "$", findings);
  return findings;
}

function walk(value: unknown, path: string, findings: SensitiveFinding[]) {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    for (const rule of VALUE_RULES) {
      if (rule.pattern.test(value)) {
        if (!findings.some((f) => f.path === path && f.kind === rule.kind)) {
          findings.push({ path, kind: rule.kind, preview: truncate(value, 50), fullValue: value });
        }
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, findings));
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      walk(val, `${path}.${key}`, findings);
    }
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

// --- マスク ---
// 各ルールの正規表現（グローバルフラグ付き）で一致部分だけ伏せる

const MASK_PATTERNS: { kind: string; pattern: RegExp; replacement: string }[] = [
  { kind: "メールアドレス", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "****@****.***" },
  { kind: "Bearer トークン", pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: "Bearer ****" },
  { kind: "AWS キー疑い", pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "AKIA****************" },
  { kind: "APIキー/トークン疑い", pattern: /\b[0-9a-fA-F]{32,}\b/g, replacement: "********************************" },
];

// base64 は他とかぶりやすいので最後にフォールバック
const BASE64_MASK = /\b[A-Za-z0-9+/]{40,}={0,2}\b/g;

export function maskValue(value: string, kind: string): string {
  // kind に一致するパターンで部分置換
  for (const rule of MASK_PATTERNS) {
    if (rule.kind === kind) {
      return value.replace(rule.pattern, rule.replacement);
    }
  }
  // APIキー/トークン疑い（base64）
  return value.replace(BASE64_MASK, "****************************************");
}

// JSON を deep clone しつつ masks に含まれるパスの値をマスク済み文字列で置き換える
export function applyMasks(
  data: unknown,
  masks: Map<string, string>,
): unknown {
  if (masks.size === 0) return data;
  return cloneAndMask(data, "$", masks);
}

function cloneAndMask(
  value: unknown,
  path: string,
  masks: Map<string, string>,
): unknown {
  if (masks.has(path)) return masks.get(path)!;

  if (value === null || value === undefined) return value;

  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      cloneAndMask(item, `${path}[${i}]`, masks),
    );
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = cloneAndMask(val, `${path}.${key}`, masks);
  }
  return result;
}
