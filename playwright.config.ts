import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  workers: 1,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 4173 --strictPort',
    // strictPort rejects occupied ports; Vite prints its URL only after listening.
    wait: { stdout: /http:\/\/127\.0\.0\.1:4173\// },
    stdout: 'pipe',
    env: {
      // Keep the provider's default storage key used by synthetic test sessions.
      VITE_APP_ENV: '',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'example',
    },
  },
});
