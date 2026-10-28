const pattern = () => /\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}/g;
export function references(value) {
  return typeof value === 'string' ? [...value.matchAll(pattern())].map(match => ({ key: match[1], format: match[2] || null, token: match[0], index: match.index })) : [];
}
export function resolve(value, consts = {}) {
  if (typeof value !== 'string') return value;
  return value.replace(pattern(), (token, key, format) => {
    const text = consts[key]?.value;
    if (typeof text !== 'string') return token;
    return format === 'tel' ? `tel:${text.replace(/[^+\d]/g, '')}` : format === 'mailto' ? `mailto:${text.trim()}` : text;
  });
}
