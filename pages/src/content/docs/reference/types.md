---
title: 型定義
description: mixi2-js で使用される型定義の一覧
---

## モデル型

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

## イベント型

| 型 | 説明 |
|---|---|
| `Event` | イベント（ID・種別・イベントボディの oneof） |
| `PingEvent` | 接続確認イベント（フィールドなし） |
| `PostCreatedEvent` | ポスト作成イベント（理由リスト・ポスト・発行者） |
| `ChatMessageReceivedEvent` | チャットメッセージ受信イベント（理由リスト・メッセージ・発行者） |

## リクエスト / レスポンス型

| 型 | 説明 |
|---|---|
| `CreatePostRequest` | ポスト作成リクエスト |
| `InitiatePostMediaUploadRequest` | メディアアップロード開始リクエスト |
| `InitiatePostMediaUploadResponse` | メディアアップロード開始レスポンス（`mediaId` / `uploadUrl`） |
| `GetPostMediaStatusResponse` | メディア状況レスポンス（`status`） |
| `SendChatMessageRequest` | チャットメッセージ送信リクエスト |
| `GetStampsRequest` | スタンプ一覧取得リクエスト |

各型の詳細なフィールドについては [API クライアント](/guides/api-client/) ガイドを参照してください。

> 公式の型定義は [mixi2-api](https://github.com/mixigroup/mixi2-api)（Protocol Buffers）を参照してください。
