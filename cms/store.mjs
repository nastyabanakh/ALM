import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectionSchemas, validateEntry } from './model.mjs';

const root = process.cwd();
const publishedRoot = path.join(root, 'src/content');
const draftRoot = path.join(root, '.cms/drafts');
const historyRoot = path.join(root, '.cms/history');
const entryLocks = new Map();

async function serializeEntry(key, action) {
  const previous = entryLocks.get(key) || Promise.resolve();
  let release;
  const turn = new Promise(resolve => { release = resolve; });
  const tail = previous.then(() => turn);
  entryLocks.set(key, tail);
  await previous;
  try { return await action(); }
  finally {
    release();
    if (entryLocks.get(key) === tail) entryLocks.delete(key);
  }
}

export class CmsError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function ensureCollection(collection) {
  if (!Object.hasOwn(collectionSchemas, collection)) throw new CmsError(404, 'Unknown collection');
}

function ensureId(id) {
  if (!/^[0-9a-f-]{36}$/.test(id || '')) throw new CmsError(400, 'Invalid ID');
}

function paths(collection, id) {
  ensureCollection(collection);
  ensureId(id);
  return {
    published: path.join(publishedRoot, collection, `${id}.json`),
    draft: path.join(draftRoot, collection, `${id}.json`),
    history: path.join(historyRoot, collection, id)
  };
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function atomicJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

function revision(value) {
  return value ? createHash('sha256').update(JSON.stringify(value)).digest('hex') : null;
}

export async function listEntries(collection) {
  ensureCollection(collection);
  const result = new Map();
  for (const [folder, label] of [[path.join(publishedRoot, collection), 'published'], [path.join(draftRoot, collection), 'draft']]) {
    let names;
    try { names = await readdir(folder); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of names.filter(name => /^[0-9a-f-]{36}\.json$/.test(name))) {
      const data = await readJson(path.join(folder, name));
      if (!data) continue;
      const id = name.slice(0, -5);
      const item = result.get(id) || { id, title: '', slug: '', published: false, draft: false };
      const entry = label === 'draft' ? data.data : data;
      item.title = entry.title || item.title;
      item.slug = entry.slug || item.slug;
      item[label] = true;
      result.set(id, item);
    }
  }
  return [...result.values()].sort((a, b) => a.title.localeCompare(b.title, 'uk'));
}

export async function getEntry(collection, id) {
  const files = paths(collection, id);
  const [published, draft] = await Promise.all([readJson(files.published), readJson(files.draft)]);
  if (!published && !draft) throw new CmsError(404, 'Entry not found');
  return { id, published, publishedRevision: revision(published), draft };
}

export async function listHistory(collection, id) {
  const files = paths(collection, id);
  let names;
  try { names = await readdir(files.history); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return names.filter(name => /^\d+-[0-9a-f]{64}\.json$/.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map(name => ({ revision: name.slice(name.indexOf('-') + 1, -5), at: new Date(Number(name.split('-')[0])).toISOString() }));
}

export async function restoreHistoryToDraft(collection, { id, revision: targetRevision, expectedDraftRevision = null }) {
  if (!/^[0-9a-f]{64}$/.test(targetRevision || '')) throw new CmsError(400, 'Invalid revision');
  const files = paths(collection, id);
  const history = await listHistory(collection, id);
  const item = history.find(item => item.revision === targetRevision);
  if (!item) throw new CmsError(404, 'Version not found');
  const names = await readdir(files.history);
  const name = names.find(name => name.endsWith(`-${targetRevision}.json`));
  const data = await readJson(path.join(files.history, name));
  return saveDraft(collection, { id, data, expectedDraftRevision });
}

export async function saveDraft(collection, params) {
  const id = params.id || randomUUID();
  return serializeEntry(`${collection}/${id}`, () => saveDraftUnlocked(collection, { ...params, id }));
}

async function saveDraftUnlocked(collection, { id, data, expectedDraftRevision = null }) {
  const files = paths(collection, id);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new CmsError(400, 'Invalid draft data');
  const encoded = JSON.stringify(data);
  if (encoded.length > 1024 * 1024) throw new CmsError(413, 'Draft is too large');
  const current = await readJson(files.draft);
  if (current && current.revision !== expectedDraftRevision) throw new CmsError(409, 'Draft was changed elsewhere');
  if (!current && expectedDraftRevision) throw new CmsError(409, 'Draft was deleted');
  const published = await readJson(files.published);
  const next = {
    revision: randomUUID(),
    basePublishedRevision: current ? current.basePublishedRevision : revision(published),
    updatedAt: new Date().toISOString(),
    data: { ...data, id }
  };
  await atomicJson(files.draft, next);
  return { id, draft: next };
}

export async function publishDraft(collection, params) {
  return serializeEntry(`publish/${collection}`, () =>
    serializeEntry(`${collection}/${params.id}`, () => publishDraftUnlocked(collection, params))
  );
}

export async function uploadImage({ base64 }) {
  if (typeof base64 !== 'string' || base64.length > 7 * 1024 * 1024) {
    throw new CmsError(413, 'Image is too large');
  }
  const data = Buffer.from(base64, 'base64');
  if (!data.length || data.length > 5 * 1024 * 1024) throw new CmsError(413, 'Image is too large');
  const { validateMediaBytes } = await import('./media-validation.mjs');
  const ext = await validateMediaBytes(data);
  if (ext === 'mp4') throw new CmsError(415, 'Use PNG, JPEG, or WebP');
  const filename = `${randomUUID()}.${ext}`;
  const folder = path.join(root, 'public/assets/uploads');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, filename), data, { flag: 'wx' });
  return { url: `/assets/uploads/${filename}` };
}

async function publishDraftUnlocked(collection, { id, expectedDraftRevision }) {
  const files = paths(collection, id);
  const draft = await readJson(files.draft);
  if (!draft) throw new CmsError(404, 'Draft not found');
  if (draft.revision !== expectedDraftRevision) throw new CmsError(409, 'Draft was changed elsewhere');
  const current = await readJson(files.published);
  if (revision(current) !== draft.basePublishedRevision) throw new CmsError(409, 'Published entry changed since this draft was created');
  const checked = validateEntry(collection, draft.data);
  if (!checked.success) throw new CmsError(422, 'Fix fields before publishing', checked.issues);
  const others = await listEntries(collection);
  if (others.some(item => item.id !== id && item.published && item.slug === checked.data.slug)) {
    throw new CmsError(409, 'This URL is already in use');
  }
  if (current) await atomicJson(path.join(files.history, `${Date.now()}-${revision(current)}.json`), current);
  await atomicJson(files.published, checked.data);
  await rm(files.draft, { force: true });
  return { id, publishedRevision: revision(checked.data), state: 'saved-locally' };
}


export async function discardDraft(collection, { id, expectedDraftRevision }) {
  return serializeEntry(`${collection}/${id}`, async () => {
    const file = paths(collection,id).draft;
    const draft = await readJson(file);
    if (!draft || draft.revision !== expectedDraftRevision) throw new CmsError(409,'Draft changed elsewhere');
    await rm(file,{force:true}); return {id};
  });
}
