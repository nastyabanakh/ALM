(() => {
  if (parent === window || new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  window.CMSConstPreview = {
    render(element, raw, consts = {}, lines = false) {
      if (element.classList.contains('cms-editing')) return;
      const fragment = document.createDocumentFragment();
      const append = (parent, text) => {
        const parts = lines ? String(text).split(/<br\s*\/?\s*>|\n/gi) : [String(text)];
        parts.forEach((part, index) => { if (index) parent.append(document.createElement('br')); parent.append(document.createTextNode(part)); });
      };
      const text = String(raw ?? ''); let offset = 0;
      for (const match of text.matchAll(/\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}/g)) {
        append(fragment, text.slice(offset, match.index));
        const span = document.createElement('span');
        span.dataset.cmsConstFragment = 'true'; span.dataset.cmsConstKey = match[1];
        span.dataset.cmsConstName = consts[match[1]]?.label || match[1];
        span.className = 'cms-const-fragment';
        const value = consts[match[1]]?.value;
        const resolved = typeof value !== 'string' ? match[0] : match[2] === 'tel' ? `tel:${value.replace(/[^+\d]/g, '')}` : match[2] === 'mailto' ? `mailto:${value.trim()}` : value;
        append(span, resolved); fragment.append(span); offset = match.index + match[0].length;
      }
      append(fragment, text.slice(offset)); element.replaceChildren(fragment);
    }
  };
})();
