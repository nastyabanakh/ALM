import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, lstat, readlink, rename, rm, rmdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CmsError } from './store.mjs';

const root = process.cwd(), assets = path.join(root, 'public/assets');
const catalogFile = path.join(root, 'src/data/media-library.json');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function atomicText(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, text, { flag: 'wx' }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}
let publishing = false;

/** Apply a filesystem transaction and rewrite project references before reporting success. */
export async function publishMediaLayout() {
  if (publishing) throw new CmsError(409, 'Media publication is already running');
  publishing = true;
  try { return await publish(); } finally { publishing = false; }
}
async function publish() {
  const originalCatalog = await readFile(catalogFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return '{"version":1,"assets":{}}'; throw error; });
  const catalog = JSON.parse(originalCatalog);
  const folderMap = new Map();
  const folderTarget = folder => {
    if (folderMap.has(folder)) return folderMap.get(folder);
    const parts = folder.split('/').slice(2);
    const target = '/assets/' + parts.map((part, index) => {
      const label = catalog.folderNames?.['/assets/' + parts.slice(0, index + 1).join('/')] || part;
      if (!/^[a-zA-Z0-9 _-]{1,80}$/.test(label)) throw new CmsError(422, `Folder “${label}” needs a name containing letters, numbers, spaces, hyphens or underscores before publishing.`);
      return label;
    }).join('/');
    const normalized = folder === '/assets' ? '/assets' : target;
    folderMap.set(folder, normalized); return normalized;
  };
  const moves = [], existingAliases = [], destinations = new Set();
  const toFile = url => path.join(root, 'public', url.slice(1));
  async function walk(directory, url) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const next = `${url}/${entry.name}`;
      if (entry.isDirectory()) { folderTarget(next); await walk(path.join(directory, entry.name), next); }
      else if (entry.isFile()) {
        const folder = folderTarget(catalog.assetFolders?.[next] || url);
        const target = `${folder}/${catalog.assetFilenames?.[next] || entry.name}`;
        if (destinations.has(target)) throw new CmsError(409, `Two files would use ${target}. Rename or separate them before publishing.`);
        destinations.add(target);
        if (target !== next) {
          const existing = await lstat(toFile(target)).catch(() => null);
          if (existing) {
            if (!existing.isSymbolicLink() || await realpath(toFile(target)) !== await realpath(toFile(next))) throw new CmsError(409, `A file already exists at ${target}`);
            existingAliases.push({ url: target, link: await readlink(toFile(target)) });
          }
          moves.push({ from: next, to: target });
        }
      }
    }
  }
  await walk(assets, '/assets');
  // Different library folders cannot collapse to the same physical directory.
  const folderOwners = new Map();
  for (const [from, to] of folderMap) {
    if (catalog.deletedFolders?.includes(from)) continue;
    if (folderOwners.has(to) && folderOwners.get(to) !== from) throw new CmsError(409, `Two folders would use ${to}`);
    folderOwners.set(to, from);
  }
  const changedFolders = [...folderMap].filter(([from, to]) => from !== to && !catalog.deletedFolders?.includes(from));
  if (!moves.length && !changedFolders.length) return { files: 0, folders: 0 };
  const mappings = new Map([...changedFolders.map(([from, to]) => [from + '/', to + '/']), ...moves.map(move => [move.from, move.to])]);
  const remapFile = file => {
    const url = '/' + path.relative(path.join(root, 'public'), file).split(path.sep).join('/');
    return moves.find(move => move.from === url) ? toFile(moves.find(move => move.from === url).to) : file;
  };
  const edits = [];
  async function sources(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (file === catalogFile) continue;
      if (entry.isDirectory()) await sources(file);
      else if (/\.(astro|css|html|js|jsx|json|md|mdx|mjs|ts|tsx|svg)$/i.test(entry.name)) {
        const before = await readFile(file, 'utf8');
        // Refuse ambiguous computed URLs rather than silently breaking a generator.
        for (const match of before.matchAll(/`([^`]*\$\{[^`]+)`/g)) {
          const template = match[1];
          if (file.startsWith(path.join(root, 'cms') + path.sep) || file.startsWith(path.join(root, 'api') + path.sep) || file.startsWith(path.join(root, 'public/admin') + path.sep)) continue;
          if (!template.includes('/assets/') && !/^(\.\.?\/)/.test(template)) continue;
          const dynamicPattern = new RegExp('^' + template.split(/\$\{[^}]+\}/g).map(escape).join('.*') + '$');
          for (const move of moves) {
            if ((dynamicPattern.test(move.from) || dynamicPattern.test(path.relative(path.dirname(file), toFile(move.from)).split(path.sep).join('/'))) && !changedFolders.some(([from, to]) => move.from.startsWith(from + '/') && move.to === to + move.from.slice(from.length))) throw new CmsError(409, `Computed asset URL in ${path.relative(root, file)} must be connected to an explicit CMS path before moving this file.`);
          }
        }
        if (!file.startsWith(path.join(root, 'cms') + path.sep) && !file.startsWith(path.join(root, 'api') + path.sep)) {
          for (const match of before.matchAll(/(['"])(\/assets\/[^'"]*\/)\1\s*\+/g)) {
            for (const move of moves) if (move.from.startsWith(match[2]) && !changedFolders.some(([from, to]) => move.from.startsWith(from + '/') && move.to === to + move.from.slice(from.length))) throw new CmsError(409, `Computed asset path in ${path.relative(root, file)} requires an explicit binding before this operation.`);
          }
        }
        const localMappings = new Map(mappings);
        for (const move of moves) {
          localMappings.set('public' + move.from, 'public' + move.to);
          localMappings.set(encodeURI(move.from), encodeURI(move.to));
          const from = path.relative(path.dirname(file), toFile(move.from)).split(path.sep).join('/');
          const to = path.relative(path.dirname(remapFile(file)), toFile(move.to)).split(path.sep).join('/');
          localMappings.set(from.startsWith('.') ? from : './' + from, to.startsWith('.') ? to : './' + to);
        }
        const localPattern = new RegExp([...localMappings.keys()].sort((a,b) => b.length-a.length).map(escape).join('|'), 'g');
        const after = before.replace(localPattern, (match, offset, text) => {
          const next = text[offset + match.length];
          return !match.endsWith('/') && next && /[\p{L}\p{N}_.-]/u.test(next) ? match : localMappings.get(match);
        });
        if (after !== before || file.startsWith(path.join(root, '.cms/drafts') + path.sep)) edits.push({ file, target: remapFile(file), before, after });
      }
    }
  }
  await sources(path.join(root, 'src'));
  await sources(path.join(root, 'public'));
  await sources(path.join(root, 'cms'));
  await sources(path.join(root, 'api'));
  await sources(path.join(root, '.cms/drafts'));
  for (const edit of edits.filter(edit => edit.file.startsWith(path.join(root, '.cms/drafts') + path.sep))) {
    const draft = JSON.parse(edit.after);
    draft.revision = randomUUID();
    const publishedFile = path.join(root, 'src/content', path.relative(path.join(root, '.cms/drafts'), edit.file));
    const publishedEdit = edits.find(edit => edit.file === publishedFile);
    if (publishedEdit && draft.basePublishedRevision === hash(JSON.parse(publishedEdit.before))) draft.basePublishedRevision = hash(JSON.parse(publishedEdit.after));
    edit.after = JSON.stringify(draft, null, 2) + '\n';
  }
  const renamed = Object.fromEntries(moves.map(move => [move.from, move.to]));
  catalog.assets = Object.fromEntries(Object.entries(catalog.assets || {}).map(([url, metadata]) => [renamed[url] || url, metadata]));
  catalog.assets = Object.fromEntries(Object.entries(catalog.assets).map(([url, metadata]) => [url, { ...metadata, name: path.basename(url, path.extname(url)) }]));
  catalog.assetFilenames = {};
  catalog.assetFolders = {};
  catalog.folderNames = {};
  catalog.deletedFolders = [...new Set([...(catalog.deletedFolders || []), ...changedFolders.map(([from]) => from)])].filter(folder => !folderOwners.has(folder));
  edits.push({ file: catalogFile, before: originalCatalog, after: JSON.stringify(catalog, null, 2) + '\n' });
  const backup = path.join(root, '.cms/media-publications', randomUUID());
  await mkdir(backup, { recursive: true });
  await writeFile(path.join(backup, 'journal.json'), JSON.stringify({ moves, sources: edits.map((edit, index) => ({ file: path.relative(root, edit.file), backup: String(index) })) }, null, 2));
  for (const [index, edit] of edits.entries()) await writeFile(path.join(backup, String(index)), edit.before);
  const completed = [], links = [], written = [], directories = [], removedAliases = [];
  try {
    for (const edit of edits) {
      const current = await readFile(edit.file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (current !== edit.before) throw new CmsError(409, 'Project files changed during the operation. Retry with the current files.');
    }
    for (const target of new Set([...changedFolders.map(([, to]) => to), ...moves.map(move => path.posix.dirname(move.to))])) {
      const directory = toFile(target);
      if (!await lstat(directory).catch(() => null)) { await mkdir(directory, { recursive: true }); directories.push(directory); }
      const actual = await realpath(directory), base = await realpath(assets);
      if (actual !== base && !actual.startsWith(base + path.sep)) throw new CmsError(400, 'Media destination must be inside assets');
    }
    for (const alias of existingAliases) { await rm(toFile(alias.url)); removedAliases.push(alias); }
    for (const move of moves) { await rename(toFile(move.from), toFile(move.to)); completed.push(move); }
    for (const edit of edits) { written.push(edit); await atomicText(edit.target || edit.file, edit.after); }
    await writeFile(path.join(backup, 'complete.json'), JSON.stringify({ at: new Date().toISOString() }));
  } catch (error) {
    for (const url of links.reverse()) await rm(toFile(url), { force: true });
    for (const edit of written.reverse()) await atomicText(edit.target || edit.file, edit.before);
    for (const move of completed.reverse()) await rename(toFile(move.to), toFile(move.from));
    for (const alias of removedAliases) await symlink(alias.link, toFile(alias.url));
    for (const directory of directories.reverse()) await rmdir(directory).catch(() => {});
    throw error;
  }
  for (const [from] of [...changedFolders].sort((a,b) => b[0].length-a[0].length)) await rmdir(toFile(from)).catch(() => {});
  return { files: moves.length, folders: changedFolders.length, pathMappings: Object.fromEntries(mappings) };
}
