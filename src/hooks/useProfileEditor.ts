// 設定ページのプロファイル編集ロジック。
// Workato / Dify 両方のプロファイル追加・編集・削除・保存をまとめてる。

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "../context/ConfigContext";
import type { Profile, DifyProfile, GeminiProfile, WorkatoFileApiProfile } from "../types/workato";

export interface EditRow {
  name: string;
  api_token: string;
  base_url: string;
  use_proxy: boolean;
}

const NEW_ROW_DEFAULT: EditRow = {
  name: "",
  api_token: "",
  base_url: "https://app.trial.workato.com",
  use_proxy: false,
};

export interface DifyEditRow {
  name: string;
  base_url: string;
  api_key: string;
  user: string;
  use_proxy: boolean;
}

const DIFY_NEW_ROW_DEFAULT: DifyEditRow = {
  name: "",
  base_url: "",
  api_key: "",
  user: "",
  use_proxy: false,
};

export interface GeminiEditRow {
  name: string;
  api_key: string;
  model: string;
  use_proxy: boolean;
}

const GEMINI_NEW_ROW_DEFAULT: GeminiEditRow = {
  name: "",
  api_key: "",
  model: "gemini-2.5-flash",
  use_proxy: false,
};

export interface WorkatoFileApiEditRow {
  name: string;
  url: string;
  api_token: string;
  use_proxy: boolean;
}

const WORKATO_FILE_API_NEW_ROW_DEFAULT: WorkatoFileApiEditRow = {
  name: "",
  url: "",
  api_token: "",
  use_proxy: false,
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
    use_proxy: false,
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

  // --- Gemini プロファイル ---
  const [geminiProfiles, setGeminiProfiles] = useState<GeminiProfile[]>([]);
  const [activeGeminiProfile, setActiveGeminiProfile] = useState("");
  const [geminiEditingIdx, setGeminiEditingIdx] = useState<number | null>(null);
  const [geminiEditRow, setGeminiEditRow] = useState<GeminiEditRow>(GEMINI_NEW_ROW_DEFAULT);
  const [geminiAdding, setGeminiAdding] = useState(false);
  const [geminiNewRow, setGeminiNewRow] = useState<GeminiEditRow>(GEMINI_NEW_ROW_DEFAULT);

  // --- Workato File API プロファイル ---
  const [wfaProfiles, setWfaProfiles] = useState<WorkatoFileApiProfile[]>([]);
  const [activeWfaProfile, setActiveWfaProfile] = useState("");
  const [wfaEditingIdx, setWfaEditingIdx] = useState<number | null>(null);
  const [wfaEditRow, setWfaEditRow] = useState<WorkatoFileApiEditRow>(WORKATO_FILE_API_NEW_ROW_DEFAULT);
  const [wfaAdding, setWfaAdding] = useState(false);
  const [wfaNewRow, setWfaNewRow] = useState<WorkatoFileApiEditRow>(WORKATO_FILE_API_NEW_ROW_DEFAULT);

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
      setGeminiProfiles(config.gemini_profiles ?? []);
      setActiveGeminiProfile(config.active_gemini_profile ?? "");
      setWfaProfiles(config.workato_file_api_profiles ?? []);
      setActiveWfaProfile(config.active_workato_file_api_profile ?? "");
      setProxyUrl(config.proxy_url ?? "");
    }
  }, [config]);

  // ===== Workato プロファイル操作 =====

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
      await saveProfiles(updated, newActive, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, editingIdx, editRow, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

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
        await saveProfiles(updated, newActive, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [profiles, activeProfile, editingIdx, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles],
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
        use_proxy: newRow.use_proxy || undefined,
      },
    ];
    setProfiles(updated);
    setAdding(false);
    setError(null);
    try {
      await saveProfiles(updated, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [profiles, newRow, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

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
      await saveProfiles(profiles, activeProfile, updated, newActiveDify, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyEditingIdx, difyEditRow, activeDifyProfile, profiles, activeProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

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
        await saveProfiles(profiles, activeProfile, updated, newActiveDify, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [difyProfiles, activeDifyProfile, difyEditingIdx, profiles, activeProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles],
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
      use_proxy: difyNewRow.use_proxy || undefined,
    };
    const updated = [...difyProfiles, newProfile];
    const newActiveDify = difyProfiles.length === 0 ? newProfile.name : activeDifyProfile;
    setDifyProfiles(updated);
    setActiveDifyProfile(newActiveDify);
    setDifyAdding(false);
    setError(null);
    try {
      await saveProfiles(profiles, activeProfile, updated, newActiveDify, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [difyProfiles, difyNewRow, activeDifyProfile, profiles, activeProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

  // ===== Gemini プロファイル操作 =====

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
      await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, updated, newActiveGemini, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [geminiProfiles, geminiEditingIdx, geminiEditRow, activeGeminiProfile, profiles, activeProfile, difyProfiles, activeDifyProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

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
        await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, updated, newActiveGemini, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [geminiProfiles, activeGeminiProfile, geminiEditingIdx, profiles, activeProfile, difyProfiles, activeDifyProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles],
  );

  const startGeminiAdding = useCallback(() => {
    setGeminiAdding(true);
    setGeminiNewRow(GEMINI_NEW_ROW_DEFAULT);
    setGeminiEditingIdx(null);
    setError(null);
  }, []);

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
      await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, updated, newActiveGemini, wfaProfiles, activeWfaProfile, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [geminiProfiles, geminiNewRow, activeGeminiProfile, profiles, activeProfile, difyProfiles, activeDifyProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

  // ===== Workato File API プロファイル操作 =====

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
      await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, updated, newActiveWfa, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [wfaProfiles, wfaEditingIdx, wfaEditRow, activeWfaProfile, profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, proxyUrl, saveProfiles]);

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
        await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, updated, newActiveWfa, proxyUrl.trim() || undefined);
      } catch (e) {
        setError(String(e));
      }
    },
    [wfaProfiles, activeWfaProfile, wfaEditingIdx, profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, proxyUrl, saveProfiles],
  );

  const startWfaAdding = useCallback(() => {
    setWfaAdding(true);
    setWfaNewRow(WORKATO_FILE_API_NEW_ROW_DEFAULT);
    setWfaEditingIdx(null);
    setError(null);
  }, []);

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
      await saveProfiles(profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, updated, newActiveWfa, proxyUrl.trim() || undefined);
    } catch (e) {
      setError(String(e));
    }
  }, [wfaProfiles, wfaNewRow, activeWfaProfile, profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, proxyUrl, saveProfiles]);

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
        geminiProfiles,
        activeGeminiProfile,
        wfaProfiles,
        activeWfaProfile,
        proxyUrl.trim() || undefined,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [profiles, activeProfile, difyProfiles, activeDifyProfile, geminiProfiles, activeGeminiProfile, wfaProfiles, activeWfaProfile, proxyUrl, saveProfiles]);

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
    // Gemini
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
    // Workato File API
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
    // 共通
    proxyUrl,
    setProxyUrl,
    saving,
    saved,
    error,
    handleSave,
  } as const;
}
