// @ts-check
import { defineConfig } from 'astro/config';
import { cmsDevApi } from './cms/dev-api.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [cmsDevApi()],
  server: {
    port: 3001,
    host: '127.0.0.1'
  },
  vite: {
    server: {
      port: 3001,
      strictPort: true
    }
  }
});
