import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const disableHmr = process.env.DISABLE_HMR === 'true';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    hmr: !disableHmr,
    watch: disableHmr ? null : {},
  },
});
