import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Site vitrine Novalyz — statique, sans JavaScript par défaut.
// Français à la racine, anglais prévu sous /en/ (pas encore traduit).
export default defineConfig({
  site: 'https://www.novalyz.com',
  trailingSlash: 'ignore',
  i18n: { defaultLocale: 'fr', locales: ['fr', 'en'], routing: { prefixDefaultLocale: false } },
  integrations: [sitemap()],
  build: { format: 'directory' },
});
