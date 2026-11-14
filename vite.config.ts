import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { uiFonts } from './scripts/ui-fonts.mjs';

export default defineConfig({
  plugins: [uiFonts(), react()],
  server: {
    port: 3000,
    host: true,
  },
});
