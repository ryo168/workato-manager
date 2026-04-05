## ダウンロード

| 形式                | リンク                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| EXE（単体）         | [workato-manager.exe](https://github.com/ryo168/workato-manager/releases/download/v3.0.0/workato-manager.exe)                                 |
| NSIS インストーラー | [workato-manager_3.0.0_x64-setup.exe](https://github.com/ryo168/workato-manager/releases/download/v3.0.0/workato-manager_3.0.0_x64-setup.exe) |
| MSI インストーラー  | [workato-manager_3.0.0_x64_en-US.msi](https://github.com/ryo168/workato-manager/releases/download/v3.0.0/workato-manager_3.0.0_x64_en-US.msi) |

## 使い方

| ドキュメント | リンク |
| ------------ | ------ |
| Dify で仕様書を生成する | [Difyで仕様書を生成する.md](documents/Difyで仕様書を生成する.md) |
| Gemini で仕様書を生成する | [Geminiで仕様書を生成する.md](documents/Geminiで仕様書を生成する.md) |

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
