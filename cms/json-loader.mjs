import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A small Astro loader that also clears deleted entries when a collection becomes empty. */
export function cmsJsonLoader(folder) {
  let registered = false;
  return {
    name: `cms-json-${folder}`,
    async load({ config, store, parseData, watcher }) {
      const directory = path.join(fileURLToPath(config.root), 'src/content', folder);
      const reload = async () => {
        const names = await readdir(directory).catch(error => {
          if (error.code === 'ENOENT') return [];
          throw error;
        });
        store.clear();
        for (const name of names.filter(name => /^[0-9a-f-]{36}\.json$/.test(name))) {
          const file = path.join(directory, name);
          const data = JSON.parse(await readFile(file, 'utf8'));
          const id = name.slice(0, -5);
          if (data.id !== id) throw new Error(`CMS ID не збігається з іменем файлу: ${name}`);
          const parsed = await parseData({ id, data, filePath: file });
          store.set({ id, data: parsed, filePath: `src/content/${folder}/${name}` });
        }
      };
      await reload();
      if (watcher && !registered) {
        registered = true;
        watcher.add(directory);
        watcher.on('all', (event, changed) => {
          if (['add', 'change', 'unlink'].includes(event) && path.dirname(changed) === directory && changed.endsWith('.json')) {
            reload().catch(error => console.error('CMS content reload failed:', error));
          }
        });
      }
    }
  };
}
