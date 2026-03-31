// 設定ページのプロファイル編集ロジック。
// 汎用 CRUD フックを使い、各サービスのプロファイルをオーケストレーションする。

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useConfig } from "../context/ConfigContext";
import type { Profile, DifyProfile, GeminiProfile, WorkatoFileApiProfile, WorkatoApiPlatformProfile } from "../types/workato";
import { useGenericProfileCrud, type ProfileCrudConfig } from "./useGenericProfileCrud";
import {
  type EditRow,
  type DifyEditRow,
  type GeminiEditRow,
  type WorkatoFileApiEditRow,
  type WorkatoApiPlatformEditRow,
  NEW_ROW_DEFAULT,
  DIFY_NEW_ROW_DEFAULT,
  GEMINI_NEW_ROW_DEFAULT,
  WORKATO_FILE_API_NEW_ROW_DEFAULT,
  WORKATO_API_PLATFORM_NEW_ROW_DEFAULT,
} from "./profileEditorTypes";
import { ERROR } from "../constants/settings";

// 型の re-export（既存の import 先を壊さない）
export type { EditRow, DifyEditRow, GeminiEditRow, WorkatoFileApiEditRow, WorkatoApiPlatformEditRow } from "./profileEditorTypes";

// ---------- CRUD 設定定義 ----------

const WORKATO_CRUD: ProfileCrudConfig<Profile, EditRow> = {
  getProfiles: (c) => c.profiles,
  getActive: (c) => c.active_profile,
  toEditRow: (p) => ({
    name: p.name,
    description: p.description ?? "",
    api_token: p.api_token,
    base_url: p.base_url,
    use_proxy: p.use_proxy ?? false,
  }),
  toProfile: (row) => ({
    name: row.name.trim(),
    description: row.description.trim() || undefined,
    api_token: row.api_token.trim(),
    base_url: row.base_url.trim(),
    use_proxy: row.use_proxy || undefined,
  }),
  getName: (row) => row.name,
  getProfileName: (p) => p.name,
  defaultRow: NEW_ROW_DEFAULT,
  serviceName: "Workato",
  requireAtLeastOne: true,
};

const DIFY_CRUD: ProfileCrudConfig<DifyProfile, DifyEditRow> = {
  getProfiles: (c) => c.dify_profiles ?? [],
  getActive: (c) => c.active_dify_profile ?? "",
  toEditRow: (p) => ({
    name: p.name,
    description: p.description ?? "",
    base_url: p.base_url,
    api_key: p.api_key,
    user: p.user ?? "",
    production_mode: p.production_mode ?? false,
    use_proxy: p.use_proxy ?? false,
  }),
  toProfile: (row, base) => ({
    ...base,
    name: row.name.trim(),
    description: row.description.trim() || undefined,
    base_url: row.base_url.trim(),
    api_key: row.api_key.trim(),
    user: row.user.trim() || undefined,
    production_mode: row.production_mode || undefined,
    use_proxy: row.use_proxy || undefined,
  }),
  getName: (row) => row.name,
  getProfileName: (p) => p.name,
  defaultRow: DIFY_NEW_ROW_DEFAULT,
  serviceName: "Dify",
};

const GEMINI_CRUD: ProfileCrudConfig<GeminiProfile, GeminiEditRow> = {
  getProfiles: (c) => c.gemini_profiles ?? [],
  getActive: (c) => c.active_gemini_profile ?? "",
  toEditRow: (p) => ({
    name: p.name,
    description: p.description ?? "",
    api_key: p.api_key,
    model: p.model ?? "gemini-2.5-flash",
    use_proxy: p.use_proxy ?? false,
  }),
  toProfile: (row, base) => ({
    ...base,
    name: row.name.trim(),
    description: row.description.trim() || undefined,
    api_key: row.api_key.trim(),
    model: row.model.trim() || undefined,
    use_proxy: row.use_proxy || undefined,
  }),
  getName: (row) => row.name,
  getProfileName: (p) => p.name,
  defaultRow: GEMINI_NEW_ROW_DEFAULT,
  serviceName: "Gemini",
};

const WFA_CRUD: ProfileCrudConfig<WorkatoFileApiProfile, WorkatoFileApiEditRow> = {
  getProfiles: (c) => c.workato_file_api_profiles ?? [],
  getActive: (c) => c.active_workato_file_api_profile ?? "",
  toEditRow: (p) => ({
    name: p.name,
    description: p.description ?? "",
    url: p.url,
    api_token: p.api_token,
    use_proxy: p.use_proxy ?? false,
  }),
  toProfile: (row, base) => ({
    ...base,
    name: row.name.trim(),
    description: row.description.trim() || undefined,
    url: row.url.trim(),
    api_token: row.api_token.trim(),
    use_proxy: row.use_proxy || undefined,
  }),
  getName: (row) => row.name,
  getProfileName: (p) => p.name,
  defaultRow: WORKATO_FILE_API_NEW_ROW_DEFAULT,
  serviceName: "Workato File API",
};

const WAP_CRUD: ProfileCrudConfig<WorkatoApiPlatformProfile, WorkatoApiPlatformEditRow> = {
  getProfiles: (c) => c.workato_api_platform_profiles ?? [],
  getActive: (c) => c.active_workato_api_platform_profile ?? "",
  toEditRow: (p) => ({
    name: p.name,
    description: p.description ?? "",
    url: p.url,
    api_token: p.api_token,
  }),
  toProfile: (row) => ({
    name: row.name.trim(),
    description: row.description.trim() || undefined,
    url: row.url.trim(),
    api_token: row.api_token.trim(),
  }),
  getName: (row) => row.name,
  getProfileName: (p) => p.name,
  defaultRow: WORKATO_API_PLATFORM_NEW_ROW_DEFAULT,
  serviceName: "Workato API Platform",
};

// ---------- メインフック ----------

export function useProfileEditor() {
  const { config, saveProfiles } = useConfig();

  // --- 共通 UI state ---
  const [proxyUrl, setProxyUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // proxyUrl の config 同期
  useEffect(() => {
    if (config) setProxyUrl(config.proxy_url ?? "");
  }, [config]);

  // 他サービスの最新 state を参照するための ref
  const stateRef = useRef({
    workato: { profiles: [] as Profile[], active: "" },
    dify: { profiles: [] as DifyProfile[], active: "" },
    gemini: { profiles: [] as GeminiProfile[], active: "" },
    wfa: { profiles: [] as WorkatoFileApiProfile[], active: "" },
    wap: { profiles: [] as WorkatoApiPlatformProfile[], active: "" },
    proxyUrl: "",
  });

  // --- onSave コールバック生成（各フックから呼ばれる） ---
  const createOnSave = useCallback(
    <T,>(key: "workato" | "dify" | "gemini" | "wfa" | "wap") =>
      async (profiles: T[], active: string) => {
        const s = stateRef.current;
        const next = { ...s, [key]: { profiles, active } };
        await saveProfiles(
          next.workato.profiles, next.workato.active,
          next.dify.profiles, next.dify.active,
          next.gemini.profiles, next.gemini.active,
          next.wfa.profiles, next.wfa.active,
          next.wap.profiles, next.wap.active,
          s.proxyUrl.trim() || undefined,
        );
      },
    [saveProfiles],
  );

  const workatoOnSave = useMemo(() => createOnSave<Profile>("workato"), [createOnSave]);
  const difyOnSave = useMemo(() => createOnSave<DifyProfile>("dify"), [createOnSave]);
  const geminiOnSave = useMemo(() => createOnSave<GeminiProfile>("gemini"), [createOnSave]);
  const wfaOnSave = useMemo(() => createOnSave<WorkatoFileApiProfile>("wfa"), [createOnSave]);
  const wapOnSave = useMemo(() => createOnSave<WorkatoApiPlatformProfile>("wap"), [createOnSave]);

  // --- 各サービスの CRUD ---
  const workato = useGenericProfileCrud(config, workatoOnSave, setError, WORKATO_CRUD);
  const dify = useGenericProfileCrud(config, difyOnSave, setError, DIFY_CRUD);
  const gemini = useGenericProfileCrud(config, geminiOnSave, setError, GEMINI_CRUD);
  const wfa = useGenericProfileCrud(config, wfaOnSave, setError, WFA_CRUD);
  const wap = useGenericProfileCrud(config, wapOnSave, setError, WAP_CRUD);

  // ref を最新値で更新
  stateRef.current = {
    workato: { profiles: workato.profiles, active: workato.activeProfile },
    dify: { profiles: dify.profiles, active: dify.activeProfile },
    gemini: { profiles: gemini.profiles, active: gemini.activeProfile },
    wfa: { profiles: wfa.profiles, active: wfa.activeProfile },
    wap: { profiles: wap.profiles, active: wap.activeProfile },
    proxyUrl,
  };

  // ===== バックエンドに保存 =====
  const handleSave = useCallback(async () => {
    if (workato.profiles.length === 0) {
      setError(ERROR.PROFILE_AT_LEAST_ONE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const s = stateRef.current;
      await saveProfiles(
        s.workato.profiles, s.workato.active,
        s.dify.profiles, s.dify.active,
        s.gemini.profiles, s.gemini.active,
        s.wfa.profiles, s.wfa.active,
        s.wap.profiles, s.wap.active,
        s.proxyUrl.trim() || undefined,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [workato.profiles.length, saveProfiles]);

  // --- dirty 判定 ---
  // 編集中・追加中、またはプロキシURLが未保存の場合にdirty
  const isProxyDirty = config ? (proxyUrl !== (config.proxy_url ?? "")) : false;
  const dirty =
    workato.editingIdx !== null || workato.adding ||
    dify.editingIdx !== null || dify.adding ||
    gemini.editingIdx !== null || gemini.adding ||
    wfa.editingIdx !== null || wfa.adding ||
    wap.editingIdx !== null || wap.adding ||
    isProxyDirty;

  return {
    workato,
    dify,
    gemini,
    wfa,
    wap,
    common: { proxyUrl, setProxyUrl, saving, saved, error, handleSave, dirty },
  } as const;
}
