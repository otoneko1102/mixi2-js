// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://mixi2.js.org",
  base: "/",

  integrations: [
    starlight({
      title: "mixi2-js Docs",
      customCss: ["./src/styles/custom.css"],
      head: [
        {
          tag: "script",
          content:
            "document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('a[href^=\"http\"]').forEach(a=>{if(!a.hostname||a.hostname!==location.hostname){a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer')}})})",
        },
        {
          tag: "meta",
          attrs: { property: "og:title", content: "mixi2-js" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:description",
            content: "mixi2 Application API の非公式 TypeScript/JavaScript SDK",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:type", content: "website" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:url",
            content: "https://mixi2.js.org/",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://mixi2.js.org/img/banner.png",
          },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:title", content: "mixi2-js" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:description",
            content: "mixi2 Application API の非公式 TypeScript/JavaScript SDK",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://mixi2.js.org/img/banner.png",
          },
        },
      ],
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      defaultLocale: "root",
      locales: {
        root: { label: "日本語", lang: "ja" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/otoneko1102/mixi2-js" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/mixi2-js" },
        { icon: "jsr", label: "JSR", href: "https://jsr.io/@otoneko1102/mixi2-js" },
      ],
      sidebar: [
        {
          label: "ガイド",
          items: [
            { label: "はじめに", slug: "guides/getting-started" },
            { label: "API クライアント", slug: "guides/api-client" },
            { label: "Webhook サーバー", slug: "guides/webhook" },
            { label: "gRPC ストリーミング", slug: "guides/streaming" },
          ],
        },
        {
          label: "API リファレンス",
          items: [
            { label: "型定義", slug: "reference/types" },
            { label: "Enum 定義", slug: "reference/enums" },
            { label: "環境変数", slug: "reference/environment" },
            { label: "レート制限", slug: "reference/rate-limits" },
          ],
        },
        {
          label: "拡張機能 (Helpers)",
          items: [
            { label: "Address", slug: "helpers/address" },
            { label: "EventRouter", slug: "helpers/event-router" },
            { label: "EventDeduplicator", slug: "helpers/event-deduplicator" },
            { label: "EventLogger", slug: "helpers/event-logger" },
            { label: "PostBuilder", slug: "helpers/post-builder" },
            { label: "MediaUploader", slug: "helpers/media-uploader" },
            { label: "ReasonFilter", slug: "helpers/reason-filter" },
            { label: "TextSplitter", slug: "helpers/text-splitter" },
          ],
        },
      ],
    }),
  ],
});
