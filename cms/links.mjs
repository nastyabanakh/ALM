export const linkSettingKey = (page, fieldId) => `${page}|${fieldId}`;

export function resolveAutomaticLink(setting, pages, sourcePage = '/') {
  if (!setting || !['page', 'section'].includes(setting.type)) return null;
  const page = pages.find(item => item.id === setting.pageId);
  if (!page) return null;
  if (setting.type === 'page') return page.path;
  if (!setting.sectionId) return null;
  return `${page.path === sourcePage ? '' : page.path}#${encodeURIComponent(setting.sectionId)}`;
}

export function resolveContentLinks(content, pages = [], sourcePage = '/') {
  for (const setting of Object.values(content?.linkSettings || {})) {
    if (setting.page !== sourcePage || setting.source !== 'content' || !Array.isArray(setting.path)) continue;
    const href = resolveAutomaticLink(setting, pages, setting.page);
    if (href === null) continue;
    let owner = content;
    for (const key of setting.path.slice(0, -1)) owner = owner?.[key];
    if (owner) owner[setting.path.at(-1)] = href;
  }
  return content;
}
