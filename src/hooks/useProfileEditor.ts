// 設定ページのプロファイル編集ロジック。
// Workato / Dify 両方のプロファイル追加・編集・削除・保存をまとめてる。

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "../context/ConfigContext";
import type { Profile, DifyProfile } from "../types/workato";

export interface EditRow {
  name: string;
  api_token: string;
  base_url: string;
}

const NEW_ROW_DEFAULT: EditRow = {
  name: "",
  api_token: "",
  base_url: "https://app.trial.workato.com",
};

export interface DifyEditRow {
  name: string;
  base_url: string;
  api_key: string;
  user: string;
}

const DIFY_NEW_ROW_DEFAULT: DifyEditRow = {
  name: "",
  base_url: "",
  api_key: "",
  user: "",
};

export function useProfileEditor() {
  const { config, saveProfiles } = useConfig();

  // --- Workato プロファイル ---
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({
    name: "",
    api_token: "",
    base_url: "",
  });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(NEW_ROW_DEFAULT);

  // --- Dify プロファイル ---
  const [difyProfiles, setDifyProfiles] = useState<DifyProfile[]>([]);
  const [activeDifyProfile, setActiveDifyProfile] = useState("");
  const [difyEditingIdx, setDifyEditingIdx] = useState<number | null>(null);
  const [difyEditRow, setDifyEditRow] = useState<DifyEditRow>(DIFY_NEW_ROW_DEFAULT);
  const [difyAdding, setDifyAdding] = useState(false);
  const [difyNewRow, setDifyNewRow] = useState<DifyEditRow>(DIFY_NEW_ROW_DEFAULT);

  // --- 共通プロキシ ---
  const [proxyUrl, setProxyUrl] = useState("");

  // --- UI state ---
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 設定読み込み時にローカル state に反映
  useEffect(() => {
    if (config) {
      setProfiles(config.profiles);
      setActiveProfile(config.active_profile);
      setDifyProfiles(config.dify_profiles ?? []);
      setActiveDifyProfile(config.active_dify_profile ?? "");
      setProxyUrl(config.proxy_url ?? "");
    }
  }, [config]);

  // ===== Workato プロファイル操作 =====

  const startEdit = useCallback(
    (idx: number) => {
      setEditingIdx(idx);
      setEditRow({ ...profiles[idx] });
      setAdding(false);
    },
    [profiles],
  );

  const cancelEdit = useCallback(() => {
    setEditingIdx(null);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    const updated = profiles.map((p, i) =>
      i === editingIdx
        ? {
            name: editRow.name.trim(),
            api_token: editRow.api_token.trim(),
            base_url: editRow.base_url.trim(),
          }
        : p,
    );
    const newActive =
      activeProfile === profiles[editingIdx!].name
        ? editRow.name.trim()
        : activeProfile;
    setProfiles(updated);
    setActiveProfile(newActive);
    setEditingIdx(null);
    setError(null);
    try {
      await saveProfiles(updated, newActive, difyProfiles, activeDifyProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, editingIdx, editRow, activeProfile, difyProfiles, activeDifyProfile, proxyUrl, saveProfiles]);

  const deleteProfile = useCallback(
    async (idx: number) => {
      if (profiles.length === 1) {
        setError("最後のプロファイルは削除できません。");
        return;
      }
      const removed = profiles[idx];
      const updated = profiles.filter((_, i) => i !== idx);
      const newActive = activeProfile === removed.name ? updated[0].name : activeProfile;
      setProfiles(updated);
      setActiveProfile(newActive);
      if (editingIdx === idx) setEditingIdx(null);
      try {
        await saveProfiles(updated, newActive, difyProfiles, activeDifyProfile, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [profiles, activeProfile, editingIdx, difyProfiles, activeDifyProfile, proxyUrl, saveProfiles],
  );

  const startAdding = useCallback(() => {
    setAdding(true);
    setNewRow(NEW_ROW_DEFAULT);
    setEditingIdx(null);
    setError(null);
  }, []);

  const cancelAdding = useCallback(() => setAdding(false), []);

  const commitAdd = useCallback(async () => {
    if (!newRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    if (profiles.some((p) => p.name === newRow.name.trim())) {
      setError("同じ名前のプロファイルが既に存在します。");
      return;
    }
    const updated = [
      ...profiles,
      {
        name: newRow.name.trim(),
        api_token: newRow.api_token.trim(),
        base_url: newRow.base_url.trim(),
      },
    ];
    setProfiles(updated);
    setAdding(false);
    setError(null);
    try {
      await saveProfiles(updated, activeProfile, difyProfiles, activeDifyProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, newRow, activeProfile, difyProfiles, activeDifyProfile, proxyUrl, saveProfiles]);

  // ===== Dify プロファイル操作 =====

  const startDifyEdit = useCallback(
    (idx: number) => {
      setDifyEditingIdx(idx);
      const p = difyProfiles[idx];
      setDifyEditRow({
        name: p.name,
        base_url: p.base_url,
        api_key: p.api_key,
        user: p.user ?? "",
      });
      setDifyAdding(false);
    },
    [difyProfiles],
  );

  const cancelDifyEdit = useCallback(() => {
    setDifyEditingIdx(null);
  }, []);

  const commitDifyEdit = useCallback(async () => {
    if (!difyEditRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    const updated = difyProfiles.map((p, i) =>
      i === difyEditingIdx
        ? {
            ...p,
            name: difyEditRow.name.trim(),
            base_url: difyEditRow.base_url.trim(),
            api_key: difyEditRow.api_key.trim(),
            user: difyEditRow.user.trim() || undefined,
          }
        : p,
    );
    const newActiveDify =
      activeDifyProfile === difyProfiles[difyEditingIdx!].name
        ? difyEditRow.name.trim()
        : activeDifyProfile;
    setDifyProfiles(updated);
    setActiveDifyProfile(newActiveDify);
    setDifyEditingIdx(null);
    setError(null);
    try {
      await saveProfiles(profiles, activeProfile, updated, newActiveDify, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyEditingIdx, difyEditRow, activeDifyProfile, profiles, activeProfile, proxyUrl, saveProfiles]);

  const deleteDifyProfile = useCallback(
    async (idx: number) => {
      const removed = difyProfiles[idx];
      const updated = difyProfiles.filter((_, i) => i !== idx);
      const newActiveDify = activeDifyProfile === removed.name
        ? (updated.length > 0 ? updated[0].name : "")
        : activeDifyProfile;
      setDifyProfiles(updated);
      setActiveDifyProfile(newActiveDify);
      if (difyEditingIdx === idx) setDifyEditingIdx(null);
      try {
        await saveProfiles(profiles, activeProfile, updated, newActiveDify, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [difyProfiles, activeDifyProfile, difyEditingIdx, profiles, activeProfile, proxyUrl, saveProfiles],
  );

  const startDifyAdding = useCallback(() => {
    setDifyAdding(true);
    setDifyNewRow(DIFY_NEW_ROW_DEFAULT);
    setDifyEditingIdx(null);
    setError(null);
  }, []);

  const cancelDifyAdding = useCallback(() => setDifyAdding(false), []);

  const commitDifyAdd = useCallback(async () => {
    if (!difyNewRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    if (difyProfiles.some((p) => p.name === difyNewRow.name.trim())) {
      setError("同じ名前のDifyプロファイルが既に存在します。");
      return;
    }
    const newProfile: DifyProfile = {
      name: difyNewRow.name.trim(),
      base_url: difyNewRow.base_url.trim(),
      api_key: difyNewRow.api_key.trim(),
      user: difyNewRow.user.trim() || undefined,
    };
    const updated = [...difyProfiles, newProfile];
    const newActiveDify = difyProfiles.length === 0 ? newProfile.name : activeDifyProfile;
    setDifyProfiles(updated);
    setActiveDifyProfile(newActiveDify);
    setDifyAdding(false);
    setError(null);
    try {
      await saveProfiles(profiles, activeProfile, updated, newActiveDify, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyNewRow, activeDifyProfile, profiles, activeProfile, proxyUrl, saveProfiles]);

  // ===== バックエンドに保存 =====

  const handleSave = useCallback(async () => {
    if (profiles.length === 0) {
      setError("プロファイルが1つ以上必要です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfiles(
        profiles,
        activeProfile,
        difyProfiles,
        activeDifyProfile,
        proxyUrl.trim() || undefined,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [profiles, activeProfile, difyProfiles, activeDifyProfile, proxyUrl, saveProfiles]);

  return {
    // Workato
    profiles,
    activeProfile,
    setActiveProfile,
    editingIdx,
    editRow,
    setEditRow,
    adding,
    newRow,
    setNewRow,
    startEdit,
    cancelEdit,
    commitEdit,
    deleteProfile,
    startAdding,
    cancelAdding,
    commitAdd,
    // Dify
    difyProfiles,
    activeDifyProfile,
    setActiveDifyProfile,
    difyEditingIdx,
    difyEditRow,
    setDifyEditRow,
    difyAdding,
    difyNewRow,
    setDifyNewRow,
    startDifyEdit,
    cancelDifyEdit,
    commitDifyEdit,
    deleteDifyProfile,
    startDifyAdding,
    cancelDifyAdding,
    commitDifyAdd,
    // 共通
    proxyUrl,
    setProxyUrl,
    saving,
    saved,
    error,
    handleSave,
  } as const;
}
