/* Shared discovery rules for the inspector and collection workspace. */
(() => {
  const title = value => String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());
  const arrayPath = field => {
    const index = field.path?.findIndex(part => typeof part === 'number');
    return field.source === 'content' && index > 0 ? field.path.slice(0, index) : null;
  };
  function collections(content, sections) {
    const result = [];
    const walk = (value, path) => {
      if (Array.isArray(value)) {
        if (!value.length || value.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
          const key = path.join('.');
          const used = sections.filter(section => section.fields.some(field => arrayPath(field)?.join('.') === key) || path[0] === 'sections' && section.contentKey === path[1]);
          result.push({ key, path, label: title(path.at(-1) === 'items' ? path.at(-2) : path.at(-1)), items: value, sections: used });
        }
        return;
      }
      if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        if (['consts', 'linkSettings', 'staticText', 'staticAttributes', 'pageOverrides', 'pageSettings', 'pub', 'meta'].includes(key)) continue;
        walk(child, [...path, key]);
      }
    };
    walk(content, []);
    return result;
  }
  function groups(fields) {
    const map = new Map();
    for (const field of fields) {
      if (arrayPath(field)) continue;
      const key = field.groupId || field.id;
      if (!map.has(key)) map.set(key, { id: key, type: field.groupType || 'text', label: field.groupLabel || title(field.path?.at(-1) || 'Content'), fields: [] });
      map.get(key).fields.push(field);
    }
    return [...map.values()];
  }
  function itemFields(item, path) {
    const result = [];
    const walk = (value, current) => {
      if (value && typeof value === 'object') { for (const [key, child] of Object.entries(value)) if (!['id', '_id', 'active'].includes(key)) walk(child, [...current, key]); return; }
      if (!['string', 'number', 'boolean'].includes(typeof value)) return;
      const key = current.at(-1);
      const mode = /alt$/i.test(key) ? 'alt' : /^(\/assets\/)/.test(String(value)) || /image|photo.*src|poster/i.test(key) ? 'src' : /href|url|link/i.test(key) ? 'href' : 'text';
      result.push({ id: `content:${current.join('.')}:${mode}`, source: 'content', path: current, mode, value, valueType: typeof value, label: title(key), htmlLines: /<br\s*\/?\s*>/i.test(String(value)) });
    };
    walk(item, path);
    return result;
  }
  const itemTitle = (item, index) => String(item.question || item.title || item.name || item.stageTitle || item.label || item.titleLine1 || `Item ${index + 1}`).replace(/<[^>]+>/g, '');
  globalThis.CMSStructure = { title, arrayPath, collections, groups, itemFields, itemTitle };
})();
