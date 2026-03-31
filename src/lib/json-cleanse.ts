// ---------------------------------------------------------------------------
// json-cleanse.ts — Workato プロジェクト JSON のクレンジングモジュール
// ---------------------------------------------------------------------------
// Workato API から取得した JSON には、実行統計・UI 制御・内部管理用など
// AI 分析に不要なフィールドが大量に含まれる。
// Dify へ送信する前にこれらを除去し、トークン消費を削減しつつ
// レスポンス精度を高めるのがこのモジュールの責務。
//
// 処理の流れ:
//   1. deep clone（元データを破壊しない）
//   2. 各階層ごとに不要キーを除去（RECIPE_KEYS, BLOCK_KEYS 等）
//   3. EIS/EOS（スキーマ定義）内の UI 制御キーを再帰除去
//   4. null 値を再帰的に除去して最終出力をコンパクトにする
// ---------------------------------------------------------------------------

/**
 * recipes 直下から削除するキー
 * — 実行統計（カウント・日時）やフォルダ管理用の ID など、
 *   レシピのロジック理解に不要なメタデータを除去する。
 */
const RECIPE_KEYS = new Set([
  "running",
  "last_run_at",
  "created_at",
  "updated_at",
  "stopped_at",
  "job_succeeded_count",
  "job_failed_count",
  "folder_id",
  "project_id",
  "trigger_application",
]);

/**
 * project 直下から削除するキー
 * — Workato 内部の ID 体系はレシピ構造分析に不要なため除去。
 */
const PROJECT_KEYS = new Set(["id", "folder_id"]);

/**
 * block 内から削除するキー
 * — uuid はランダム識別子、old_name はリネーム履歴、
 *   toggleCfg / clear_scope は UI トグル制御用。いずれもロジック理解に不要。
 */
const BLOCK_KEYS = new Set(["uuid", "old_name", "toggleCfg", "clear_scope"]);

/**
 * connections 内から削除するキー
 * — 認証日時やフォルダ管理 ID など、接続定義の中身に関係しないメタデータ。
 */
const CONNECTION_KEYS = new Set([
  "authorized_at",
  "created_at",
  "updated_at",
  "folder_id",
  "project_id",
]);

/**
 * EIS/EOS（Extended Input/Output Schema）配下から再帰的に削除するキー
 * — スキーマ定義にはフィールドの型・名前のほかに、Workato UI のレンダリング制御
 *   （ピックリスト表示、トグルヒント、入力モード強制等）が大量に混在する。
 *   これらは UI 専用でありレシピロジックの理解には無関係なため、再帰的に除去する。
 */
const SCHEMA_KEYS = new Set([
  "control_type",
  "render_input",
  "parse_output",
  "extends_schema",
  "toggle_field",
  "toggle_hint",
  "toggle_to_primary_hint",
  "toggle_to_secondary_hint",
  "sticky",
  "ngIf",
  "change_on_blur",
  "picklist_type",
  "old_name",
  "custom_attribute",
  "list_data_type",
  "pick_list",
  "enforce_template_mode",
  "since_field",
  "ignore_timezone",
  "pick_list_connection_less",
  "suffix",
]);

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

/**
 * null / undefined 値を再帰的に除去する。
 * Workato JSON には値が null のフィールドが多数あり、そのまま送ると
 * トークンを無駄に消費するため最終段で一括除去する。
 * 配列内の null 要素もフィルタし、オブジェクトは新しいインスタンスに複写する。
 */
function stripNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj.map(stripNulls).filter((v) => v !== undefined);
  }
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === null) continue;
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return obj;
}

/**
 * 指定キーセットに該当するプロパティを浅く（1階層のみ）削除する。
 * 再帰しないため、特定階層のメタデータ除去に使う。
 * 子要素のクレンジングは呼び出し側が別途行う設計。
 */
function removeKeys(obj: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.has(k)) out[k] = v;
  }
  return out;
}

/**
 * EIS/EOS 用：SCHEMA_KEYS に該当するキーを再帰的に除去する。
 * スキーマはネストが深い（配列 → オブジェクト → 配列…）ため、
 * 配列・オブジェクトの両方を再帰走査し、末端のプリミティブに達するまで掘り下げる。
 */
function cleanseSchema(node: unknown): unknown {
  // 配列の場合は各要素を再帰処理
  if (Array.isArray(node)) return node.map(cleanseSchema);
  // オブジェクトの場合は SCHEMA_KEYS を除外しつつ値を再帰処理
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (SCHEMA_KEYS.has(k)) continue;
      out[k] = cleanseSchema(v);
    }
    return out;
  }
  return node;
}

/**
 * 個々の block（アクション/トリガーの1ステップ）をクレンジングする。
 * 1. BLOCK_KEYS で block 固有の不要キーを浅く除去
 * 2. block 直下の EIS/EOS を cleanseSchema で再帰除去
 * 3. input 内にもネストされた EIS/EOS が存在し得るため cleanseSchemaFields で探索
 */
function cleanseBlock(block: Record<string, unknown>): Record<string, unknown> {
  const cleaned = removeKeys(block, BLOCK_KEYS);
  // block 直下の EIS / EOS を処理
  if (cleaned.extended_input_schema) {
    cleaned.extended_input_schema = cleanseSchema(cleaned.extended_input_schema);
  }
  if (cleaned.extended_output_schema) {
    cleaned.extended_output_schema = cleanseSchema(cleaned.extended_output_schema);
  }
  // input / output 内にも EIS/EOS が入れ子で存在するケースに対応
  if (cleaned.input && typeof cleaned.input === "object") {
    cleaned.input = cleanseSchemaFields(cleaned.input as Record<string, unknown>);
  }
  return cleaned;
}

/**
 * オブジェクトツリー内に散在する extended_input_schema / extended_output_schema を
 * 再帰的に探索し、見つけ次第 cleanseSchema で UI 制御キーを除去する。
 *
 * なぜ必要か：Workato の block.input にはサブレシピやループなどで
 * さらに EIS/EOS がネストされることがあり、block 直下だけでは取りこぼす。
 * そのため任意深度のオブジェクト/配列を走査して EIS/EOS キーを探す。
 *
 * 処理フロー:
 *   - キー名が EIS/EOS → cleanseSchema で再帰クレンジング
 *   - 配列 → 各要素がオブジェクトなら再帰、プリミティブならそのまま
 *   - オブジェクト → 再帰探索を続行
 *   - プリミティブ → そのままコピー
 */
function cleanseSchemaFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "extended_input_schema" || k === "extended_output_schema") {
      // EIS/EOS を発見 → スキーマ専用の再帰除去を適用
      out[k] = cleanseSchema(v);
    } else if (Array.isArray(v)) {
      // 配列内のオブジェクト要素にも EIS/EOS が潜む可能性があるため再帰
      out[k] = v.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? cleanseSchemaFields(item as Record<string, unknown>)
          : item,
      );
    } else if (v !== null && typeof v === "object") {
      // ネストされたオブジェクトを再帰探索
      out[k] = cleanseSchemaFields(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * recipe.code 全体をクレンジングする。
 * code にはレシピのトリガー定義と block 配列（各アクション）が含まれる。
 * code 直下にも EIS/EOS が存在するため、block 配列とは別に処理する。
 */
function cleanseRecipeCode(code: unknown): unknown {
  if (!code || typeof code !== "object") return code;
  const c = code as Record<string, unknown>;
  const result: Record<string, unknown> = { ...c };

  // code 直下の EIS/EOS（トリガー定義のスキーマ）
  if (result.extended_input_schema) {
    result.extended_input_schema = cleanseSchema(result.extended_input_schema);
  }
  if (result.extended_output_schema) {
    result.extended_output_schema = cleanseSchema(result.extended_output_schema);
  }

  // block 配列（各アクションステップ）を個別にクレンジング
  if (Array.isArray(result.block)) {
    result.block = (result.block as Record<string, unknown>[]).map(cleanseBlock);
  }

  return result;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * プロジェクト JSON をクレンジングする（公開 API）。
 *
 * 処理順序:
 *   1. JSON round-trip で deep clone（元データを破壊しない）
 *   2. project / recipes / connections 各階層で不要キーを除去
 *   3. recipes 内の code → block → EIS/EOS を再帰クレンジング
 *   4. 最後に stripNulls で null 値を一括除去し、出力をコンパクトにする
 */
export function cleanseProjectJson(data: unknown): unknown {
  // deep clone — structuredClone が使えない環境向けに JSON round-trip で代替
  const clone = JSON.parse(JSON.stringify(data));
  if (!clone || typeof clone !== "object") return stripNulls(clone);

  const root = clone as Record<string, unknown>;

  // project
  if (root.project && typeof root.project === "object") {
    root.project = removeKeys(root.project as Record<string, unknown>, PROJECT_KEYS);
  }

  // recipes
  if (Array.isArray(root.recipes)) {
    root.recipes = (root.recipes as Record<string, unknown>[]).map((r) => {
      const cleaned = removeKeys(r, RECIPE_KEYS);
      if (cleaned.code) {
        cleaned.code = cleanseRecipeCode(cleaned.code);
      }
      return cleaned;
    });
  }

  // connections
  if (Array.isArray(root.connections)) {
    root.connections = (root.connections as Record<string, unknown>[]).map((c) =>
      removeKeys(c as Record<string, unknown>, CONNECTION_KEYS),
    );
  }

  return stripNulls(root);
}
