(() => {
  if (window.parent === window) return;
  if (new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  let parentOrigin;
  try { parentOrigin = new URL(document.referrer).origin; } catch { return; }
  if (parentOrigin !== location.origin) return;

  const bindings = [];
  let currentContent;
  let selectedConstKey = null;
  const lookup = path => path.reduce((value, key) => value?.[key], currentContent);
  const constReference = value => {
    const match = typeof value === 'string' && /^\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}$/.exec(value.trim());
    return match ? { key: match[1], format: match[2] || null } : null;
  };
  const resolvedValue = value => {
    const ref = constReference(value);
    if (!ref) return value;
    const text = currentContent?.consts?.[ref.key]?.value;
    if (typeof text !== 'string') return value;
    if (ref.format === 'tel') return `tel:${text.replace(/[^+\d]/g, '')}`;
    if (ref.format === 'mailto') return `mailto:${text.trim()}`;
    return text;
  };
  const displayText = (element, value) => {
    if (element.hasAttribute('data-cms-html-lines')) {
      const escaped = String(value).split(/<br\s*\/?\s*>|\n/gi)
        .map(part => part.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]))
        .join('<br />');
      element.innerHTML = escaped;
    } else element.textContent = String(value);
  };
  const bindElement = (element, resolved, mode = 'text', category = 'static') => {
      bindings.push({ element, path: resolved, mode });
      const fieldId = `content:${resolved.join('.')}:${mode}`;
      element.dataset.cmsFieldId = fieldId;
      if (mode !== 'text') element.addEventListener('dblclick', event => {
        const ref = constReference(lookup(resolved));
        if (!ref) return;
        event.preventDefault();
        event.stopPropagation();
        parent.postMessage({ type: 'CMS_CONST_FOCUS', key: ref.key }, parentOrigin);
      });
      if (mode === 'text') {
        element.classList.add('cms-editable');
        element.classList.add(`cms-${category}`);
        element.title = 'Double-click to edit text';
        element.addEventListener('dblclick', event => {
          event.preventDefault();
          event.stopPropagation();
          const ref = constReference(lookup(resolved));
          if (ref) {
            event.stopImmediatePropagation();
            parent.postMessage({ type: 'CMS_CONST_FOCUS', key: ref.key }, parentOrigin);
            return;
          }
          if (resolved.some(part => typeof part === 'number')) {
            parent.postMessage({ type: 'CMS_FIELD_FOCUS', id: fieldId }, parentOrigin); return;
          }
          parent.postMessage({ type: 'CMS_FIELD_FOCUS', id: fieldId }, parentOrigin);
          if (element.hasAttribute('data-cms-html-lines')) {
            element.textContent = String(lookup(resolved) ?? '').replace(/<br\s*\/?\s*>/gi, '\n');
            element.style.whiteSpace = 'pre-line';
          }
          element.contentEditable = 'plaintext-only';
          element.classList.add('cms-editing');
          element.focus();
          const selection = getSelection();
          const range = document.createRange();
          range.selectNodeContents(element);
          selection?.removeAllRanges();
          selection?.addRange(range);
        });
        element.addEventListener('keydown', event => {
          if (element.contentEditable === 'inherit') return;
          if (event.key === 'Escape') {
            event.preventDefault();
            element.contentEditable = 'inherit';
            element.classList.remove('cms-editing');
            element.style.whiteSpace = '';
            displayText(element, lookup(resolved) ?? '');
            element.blur();
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            element.blur();
          }
        });
        element.addEventListener('blur', () => {
          if (element.contentEditable === 'inherit') return;
          const value = (element.textContent || '').trim().replace(/\n/g, element.hasAttribute('data-cms-html-lines') ? '<br />' : '\n');
          element.contentEditable = 'inherit';
          element.classList.remove('cms-editing');
          if (element.hasAttribute('data-cms-html-lines')) {
            element.style.whiteSpace = '';
            displayText(element, value);
          }
          if (value !== String(lookup(resolved) ?? '')) {
            parent.postMessage({ type: 'CMS_INLINE_EDIT', path: resolved, value }, parentOrigin);
          }
        });
      }
  };
  const bind = (selector, path, mode = 'text', category = 'static') => {
    document.querySelectorAll(selector).forEach((element, index) =>
      bindElement(element, typeof path === 'function' ? path(index) : path, mode, category));
  };

  bind('.hero__badge-text', ['hero', 'badgeText']);
  bind('.hero__title', ['hero', 'title']);
  bind('.hero .glass-card__tag', ['hero', 'aboutTag']);
  bind('.hero .glass-card__text', ['hero', 'aboutText']);
  bind('.hero .glass-card__cta .btn-composite__label', ['hero', 'ctaText'], 'text', 'component');
  bind('.hero .glass-card__cta .btn-composite', ['hero', 'ctaHref'], 'href', 'component');
  bind('.hero__bg-video', ['hero', 'videoPoster'], 'poster');
  bind('.hero__bg-video source', ['hero', 'videoUrl'], 'src');

  bind('.starting-points__bar-title', ['startingPoints', 'barTitle']);
  bind('.starting-points__card-title', i => ['startingPoints', 'items', i, 'title']);
  bind('.starting-points__card-num', i => ['startingPoints', 'items', i, 'num']);
  bind('.starting-points__image', i => ['startingPoints', 'items', i, 'image'], 'src');
  bind('.starting-points__card', i => ['startingPoints', 'items', i, 'note'], 'data-step-note');

  bind('.featured-home-section__hero-img', ['featuredHome', 'heroKitchenImage'], 'src');
  bind('.featured-home-section__spec-index', i => ['featuredHome', 'specs', i, 'index']);
  bind('.featured-home-section__spec-label', i => ['featuredHome', 'specs', i, 'label']);
  bind('.featured-home-section__spec-value', i => ['featuredHome', 'specs', i, 'value']);
  bind('.featured-home-section__card-title', i => ['featuredHome', 'stages', i, 'title']);
  bind('.featured-home-section__card-desc', i => ['featuredHome', 'stages', i, 'desc']);
  bind('.featured-home-section__card-img', i => ['featuredHome', 'stages', i, 'image'], 'src');

  bind('.completed-home__photo', i => ['completedHome', 'images', ['bathroom', 'office', 'kitchen', 'livingRoom'][i]], 'src');
  bind('.completed-home__spec-label', i => ['completedHome', 'specs', i, 'label']);
  bind('.completed-home__spec-value', i => ['completedHome', 'specs', i, 'value']);
  bind('.faq__item-question', i => ['faq', i, 'question'], 'text', 'record');
  bind('.faq__item-answer', i => ['faq', i, 'answer'], 'text', 'record');

  bind('.local-management__bar-label', ['localManagement', 'barLabel']);
  bind('.local-management__headline', ['localManagement', 'headline']);
  bind('.local-management__photo', ['localManagement', 'ownerImage'], 'src');
  bind('.local-management__principle-title', i => ['localManagement', 'principles', i, 'title']);
  bind('.local-management__principle-desc', i => ['localManagement', 'principles', i, 'description']);
  bind('.local-management__background-label', ['localManagement', 'backgroundLabel']);
  bind('.local-management__background-text', ['localManagement', 'backgroundText']);
  bind('.builder-accountability__bar-label', ['builderAccountability', 'barLabel']);
  bind('.builder-accountability__title', ['builderAccountability', 'title']);
  bind('.builder-accountability__desc', ['builderAccountability', 'description']);
  bind('.builder-accountability__col-title span:first-child', i => ['builderAccountability', 'commitments', i, 'titleLine1']);
  bind('.builder-accountability__col-title span:last-child', i => ['builderAccountability', 'commitments', i, 'titleLine2']);
  bind('.builder-accountability__col-desc', i => ['builderAccountability', 'commitments', i, 'description']);
  bind('.builder-accountability__cta-wrap .btn-composite__label', ['builderAccountability', 'ctaText'], 'text', 'component');
  bind('.site-footer__contacts-list .site-footer__contact-link:first-child', ['contacts', 'email']);
  bind('.site-footer__contacts-list .site-footer__contact-link:last-child', ['contacts', 'phone']);
  for (const element of document.querySelectorAll('[data-cms-path],[data-cms-path-src],[data-cms-path-poster],[data-cms-path-href],[data-cms-path-alt],[data-cms-path-placeholder]')) {
    for (const [attribute, value] of Object.entries(element.dataset)) {
      if (!attribute.startsWith('cmsPath') || typeof value !== 'string' || !value) continue;
      const mode = attribute === 'cmsPath' ? 'text' : attribute.slice('cmsPath'.length)
        .replace(/^./, letter => letter.toLowerCase()).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
      const resolved = value.split('.').map(part => /^\d+$/.test(part) ? Number(part) : part);
      if (bindings.some(binding => binding.element === element && binding.mode === mode)) continue;
      bindElement(element, resolved, mode, element.closest('a,button') ? 'component' : 'static');
    }
  }
  // The preview discovers the editor layout from the rendered page and these
  // existing collection bindings, rather than from a second list in /admin.
  window.__cmsPreviewBindings = bindings;

  const style = document.createElement('style');
  style.textContent = '.cms-editable:hover{outline:2px dashed #3b82f6!important;outline-offset:3px;cursor:text!important}.cms-editable:empty::before{content:"Edit text";opacity:.35}.cms-editing{outline:3px solid #3b82f6!important;outline-offset:3px;cursor:text!important;user-select:text!important}.cms-component:hover,.cms-component.cms-editing{outline-color:#a855f7!important}.cms-record:hover,.cms-record.cms-editing{outline-color:#22c55e!important}.cms-field-selected{outline:3px solid #fff!important;outline-offset:4px!important}.cms-variable:hover{outline:none!important}.cms-variable::after{content:none!important}.cms-const-selected{outline:none!important}';
  document.head.append(style);

  window.addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== parent) return;
    if (event.data?.type === 'CMS_HIGHLIGHT_CONST') {
      selectedConstKey = event.data.key || null;
      for (const { element } of bindings) element.classList.toggle('cms-const-selected', Boolean(selectedConstKey) && element.dataset.cmsConstKey === selectedConstKey);
      return;
    }
    if (event.data?.type !== 'CMS_DRAFT_UPDATE') return;
    currentContent = event.data.content;
    if (!currentContent) return;
    for (const { element, path, mode } of bindings) {
      if (element.classList.contains('cms-editing')) continue;
      const rawValue = lookup(path);
      const value = resolvedValue(rawValue);
      if (value == null) continue;
      if (mode === 'text') displayText(element, value);
      else element.setAttribute(mode, String(value));
    }
    for (const element of new Set(bindings.map(binding => binding.element))) {
      const connected = bindings.filter(binding => binding.element === element && constReference(lookup(binding.path)));
      const binding = connected.find(binding => binding.mode === 'text') || connected[0];
      const ref = binding && constReference(lookup(binding.path));
      element.classList.toggle('cms-variable', Boolean(ref));
      if (ref) {
        element.dataset.cmsConstKey = ref.key;
        element.dataset.cmsConstName = currentContent.consts?.[ref.key]?.label || ref.key;
        element.title = `Const: ${element.dataset.cmsConstName} · Double-click to edit everywhere`;
      } else {
        delete element.dataset.cmsConstName; delete element.dataset.cmsConstKey;
      }
      element.classList.toggle('cms-const-selected', Boolean(selectedConstKey) && ref?.key === selectedConstKey);
    }
    document.title = `${currentContent.meta?.title || document.title} — draft`;
  });
  parent.postMessage({ type: 'CMS_PREVIEW_READY' }, parentOrigin);
})();
