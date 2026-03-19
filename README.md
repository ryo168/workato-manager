## ダウンロード

| 形式                | リンク                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| EXE（単体）         | [workato-manager.exe](https://github.com/ryo168/workato-manager/releases/download/v1.2.0/workato-manager.exe)                                 |
| NSIS インストーラー | [workato-manager_1.2.0_x64-setup.exe](https://github.com/ryo168/workato-manager/releases/download/v1.2.0/workato-manager_1.2.0_x64-setup.exe) |
| MSI インストーラー  | [workato-manager_1.2.0_x64_en-US.msi](https://github.com/ryo168/workato-manager/releases/download/v1.2.0/workato-manager_1.2.0_x64_en-US.msi) |

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
