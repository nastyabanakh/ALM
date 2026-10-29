import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { getEntry, listEntries } from './store.mjs';
import { HOME_PAGE_ID } from './model.mjs';
import { collectionPages } from './collection-pages.mjs';

const root = path.join(process.cwd(), 'src/pages');

export async function listSitePages() {
  const pages = [];
  async function walk(folder, parts = []) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(path.join(folder, entry.name), [...parts, entry.name]);
      else if (entry.isFile() && entry.name.endsWith('.astro') && !entry.name.includes('[')) {
        const name = entry.name.slice(0, -6);
        const segments = name === 'index' ? parts : [...parts, name];
        if (segments[0] === 'admin' || segments[0] === 'cms') continue;
        const url = segments.length ? `/${segments.join('/')}/` : '/';
        pages.push({ id: `route:${path.relative(root, path.join(folder, entry.name)).split(path.sep).join('/')}`, path: url, title: url === '/' ? 'Home' : segments.at(-1).replace(/-/g, ' '), kind: 'static' });
      }
    }
  }
  await walk(root);
  for (const [collection, prefix] of [['posts', 'blog'], ['projects', 'portfolio']]) {
    for (const entry of await listEntries(collection)) {
      if (!entry.published) continue;
      const { published } = await getEntry(collection, entry.id);
      if (published?.slug && published.cmsState!=='archived' && published.isPublished!==false) pages.push({ id: `${collection}:${entry.id}`, path: `/${prefix}/${published.slug}/`, title: published.title, kind: collection });
    }
  }
  const home = await getEntry('pages', HOME_PAGE_ID);
  pages.push(...collectionPages(home.published?.content).map(({ item, key, record, ...page }) => page));
  return pages.sort((a, b) => a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path));
}
