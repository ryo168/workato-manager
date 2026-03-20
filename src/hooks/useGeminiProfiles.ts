// Gemini プロファイルの CRUD 管理
import { useState, useCallback, useEffect } from "react";
import type { AppConfig, GeminiProfile } from "../types/workato";
import { GeminiEditRow, GEMINI_NEW_ROW_DEFAULT } from "./profileEditorTypes";

/** onSave: 更新後の geminiProfiles と activeGeminiProfile を渡して保存を依頼する */
export function useGeminiProfiles(
  config: AppConfig | null,
  onSave: (profiles: GeminiProfile[], active: string) => Promise<void>,
  setError: (e: string | null) => void,
) {
  const [geminiProfiles, setGeminiProfiles] = useState<GeminiProfile[]>([]);
  const [activeGeminiProfile, setActiveGeminiProfile] = useState("");
  const [geminiEditingIdx, setGeminiEditingIdx] = useState<number | null>(null);
  const [geminiEditRow, setGeminiEditRow] = useState<GeminiEditRow>(GEMINI_NEW_ROW_DEFAULT);
  const [geminiAdding, setGeminiAdding] = useState(false);
  const [geminiNewRow, setGeminiNewRow] = useState<GeminiEditRow>(GEMINI_NEW_ROW_DEFAULT);

  // config 同期
  useEffect(() => {
    if (config) {
      setGeminiProfiles(config.gemini_profiles ?? []);
      setActiveGeminiProfile(config.active_gemini_profile ?? "");
    }
  }, [config]);

  const startGeminiEdit = useCallback(
    (idx: number) => {
      setGeminiEditingIdx(idx);
      const p = geminiProfiles[idx];
      setGeminiEditRow({
        name: p.name,
        api_key: p.api_key,
        model: p.model ?? "gemini-2.5-flash",
        use_proxy: p.use_proxy ?? false,
      });
      setGeminiAdding(false);
    },
    [geminiProfiles],
  );

  const cancelGeminiEdit = useCallback(() => {
    setGeminiEditingIdx(null);
  }, []);

  const commitGeminiEdit = useCallback(async () => {
    if (!geminiEditRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    const updated = geminiProfiles.map((p, i) =>
      i === geminiEditingIdx
        ? {
            ...p,
            name: geminiEditRow.name.trim(),
            api_key: geminiEditRow.api_key.trim(),
            model: geminiEditRow.model.trim() || undefined,
            use_proxy: geminiEditRow.use_proxy || undefined,
          }
        : p,
    );
    const newActiveGemini =
      activeGeminiProfile === geminiProfiles[geminiEditingIdx!].name
        ? geminiEditRow.name.trim()
        : activeGeminiProfile;
    setGeminiProfiles(updated);
    setActiveGeminiProfile(newActiveGemini);
    setGeminiEditingIdx(null);
    setError(null);
    try {
      await onSave(updated, newActiveGemini);
    } catch (e) {
      setError(String(e));
    }
  }, [geminiProfiles, geminiEditingIdx, geminiEditRow, activeGeminiProfile, onSave, setError]);

  const deleteGeminiProfile = useCallback(
    async (idx: number) => {
      const removed = geminiProfiles[idx];
      const updated = geminiProfiles.filter((_, i) => i !== idx);
      const newActiveGemini = activeGeminiProfile === removed.name
        ? (updated.length > 0 ? updated[0].name : "")
        : activeGeminiProfile;
      setGeminiProfiles(updated);
      setActiveGeminiProfile(newActiveGemini);
      if (geminiEditingIdx === idx) setGeminiEditingIdx(null);
      try {
        await onSave(updated, newActiveGemini);
      } catch (e) {
        setError(String(e));
      }
    },
    [geminiProfiles, activeGeminiProfile, geminiEditingIdx, onSave, setError],
  );

  const startGeminiAdding = useCallback(() => {
    setGeminiAdding(true);
    setGeminiNewRow(GEMINI_NEW_ROW_DEFAULT);
    setGeminiEditingIdx(null);
    setError(null);
  }, [setError]);

  const cancelGeminiAdding = useCallback(() => setGeminiAdding(false), []);

  const commitGeminiAdd = useCallback(async () => {
    if (!geminiNewRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    if (geminiProfiles.some((p) => p.name === geminiNewRow.name.trim())) {
      setError("同じ名前のGeminiプロファイルが既に存在します。");
      return;
    }
    const newProfile: GeminiProfile = {
      name: geminiNewRow.name.trim(),
      api_key: geminiNewRow.api_key.trim(),
      model: geminiNewRow.model.trim() || undefined,
      use_proxy: geminiNewRow.use_proxy || undefined,
    };
    const updated = [...geminiProfiles, newProfile];
    const newActiveGemini = geminiProfiles.length === 0 ? newProfile.name : activeGeminiProfile;
    setGeminiProfiles(updated);
    setActiveGeminiProfile(newActiveGemini);
    setGeminiAdding(false);
    setError(null);
    try {
      await onSave(updated, newActiveGemini);
    } catch (e) {
      setError(String(e));
    }
  }, [geminiProfiles, geminiNewRow, activeGeminiProfile, onSave, setError]);

  return {
    geminiProfiles,
    activeGeminiProfile,
    setActiveGeminiProfile,
    geminiEditingIdx,
    geminiEditRow,
    setGeminiEditRow,
    geminiAdding,
    geminiNewRow,
    setGeminiNewRow,
    startGeminiEdit,
    cancelGeminiEdit,
    commitGeminiEdit,
    deleteGeminiProfile,
    startGeminiAdding,
    cancelGeminiAdding,
    commitGeminiAdd,
  } as const;
}
