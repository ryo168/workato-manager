// 設定ページのプロファイル編集ロジック。
// 追加・編集・削除・保存をまとめてる。

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "../context/ConfigContext";
import type { Profile } from "../types/workato";

export interface EditRow {
  name: string;
  api_token: string;
  base_url: string;
  proxy_url: string;
}

const NEW_ROW_DEFAULT: EditRow = {
  name: "",
  api_token: "",
  base_url: "https://app.trial.workato.com",
  proxy_url: "",
};

export function useProfileEditor() {
  const { config, saveProfiles } = useConfig();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({
    name: "",
    api_token: "",
    base_url: "",
    proxy_url: "",
  });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(NEW_ROW_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 設定読み込み時にローカル state に反映
  useEffect(() => {
    if (config) {
      setProfiles(config.profiles);
      setActiveProfile(config.active_profile);
    }
  }, [config]);

  const startEdit = useCallback(
    (idx: number) => {
      setEditingIdx(idx);
      setEditRow({ ...profiles[idx], proxy_url: profiles[idx].proxy_url ?? "" });
      setAdding(false);
    },
    [profiles],
  );

  const cancelEdit = useCallback(() => {
    setEditingIdx(null);
  }, []);

  // 編集確定（まだ保存はしない）
  const commitEdit = useCallback(() => {
    if (!editRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    const updated = profiles.map((p, i) =>
      i === editingIdx
        ? {
            ...editRow,
            name: editRow.name.trim(),
            api_token: editRow.api_token.trim(),
            base_url: editRow.base_url.trim(),
            proxy_url: editRow.proxy_url.trim() || undefined,
          }
        : p,
    );
    setProfiles(updated);
    if (activeProfile === profiles[editingIdx!].name) {
      setActiveProfile(editRow.name.trim());
    }
    setEditingIdx(null);
    setError(null);
  }, [profiles, editingIdx, editRow, activeProfile]);

  const deleteProfile = useCallback(
    (idx: number) => {
      if (profiles.length === 1) {
        setError("最後のプロファイルは削除できません。");
        return;
      }
      const removed = profiles[idx];
      const updated = profiles.filter((_, i) => i !== idx);
      setProfiles(updated);
      if (activeProfile === removed.name) {
        setActiveProfile(updated[0].name);
      }
      if (editingIdx === idx) setEditingIdx(null);
    },
    [profiles, activeProfile, editingIdx],
  );

  const startAdding = useCallback(() => {
    setAdding(true);
    setNewRow(NEW_ROW_DEFAULT);
    setEditingIdx(null);
    setError(null);
  }, []);

  const cancelAdding = useCallback(() => setAdding(false), []);

  const commitAdd = useCallback(() => {
    if (!newRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    if (profiles.some((p) => p.name === newRow.name.trim())) {
      setError("同じ名前のプロファイルが既に存在します。");
      return;
    }
    setProfiles([
      ...profiles,
      {
        name: newRow.name.trim(),
        api_token: newRow.api_token.trim(),
        base_url: newRow.base_url.trim(),
        proxy_url: newRow.proxy_url.trim() || undefined,
      },
    ]);
    setAdding(false);
    setError(null);
  }, [profiles, newRow]);

  // バックエンドに保存
  const handleSave = useCallback(async () => {
    if (profiles.length === 0) {
      setError("プロファイルが1つ以上必要です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfiles(profiles, activeProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [profiles, activeProfile, saveProfiles]);

  return {
    profiles,
    activeProfile,
    setActiveProfile,
    editingIdx,
    editRow,
    setEditRow,
    adding,
    newRow,
    setNewRow,
    saving,
    saved,
    error,
    startEdit,
    cancelEdit,
    commitEdit,
    deleteProfile,
    startAdding,
    cancelAdding,
    commitAdd,
    handleSave,
  } as const;
}
