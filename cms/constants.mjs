import { resolveContentLinks } from './links.mjs';
// A reference is the whole field value. This keeps ownership clear in the editor.
const referencePattern = /^\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}$/;

export function parseConstReference(value) {
  if (typeof value !== 'string') return null;
  const match = referencePattern.exec(value.trim());
  return match ? { key: match[1], format: match[2] || null } : null;
}

export function constToken(key, format = null) {
  return `{{const.${key}${format ? `|${format}` : ''}}}`;
}

export function resolveConstReference(value, consts = {}) {
  const reference = parseConstReference(value);
  if (!reference) return value;
  const entry = consts?.[reference.key];
  if (!entry || typeof entry.value !== 'string') return value;
  const text = entry.value;
  if (reference.format === 'tel') return `tel:${text.replace(/[^+\d]/g, '')}`;
  if (reference.format === 'mailto') return `mailto:${text.trim()}`;
  return text;
}

export function resolveContentConstants(content, pages = [], sourcePage = '/') {
  const consts = content?.consts || {};
  const walk = value => {
    if (typeof value === 'string') return resolveConstReference(value, consts);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'consts' ? item : walk(item)]));
    return value;
  };
  return resolveContentLinks(walk(content), pages, sourcePage);
}

export function invalidConstReferences(content) {
  const issues = [];
  const consts = content?.consts || {};
  const walk = (value, path) => {
    if (typeof value === 'string') {
      const ref = parseConstReference(value);
      if (ref && !consts[ref.key]) issues.push({ path, message: `Unknown Const variable: ${ref.key}` });
      else if (ref?.format === 'tel' && consts[ref.key].type !== 'phone') issues.push({ path, message: `Const ${ref.key} must be a phone variable` });
      else if (ref?.format === 'mailto' && consts[ref.key].type !== 'email') issues.push({ path, message: `Const ${ref.key} must be an email variable` });
      return;
    }
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index]));
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) if (path.length || key !== 'consts') walk(item, [...path, key]);
    }
  };
  walk(content, []);
  return issues;
}
