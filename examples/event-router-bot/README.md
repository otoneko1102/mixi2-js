# 🔀 Event Router Bot

[mixi2-js](https://github.com/otoneko1102/mixi2-js) の拡張機能 `EventRouter` と `ReasonFilter` を使ったサンプルです。

`switch` 文の代わりに `EventRouter` でイベント種別ごとにハンドラを登録し、
`ReasonFilter` で処理対象を特定の理由のみに絞り込みます。

## 使用する機能

- `EventRouter` — イベントタイプ別のルーティング
- `ReasonFilter` — EventReason ベースのフィルタリング
- `StreamWatcher` — gRPC ストリーミング
- `Client.sendChatMessage()` — チャットメッセージ送信
- `Client.createPost()` — ポスト作成

## セットアップ

1. `.env.example` を `.env` にコピーして認証情報を設定

   ```sh
   cp .env.example .env
   ```

2. 依存パッケージをインストール

   ```sh
   npm install
   ```

3. Bot を起動

   ```sh
   # JavaScript
   npm start

   # TypeScript
   npx tsx index.ts
   ```

## 動作

- **メンション** → 挨拶をリプライ
- **リプライ** → ログに記録
- **DM** → オウム返し
