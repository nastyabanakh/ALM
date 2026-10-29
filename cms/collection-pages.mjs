/** Shared URLs for collections promoted from a repeated list to standalone pages. */
export function collectionPages(content) {
  const pages = [];
  for (const [key, mode] of Object.entries(content?.editorSettings?.collectionModes || {})) {
    if (mode !== 'page') continue;
    const items = key.split('.').reduce((value, part) => value?.[part], content);
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const record = String(item.slug || item.id || `record-${index + 1}`);
      const title = String(item.question || item.title || item.name || item.stageTitle || item.label || item.titleLine1 || `Item ${index + 1}`).replace(/<[^>]+>/g, '');
      pages.push({ id: `collection:${key}:${String(item.id||record)}`, path: `/collections/${encodeURIComponent(key)}/${encodeURIComponent(record)}/`, title, kind: 'collection', key, record, item });
    });
  }
  return pages;
}
