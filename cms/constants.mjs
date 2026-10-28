import { resolveContentLinks } from './links.mjs';
import { resolve, references } from '../public/admin/const-tokens.mjs';
// Exact-reference parsing remains available for legacy callers; resolution supports inline tokens.
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
  return resolve(value, consts);
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
      for (const ref of references(value)) {
      if (ref && !consts[ref.key]) issues.push({ path, message: `Unknown Const variable: ${ref.key}` });
      else if (ref?.format === 'tel' && consts[ref.key].type !== 'phone') issues.push({ path, message: `Const ${ref.key} must be a phone variable` });
      else if (ref?.format === 'mailto' && consts[ref.key].type !== 'email') issues.push({ path, message: `Const ${ref.key} must be an email variable` });
      }
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
