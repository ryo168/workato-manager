// Dify プロファイルの CRUD 管理
import { useState, useCallback, useEffect } from "react";
import type { AppConfig, DifyProfile } from "../types/workato";
import { DifyEditRow, DIFY_NEW_ROW_DEFAULT } from "./profileEditorTypes";

/** onSave: 更新後の difyProfiles と activeDifyProfile を渡して保存を依頼する */
export function useDifyProfiles(
  config: AppConfig | null,
  onSave: (profiles: DifyProfile[], active: string) => Promise<void>,
  setError: (e: string | null) => void,
) {
  const [difyProfiles, setDifyProfiles] = useState<DifyProfile[]>([]);
  const [activeDifyProfile, setActiveDifyProfile] = useState("");
  const [difyEditingIdx, setDifyEditingIdx] = useState<number | null>(null);
  const [difyEditRow, setDifyEditRow] = useState<DifyEditRow>(DIFY_NEW_ROW_DEFAULT);
  const [difyAdding, setDifyAdding] = useState(false);
  const [difyNewRow, setDifyNewRow] = useState<DifyEditRow>(DIFY_NEW_ROW_DEFAULT);

  // config 同期
  useEffect(() => {
    if (config) {
      setDifyProfiles(config.dify_profiles ?? []);
      setActiveDifyProfile(config.active_dify_profile ?? "");
    }
  }, [config]);

  const startDifyEdit = useCallback(
    (idx: number) => {
      setDifyEditingIdx(idx);
      const p = difyProfiles[idx];
      setDifyEditRow({
        name: p.name,
        base_url: p.base_url,
        api_key: p.api_key,
        user: p.user ?? "",
        use_proxy: p.use_proxy ?? false,
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
            use_proxy: difyEditRow.use_proxy || undefined,
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
      await onSave(updated, newActiveDify);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyEditingIdx, difyEditRow, activeDifyProfile, onSave, setError]);

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
        await onSave(updated, newActiveDify);
      } catch (e) {
        setError(String(e));
      }
    },
    [difyProfiles, activeDifyProfile, difyEditingIdx, onSave, setError],
  );

  const startDifyAdding = useCallback(() => {
    setDifyAdding(true);
    setDifyNewRow(DIFY_NEW_ROW_DEFAULT);
    setDifyEditingIdx(null);
    setError(null);
  }, [setError]);

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
      use_proxy: difyNewRow.use_proxy || undefined,
    };
    const updated = [...difyProfiles, newProfile];
    const newActiveDify = difyProfiles.length === 0 ? newProfile.name : activeDifyProfile;
    setDifyProfiles(updated);
    setActiveDifyProfile(newActiveDify);
    setDifyAdding(false);
    setError(null);
    try {
      await onSave(updated, newActiveDify);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyNewRow, activeDifyProfile, onSave, setError]);

  return {
    difyProfiles,
    setDifyProfiles,
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
  } as const;
}
