/**
 * @file 汎用プロファイル CRUD フック
 * Workato / Dify / Gemini / Workato File API で共通する
 * プロファイルの追加・編集・削除・アクティブ切替ロジックを提供する。
 */

import { useState, useCallback, useEffect } from "react";
import type { AppConfig } from "../types/workato";
import { ERROR } from "../constants/settings";

// ---------- 型定義 ----------

/**
 * プロファイル CRUD の設定。
 * @typeParam P - 永続化されるプロファイル型（Profile, DifyProfile 等）
 * @typeParam E - UI 上の編集行型（EditRow, DifyEditRow 等）。
 *               P と E を分離することで、UI 固有のフィールド（パスワードマスク等）を
 *               永続化データに影響させずに扱える。
 */
export interface ProfileCrudConfig<P, E> {
  /** AppConfig からプロファイル配列を取り出す */
  getProfiles: (config: AppConfig) => P[];
  /** AppConfig からアクティブプロファイル名を取り出す */
  getActive: (config: AppConfig) => string;
  /** Profile → EditRow 変換（編集開始時に呼ばれる） */
  toEditRow: (profile: P) => E;
  /**
   * EditRow → Profile 変換。
   * base が渡される場合は既存プロファイルの編集（既存値とマージ）、
   * base が undefined の場合は新規追加。
   */
  toProfile: (editRow: E, base?: P) => P;
  /** EditRow からプロファイル名を取得 */
  getName: (editRow: E) => string;
  /** Profile からプロファイル名を取得 */
  getProfileName: (profile: P) => string;
  /** 新規追加時のデフォルト値 */
  defaultRow: E;
  /** サービス名（重複エラー表示用） */
  serviceName: string;
  /** 最低1つ必須か（Workato は true、他は false） */
  requireAtLeastOne?: boolean;
}

export interface ProfileCrudResult<P, E> {
  profiles: P[];
  activeProfile: string;
  setActiveProfile: (name: string) => void;
  editingIdx: number | null;
  editRow: E;
  setEditRow: React.Dispatch<React.SetStateAction<E>>;
  adding: boolean;
  newRow: E;
  setNewRow: React.Dispatch<React.SetStateAction<E>>;
  startEdit: (idx: number) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
  deleteProfile: (idx: number) => Promise<void>;
  startAdding: () => void;
  cancelAdding: () => void;
  commitAdd: () => Promise<void>;
}

// ---------- フック本体 ----------

/**
 * 汎用プロファイル CRUD フック。
 * @param config - 現在の AppConfig（Tauri バックエンドから取得）
 * @param onSave - プロファイル配列とアクティブ名を永続化するコールバック
 * @param setError - エラーメッセージ表示用セッター
 * @param crudConfig - プロファイル型固有の設定
 */
export function useGenericProfileCrud<P, E>(
  config: AppConfig | null,
  onSave: (profiles: P[], active: string) => Promise<void>,
  setError: (e: string | null) => void,
  crudConfig: ProfileCrudConfig<P, E>,
): ProfileCrudResult<P, E> {
  const {
    getProfiles,
    getActive,
    toEditRow,
    toProfile,
    getName,
    getProfileName,
    defaultRow,
    serviceName,
    requireAtLeastOne = false,
  } = crudConfig;

  const [profiles, setProfiles] = useState<P[]>([]);
  const [activeProfile, setActiveProfile] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<E>(defaultRow);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<E>(defaultRow);

  // config 同期（Tauri バックエンドからの値反映）
  useEffect(() => {
    if (config) {
      setProfiles(getProfiles(config)); // eslint-disable-line react-hooks/set-state-in-effect
      setActiveProfile(getActive(config));
    }
  }, [config, getProfiles, getActive]);

  const startEdit = useCallback(
    (idx: number) => {
      setEditingIdx(idx);
      setEditRow(toEditRow(profiles[idx]));
      setAdding(false);
    },
    [profiles, toEditRow],
  );

  const cancelEdit = useCallback(() => {
    setEditingIdx(null);
  }, []);

  const commitEdit = useCallback(async () => {
    const name = getName(editRow).trim();
    if (!name) {
      setError(ERROR.PROFILE_NAME_REQUIRED);
      return;
    }
    const updated = profiles.map((p, i) =>
      i === editingIdx ? toProfile(editRow, p) : p,
    );
    const newActive =
      activeProfile === getProfileName(profiles[editingIdx!])
        ? name
        : activeProfile;
    setProfiles(updated);
    setActiveProfile(newActive);
    setEditingIdx(null);
    setError(null);
    try {
      await onSave(updated, newActive);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [profiles, editingIdx, editRow, activeProfile, onSave, setError, getName, getProfileName, toProfile]);

  const deleteProfile = useCallback(
    async (idx: number) => {
      if (requireAtLeastOne && profiles.length === 1) {
        setError(ERROR.PROFILE_LAST_CANNOT_DELETE);
        return;
      }
      const removed = profiles[idx];
      const updated = profiles.filter((_, i) => i !== idx);
      const newActive = activeProfile === getProfileName(removed)
        ? (updated.length > 0 ? getProfileName(updated[0]) : "")
        : activeProfile;
      setProfiles(updated);
      setActiveProfile(newActive);
      if (editingIdx === idx) setEditingIdx(null);
      try {
        await onSave(updated, newActive);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [profiles, activeProfile, editingIdx, onSave, setError, getProfileName, requireAtLeastOne],
  );

  const startAdding = useCallback(() => {
    setAdding(true);
    setNewRow(defaultRow);
    setEditingIdx(null);
    setError(null);
  }, [setError, defaultRow]);

  const cancelAdding = useCallback(() => setAdding(false), []);

  const commitAdd = useCallback(async () => {
    const name = getName(newRow).trim();
    if (!name) {
      setError(ERROR.PROFILE_NAME_REQUIRED);
      return;
    }
    if (profiles.some((p) => getProfileName(p) === name)) {
      setError(ERROR.PROFILE_NAME_DUPLICATE(serviceName));
      return;
    }
    const newProfile = toProfile(newRow);
    const updated = [...profiles, newProfile];
    const newActive = profiles.length === 0 ? name : activeProfile;
    setProfiles(updated);
    setAdding(false);
    setError(null);
    if (profiles.length === 0) setActiveProfile(name);
    try {
      await onSave(updated, newActive);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [profiles, newRow, activeProfile, onSave, setError, getName, getProfileName, toProfile, serviceName]);

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
