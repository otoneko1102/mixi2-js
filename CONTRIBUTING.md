# コントリビューションガイド

mixi2-js へのコントリビュートに興味を持っていただきありがとうございます！

## 方針

このプロジェクトは [mixi2 公式 API 仕様](https://developer.mixi.social/docs)、[mixi2-api](https://github.com/mixigroup/mixi2-api)（Protocol Buffers 定義）、および [mixi2-application-sdk-go](https://github.com/mixigroup/mixi2-application-sdk-go)（公式 Go SDK）に基づいて開発されています。

**公式仕様に基づいた修正やバグ報告を歓迎します。**

### 歓迎するコントリビュート

- 公式 API の仕様変更に追従する修正
- 公式 proto 定義の更新への対応
- バグ修正（公式 SDK の動作と異なる箇所の修正）
- ドキュメントの改善・誤記修正
- テストの追加・改善
- パフォーマンス改善

### 受け付けないコントリビュート

- 公式 API 仕様に存在しない独自機能の追加
- 公式 SDK の設計方針に反する変更
- 破壊的変更（事前の Issue での議論が必要）

## 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/otoneko1102/mixi2-js.git
cd mixi2-js

# 依存関係をインストール
npm install
```

### 必要な環境

- Node.js 18 以上
- npm

### 主なコマンド

| コマンド | 説明 |
|---|---|
| `npm run check` | 型チェック + Lint + フォーマットチェックを一括実行 |
| `npm run check:all` | 上記 + テスト + ビルドをすべて実行 |
| `npm run check:types` | 型チェック (`tsc --noEmit`) |
| `npm run check:lint` | Lint (`eslint`) |
| `npm run check:format` | フォーマットチェック (`prettier --check`) |
| `npm test` | テスト実行 |
| `npm run build` | ビルド (ESM + CJS + `.d.ts`) |
| `npm run format` | コードフォーマット適用 |
| `npm run lint:fix` | Lint エラーの自動修正 |

## プルリクエストの手順

1. **Issue を確認する** — 既存の Issue に関連する場合はリンクしてください。大きな変更の場合は先に Issue で議論してください。
2. **ブランチを作成する** — `main` から新しいブランチを作成してください。
3. **変更を実装する** — 公式仕様に準拠していることを確認してください。
4. **チェックを実行する** — `npm run check:all` ですべてのチェックが通ることを確認してください。
5. **プルリクエストを作成する** — 変更内容と関連する公式ドキュメント / proto 定義への参照を含めてください。

## コーディング規約

- **言語**: TypeScript（strict モード）
- **型チェック**: `npm run check:types`
- **Lint**: `npm run check:lint`
- **フォーマットチェック**: `npm run check:format`
- **フォーマッタ**: Prettier（`npm run format` で整形）
- **テスト**: Jest
- **ビルド**: tsup（ESM + CJS + `.d.ts` を出力）
- **一括チェック**: `npm run check:all`（型 + Lint + フォーマット + テスト + ビルド）

### 公式仕様との対応

変更を行う際は、以下のリソースを参照して仕様との整合性を確認してください:

| リソース | 用途 |
|---|---|
| [mixi2-api](https://github.com/mixigroup/mixi2-api) | proto 定義（型・サービス・enum 定義の正確な値） |
| [mixi2-application-sdk-go](https://github.com/mixigroup/mixi2-application-sdk-go) | 公式 SDK のアーキテクチャ・動作仕様 |
| [公式ドキュメント](https://developer.mixi.social/docs) | API リファレンス・イベント仕様・レート制限等 |

## バグ報告

[Issues](https://github.com/otoneko1102/mixi2-js/issues) からバグ報告をお願いします。

以下の情報を含めてください:

- **再現手順**
- **期待される動作** と **実際の動作**
- **Node.js / npm のバージョン**
- **mixi2-js のバージョン**
- 可能であれば **公式 Go SDK との動作比較**

## 行動規範

このプロジェクトは [Contributor Covenant 行動規範](CODE_OF_CONDUCT.md) に準拠しています。プロジェクトに参加することで、この行動規範の遵守に同意したものとみなされます。
