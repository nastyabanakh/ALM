import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publishMediaLayout } from './media-publish.mjs';
import { CmsError } from './store.mjs';

const root = process.cwd();
const assetRoot = path.join(root, 'public/assets');
const catalogFile = path.join(root, 'src/data/media-library.json');
const visibleMedia = /\.(png|jpe?g|webp|gif|avif|svg|mp4|webm|mp3|wav|pdf)$/i;
const replaceable = new Set(['png', 'jpg', 'jpeg', 'webp', 'mp4']);
const maxBytes = 96 * 1024 * 1024;
const sourceExtensions = /\.(astro|css|html|js|jsx|json|md|mdx|mjs|ts|tsx|svg)$/i;

export async function mediaReferences() {
  const sources = [];
  async function walk(folder, relative = '') {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })) {
      const nextRelative = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        await walk(path.join(folder, entry.name), nextRelative);
      } else if (entry.isFile() && sourceExtensions.test(entry.name) && nextRelative !== path.join('data', 'media-library.json')) {
        sources.push({ file: path.join(folder, entry.name), text: await readFile(path.join(folder, entry.name), 'utf8') });
      }
    }
  }
  await Promise.all([
    walk(path.join(root, 'src')),
    walk(path.join(root, '.cms/drafts')),
    walk(path.join(root, 'public'))
  ]);
  const source = sources.map(item => item.text).join('\n');
  const dynamic = [];
  for (const match of source.matchAll(/\/assets\/[^\s"'`<>\)]+/g)) {
    const reference = match[0];
    if (!reference.includes('${')) continue;
    const expression = reference.split(/\$\{[^}]+\}/g)
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+');
    dynamic.push(new RegExp(`^${expression}$`));
  }
  return url => source.includes(url) || source.includes(encodeURI(url)) || dynamic.some(pattern => pattern.test(url)) || sources.some(({file,text}) => {
    const relative = path.relative(path.dirname(file), path.join(root, 'public', url.slice(1))).split(path.sep).join('/');
    return text.includes(relative.startsWith('.') ? relative : './' + relative) || new RegExp('[\\x22\\x27`(]' + relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[?#\\x22\\x27`)])').test(text);
  });
}

function locationFor(url) {
  if (typeof url !== 'string' || !url.startsWith('/assets/')) throw new CmsError(400, 'Invalid media URL');
  let relative;
  try { relative = decodeURIComponent(url.slice('/assets/'.length)); }
  catch { throw new CmsError(400, 'Invalid media URL'); }
  if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new CmsError(400, 'Invalid media URL');
  }
  const file = path.resolve(assetRoot, relative);
  if (!file.startsWith(assetRoot + path.sep)) throw new CmsError(400, 'Invalid media URL');
  return { relative, file };
}

async function assertInsideAssets(file) {
  const [base, target] = await Promise.all([realpath(assetRoot), realpath(file)]);
  if (target !== base && !target.startsWith(base + path.sep)) throw new CmsError(400, 'Media must be inside public/assets');
}

function folderLocation(folder) {
  if (folder === '/assets' || folder === '/assets/') return assetRoot;
  if (typeof folder !== 'string' || !folder.startsWith('/assets/')) throw new CmsError(400, 'Invalid folder');
  const relative = folder.slice('/assets/'.length).replace(/\/$/, '');
  if (!relative || relative.split('/').some(part => !/^[a-zA-Z0-9 _-]+$/.test(part))) {
    throw new CmsError(400, 'Folder name may contain letters, numbers, spaces, hyphens, and underscores');
  }
  const result = path.resolve(assetRoot, relative);
  if (!result.startsWith(assetRoot + path.sep)) throw new CmsError(400, 'Invalid folder');
  return result;
}

async function catalog() {
  try {
    const parsed = JSON.parse(await readFile(catalogFile, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.assets ? parsed : { version: 1, assets: {} };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, assets: {} };
    throw error;
  }
}

async function saveCatalog(data) {
  await mkdir(path.dirname(catalogFile), { recursive: true });
  const temporary = `${catalogFile}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, catalogFile);
  } finally { await rm(temporary, { force: true }); }
}

function detectedExtension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  throw new CmsError(415, 'Upload PNG, JPEG, WebP, or MP4');
}

function decode(base64) {
  if (typeof base64 !== 'string' || base64.length > maxBytes * 1.4) throw new CmsError(413, 'File is too large');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > maxBytes) throw new CmsError(413, 'File is too large');
  return { bytes, extension: detectedExtension(bytes) };
}

export async function listMedia() {
  const data = await catalog();
  const isUsed = await mediaReferences();
  const folders = ['/assets'];
  const assets = [];
  async function walk(folder, url) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const nextFile = path.join(folder, entry.name);
      const nextUrl = `${url}/${entry.name}`;
      if (entry.isDirectory()) {
        folders.push(nextUrl);
        await walk(nextFile, nextUrl);
      } else if (entry.isFile() && visibleMedia.test(entry.name)) {
        const info = await stat(nextFile);
        const metadata = data.assets[nextUrl] || {};
        assets.push({ url: nextUrl, folder: data.assetFolders?.[nextUrl] || url, filename: entry.name,
          name: entry.name.replace(/\.[^.]+$/, ''), alt: metadata.alt || '',
          updatedAt: metadata.updatedAt || info.mtime.toISOString(), size: info.size, fileModifiedAt: info.mtimeMs,
          used: isUsed(nextUrl),
          replaceable: replaceable.has(entry.name.split('.').at(-1).toLowerCase()) });
      }
    }
  }
  await walk(assetRoot, '/assets');
  return { pendingFolders: Object.entries(data.folderNames || {}).some(([folder, name]) => !data.deletedFolders?.includes(folder) && name !== folder.split('/').at(-1)) || Object.entries(data.assetFolders || {}).some(([url, folder]) => folder !== url.slice(0, url.lastIndexOf('/'))), folderNames: data.folderNames || {}, folders: folders.filter(folder => !(data.deletedFolders || []).includes(folder)).sort(), assets: assets.sort((a, b) => a.url.localeCompare(b.url)) };
}

export async function createMediaFolder({ parent = '/assets/uploads', name }) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9 _-]{1,80}$/.test(name.trim())) throw new CmsError(400, 'Invalid folder name');
  const parentFile = folderLocation(parent);
  const next = folderLocation(`${parent.replace(/\/$/, '')}/${name.trim()}`);
  if (!next.startsWith(parentFile + path.sep)) throw new CmsError(400, 'Invalid folder');
  await assertInsideAssets(parentFile);
  const existingCatalog = await catalog();
  const nextUrl = `/assets/${path.relative(assetRoot, next).split(path.sep).join('/')}`;
  if (await stat(next).catch(() => null) && !existingCatalog.deletedFolders?.includes(nextUrl)) throw new CmsError(409, 'Folder already exists');
  await mkdir(next).catch(error => {
    if (error.code === 'EEXIST') return;
    throw error;
  });
  if (existingCatalog.deletedFolders?.includes(nextUrl)) { existingCatalog.deletedFolders = existingCatalog.deletedFolders.filter(folder => folder !== nextUrl); await saveCatalog(existingCatalog); }
  return { folder: nextUrl };
}

export async function removeEmptyMediaFolder({ folder }) {
  const target = folderLocation(folder);
  await assertInsideAssets(target);
  if (target === assetRoot) throw new CmsError(400, 'Cannot remove assets root');
  await rmdir(target);
  return { folder };
}

export async function uploadMedia({ folder = '/assets/uploads', filename = 'Media', base64 }) {
  const targetFolder = folderLocation(folder);
  const { bytes, extension } = decode(base64);
  await assertInsideAssets(targetFolder);
  const stem = String(filename).replace(/\.[^.]+$/, '').normalize('NFKC').trim().replace(/[^\p{L}\p{N} _-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0,100) || 'media';
  let url = `${folder.replace(/\/$/, '')}/${stem}.${extension}`;
  if (await stat(locationFor(url).file).catch(() => null)) url = `${folder.replace(/\/$/, '')}/${stem}-${randomUUID().slice(0,8)}.${extension}`;
  const { file } = locationFor(url);
  await writeFile(file, bytes, { flag: 'wx' });
  const data = await catalog();
  data.assets[url] = { name: String(filename).replace(/\.[^.]+$/, '').slice(0, 120), alt: '', updatedAt: new Date().toISOString() };
  await saveCatalog(data);
  return { url, metadata: data.assets[url] };
}

export async function updateMedia({ url, name, alt }) {
  const { file } = locationFor(url);
  if (!(await stat(file).catch(() => null))?.isFile()) throw new CmsError(404, 'Media file not found');
  await assertInsideAssets(file);
  const data = await catalog(), original = structuredClone(data);
  const extension = path.extname(file);
  const current = path.basename(file, extension);
  const enteredName = typeof name === 'string' ? name.trim() : current;
  const nextName = enteredName.toLowerCase().endsWith(extension.toLowerCase()) ? enteredName.slice(0, -extension.length) : enteredName;
  if (!nextName || nextName.length > 120 || !/^[\p{L}\p{N} _.-]+$/u.test(nextName) || nextName.startsWith('.')) throw new CmsError(400, 'Enter a valid filename');
  data.assets[url] = { ...data.assets[url], name: nextName, alt: typeof alt === 'string' ? alt.trim().slice(0,250) : data.assets[url]?.alt || '' };
  if (nextName !== current) (data.assetFilenames ||= {})[url] = nextName + extension;
  await saveCatalog(data);
  let filesystem;
  try { filesystem = nextName !== current ? await publishMediaLayout() : null; }
  catch (error) { await saveCatalog(original); throw error; }
  const nextUrl = filesystem?.pathMappings?.[url] || url;
  return { url: nextUrl, metadata: (await catalog()).assets[nextUrl], filesystem };
}

export async function replaceMedia({ url, base64 }) {
  const { file } = locationFor(url);
  const original = await stat(file).catch(() => null);
  if (!original?.isFile()) throw new CmsError(404, 'Media file not found');
  await assertInsideAssets(file);
  const currentExtension = path.extname(file).slice(1).toLowerCase().replace('jpeg', 'jpg');
  if (!replaceable.has(currentExtension)) throw new CmsError(415, 'This format cannot be replaced yet');
  const { bytes, extension } = decode(base64);
  if (extension !== currentExtension) throw new CmsError(415, `Replacement requires a file in ${currentExtension.toUpperCase()}`);
  const backupFolder = path.join(root, '.cms/media-backups');
  await mkdir(backupFolder, { recursive: true });
  const backup = `${randomUUID()}${path.extname(file)}`;
  await copyFile(file, path.join(backupFolder, backup));
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
  const data = await catalog();
  data.assets[url] = { ...data.assets[url], updatedAt: new Date().toISOString() };
  await saveCatalog(data);
  return { url, metadata: data.assets[url], backup };
}

function backupLocation(token, extension) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(token) || path.extname(token) !== extension) {
    throw new CmsError(400, 'Invalid media backup');
  }
  return path.join(root, '.cms/media-backups', token);
}

export async function swapMediaBackup({ url, backup }) {
  const { file } = locationFor(url);
  await assertInsideAssets(file);
  const saved = backupLocation(backup, path.extname(file));
  if (!(await stat(saved).catch(() => null))?.isFile()) throw new CmsError(404, 'Media backup not found');
  const next = `${randomUUID()}${path.extname(file)}`;
  const nextFile = backupLocation(next, path.extname(file));
  await copyFile(file, nextFile);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await copyFile(saved, temporary);
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
  await rm(saved, { force: true });
  const data = await catalog();
  data.assets[url] = { ...data.assets[url], updatedAt: new Date().toISOString() };
  await saveCatalog(data);
  return { url, backup: next, metadata: data.assets[url] };
}

export async function stashMedia({ url }) {
  if ((await mediaReferences())(url)) throw new CmsError(409, 'File is used on the site or in drafts. Replace its references before deleting.');
  const { file } = locationFor(url);
  await assertInsideAssets(file);
  const token = `${randomUUID()}${path.extname(file)}`;
  const backupFolder = path.join(root, '.cms/media-backups');
  await mkdir(backupFolder, { recursive: true });
  await rename(file, backupLocation(token, path.extname(file)));
  const data = await catalog();
  const metadata = { ...(data.assets[url] || {}), libraryFolder: data.assetFolders?.[url] };
  delete data.assets[url];
  if (data.assetFolders) delete data.assetFolders[url];
  await saveCatalog(data);
  return { url, token, metadata };
}

export async function unstashMedia({ url, token, metadata }) {
  const { file } = locationFor(url);
  const saved = backupLocation(token, path.extname(file));
  if (!(await stat(saved).catch(() => null))?.isFile()) throw new CmsError(404, 'Media backup not found');
  if (await stat(file).catch(() => null)) throw new CmsError(409, 'Media URL is already in use');
  await assertInsideAssets(path.dirname(file));
  await rename(saved, file);
  const data = await catalog();
  if (metadata?.libraryFolder) (data.assetFolders ||= {})[url] = metadata.libraryFolder;
  data.assets[url] = { name: String(metadata?.name || '').slice(0, 120), alt: String(metadata?.alt || '').slice(0, 250), updatedAt: new Date().toISOString() };
  await saveCatalog(data);
  return { url, metadata: data.assets[url] };
}

let mediaMutationQueue = Promise.resolve();
export async function withMediaMutation(action) {
  const previous = mediaMutationQueue; let release;
  mediaMutationQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await action(); } finally { release(); }
}

export async function mediaMetadata() { return (await catalog()).assets; }

// Folder names are catalog labels: renaming never invalidates asset URLs.
export async function renameMediaFolder({ folder, name }) {
  const target = folderLocation(folder);
  if (target === assetRoot) throw new CmsError(400, 'Cannot rename assets root');
  await assertInsideAssets(target);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[/\\\x00-\x1f]/.test(name)) throw new CmsError(400, 'Enter a valid folder name');
  const data = await catalog();
  const parent = folder.slice(0, folder.lastIndexOf('/'));
  const siblings = (await listMedia()).folders.filter(item => item !== folder && item.slice(0, item.lastIndexOf('/')) === parent);
  if (siblings.some(item => (data.folderNames?.[item] || item.split('/').at(-1)).toLowerCase() === name.trim().toLowerCase())) throw new CmsError(409, 'Folder name already exists');
  const before = data.folderNames?.[folder] || folder.split('/').at(-1);
  (data.folderNames ||= {})[folder] = name.trim();
  const oldCatalog = await catalog();
  await saveCatalog(data);
  let filesystem;
  try { filesystem = await publishMediaLayout(); } catch (error) { await saveCatalog(oldCatalog); throw error; }
  const next = filesystem.pathMappings?.[folder + '/']?.replace(/\/$/, '') || folder;
  return { folder: next, name: name.trim(), before, filesystem };
}

async function folderMembers(folder) {
  const target = folderLocation(folder);
  if (target === assetRoot) throw new CmsError(400, 'Cannot delete assets root');
  await assertInsideAssets(target);
  const data = await catalog(), members = [];
  const contains = value => value === folder || value.startsWith(folder + '/');
  async function walk(directory, url) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const next = `${url}/${entry.name}`;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), next);
      else if (entry.isFile() && !entry.name.startsWith('.') && contains(data.assetFolders?.[next] || url)) members.push(next);
    }
  }
  // Scan all physical locations because assets may be assigned from another folder.
  await walk(assetRoot, '/assets');
  return { data, members };
}

export async function mediaFolderInfo({ folder }) {
  const { members } = await folderMembers(folder);
  return { folder, files: members.length, images: members.filter(url => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(url)).length };
}

export async function stashMediaFolder({ folder, expectedFiles }) {
  const { members } = await folderMembers(folder);
  if (expectedFiles !== undefined && expectedFiles !== members.length) throw new CmsError(409, 'Folder contents changed. Review and confirm again.');
  const isUsed = await mediaReferences();
  if (members.some(isUsed)) throw new CmsError(409, 'Folder contains files used on the site or in drafts. Replace their references before deleting.');
  const target = folderLocation(folder), data = await catalog();
  const token = randomUUID(), backup = path.join(root, '.cms/media-folder-trash', token);
  const contains = key => key === folder || key.startsWith(folder + '/');
  const manifest = { folder, assets: Object.fromEntries(Object.entries(data.assets).filter(([url]) => contains(url))), folderNames: {} };
  await mkdir(backup, { recursive: true });
  await writeFile(path.join(backup, 'manifest.json'), JSON.stringify(manifest));
  await rename(target, path.join(backup, 'content'));
  try { for (const url of Object.keys(manifest.assets)) delete data.assets[url]; await saveCatalog(data); }
  catch(error) { await rename(path.join(backup, 'content'), target); throw error; }
  return { folder, token, files: members.length };
}

export async function restoreMediaFolder({ token }) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) throw new CmsError(400, 'Invalid folder backup');
  const backup = path.join(root, '.cms/media-folder-trash', token);
  const manifest = JSON.parse(await readFile(path.join(backup, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.folders)) {
    const target = folderLocation(manifest.folder);
    if (target === assetRoot) throw new CmsError(400, 'Invalid folder backup');
    await assertInsideAssets(path.dirname(target));
    if (await stat(target).catch(() => null)) throw new CmsError(409, 'Folder already exists');
    await rename(path.join(backup, 'content'), target);
    const legacyCatalog = await catalog();
    Object.assign(legacyCatalog.assets, manifest.assets || {});
    Object.assign(legacyCatalog.folderNames ||= {}, manifest.folderNames || {});
    await saveCatalog(legacyCatalog);
    return { folder: manifest.folder };
  }
  if (manifest.selectionToken) await restoreMediaSelection({ token: manifest.selectionToken });
  const data = await catalog();
  data.deletedFolders = (data.deletedFolders || []).filter(folder => !manifest.folders.includes(folder));
  await saveCatalog(data);
  return { folder: manifest.folder };
}

function selectedUrls(urls) {
  if (!Array.isArray(urls) || !urls.length || urls.length > 2000 || urls.some(url => typeof url !== 'string')) throw new CmsError(400, 'Select between 1 and 2000 files');
  return [...new Set(urls)];
}

export async function moveMediaSelection({ urls, folder, assignments }) {
  const data = await catalog(), original = structuredClone(data);
  const moves = assignments || selectedUrls(urls).map(url => ({ url, folder }));
  if (!Array.isArray(moves) || !moves.length || moves.length > 2000) throw new CmsError(400, 'Invalid selection');
  const before = [];
  for (const move of moves) {
    const target = folderLocation(move.folder);
    await assertInsideAssets(target);
    if (!(await stat(target)).isDirectory() || data.deletedFolders?.includes(move.folder)) throw new CmsError(400, 'Choose an existing folder');
    const { file } = locationFor(move.url); await assertInsideAssets(file);
    if (!(await stat(file)).isFile()) throw new CmsError(400, 'Select files only');
    before.push({ url: move.url, folder: data.assetFolders?.[move.url] || move.url.slice(0, move.url.lastIndexOf('/')) });
  }
  for (const move of moves) (data.assetFolders ||= {})[move.url] = move.folder;
  await saveCatalog(data);
  let filesystem;
  try { filesystem = await publishMediaLayout(); } catch (error) { await saveCatalog(original); throw error; }
  const mappedUrl = url => filesystem.pathMappings?.[url] || url;
  return { before: before.map(item => ({ ...item, url: mappedUrl(item.url) })), after: moves.map(({ url, folder }) => ({ url: mappedUrl(url), folder })), filesystem };
}

export async function trashMediaSelection({ urls }) {
  const selected = selectedUrls(urls);
  const isUsed = await mediaReferences();
  if (selected.some(isUsed)) throw new CmsError(409, 'Some selected files are used on the site or in drafts. Replace their references before deleting.');
  const data = await catalog();
  const token = randomUUID(), backup = path.join(root, '.cms/media-selection-trash', token);
  const entries = [];
  for (const url of selected) {
    const { file } = locationFor(url); await assertInsideAssets(file);
    if (!(await stat(file)).isFile()) throw new CmsError(400, 'Select files only');
    entries.push({ url, metadata: data.assets[url], folder: data.assetFolders?.[url] });
  }
  await mkdir(backup, { recursive: true });
  await writeFile(path.join(backup, 'manifest.json'), JSON.stringify({ entries }));
  const moved = [];
  try {
    for (const [index, entry] of entries.entries()) {
      await rename(locationFor(entry.url).file, path.join(backup, String(index))); moved.push(index);
      delete data.assets[entry.url]; if (data.assetFolders) delete data.assetFolders[entry.url];
    }
    await saveCatalog(data);
  } catch (error) {
    for (const index of moved.reverse()) await rename(path.join(backup, String(index)), locationFor(entries[index].url).file);
    throw error;
  }
  return { token, count: entries.length };
}

export async function restoreMediaSelection({ token }) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) throw new CmsError(400, 'Invalid media backup');
  const backup = path.join(root, '.cms/media-selection-trash', token);
  const { entries } = JSON.parse(await readFile(path.join(backup, 'manifest.json'), 'utf8'));
  const data = await catalog(), moved = [];
  for (const [index, entry] of entries.entries()) {
    const { file } = locationFor(entry.url); await assertInsideAssets(path.dirname(file));
    if (await stat(file).catch(() => null)) throw new CmsError(409, 'A file already exists at a restored URL');
    if (!(await stat(path.join(backup, String(index)))).isFile()) throw new CmsError(404, 'Backup file missing');
  }
  try {
    for (const [index, entry] of entries.entries()) {
      await rename(path.join(backup, String(index)), locationFor(entry.url).file); moved.push(index);
      if (entry.metadata) data.assets[entry.url] = entry.metadata;
      if (entry.folder) (data.assetFolders ||= {})[entry.url] = entry.folder;
    }
    await saveCatalog(data);
  } catch (error) {
    for (const index of moved.reverse()) await rename(locationFor(entries[index].url).file, path.join(backup, String(index)));
    throw error;
  }
  return { count: entries.length };
}
