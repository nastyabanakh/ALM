import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const original = process.cwd();
const sandbox = await mkdtemp(path.join(tmpdir(), 'alm-cms-test-'));
process.chdir(sandbox);
const { CmsError, getEntry, listEntries, listHistory, publishDraft, restoreHistoryToDraft, saveDraft, uploadImage } = await import('../cms/store.mjs');
const { renderDraftPreview } = await import('../cms/preview.mjs');
const { cmsJsonLoader } = await import('../cms/json-loader.mjs');
const { slugify } = await import('../public/cms/slug.mjs');

test('addresses are normalized before publication', () => {
  assert.equal(slugify('test adress'), 'test-adress');
  assert.equal(slugify('Нова стаття'), 'nova-stattya');
  assert.equal(slugify('  Hello   World!  '), 'hello-world');
});

test('drafts, validation, publication and revision conflicts', async () => {
  try {
    const first = await saveDraft('posts', { data: { title: 'Test', slug: 'test-entry' } });
    assert.equal((await listEntries('posts')).length, 1);
    await assert.rejects(
      publishDraft('posts', { id: first.id, expectedDraftRevision: first.draft.revision }),
      error => error instanceof CmsError && error.status === 422
    );
    const valid = {
      title: 'Test', slug: 'test-entry', body: 'Content',
      seo: { title: 'Test', description: 'Description' }
    };
    const second = await saveDraft('posts', {
      id: first.id, data: valid, expectedDraftRevision: first.draft.revision
    });
    const preview = await renderDraftPreview('posts', first.id);
    assert.match(preview, /Чернетка: Test/);
    await assert.rejects(
      saveDraft('posts', { id: first.id, data: valid, expectedDraftRevision: first.draft.revision }),
      error => error instanceof CmsError && error.status === 409
    );
    const result = await publishDraft('posts', { id: first.id, expectedDraftRevision: second.draft.revision });
    assert.equal(result.state, 'saved-locally');
    const saved = JSON.parse(await readFile(path.join(sandbox, 'src/content/posts', `${first.id}.json`), 'utf8'));
    assert.equal(saved.slug, 'test-entry');
    assert.equal((await getEntry('posts', first.id)).draft, null);
    const changed = await saveDraft('posts', { id: first.id, data: { ...saved, title: 'Updated' } });
    await publishDraft('posts', { id: first.id, expectedDraftRevision: changed.draft.revision });
    const history = await listHistory('posts', first.id);
    assert.equal(history.length, 1);
    const restored = await restoreHistoryToDraft('posts', { id: first.id, revision: history[0].revision });
    assert.equal(restored.draft.data.title, 'Test');
  } finally {
    process.chdir(original);
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('media upload checks file signature and uses a generated filename', async () => {
  try {
    await assert.rejects(uploadImage({ base64: Buffer.from('<script>bad</script>').toString('base64') }), error => error.status === 415);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/hWQAAAAASUVORK5CYII=', 'base64');
    const result = await uploadImage({ base64: png.toString('base64') });
    assert.match(result.url, /^\/assets\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.deepEqual(await readFile(path.join(sandbox, 'public', result.url)), png);
  } finally {
    process.chdir(original);
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('Astro loader removes a deleted final entry', async () => {
  const site = await mkdtemp(path.join(tmpdir(), 'alm-loader-test-'));
  try {
    const directory = path.join(site, 'src/content/posts');
    await mkdir(directory, { recursive: true });
    const id = '11111111-1111-4111-8111-111111111111';
    const file = path.join(directory, `${id}.json`);
    await writeFile(file, JSON.stringify({ id, title: 'Test' }));
    const entries = new Map();
    const context = {
      config: { root: pathToFileURL(site + path.sep) },
      store: { clear: () => entries.clear(), set: item => entries.set(item.id, item) },
      parseData: async ({ data }) => data
    };
    const loader = cmsJsonLoader('posts');
    await loader.load(context);
    assert.equal(entries.size, 1);
    await rm(file);
    await loader.load(context);
    assert.equal(entries.size, 0);
  } finally { await rm(site, { recursive: true, force: true }); }
});
