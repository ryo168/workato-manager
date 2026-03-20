// Workato File API プロファイルの CRUD 管理
import { useState, useCallback, useEffect } from "react";
import type { AppConfig, WorkatoFileApiProfile } from "../types/workato";
import { WorkatoFileApiEditRow, WORKATO_FILE_API_NEW_ROW_DEFAULT } from "./profileEditorTypes";

/** onSave: 更新後の wfaProfiles と activeWfaProfile を渡して保存を依頼する */
export function useWorkatoFileApiProfiles(
  config: AppConfig | null,
  onSave: (profiles: WorkatoFileApiProfile[], active: string) => Promise<void>,
  setError: (e: string | null) => void,
) {
  const [wfaProfiles, setWfaProfiles] = useState<WorkatoFileApiProfile[]>([]);
  const [activeWfaProfile, setActiveWfaProfile] = useState("");
  const [wfaEditingIdx, setWfaEditingIdx] = useState<number | null>(null);
  const [wfaEditRow, setWfaEditRow] = useState<WorkatoFileApiEditRow>(WORKATO_FILE_API_NEW_ROW_DEFAULT);
  const [wfaAdding, setWfaAdding] = useState(false);
  const [wfaNewRow, setWfaNewRow] = useState<WorkatoFileApiEditRow>(WORKATO_FILE_API_NEW_ROW_DEFAULT);

  // config 同期
  useEffect(() => {
    if (config) {
      setWfaProfiles(config.workato_file_api_profiles ?? []);
      setActiveWfaProfile(config.active_workato_file_api_profile ?? "");
    }
  }, [config]);

  const startWfaEdit = useCallback(
    (idx: number) => {
      setWfaEditingIdx(idx);
      const p = wfaProfiles[idx];
      setWfaEditRow({
        name: p.name,
        url: p.url,
        api_token: p.api_token,
        use_proxy: p.use_proxy ?? false,
      });
      setWfaAdding(false);
    },
    [wfaProfiles],
  );

  const cancelWfaEdit = useCallback(() => {
    setWfaEditingIdx(null);
  }, []);

  const commitWfaEdit = useCallback(async () => {
    if (!wfaEditRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    const updated = wfaProfiles.map((p, i) =>
      i === wfaEditingIdx
        ? {
            ...p,
            name: wfaEditRow.name.trim(),
            url: wfaEditRow.url.trim(),
            api_token: wfaEditRow.api_token.trim(),
            use_proxy: wfaEditRow.use_proxy || undefined,
          }
        : p,
    );
    const newActiveWfa =
      activeWfaProfile === wfaProfiles[wfaEditingIdx!].name
        ? wfaEditRow.name.trim()
        : activeWfaProfile;
    setWfaProfiles(updated);
    setActiveWfaProfile(newActiveWfa);
    setWfaEditingIdx(null);
    setError(null);
    try {
      await onSave(updated, newActiveWfa);
    } catch (e) {
      setError(String(e));
    }
  }, [wfaProfiles, wfaEditingIdx, wfaEditRow, activeWfaProfile, onSave, setError]);

  const deleteWfaProfile = useCallback(
    async (idx: number) => {
      const removed = wfaProfiles[idx];
      const updated = wfaProfiles.filter((_, i) => i !== idx);
      const newActiveWfa = activeWfaProfile === removed.name
        ? (updated.length > 0 ? updated[0].name : "")
        : activeWfaProfile;
      setWfaProfiles(updated);
      setActiveWfaProfile(newActiveWfa);
      if (wfaEditingIdx === idx) setWfaEditingIdx(null);
      try {
        await onSave(updated, newActiveWfa);
      } catch (e) {
        setError(String(e));
      }
    },
    [wfaProfiles, activeWfaProfile, wfaEditingIdx, onSave, setError],
  );

  const startWfaAdding = useCallback(() => {
    setWfaAdding(true);
    setWfaNewRow(WORKATO_FILE_API_NEW_ROW_DEFAULT);
    setWfaEditingIdx(null);
    setError(null);
  }, [setError]);

  const cancelWfaAdding = useCallback(() => setWfaAdding(false), []);

  const commitWfaAdd = useCallback(async () => {
    if (!wfaNewRow.name.trim()) {
      setError("プロファイル名を入力してください。");
      return;
    }
    if (wfaProfiles.some((p) => p.name === wfaNewRow.name.trim())) {
      setError("同じ名前のWorkato File APIプロファイルが既に存在します。");
      return;
    }
    const newProfile: WorkatoFileApiProfile = {
      name: wfaNewRow.name.trim(),
      url: wfaNewRow.url.trim(),
      api_token: wfaNewRow.api_token.trim(),
      use_proxy: wfaNewRow.use_proxy || undefined,
    };
    const updated = [...wfaProfiles, newProfile];
    const newActiveWfa = wfaProfiles.length === 0 ? newProfile.name : activeWfaProfile;
    setWfaProfiles(updated);
    setActiveWfaProfile(newActiveWfa);
    setWfaAdding(false);
    setError(null);
    try {
      await onSave(updated, newActiveWfa);
    } catch (e) {
      setError(String(e));
    }
  }, [wfaProfiles, wfaNewRow, activeWfaProfile, onSave, setError]);

  return {
    wfaProfiles,
    activeWfaProfile,
    setActiveWfaProfile,
    wfaEditingIdx,
    wfaEditRow,
    setWfaEditRow,
    wfaAdding,
    wfaNewRow,
    setWfaNewRow,
    startWfaEdit,
    cancelWfaEdit,
    commitWfaEdit,
    deleteWfaProfile,
    startWfaAdding,
    cancelWfaAdding,
    commitWfaAdd,
  } as const;
}
