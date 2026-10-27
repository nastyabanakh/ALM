(() => {
  let media = {};
  try { media = JSON.parse(document.getElementById('cms-media-data')?.textContent || '{}'); } catch { /* No catalog yet. */ }
  const sourceUrl = element => element.getAttribute('src') || '';
  const assetPath = value => {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin ? decodeURIComponent(url.pathname) : null;
    } catch { return null; }
  };
  function apply() {
    for (const element of document.querySelectorAll('img,video,source')) {
      const url = sourceUrl(element);
      const path = assetPath(url);
      const info = path && media[path];
      if (!info) continue;
      if (element.tagName === 'IMG') {
        if (!element.hasAttribute('data-cms-base-alt')) element.setAttribute('data-cms-base-alt', element.getAttribute('alt') || '');
        element.alt = info.alt || element.getAttribute('data-cms-base-alt') || '';
      }
      if (info.updatedAt && url) {
        const next = new URL(url, location.href);
        next.searchParams.set('cmsv', String(Date.parse(info.updatedAt) || info.updatedAt));
        const relative = next.pathname + next.search + next.hash;
        if (element.getAttribute('src') !== relative) {
          element.setAttribute('src', relative);
          if (element.tagName === 'SOURCE' && element.parentElement?.tagName === 'VIDEO') element.parentElement.load();
        }
      }
    }
    for (const element of document.querySelectorAll('video[poster]')) {
      const original = element.getAttribute('poster');
      const path = assetPath(original);
      const info = path && media[path];
      if (!info?.updatedAt) continue;
      const next = new URL(original, location.href);
      next.searchParams.set('cmsv', String(Date.parse(info.updatedAt) || info.updatedAt));
      element.setAttribute('poster', next.pathname + next.search);
    }
  }
  apply();
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || parent === window) return;
    if (event.data?.type === 'CMS_MEDIA_UPDATE' && event.data.media && typeof event.data.media === 'object') {
      media = event.data.media;
      apply();
    }
    if (event.data?.type === 'CMS_DRAFT_UPDATE') queueMicrotask(apply);
  });
})();
