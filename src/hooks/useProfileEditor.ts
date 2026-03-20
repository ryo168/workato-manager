// 設定ページのプロファイル編集ロジック。
// 各サービスの CRUD を個別フックに分割し、ここでオーケストレーションする。

import { useState, useEffect, useCallback, useRef } from "react";
import { useConfig } from "../context/ConfigContext";
import type { Profile, DifyProfile, GeminiProfile, WorkatoFileApiProfile } from "../types/workato";
import { useWorkatoProfiles } from "./useWorkatoProfiles";
import { useDifyProfiles } from "./useDifyProfiles";
import { useGeminiProfiles } from "./useGeminiProfiles";
import { useWorkatoFileApiProfiles } from "./useWorkatoFileApiProfiles";

// 型の re-export（既存の import 先を壊さない）
export type { EditRow, DifyEditRow, GeminiEditRow, WorkatoFileApiEditRow } from "./profileEditorTypes";

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
  // （onSave コールバック内でクロージャの stale 問題を回避する）
  const workatoRef = useRef<{ profiles: Profile[]; active: string }>({ profiles: [], active: "" });
  const difyRef = useRef<{ profiles: DifyProfile[]; active: string }>({ profiles: [], active: "" });
  const geminiRef = useRef<{ profiles: GeminiProfile[]; active: string }>({ profiles: [], active: "" });
  const wfaRef = useRef<{ profiles: WorkatoFileApiProfile[]; active: string }>({ profiles: [], active: "" });
  const proxyUrlRef = useRef("");

  // --- onSave コールバック（各フックから呼ばれる） ---
  // 自身の更新値を引数で受け取り、他サービスの値は ref から読む

  const workatoOnSave = useCallback(async (p: Profile[], a: string) => {
    await saveProfiles(p, a, difyRef.current.profiles, difyRef.current.active, geminiRef.current.profiles, geminiRef.current.active, wfaRef.current.profiles, wfaRef.current.active, proxyUrlRef.current.trim() || undefined);
  }, [saveProfiles]);

  const difyOnSave = useCallback(async (p: DifyProfile[], a: string) => {
    await saveProfiles(workatoRef.current.profiles, workatoRef.current.active, p, a, geminiRef.current.profiles, geminiRef.current.active, wfaRef.current.profiles, wfaRef.current.active, proxyUrlRef.current.trim() || undefined);
  }, [saveProfiles]);

  const geminiOnSave = useCallback(async (p: GeminiProfile[], a: string) => {
    await saveProfiles(workatoRef.current.profiles, workatoRef.current.active, difyRef.current.profiles, difyRef.current.active, p, a, wfaRef.current.profiles, wfaRef.current.active, proxyUrlRef.current.trim() || undefined);
  }, [saveProfiles]);

  const wfaOnSave = useCallback(async (p: WorkatoFileApiProfile[], a: string) => {
    await saveProfiles(workatoRef.current.profiles, workatoRef.current.active, difyRef.current.profiles, difyRef.current.active, geminiRef.current.profiles, geminiRef.current.active, p, a, proxyUrlRef.current.trim() || undefined);
  }, [saveProfiles]);

  // --- 各サービスのフック ---
  const workato = useWorkatoProfiles(config, workatoOnSave, setError);
  const dify = useDifyProfiles(config, difyOnSave, setError);
  const gemini = useGeminiProfiles(config, geminiOnSave, setError);
  const wfa = useWorkatoFileApiProfiles(config, wfaOnSave, setError);

  // ref を最新値で更新
  workatoRef.current = { profiles: workato.profiles, active: workato.activeProfile };
  difyRef.current = { profiles: dify.difyProfiles, active: dify.activeDifyProfile };
  geminiRef.current = { profiles: gemini.geminiProfiles, active: gemini.activeGeminiProfile };
  wfaRef.current = { profiles: wfa.wfaProfiles, active: wfa.activeWfaProfile };
  proxyUrlRef.current = proxyUrl;

  // ===== バックエンドに保存（プロキシ URL 変更時などに使う） =====
  const handleSave = useCallback(async () => {
    if (workato.profiles.length === 0) {
      setError("プロファイルが1つ以上必要です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfiles(
        workatoRef.current.profiles,
        workatoRef.current.active,
        difyRef.current.profiles,
        difyRef.current.active,
        geminiRef.current.profiles,
        geminiRef.current.active,
        wfaRef.current.profiles,
        wfaRef.current.active,
        proxyUrlRef.current.trim() || undefined,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [workato.profiles.length, saveProfiles]);

  return {
    // Workato
    ...workato,
    // Dify
    ...dify,
    // Gemini
    ...gemini,
    // Workato File API
    ...wfa,
    // 共通
    proxyUrl,
    setProxyUrl,
    saving,
    saved,
    error,
    handleSave,
  } as const;
}
