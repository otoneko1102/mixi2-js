import 'dotenv/config';
import consola from 'consola';
import {
  OAuth2Authenticator,
  Client,
  StreamWatcher,
  EventType,
  EventReason,
} from 'mixi2-js';
import { EventRouter, ReasonFilter } from 'mixi2-js/helpers';

const { CLIENT_ID, CLIENT_SECRET, TOKEN_URL, API_ADDRESS, STREAM_ADDRESS, AUTH_KEY } = process.env;

if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_URL || !API_ADDRESS || !STREAM_ADDRESS) {
  consola.error('必要な環境変数が設定されていません。.env.example を参考に .env を作成してください。');
  process.exit(1);
}

const authenticator = new OAuth2Authenticator({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  tokenUrl: TOKEN_URL,
});

const client = new Client({
  apiAddress: API_ADDRESS,
  authenticator,
  authKey: AUTH_KEY,
});

const watcher = new StreamWatcher({
  streamAddress: STREAM_ADDRESS,
  authenticator,
  authKey: AUTH_KEY,
});

// --- EventRouter でイベント種別ごとにハンドラを登録 ---
const router = new EventRouter();

// ポスト作成イベント（メンションのみ処理）
router.on(EventType.POST_CREATED, async (event) => {
  const postEvent = event.postCreatedEvent;
  if (!postEvent?.post) return;

  const post = postEvent.post;
  const name = postEvent.issuer?.displayName ?? '不明';

  if (postEvent.eventReasonList.includes(EventReason.POST_MENTIONED)) {
    consola.info(`📝 ${name} さんからメンション: ${post.text}`);
    await client.createPost({
      text: `こんにちは、${name} さん！`,
      inReplyToPostId: post.postId,
    });
  } else if (postEvent.eventReasonList.includes(EventReason.POST_REPLY)) {
    consola.info(`💬 ${name} さんからリプライ: ${post.text}`);
  }
});

// DM 受信イベント → エコー
router.on(EventType.CHAT_MESSAGE_RECEIVED, async (event) => {
  const messageEvent = event.chatMessageReceivedEvent;
  if (!messageEvent?.message?.text) return;

  const message = messageEvent.message;
  const name = messageEvent.issuer?.displayName ?? '不明';

  consola.info(`✉️ ${name} さんから DM: ${message.text}`);
  await client.sendChatMessage({
    roomId: message.roomId,
    text: message.text,
  });
  consola.success(`${name} さんのメッセージをエコー`);
});

// --- ReasonFilter でメンション・リプライ・DM のみに限定 ---
const filter = new ReasonFilter(router, [
  EventReason.POST_MENTIONED,
  EventReason.POST_REPLY,
  EventReason.DIRECT_MESSAGE_RECEIVED,
]);

consola.info('🔀 Event Router Bot を起動中...');

watcher.watch(filter).then(() => {
  consola.info('ストリーム接続が終了しました。');
}).catch((err) => {
  consola.error('ストリーム接続エラー:', err);
  process.exit(1);
});
