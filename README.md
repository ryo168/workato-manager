## ダウンロード

| 形式 | リンク |
|------|--------|
| EXE（単体） | [workato-manager.exe](https://github.com/ryo168/workato-manager/releases/download/v1.1.0/workato-manager.exe) |
| NSIS インストーラー | [workato-manager_1.1.0_x64-setup.exe](https://github.com/ryo168/workato-manager/releases/download/v1.1.0/workato-manager_1.1.0_x64-setup.exe) |
| MSI インストーラー | [workato-manager_1.1.0_x64_en-US.msi](https://github.com/ryo168/workato-manager/releases/download/v1.1.0/workato-manager_1.1.0_x64_en-US.msi) |

> [全リリース一覧](https://github.com/ryo168/workato-manager/releases)

## 前提条件

- [Node.js](https://nodejs.org/) v20 以上（LTS 推奨）
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri 2 の前提条件](https://v2.tauri.app/start/prerequisites/)

## セットアップ

```bash
npm install
npm run tauri dev
```

## 開発

```bash
npm run tauri dev
```

## ビルド

```bash
npm run tauri build
```

## Lint / Format

```bash
npm run lint          # ESLint チェック
npm run lint:fix      # ESLint 自動修正
npm run format        # Prettier でフォーマット
npm run format:check  # フォーマット差分チェック
```

## 構成

```
src/                          # フロントエンド (React + TypeScript)
├── components/               # 共通コンポーネント
│   ├── json-viewer/          #   折りたたみ可能な JSON ツリービューワー
│   ├── AuthStatusBadge.tsx   #   認証状態バッジ
│   ├── ExternalLinkButton.tsx#   外部リンクボタン
│   ├── Modal.tsx             #   汎用モーダル
│   ├── SortableTableHead.tsx #   ソート対応テーブルヘッダー
│   └── ...
├── pages/                    # 各ページコンポーネント
│   ├── RecipesPage.tsx
│   ├── JobsPage.tsx
│   ├── ConnectionsPage.tsx
│   ├── ProjectsPage.tsx
│   ├── ProjectDetailPage.tsx
│   └── SettingsPage.tsx
├── hooks/                    # カスタムフック
├── context/                  # React Context (状態管理)
├── lib/                      # ユーティリティ (CSV, JSON, ソート, Tauri通信, Tailwind定数)
└── types/                    # TypeScript 型定義

src-tauri/                    # バックエンド (Rust / Tauri)
├── src/
│   ├── workato/              # Workato API モジュール
│   │   ├── client.rs         #   HTTP クライアント
│   │   ├── recipes.rs        #   レシピ管理
│   │   ├── jobs.rs           #   ジョブ管理
│   │   ├── connections.rs    #   コネクション管理
│   │   └── folders.rs        #   フォルダ・プロジェクト管理
│   ├── commands.rs           # Tauri コマンドハンドラ
│   ├── config.rs             # 設定ファイルの読み書き
│   └── lib.rs                # コマンド登録・アプリ初期化
└── icons/                    # アプリアイコン
```
