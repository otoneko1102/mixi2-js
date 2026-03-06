# mixi2-js

[![npm version](https://img.shields.io/npm/v/mixi2-js?color=cb3837&logo=npm)](https://www.npmjs.com/package/mixi2-js)
[![npm downloads](https://img.shields.io/npm/dm/mixi2-js?color=cb3837&logo=npm)](https://www.npmjs.com/package/mixi2-js)
[![License](https://img.shields.io/github/license/otoneko1102/mixi2-js?color=blue)](LICENSE)
[![Node.js](https://img.shields.io/node/v/mixi2-js?color=339933&logo=nodedotjs&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Build](https://img.shields.io/github/actions/workflow/status/otoneko1102/mixi2-js/publish.yml?label=build&logo=github)](https://github.com/otoneko1102/mixi2-js/actions)

mixi2 の [Application API](https://developer.mixi.social/docs) を利用するための **非公式** TypeScript/JavaScript SDK です。

[公式 Go SDK](https://github.com/mixigroup/mixi2-application-sdk-go) および [公式 API 仕様](https://github.com/mixigroup/mixi2-api) に基づいて作成されています。

> **Note:** これは MIXI 社公式のプロダクトではありません。コミュニティメンバーによるオープンソースプロジェクトです。

---

## 目次

- [インストール](#インストール)
- [機能概要](#機能概要)
- [クイックスタート](#クイックスタート)
  - [認証](#認証)
  - [API クライアント](#api-クライアント)
  - [Webhook サーバー](#webhook-サーバー)
  - [gRPC ストリーミング](#grpc-ストリーミング)
- [API リファレンス](#api-リファレンス)
  - [OAuth2Authenticator](#oauth2authenticator)
  - [Client](#client)
  - [WebhookServer](#webhookserver)
  - [StreamWatcher](#streamwatcher)
  - [EventHandler](#eventhandler)
  - [RPC メソッド一覧](#rpc-メソッド一覧)
  - [型定義](#型定義)
  - [Enum 定義](#enum-定義)
- [環境変数](#環境変数)
- [イベント](#イベント)
- [レート制限](#レート制限)
- [セキュリティ](#セキュリティ)
- [関連リンク](#関連リンク)
- [コントリビュート](#コントリビュート)
- [ライセンス](#ライセンス)

---

## インストール

```bash
npm install mixi2-js
```

ESM・CommonJS の両方に対応しています。TypeScript の型定義 (`.d.ts`) も同梱されています。

---

## 機能概要

| モジュール | 説明 |
|---|---|
| `OAuth2Authenticator` | OAuth2 Client Credentials 認証（アクセストークンの取得・キャッシュ・有効期限 1 分前に自動更新） |
| `Client` | gRPC API クライアント（8 つの RPC メソッドに対応） |
| `WebhookServer` | HTTP Webhook サーバー（Ed25519 署名検証・Ping 自動応答） |
| `StreamWatcher` | gRPC ストリーミング（指数バックオフによる自動再接続） |

---

## クイックスタート

### 前提条件

- **Node.js 18 以上**
- [mixi2 Developer Platform](https://developer.mixi.social) で開発者登録が完了していること
- アプリケーションを作成し、認証情報（Client ID / Client Secret / Token URL 等）を取得済みであること

### 認証

```typescript
import { OAuth2Authenticator } from 'mixi2-js';

const authenticator = new OAuth2Authenticator({
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: process.env.TOKEN_URL!,
});

// アクセストークンを取得（キャッシュ済みの場合は即座に返却）
const token = await authenticator.getAccessToken();
```

### API クライアント

```typescript
import { OAuth2Authenticator, Client, MediaUploadType, LanguageCode } from 'mixi2-js';

const authenticator = new OAuth2Authenticator({
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: process.env.TOKEN_URL!,
});

const client = new Client({
  apiAddress: process.env.API_ADDRESS!,
  authenticator,
});

// ユーザー情報取得
const users = await client.getUsers(['user-id-1', 'user-id-2']);

// ポスト作成
const post = await client.createPost({ text: 'Hello mixi2!' });

// ポスト情報取得
const posts = await client.getPosts(['post-id-1']);

// チャットメッセージ送信（ユーザーからの DM 受信後のみ）
const message = await client.sendChatMessage({
  roomId: 'room-id',
  text: 'Hello!',
});

// メディアアップロード → ポスト添付の流れ
const upload = await client.initiatePostMediaUpload({
  contentType: 'image/png',
  dataSize: 1024,
  mediaType: MediaUploadType.IMAGE,
});
// upload.uploadUrl に PUT でメディアデータを送信
const status = await client.getPostMediaStatus(upload.mediaId);
// status.status === MediaUploadStatus.COMPLETED になったら添付可能
await client.createPost({ text: '画像付き！', mediaIdList: [upload.mediaId] });

// スタンプ一覧取得
const stamps = await client.getStamps({ officialStampLanguage: LanguageCode.JP });

// ポストにスタンプを付与
await client.addStampToPost('post-id', 'stamp-id');

// クライアントを閉じる
client.close();
```

### Webhook サーバー

```typescript
import { WebhookServer, EventType } from 'mixi2-js';
import type { EventHandler, Event } from 'mixi2-js';

const handler: EventHandler = {
  handle: async (event: Event) => {
    switch (event.eventType) {
      case EventType.POST_CREATED:
        console.log('Post created:', event.postCreatedEvent?.post?.text);
        break;
      case EventType.CHAT_MESSAGE_RECEIVED:
        console.log('Chat message:', event.chatMessageReceivedEvent?.message?.text);
        break;
    }
  },
};

// 公開鍵は Base64 からデコード
const publicKey = Buffer.from(process.env.SIGNATURE_PUBLIC_KEY!, 'base64');

const server = new WebhookServer({
  port: 8080,
  publicKey,
  handler,
});

await server.start();
console.log('Webhook server started on :8080');

// エンドポイント:
// POST /events  - イベント受信
// GET  /healthz - ヘルスチェック
```

サーバーレス環境（Vercel、AWS Lambda など）では `syncHandling: true` を設定してください:

```typescript
const server = new WebhookServer({
  port: 8080,
  publicKey,
  handler,
  syncHandling: true, // レスポンス後にプロセスが終了する環境向け
});

export default server.httpServer;
```

### gRPC ストリーミング

ローカル開発やプロトタイピングに推奨される方式です。外部公開 URL が不要です。

```typescript
import { OAuth2Authenticator, StreamWatcher, EventType } from 'mixi2-js';
import type { EventHandler, Event } from 'mixi2-js';

const authenticator = new OAuth2Authenticator({
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: process.env.TOKEN_URL!,
});

const handler: EventHandler = {
  handle: async (event: Event) => {
    console.log('Received event:', event.eventId, EventType[event.eventType]);
  },
};

const watcher = new StreamWatcher({
  streamAddress: process.env.STREAM_ADDRESS!,
  authenticator,
});

// イベント監視開始（接続エラー時は自動再接続: 1s → 2s → 4s, 最大 3 回）
await watcher.watch(handler);

// 停止
watcher.stop();
```

---

## API リファレンス

### OAuth2Authenticator

OAuth2 Client Credentials フローによる認証を管理します。

```typescript
new OAuth2Authenticator(options: AuthenticatorOptions)
```

| プロパティ | 型 | 説明 |
|---|---|---|
| `clientId` | `string` | OAuth2 クライアント ID |
| `clientSecret` | `string` | OAuth2 クライアントシークレット |
| `tokenUrl` | `string` | トークンエンドポイント URL |

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `getAccessToken()` | `Promise<string>` | アクセストークンを取得。有効期限の 1 分前までキャッシュし、自動更新する |

`Authenticator` インターフェースを実装しているため、カスタム認証を独自に実装することも可能です。

---

### Client

8 つの RPC メソッドを提供する gRPC API クライアントです。

```typescript
new Client(options: ClientOptions)
```

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| `apiAddress` | `string` | ○ | API サーバーアドレス |
| `authenticator` | `Authenticator` | ○ | 認証インスタンス |

#### RPC メソッド一覧

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getUsers(userIdList)` | `string[]` | `Promise<User[]>` | ユーザー情報を一括取得 |
| `getPosts(postIdList)` | `string[]` | `Promise<Post[]>` | ポスト情報を一括取得 |
| `createPost(request)` | `CreatePostRequest` | `Promise<Post>` | ポストを作成（返信/引用/メディア添付対応） |
| `initiatePostMediaUpload(request)` | `InitiatePostMediaUploadRequest` | `Promise<InitiatePostMediaUploadResponse>` | メディアアップロードを開始 |
| `getPostMediaStatus(mediaId)` | `string` | `Promise<GetPostMediaStatusResponse>` | メディアの処理状況を取得 |
| `sendChatMessage(request)` | `SendChatMessageRequest` | `Promise<ChatMessage>` | チャットメッセージを送信 |
| `getStamps(request?)` | `GetStampsRequest?` | `Promise<OfficialStampSet[]>` | スタンプ一覧を取得 |
| `addStampToPost(postId, stampId)` | `string, string` | `Promise<Post>` | ポストにスタンプを付与 |
| `close()` | - | `void` | gRPC 接続を閉じる |

#### CreatePostRequest

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `text` | `string` | ○ | ポスト本文（最大 149 文字） |
| `inReplyToPostId` | `string` | - | 返信先ポスト ID |
| `quotedPostId` | `string` | - | 引用対象ポスト ID |
| `mediaIdList` | `string[]` | - | 添付メディア ID（最大 4 件） |
| `postMask` | `PostMask` | - | マスク設定（センシティブ/ネタバレ） |
| `publishingType` | `PostPublishingType` | - | 配信設定 |

> `inReplyToPostId` と `quotedPostId` は同時に指定できません。

#### InitiatePostMediaUploadRequest

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contentType` | `string` | ○ | Content-Type（例: `image/jpeg`） |
| `dataSize` | `number` | ○ | データサイズ（バイト） |
| `mediaType` | `MediaUploadType` | ○ | メディア種別（`IMAGE` / `VIDEO`） |
| `description` | `string` | - | メディアの説明 |

#### SendChatMessageRequest

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `roomId` | `string` | ○ | 送信先ルーム ID |
| `text` | `string` | △ | テキスト（`text` または `mediaId` のいずれか必須） |
| `mediaId` | `string` | △ | 添付メディア ID |

---

### WebhookServer

Ed25519 署名検証付きの HTTP Webhook サーバーです。

```typescript
new WebhookServer(options: WebhookServerOptions)
```

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `publicKey` | `Buffer` | ○ | - | Ed25519 公開鍵（Base64 をデコードしたもの） |
| `handler` | `EventHandler` | ○ | - | イベントハンドラ |
| `port` | `number` | - | `8080` | リッスンポート |
| `syncHandling` | `boolean` | - | `false` | イベントを同期処理するか |

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `start()` | `Promise<void>` | サーバーを起動 |
| `shutdown()` | `Promise<void>` | サーバーを停止 |
| `address` | `string` | リッスンアドレス |
| `httpServer` | `http.Server` | 内部の HTTP サーバーインスタンス |
| `eventHandlerFunc` | `Function` | イベントハンドラ関数（フレームワーク統合用） |

#### エンドポイント

| パス | メソッド | 説明 |
|---|---|---|
| `/events` | POST | イベント受信（署名検証 → protobuf デコード → ハンドラ呼出） |
| `/healthz` | GET | ヘルスチェック（常に `200 OK`） |

#### 署名検証の仕様

| 項目 | 値 |
|---|---|
| 署名ヘッダ | `x-mixi2-application-event-signature`（Base64） |
| タイムスタンプヘッダ | `x-mixi2-application-event-timestamp`（Unix 秒） |
| 署名対象 | リクエストボディ + タイムスタンプ |
| 許容時刻ズレ | ±300 秒（5 分） |
| 署名失敗レスポンス | HTTP 401 |
| 成功レスポンス | HTTP 204 |

---

### StreamWatcher

gRPC ストリーミングによるリアルタイムイベント受信を行います。

```typescript
new StreamWatcher(options: StreamWatcherOptions)
```

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| `streamAddress` | `string` | ○ | Stream サーバーアドレス |
| `authenticator` | `Authenticator` | ○ | 認証インスタンス |

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `watch(handler)` | `Promise<void>` | イベント監視を開始 |
| `stop()` | `void` | 監視を停止し接続を閉じる |

#### 再接続の仕様

| 項目 | 値 |
|---|---|
| 再接続方式 | 指数バックオフ（1 秒 → 2 秒 → 4 秒） |
| 最大リトライ回数 | 3 回 |
| Ping イベント | SDK 内部で処理（`handle` には渡されない） |

> 再接続中に発生したイベントは失われます。厳密な到達保証が必要な場合は Webhook 方式を使用してください。

---

### EventHandler

Webhook・gRPC ストリーム共通のイベントハンドラインターフェースです。

```typescript
interface EventHandler {
  handle(event: Event): void | Promise<void>;
}
```

- `handle` 内で発生したエラーはログ出力され、処理は継続します
- Ping イベントは SDK 内部で処理されるため `handle` には渡されません
- Webhook 方式では `handle` の結果にかかわらず常に HTTP 204 が返されます

---

### 型定義

#### モデル型

| 型 | 説明 |
|---|---|
| `User` | ユーザー情報（ID・表示名・プロフィール・アバター等） |
| `UserAvatar` | ユーザーアバター画像情報（大小 2 サイズ） |
| `Post` | ポスト情報（本文・作成日時・メディア・マスク・スタンプ等） |
| `PostMedia` | ポスト添付メディア（画像 / 動画） |
| `PostMediaImage` | ポスト添付画像の詳細 |
| `PostMediaVideo` | ポスト添付動画の詳細 |
| `PostMask` | ポストマスク（センシティブ / ネタバレ） |
| `PostStamp` | ポストに付与されたスタンプ（スタンプ情報 + 回数） |
| `Media` | メッセージ添付メディア |
| `MediaImage` | メッセージ添付画像の詳細 |
| `MediaVideo` | メッセージ添付動画の詳細 |
| `MediaStamp` | スタンプ画像情報 |
| `ChatMessage` | チャットメッセージ（ルーム ID・本文・メディア等） |
| `OfficialStampSet` | 公式スタンプセット（名前・スプライト URL・有効期間等） |
| `OfficialStamp` | 個別の公式スタンプ |

#### イベント型

| 型 | 説明 |
|---|---|
| `Event` | イベント（ID・種別・イベントボディの oneof） |
| `PingEvent` | 接続確認イベント（フィールドなし） |
| `PostCreatedEvent` | ポスト作成イベント（理由リスト・ポスト・発行者） |
| `ChatMessageReceivedEvent` | チャットメッセージ受信イベント（理由リスト・メッセージ・発行者） |

#### リクエスト/レスポンス型

| 型 | 説明 |
|---|---|
| `CreatePostRequest` | ポスト作成リクエスト |
| `InitiatePostMediaUploadRequest` | メディアアップロード開始リクエスト |
| `InitiatePostMediaUploadResponse` | メディアアップロード開始レスポンス（`mediaId` / `uploadUrl`） |
| `GetPostMediaStatusResponse` | メディア状況レスポンス（`status`） |
| `SendChatMessageRequest` | チャットメッセージ送信リクエスト |
| `GetStampsRequest` | スタンプ一覧取得リクエスト |

---

### Enum 定義

#### EventType

| 名前 | 値 | 説明 |
|---|---|---|
| `UNSPECIFIED` | 0 | 未指定 |
| `PING` | 1 | 接続確認 |
| `POST_CREATED` | 2 | ポスト作成 |
| `CHAT_MESSAGE_RECEIVED` | 4 | メッセージ受信 |

#### EventReason

| 名前 | 値 | 説明 |
|---|---|---|
| `UNSPECIFIED` | 0 | 未指定 |
| `PING` | 1 | 接続確認 |
| `POST_REPLY` | 2 | ポストに返信された |
| `POST_MENTIONED` | 3 | ポストでメンションされた |
| `POST_QUOTED` | 4 | ポストが引用された |
| `DIRECT_MESSAGE_RECEIVED` | 8 | DM を受信した |

#### PostVisibility / PostAccessLevel

| Enum | 値 | 説明 |
|---|---|---|
| `PostVisibility.VISIBLE` | 1 | 閲覧可能 |
| `PostVisibility.INVISIBLE` | 2 | 閲覧不可 |
| `PostAccessLevel.PUBLIC` | 1 | 公開 |
| `PostAccessLevel.PRIVATE` | 2 | 非公開 |

#### PostMaskType

| 名前 | 値 | 説明 |
|---|---|---|
| `SENSITIVE` | 1 | 刺激的なコンテンツ |
| `SPOILER` | 2 | ネタバレ防止 |

#### PostPublishingType

| 名前 | 値 | 説明 |
|---|---|---|
| `UNSPECIFIED` | 0 | フォロワーのタイムラインに公開（デフォルト） |
| `NOT_PUBLISHING` | 1 | プロフィールにのみ公開 |

#### MediaUploadType / MediaUploadStatus

| Enum | 値 | 説明 |
|---|---|---|
| `MediaUploadType.IMAGE` | 1 | 画像 |
| `MediaUploadType.VIDEO` | 2 | 動画 |
| `MediaUploadStatus.UPLOAD_PENDING` | 1 | アップロード待機中 |
| `MediaUploadStatus.PROCESSING` | 2 | 処理中 |
| `MediaUploadStatus.COMPLETED` | 3 | 完了 |
| `MediaUploadStatus.FAILED` | 4 | 失敗 |

#### UserVisibility / UserAccessLevel

| Enum | 値 | 説明 |
|---|---|---|
| `UserVisibility.VISIBLE` | 1 | 閲覧可能 |
| `UserVisibility.INVISIBLE` | 2 | 閲覧不可 |
| `UserAccessLevel.PUBLIC` | 1 | 公開 |
| `UserAccessLevel.PRIVATE` | 2 | 非公開 |

#### その他

| Enum | 値 | 説明 |
|---|---|---|
| `LanguageCode.JP` | 1 | 日本語 |
| `LanguageCode.EN` | 2 | 英語 |
| `MediaType.IMAGE` | 1 | 画像 |
| `MediaType.VIDEO` | 2 | 動画 |
| `PostMediaType.IMAGE` | 1 | 画像 |
| `PostMediaType.VIDEO` | 2 | 動画 |
| `StampSetType.DEFAULT` | 1 | デフォルト |
| `StampSetType.SEASONAL` | 2 | 季節限定 |

---

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `CLIENT_ID` | ○ | OAuth2 クライアント ID |
| `CLIENT_SECRET` | ○ | OAuth2 クライアントシークレット |
| `TOKEN_URL` | ○ | トークンエンドポイント URL |
| `API_ADDRESS` | △ | API サーバーアドレス（API クライアント使用時） |
| `STREAM_ADDRESS` | △ | Stream サーバーアドレス（gRPC ストリーミング使用時） |
| `SIGNATURE_PUBLIC_KEY` | △ | イベント署名検証用の公開鍵（Base64）（Webhook 使用時） |
| `PORT` | - | Webhook サーバーポート（デフォルト: `8080`） |

---

## イベント

アプリケーションが受信できるイベントの一覧です。

| イベント種別 | イベントタイプ | 説明 |
|---|---|---|
| ポスト作成 | `EVENT_TYPE_POST_CREATED` | ユーザーがメンション・リプライ・引用を行った場合 |
| メッセージ受信 | `EVENT_TYPE_CHAT_MESSAGE_RECEIVED` | ユーザーが DM を送信した場合 |
| Ping | `EVENT_TYPE_PING` | 接続確認（SDK 内部で処理、ハンドラには渡されない） |

### イベント配信の特性

- **順序保証なし** — イベントは発生順と異なる順序で届く可能性があります
- **Best-effort 配信** — gRPC ストリーム接続中断時のイベントは失われます
- **Webhook リトライ** — 配信失敗時に最大 3 回（30 秒間隔）リトライされます。冪等な処理を推奨します

---

## レート制限

API ごとのレート制限（アプリケーション単位で適用）:

| RPC | 制限 | ウィンドウ |
|---|---|---|
| `CreatePost` | 10 回 | 1 分 |
| `SendChatMessage` | 10 回 | 1 分 |
| `InitiatePostMediaUpload` | 10 回 / 100 回 | 1 分 / 1 時間 |
| `AddStampToPost` | 10 回 | 1 分 |
| `GetUsers` | 10 回 | 1 分 |
| `GetPosts` | 10 回 | 1 分 |

`GetStamps`・`GetPostMediaStatus`・`SubscribeEvents` にはレート制限はありません。

制限超過時は gRPC ステータス `RESOURCE_EXHAUSTED` が返されます。`retry-after` ヘッダに従って待機してください。

---

## セキュリティ

- **認証情報の管理** — `CLIENT_SECRET` は環境変数またはシークレット管理システムから読み込んでください。ソースコードへのハードコードは禁止です。
- **署名検証** — Webhook リクエストは Ed25519 署名で検証されます。
- **リプレイ攻撃防止** — タイムスタンプ検証により ±5 分を超えるリクエストを拒否します。
- **TLS** — gRPC 接続はすべて TLS で暗号化されます。

---

## 関連リンク

- [mixi2 Developer Platform 公式ドキュメント](https://developer.mixi.social/docs)
- [mixi2-api](https://github.com/mixigroup/mixi2-api) — API 定義（Protocol Buffers）
- [mixi2-application-sdk-go](https://github.com/mixigroup/mixi2-application-sdk-go) — 公式 Go SDK
- [mixi2-application-sample-go](https://github.com/mixigroup/mixi2-application-sample-go) — サンプルアプリケーション

---

## コントリビュート

コントリビュートを歓迎しています！詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

このプロジェクトは [Contributor Covenant 行動規範](CODE_OF_CONDUCT.md) に準拠しています。

<a href="https://github.com/otoneko1102/mixi2-js/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=otoneko1102/mixi2-js" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

---

## ライセンス

[Apache-2.0](LICENSE)
