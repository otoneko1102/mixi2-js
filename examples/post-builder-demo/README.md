# 🏗️ Post Builder Demo

[mixi2-js](https://github.com/otoneko1102/mixi2-js) の拡張機能 `PostBuilder` と `MediaUploader` を使ったサンプルです。

`PostBuilder` でメソッドチェーンを使ってポストを組み立て、
`MediaUploader` で画像アップロードの完了待機を簡潔に行います。

## 使用する機能

- `PostBuilder` — メソッドチェーンによるポスト構築
- `MediaUploader` — メディアアップロード + 処理完了待機
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

3. 実行

   ```sh
   # テキストのみ
   node index.js "こんにちは！"

   # 画像付き
   node index.js "今日の一枚" ./photo.jpg

   # TypeScript
   npx tsx index.ts "こんにちは！"
   npx tsx index.ts "今日の一枚" ./photo.jpg
   ```

## PostBuilder の使い方

```javascript
import { PostBuilder } from 'mixi2-js/helpers';

// テキストのみ
const request = new PostBuilder('Hello!').build();

// リプライ + センシティブマスク
const reply = new PostBuilder('返信です')
  .reply('post-id')
  .sensitive('注意')
  .build();

// 画像付き
const mediaPost = new PostBuilder('写真です')
  .media(['media-id'])
  .build();
```
