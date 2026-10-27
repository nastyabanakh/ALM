import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@astrojs/compiler';

const editableAttributes = {
  img: new Set(['src', 'alt']),
  a: new Set(['href']),
  video: new Set(['poster']),
  source: new Set(['src'])
};
const ignoredAncestors = new Set(['script', 'style', 'svg', 'noscript', 'code', 'pre', 'expression']);
const pageRoots = new Set(['section', 'header', 'footer', 'main']);
const hash = value => createHash('sha256').update(value).digest('hex');
const attribute = (node, name) => node.attributes?.find(item => item.name === name && item.kind === 'quoted');
const children = node => node.children || [];
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

function visit(node, action, trail = [], ancestors = []) {
  action(node, trail, ancestors);
  children(node).forEach((child, index) => visit(child, action, [...trail, index], [...ancestors, node.name || node.type]));
}

function sectionFields(section, file, root, instanceKey) {
  const fields = [];
  const filePath = relative(root, file);
  visit(section, (node, trail, ancestors) => {
    if (ancestors.some(name => ignoredAncestors.has(name))) return;
    if (node.type === 'text' && node.value?.trim()) {
      const value = node.value.trim();
      const id = hash(`${instanceKey}:${filePath}:${trail.join('.')}:text`).slice(0, 20);
      fields.push({ id, kind: 'text', value, file: filePath, line: node.position?.start?.line ?? null,
        source: { encoding: 'utf8-bytes', start: node.position?.start?.offset ?? null, end: node.position?.end?.offset ?? null, hash: hash(node.value) } });
    }
    if (node.type === 'element') {
      for (const name of editableAttributes[node.name] || []) {
        const item = attribute(node, name);
        if (!item) continue;
        const id = hash(`${instanceKey}:${filePath}:${trail.join('.')}:${name}`).slice(0, 20);
        fields.push({ id, kind: name, value: item.value, file: filePath, line: item.position?.start?.line ?? null,
          source: { encoding: 'utf8-bytes', start: item.position?.start?.offset ?? null, hash: hash(item.raw) } });
      }
    }
  });
  return fields;
}

/** Discover literal content in Astro components used by a page. No file changes occur. */
export async function discoverPage(pageFile, { root = process.cwd() } = {}) {
  const page = path.resolve(root, pageFile);
  if (!page.startsWith(path.resolve(root) + path.sep)) throw new Error('Page must be inside the site');
  const source = await readFile(page, 'utf8');
  const ast = (await parse(source)).ast;
  const imports = new Map();
  for (const match of source.matchAll(/import\s+([A-Z][\w]*)\s+from\s+['"]([^'"]+\.astro)['"]/g)) {
    const candidate = path.resolve(path.dirname(page), match[2]);
    if (candidate.startsWith(path.resolve(root) + path.sep)) imports.set(match[1], candidate);
  }
  const instances = [];
  visit(ast, (node, trail) => {
    if (node.type === 'component' && imports.has(node.name)) instances.push({ node, trail, file: imports.get(node.name) });
  });
  const sections = [];
  for (const instance of instances) {
    const componentSource = await readFile(instance.file, 'utf8');
    const componentAst = (await parse(componentSource)).ast;
    const roots = [];
    visit(componentAst, (node, trail, ancestors) => {
      if (node.type === 'element' && pageRoots.has(node.name) && !ancestors.some(name => pageRoots.has(name))) {
        roots.push({ node, trail });
      }
    });
    for (const item of roots) {
      const key = attribute(item.node, 'cms:key')?.value || attribute(item.node, 'id')?.value || `${instance.node.name}-${item.trail.join('-')}`;
      const instanceKey = `${relative(root, page)}:${instance.trail.join('.')}:${key}`;
      const fields = sectionFields(item.node, instance.file, root, instanceKey);
      sections.push({
        id: hash(instanceKey).slice(0, 20),
        key, component: instance.node.name, file: relative(root, instance.file),
        label: attribute(item.node, 'aria-label')?.value || key,
        fields
      });
    }
  }
  return { page: relative(root, page), sections };
}
