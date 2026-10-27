import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CmsError } from './store.mjs';

const root = process.cwd();
const assetRoot = path.join(root, 'public/assets');
const catalogFile = path.join(root, 'src/data/media-library.json');
const visibleMedia = /\.(png|jpe?g|webp|gif|avif|svg|mp4|webm|mp3|wav|pdf)$/i;
const replaceable = new Set(['png', 'jpg', 'jpeg', 'webp', 'mp4']);
const maxBytes = 96 * 1024 * 1024;
const sourceExtensions = /\.(astro|css|html|js|jsx|json|md|mdx|mjs|ts|tsx)$/i;

async function mediaReferences() {
  const sources = [];
  async function walk(folder, relative = '') {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })) {
      const nextRelative = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || (relative === '' && entry.name === 'assets')) continue;
        await walk(path.join(folder, entry.name), nextRelative);
      } else if (entry.isFile() && sourceExtensions.test(entry.name) && nextRelative !== path.join('data', 'media-library.json')) {
        sources.push(await readFile(path.join(folder, entry.name), 'utf8'));
      }
    }
  }
  await Promise.all([
    walk(path.join(root, 'src')),
    walk(path.join(root, '.cms/drafts')),
    walk(path.join(root, 'public'))
  ]);
  const source = sources.join('\n');
  const dynamic = [];
  for (const match of source.matchAll(/\/assets\/[^\s"'`<>\)]+/g)) {
    const reference = match[0];
    if (!reference.includes('${')) continue;
    const expression = reference.split(/\$\{[^}]+\}/g)
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+');
    dynamic.push(new RegExp(`^${expression}$`));
  }
  return url => source.includes(url) || dynamic.some(pattern => pattern.test(url));
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
        assets.push({ url: nextUrl, folder: url, filename: entry.name,
          name: metadata.name || entry.name.replace(/\.[^.]+$/, ''), alt: metadata.alt || '',
          updatedAt: metadata.updatedAt || info.mtime.toISOString(), size: info.size,
          used: isUsed(nextUrl),
          replaceable: replaceable.has(entry.name.split('.').at(-1).toLowerCase()) });
      }
    }
  }
  await walk(assetRoot, '/assets');
  return { folders: folders.sort(), assets: assets.sort((a, b) => a.url.localeCompare(b.url)) };
}

export async function createMediaFolder({ parent = '/assets/uploads', name }) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9 _-]{1,80}$/.test(name.trim())) throw new CmsError(400, 'Invalid folder name');
  const parentFile = folderLocation(parent);
  const next = folderLocation(`${parent.replace(/\/$/, '')}/${name.trim()}`);
  if (!next.startsWith(parentFile + path.sep)) throw new CmsError(400, 'Invalid folder');
  await assertInsideAssets(parentFile);
  await mkdir(next).catch(error => {
    if (error.code === 'EEXIST') throw new CmsError(409, 'Folder already exists');
    throw error;
  });
  return { folder: `/assets/${path.relative(assetRoot, next).split(path.sep).join('/')}` };
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
  const url = `${folder.replace(/\/$/, '')}/${randomUUID()}.${extension}`;
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
  const data = await catalog();
  const previous = data.assets[url] || {};
  data.assets[url] = {
    name: typeof name === 'string' ? name.trim().slice(0, 120) : previous.name || path.basename(file).replace(/\.[^.]+$/, ''),
    alt: typeof alt === 'string' ? alt.trim().slice(0, 250) : previous.alt || '',
    updatedAt: previous.updatedAt || new Date().toISOString()
  };
  await saveCatalog(data);
  return { url, metadata: data.assets[url] };
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
  const { file } = locationFor(url);
  await assertInsideAssets(file);
  const token = `${randomUUID()}${path.extname(file)}`;
  const backupFolder = path.join(root, '.cms/media-backups');
  await mkdir(backupFolder, { recursive: true });
  await rename(file, backupLocation(token, path.extname(file)));
  const data = await catalog();
  const metadata = data.assets[url] || {};
  delete data.assets[url];
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
  data.assets[url] = { name: String(metadata?.name || '').slice(0, 120), alt: String(metadata?.alt || '').slice(0, 250), updatedAt: new Date().toISOString() };
  await saveCatalog(data);
  return { url, metadata: data.assets[url] };
}

export async function mediaMetadata() { return (await catalog()).assets; }
