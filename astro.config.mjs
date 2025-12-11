import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import netlify from '@astrojs/netlify';

export default defineConfig({
      integrations: [react({
    include: ['**/*.jsx', '**/*.tsx']
  })],
  output: 'server',
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom']
    }
  },
  // adapter: netlify(),
});