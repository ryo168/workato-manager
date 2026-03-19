// JSONクレンジング — Dify送信前に不要フィールドを除去してトークン消費を削減する。

/** recipes 直下から削除するキー */
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

/** project 直下から削除するキー */
const PROJECT_KEYS = new Set(["id", "folder_id"]);

/** block 内から削除するキー */
const BLOCK_KEYS = new Set(["uuid", "old_name", "toggleCfg", "clear_scope"]);

/** connections 内から削除するキー */
const CONNECTION_KEYS = new Set([
  "authorized_at",
  "created_at",
  "updated_at",
  "folder_id",
  "project_id",
]);

/** EIS/EOS 配下から再帰的に削除するキー */
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

/** null値を再帰的に除去しつつ deep clone */
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

/** 指定キーセットを削除（shallow — 再帰しない） */
function removeKeys(obj: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.has(k)) out[k] = v;
  }
  return out;
}

/** EIS/EOS 用：再帰的にスキーマキーを除去 */
function cleanseSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanseSchema);
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

/** block をクレンジング（block自身のキー + EIS/EOS を再帰処理） */
function cleanseBlock(block: Record<string, unknown>): Record<string, unknown> {
  const cleaned = removeKeys(block, BLOCK_KEYS);
  // EIS / EOS
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

/** オブジェクト内の extended_input_schema / extended_output_schema を再帰探索して処理 */
function cleanseSchemaFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "extended_input_schema" || k === "extended_output_schema") {
      out[k] = cleanseSchema(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? cleanseSchemaFields(item as Record<string, unknown>)
          : item,
      );
    } else if (v !== null && typeof v === "object") {
      out[k] = cleanseSchemaFields(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** recipe の code 内の block 配列をクレンジング */
function cleanseRecipeCode(code: unknown): unknown {
  if (!code || typeof code !== "object") return code;
  const c = code as Record<string, unknown>;
  const result: Record<string, unknown> = { ...c };

  // code 直下の EIS/EOS
  if (result.extended_input_schema) {
    result.extended_input_schema = cleanseSchema(result.extended_input_schema);
  }
  if (result.extended_output_schema) {
    result.extended_output_schema = cleanseSchema(result.extended_output_schema);
  }

  // block 配列
  if (Array.isArray(result.block)) {
    result.block = (result.block as Record<string, unknown>[]).map(cleanseBlock);
  }

  return result;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * プロジェクト JSON をクレンジングする。
 * deep clone → 不要キー除去 → null 除去 の順で処理。
 */
export function cleanseProjectJson(data: unknown): unknown {
  // deep clone (structuredClone が使えない環境向けに JSON round-trip)
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
