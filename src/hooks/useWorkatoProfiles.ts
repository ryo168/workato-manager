// Workato プロファイルの CRUD 管理
import { useState, useCallback, useEffect } from "react";
import type { AppConfig, Profile } from "../types/workato";
import { EditRow, NEW_ROW_DEFAULT } from "./profileEditorTypes";

/** onSave: 更新後の profiles と activeProfile を渡して保存を依頼する */
export function useWorkatoProfiles(
  config: AppConfig | null,
  onSave: (profiles: Profile[], active: string) => Promise<void>,
  setError: (e: string | null) => void,
) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({
    name: "",
    api_token: "",
    base_url: "",
    use_proxy: false,
  });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(NEW_ROW_DEFAULT);

  // config 同期
  useEffect(() => {
    if (config) {
      setProfiles(config.profiles);
      setActiveProfile(config.active_profile);
    }
  }, [config]);

  const startEdit = useCallback(
    (idx: number) => {
      setEditingIdx(idx);
      const p = profiles[idx];
      setEditRow({ name: p.name, api_token: p.api_token, base_url: p.base_url, use_proxy: p.use_proxy ?? false });
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
            use_proxy: editRow.use_proxy || undefined,
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
      await onSave(updated, newActive);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, editingIdx, editRow, activeProfile, onSave, setError]);

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
        await onSave(updated, newActive);
      } catch (e) {
        setError(String(e));
      }
    },
    [profiles, activeProfile, editingIdx, onSave, setError],
  );

  const startAdding = useCallback(() => {
    setAdding(true);
    setNewRow(NEW_ROW_DEFAULT);
    setEditingIdx(null);
    setError(null);
  }, [setError]);

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
        use_proxy: newRow.use_proxy || undefined,
      },
    ];
    setProfiles(updated);
    setAdding(false);
    setError(null);
    try {
      await onSave(updated, activeProfile);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, newRow, activeProfile, onSave, setError]);

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
    startEdit,
    cancelEdit,
    commitEdit,
    deleteProfile,
    startAdding,
    cancelAdding,
    commitAdd,
  } as const;
}
