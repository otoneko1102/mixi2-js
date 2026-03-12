import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import consola from 'consola';
import {
  OAuth2Authenticator,
  Client,
  MediaUploadType,
} from 'mixi2-js';
import { PostBuilder, MediaUploader } from 'mixi2-js/helpers';

const { CLIENT_ID, CLIENT_SECRET, TOKEN_URL, API_ADDRESS, AUTH_KEY } = process.env;

if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_URL || !API_ADDRESS) {
  consola.error('必要な環境変数が設定されていません。.env.example を参考に .env を作成してください。');
  process.exit(1);
}

const postText = process.argv[2];
const imagePath = process.argv[3];

if (!postText) {
  consola.error('使い方: node index.js "投稿テキスト" [画像ファイルパス]');
  consola.error('例: node index.js "こんにちは！"');
  consola.error('例: node index.js "今日の一枚" ./photo.jpg');
  process.exit(1);
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

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

async function main() {
  // PostBuilder でポストを組み立てる
  const builder = new PostBuilder(postText);

  // 画像が指定されている場合は MediaUploader でアップロード
  if (imagePath) {
    const ext = imagePath.toLowerCase().match(/\.[^.]+$/)?.[0];
    const contentType = ext ? CONTENT_TYPES[ext] : undefined;
    if (!contentType) {
      consola.error(`未対応の画像形式です。対応形式: ${Object.keys(CONTENT_TYPES).join(', ')}`);
      process.exit(1);
    }

    consola.info(`📷 画像をアップロード中: ${basename(imagePath)}`);

    // MediaUploader で開始 → 完了待機
    const uploader = new MediaUploader(client);
    const imageData = await readFile(imagePath);

    const uploaded = await uploader.initiate({
      contentType,
      dataSize: imageData.length,
      mediaType: MediaUploadType.IMAGE,
    });
    consola.success(`  メディア ID: ${uploaded.mediaId}`);

    // upload_url に画像データを送信
    const response = await fetch(uploaded.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(imageData),
    });
    if (!response.ok) {
      consola.error(`アップロード失敗: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    // 処理完了を待機
    consola.info('⏳ メディアの処理を待機中...');
    await uploader.waitForReady(uploaded.mediaId);
    consola.success('  処理完了');

    builder.media([uploaded.mediaId]);
  }

  // ポストを作成
  const request = builder.build();
  consola.info('📝 ポストを作成中...');
  const post = await client.createPost(request);
  consola.success(`✅ 投稿完了! (postId: ${post.postId})`);

  client.close();
}

main().catch((err) => {
  consola.error('エラーが発生しました:', err);
  process.exit(1);
});
