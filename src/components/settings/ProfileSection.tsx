// プロファイルセクション。SectionHeader + ProfileTable を1つにまとめる。

import React from "react";
import SectionHeader from "./SectionHeader";
import ProfileTable from "./ProfileTable";
import type { ColumnDef, ThemeColor } from "./ProfileTable";
import type { ProfileCrudResult } from "../../hooks/useGenericProfileCrud";
import { CARD } from "../../lib/tw";

export interface ProfileSectionProps<P, E> {
  /** セクションアイコン */
  icon: React.ReactNode;
  /** セクション名 */
  label: string;
  /** セクション説明文 */
  description: string;
  /** カラーテーマ */
  theme: ThemeColor;
  /** ヘッダー背景色 */
  headerColor: string;
  /** 列定義 */
  columns: ColumnDef<P, E>[];
  /** CRUD フックの返り値 */
  crud: ProfileCrudResult<P, E>;
  /** 空状態メッセージ */
  emptyMessage: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ProfileSection<P = any, E extends { use_proxy: boolean; name: string } = any>({
  icon,
  label,
  description,
  theme,
  headerColor,
  columns,
  crud,
  emptyMessage,
}: ProfileSectionProps<P, E>) {
  return (
    <div className={CARD}>
      <SectionHeader
        icon={icon}
        label={label}
        color={headerColor}
        count={crud.profiles.length}
        adding={crud.adding}
        onAdd={crud.startAdding}
        description={description}
      />
      <ProfileTable<P, E>
        theme={theme}
        columns={columns}
        profiles={crud.profiles}
        activeProfile={crud.activeProfile}
        getProfileName={(p) => (p as Record<string, unknown>).name as string}
        onSelectActive={crud.setActiveProfile}
        editingIdx={crud.editingIdx}
        editRow={crud.editRow}
        setEditRow={crud.setEditRow}
        getEditProxy={(r) => r.use_proxy}
        setEditProxy={(v) => crud.setEditRow((r) => ({ ...r, use_proxy: v }))}
        getEditName={(r) => r.name}
        onStartEdit={crud.startEdit}
        onCommitEdit={crud.commitEdit}
        onCancelEdit={crud.cancelEdit}
        adding={crud.adding}
        newRow={crud.newRow}
        setNewRow={crud.setNewRow}
        getAddProxy={(r) => r.use_proxy}
        setAddProxy={(v) => crud.setNewRow((r) => ({ ...r, use_proxy: v }))}
        onCommitAdd={crud.commitAdd}
        onCancelAdd={crud.cancelAdding}
        onDelete={crud.deleteProfile}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
