(() => {
  if (parent === window || new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  const initial = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || ''
  };
  const setMeta = (selector, attributes, value) => {
    let element = document.querySelector(selector);
    if (!value) { element?.remove(); return; }
    if (!element) {
      element = document.createElement('meta');
      for (const [name, content] of Object.entries(attributes)) element.setAttribute(name, content);
      document.head.append(element);
    }
    element.content = value;
  };
  const resolve = (value, consts) => {
    const match = typeof value === 'string' && /^\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}$/.exec(value.trim());
    if (!match) return value;
    const text = consts?.[match[1]]?.value;
    if (typeof text !== 'string') return value;
    if (match[2] === 'tel') return `tel:${text.replace(/[^+\d]/g, '')}`;
    if (match[2] === 'mailto') return `mailto:${text.trim()}`;
    return text;
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'CMS_DRAFT_UPDATE') return;
    const content = event.data.content;
    const settings = content?.pageSettings?.[location.pathname] || {};
    const consts = content?.consts || {};
    const title = resolve(settings.seoTitle || (location.pathname === '/' ? content?.meta?.title : initial.title) || initial.title, consts);
    const description = resolve(settings.seoDescription || (location.pathname === '/' ? content?.meta?.description : initial.description) || initial.description, consts);
    document.title = title + ' — draft';
    setMeta('meta[name="description"]', { name: 'description' }, description);
    setMeta('meta[name="robots"]', { name: 'robots' }, settings.noIndex ? 'noindex,nofollow' : '');
    setMeta('meta[property="og:title"]', { property: 'og:title' }, resolve(settings.ogTitle || title, consts));
    setMeta('meta[property="og:description"]', { property: 'og:description' }, resolve(settings.ogDescription || description, consts));
    setMeta('meta[property="og:image"]', { property: 'og:image' }, resolve(settings.ogImage || '', consts));
  });
})();
