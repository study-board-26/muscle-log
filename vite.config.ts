import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * GitHub Pages のプロジェクトページで配信するため、base はリポジトリ名。
 * https://<username>.github.io/muscle-log/
 */
const BASE = "/muscle-log/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // 種目マスタと3Dアセットを含め、オフラインで動作させる（NFR-1）
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,svg,png,woff2,glb}"],
        // 3Dアセットを見越して上限を引き上げる
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
      },
      manifest: {
        name: "筋トレ記録",
        short_name: "筋トレ",
        description: "記録から次に扱う重量が決まるトレーニングアプリ",
        lang: "ja",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        background_color: "#11161a",
        theme_color: "#11161a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // 開発中もPWAの挙動を確認できるようにする
      devOptions: { enabled: true, type: "module" },
    }),
  ],
});
