import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Dedicated build config for the packaged Android WebView bundle.
//
// The main vite.config.js (used for `npm run build` / Replit deployment) keeps
// the default root-absolute `base: "/"` because the web app is served from a
// real HTTP origin and uses client-side routing (react-router BrowserRouter)
// with deep links like "/piano-roll" — that requires root-absolute asset URLs.
//
// The Android host loads the bundle via `file:///android_asset/webapp/index.html`.
// Under the file:// scheme, a root-absolute path ("/assets/x.js") resolves
// against the filesystem root, not the asset folder — so it 404s and the
// WebView never mounts the app (white screen). This config only changes
// `base` to a relative path and points the output at the Android assets
// folder so the emitted index.html references "./assets/..." instead.
export default defineConfig({
  base: './',
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: 'native-android/app/src/main/assets/webapp',
    emptyOutDir: true,
  },
});
