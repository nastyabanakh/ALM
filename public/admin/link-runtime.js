(() => {
  let published = { settings: {}, pages: [] };
  try { published = JSON.parse(document.getElementById('cms-links-data')?.textContent || '{}'); } catch {}
  const original = new WeakMap();
  const automaticHref = (setting, pages) => {
    if (!['page', 'section'].includes(setting.type)) return null;
    const page = pages.find(item => item.id === setting.pageId);
    if (!page) return null;
    return setting.type === 'page' ? page.path : setting.sectionId
      ? `${page.path === setting.page ? '' : page.path}#${encodeURIComponent(setting.sectionId)}` : null;
  };
  const apply = (settings, pages) => {
    const links = new Map();
    for (const binding of window.__cmsPreviewBindings || []) {
      if (binding.mode === 'href') links.set(binding.element, `content:${binding.path.join('.')}:href`);
    }
    for (const element of document.querySelectorAll('[data-cms-path-href]')) links.set(element, `content:${element.dataset.cmsPathHref}:href`);
    for (const element of document.querySelectorAll('[data-cms-link-field-id]')) links.set(element, element.dataset.cmsLinkFieldId);
    for (const [element, id] of links) {
      if (!original.has(element)) original.set(element, { target: element.getAttribute('target'), rel: element.getAttribute('rel') });
      const setting = settings?.[`${location.pathname}|${id}`];
      if (setting) {
        const href = automaticHref(setting, pages || []);
        if (href !== null) element.setAttribute('href', href);
        element.setAttribute('target', setting.target || '_self');
        if (setting.target === '_blank') {
          const rel = new Set((original.get(element).rel || '').split(/\s+/).filter(Boolean));
          rel.delete('opener');
          rel.add('noopener'); rel.add('noreferrer');
          element.setAttribute('rel', [...rel].join(' '));
        } else {
          const rel = original.get(element).rel;
          if (rel === null) element.removeAttribute('rel'); else element.setAttribute('rel', rel);
        }
      } else {
        for (const name of ['target', 'rel']) {
          const value = original.get(element)[name];
          if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
        }
      }
    }
  };
  apply(published.settings, published.pages);
  if (parent === window || new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'CMS_DRAFT_UPDATE') return;
    apply(event.data.content?.linkSettings || {}, event.data.pages || published.pages);
  });
})();
