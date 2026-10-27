import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverPage } from '../cms/source-manifest.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

test('discovers new Astro sections and literal fields without a site-specific field list', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alm-manifest-'));
  const page = 'src/pages/index.astro';
  const component = 'src/sections/DemoSection.astro';
  try {
    await mkdir(path.join(root, 'src/pages'), { recursive: true });
    await mkdir(path.join(root, 'src/sections'), { recursive: true });
    await writeFile(path.join(root, page), `---\nimport DemoSection from '../sections/DemoSection.astro';\n---\n<DemoSection />\n`);
    const section = value => `---\nconst dynamic = 'computed';\n---\n<section id="demo" aria-label="Demo section"><h2>${value}</h2><img src="/assets/demo.webp" alt="Demo image"/><p>{dynamic}</p></section>`;
    await writeFile(path.join(root, component), section('Привіт'));
    const first = await discoverPage(page, { root });
    assert.equal(first.sections.length, 1);
    const fields = first.sections[0].fields;
    assert.deepEqual(fields.map(field => field.kind), ['text', 'src', 'alt']);
    const title = fields[0];
    assert.equal(title.value, 'Привіт');
    const bytes = await readFile(path.join(root, component));
    assert.equal(digest(bytes.subarray(title.source.start, title.source.end).toString()), title.source.hash);
    await writeFile(path.join(root, component), section('Новий заголовок'));
    const second = await discoverPage(page, { root });
    assert.equal(second.sections[0].fields[0].id, title.id);
    assert.equal(second.sections[0].fields[0].value, 'Новий заголовок');
    await writeFile(path.join(root, page), `---\nimport DemoSection from '../sections/DemoSection.astro';\n---\n<DemoSection /><DemoSection />\n`);
    const repeated = await discoverPage(page, { root });
    assert.equal(repeated.sections.length, 2);
    assert.notEqual(repeated.sections[0].fields[0].id, repeated.sections[1].fields[0].id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
