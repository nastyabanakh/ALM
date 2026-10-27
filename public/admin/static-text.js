(() => {
  const previewMode = window.parent !== window && new URLSearchParams(location.search).get('cms-preview') === '1';
  let parentOrigin = null;
  if (previewMode) {
    try { parentOrigin = new URL(document.referrer).origin; } catch { return; }
    if (parentOrigin !== location.origin) return;
  }

  let published = {};
  let selectedConstKey = null;
  try { published = JSON.parse(document.getElementById('cms-static-text')?.textContent || '{}'); } catch { /* Ignore invalid embedded data. */ }
  const constReference = value => {
    const match = typeof value === 'string' && /^\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}$/.exec(value.trim());
    return match ? { key: match[1], format: match[2] || null } : null;
  };
  const resolveConst = (value, consts) => {
    const ref = constReference(value);
    if (!ref) return value;
    const text = consts?.[ref.key]?.value;
    if (typeof text !== 'string') return value;
    if (ref.format === 'tel') return `tel:${text.replace(/[^+\d]/g, '')}`;
    if (ref.format === 'mailto') return `mailto:${text.trim()}`;
    return text;
  };
  const markConst = (element, value, consts) => {
    if (!previewMode) return;
    const ref = constReference(value);
    element.classList.toggle('cms-variable', Boolean(ref));
    if (ref) {
      element.dataset.cmsConstKey = ref.key;
      element.dataset.cmsConstName = consts?.[ref.key]?.label || ref.key;
      element.title = `Const: ${element.dataset.cmsConstName} · Double-click to edit everywhere`;
    } else {
      delete element.dataset.cmsConstName;
      delete element.dataset.cmsConstKey;
      element.title = 'Double-click to edit text';
    }
    element.classList.toggle('cms-const-selected', Boolean(selectedConstKey) && ref?.key === selectedConstKey);
  };
  const excluded = 'script,style,svg,noscript,code,pre,textarea,select,option,[data-cms-ignore]';
  const semanticRoots = [...document.querySelectorAll('main section, main header, main footer')]
    .filter(element => !element.parentElement?.closest('section,header,footer'));
  const roots = semanticRoots.length ? semanticRoots : [...document.querySelectorAll('main')];
  const fields = [];
  const attributes = [];
  const mapped = previewMode ? window.__cmsPreviewBindings || [] : [];
  const structuredPage = location.pathname === '/';
  const sectionKey = (root, index) => root.id || `${root.tagName.toLowerCase()}-${index}`;
  const ownSection = element => roots.find(root => root.contains(element));
  const labelFor = (element, mode, value) => {
    if (mode === 'href') return 'Link · ' + (element.textContent || '').trim().slice(0, 42);
    if (mode === 'src' || mode === 'poster' || mode === 'data-image') return (element.tagName === 'SOURCE' ? 'Video · ' : 'Image · ') + (element.getAttribute('alt') || element.getAttribute('aria-label') || '').slice(0, 42);
    if (mode === 'alt') return 'Image description';
    if (mode === 'placeholder') return 'Placeholder';
    if (mode === 'aria-label') return 'Accessible label';
    if (/^H[1-6]$/.test(element.tagName)) return 'Heading · ' + value.slice(0, 42);
    if (element.closest('a,button')) return 'Button · ' + value.slice(0, 42);
    return value.slice(0, 54) || 'Text';
  };
  const safeAttribute = (name, value) => {
    if (name === 'href') return /^(#|\/(?!\/)|https?:\/\/|mailto:|tel:)/i.test(value);
    if (name === 'src' || name === 'poster') return /^\/assets\//.test(value);
    return true;
  };

  function elementPath(root, element) {
    const parts = [];
    for (let node = element; node !== root; node = node.parentElement) {
      if (!node?.parentElement) return null;
      parts.unshift([...node.parentElement.children].indexOf(node));
    }
    return parts.join('.');
  }

  function addField(element, key, sourceText) {
    const base = sourceText.trim();
    if (!base || base.length > 5000) return;
    const start = sourceText.indexOf(base);
    const prefix = sourceText.slice(0, start);
    const suffix = sourceText.slice(start + base.length);
    const field = { element, key, base, prefix, suffix, value: base,
      label: labelFor(element, 'text', base), section: ownSection(element) };
    fields.push(field);
    if (!previewMode) return;
    element.dataset.cmsFieldId = `text:${key}`;
    element.classList.add('cms-editable', element.closest('a,button') ? 'cms-component' : 'cms-static');
    element.title = 'Double-click to edit text';
    element.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      if (element.closest('[data-cms-item]')) return;
      const ref = constReference(field.value);
      if (ref) {
        parent.postMessage({ type: 'CMS_CONST_FOCUS', key: ref.key }, parentOrigin);
        return;
      }
      parent.postMessage({ type: 'CMS_FIELD_FOCUS', id: `text:${key}` }, parentOrigin);
      element.contentEditable = 'plaintext-only';
      element.classList.add('cms-editing');
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    element.addEventListener('keydown', event => {
      if (!element.classList.contains('cms-editing')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        element.textContent = field.prefix + field.value + field.suffix;
        element.blur();
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        element.blur();
      }
    });
    element.addEventListener('blur', () => {
      if (!element.classList.contains('cms-editing')) return;
      const value = (element.textContent || '').trim();
      element.contentEditable = 'inherit';
      element.classList.remove('cms-editing');
      element.textContent = field.prefix + value + field.suffix;
      if (value !== field.value) {
        field.value = value;
        parent.postMessage({ type: 'CMS_STATIC_EDIT', page: location.pathname, key, base, value }, parentOrigin);
      }
    });
  }

  for (const [rootIndex, root] of roots.entries()) {
    const rootKey = sectionKey(root, rootIndex);
    const candidates = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (element.closest(excluded) || element.closest('.cms-editable') || element.isContentEditable || element.closest('[data-cms-path]')) continue;
      const path = elementPath(root, element);
      if (path === null) continue;
      if (element.children.length === 0) {
        if (element.textContent?.trim()) candidates.push({ element, key: `${rootKey}:${path}`, text: element.textContent });
        continue;
      }
      [...element.childNodes].forEach((node, index) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          candidates.push({ node, key: `${rootKey}:${path}:text-${index}`, text: node.textContent });
        }
      });
    }
    const editableAttributes = { IMG: ['src', 'alt'], VIDEO: ['poster'], SOURCE: ['src'], A: ['href'], INPUT: ['placeholder'], TEXTAREA: ['placeholder'] };
    for (const element of root.querySelectorAll('img,video,source,a,input,textarea')) {
      if (element.closest(excluded) && !element.matches('input,textarea')) continue;
      const path = elementPath(root, element);
      if (path === null) continue;
      for (const name of editableAttributes[element.tagName] || []) {
        if (mapped.some(binding => binding.element === element && binding.mode === name)) continue;
        const base = element.getAttribute(name);
        if (base === null || base.length > 5000) continue;
        attributes.push({ element, name, base, key: `${rootKey}:${path}:@${name}`,
          label: labelFor(element, name, base), section: root });
        if (name === 'href') element.dataset.cmsLinkFieldId = `attribute:${rootKey}:${path}:@${name}`;
        if (previewMode && (name === 'src' || name === 'poster') && !element.dataset.cmsFieldId) {
          element.dataset.cmsFieldId = `attribute:${rootKey}:${path}:@${name}`;
        }
      }
    }
    for (const candidate of candidates) {
      if (structuredPage) continue;
      if (!previewMode && published.staticText?.[candidate.key]?.base !== candidate.text.trim()) continue;
      if (candidate.node) {
        const wrapper = document.createElement('span');
        wrapper.className = 'cms-inline-text';
        candidate.node.replaceWith(wrapper);
        wrapper.textContent = candidate.text;
        addField(wrapper, candidate.key, candidate.text);
      } else {
        addField(candidate.element, candidate.key, candidate.text);
      }
    }
  }

  function apply(content) {
    const pageContent = location.pathname === '/' ? content : content?.pageOverrides?.[location.pathname] || {};
    const consts = content?.consts || published.consts || {};
    const overrides = pageContent?.staticText || {};
    for (const field of fields) {
      if (field.element.classList.contains('cms-editing')) continue;
      const saved = overrides[field.key];
      // A source-code change takes precedence over an override made for older text.
      const value = saved?.base === field.base && typeof saved.value === 'string' ? saved.value : field.base;
      field.value = value;
      field.element.textContent = field.prefix + resolveConst(value, consts) + field.suffix;
      markConst(field.element, value, consts);
    }
    for (const field of attributes) {
      const saved = pageContent?.staticAttributes?.[field.key];
      const rawValue = saved?.base === field.base && typeof saved.value === 'string'
        ? saved.value : field.base;
      const resolved = resolveConst(rawValue, consts);
      const value = safeAttribute(field.name, resolved) ? resolved : field.base;
      if (!fields.some(text => text.element === field.element && constReference(text.value))) markConst(field.element, rawValue, consts);
      if (field.element.getAttribute(field.name) !== value) {
        field.element.setAttribute(field.name, value);
        if (field.element.tagName === 'SOURCE' && field.element.parentElement?.tagName === 'VIDEO') field.element.parentElement.load();
      }
    }
  }
  apply(location.pathname === '/' ? published : { pageOverrides: { [location.pathname]: published }, consts: published.consts });

  if (!previewMode) return;
  const previewStyle = document.createElement('style');
  previewStyle.textContent = '.cms-editable:hover{outline:2px dashed #3b82f6!important;outline-offset:3px;cursor:text!important}.cms-editing{outline:3px solid #3b82f6!important;outline-offset:3px;user-select:text!important}.cms-field-selected{outline:3px solid #fff!important;outline-offset:4px!important}.cms-variable:hover{outline:none!important}.cms-variable::after{content:none!important}.cms-const-selected{outline:none!important}';
  document.head.append(previewStyle);
  const buildStructure = () => roots.map((root, index) => {
    const key = sectionKey(root, index);
    const heading = root.querySelector('h1,h2,h3,[class*="bar-title"],[class*="bar-label"]');
    const label = (root.getAttribute('aria-label') || heading?.textContent || key).trim().replace(/\s+/g, ' ').slice(0, 40);
    const orderedElements = [root, ...root.querySelectorAll('*')];
    const sectionFields = [];
    for (const binding of mapped) {
      if (!root.contains(binding.element)) continue;
      const id = `content:${binding.path.join('.')}:${binding.mode}`;
      if (sectionFields.some(field => field.source === 'content' && field.path.join('.') === binding.path.join('.'))) continue;
      const value = binding.mode === 'text' ? binding.element.textContent.trim() : binding.element.getAttribute(binding.mode) || '';
      sectionFields.push({ id, source: 'content', path: binding.path, mode: binding.mode,
        label: labelFor(binding.element, binding.mode, value), value,
        target: binding.mode === 'href' ? binding.element.getAttribute('target') || '_self' : undefined,
        htmlLines: binding.element.hasAttribute('data-cms-html-lines') || /<br\s*\/?\s*>/i.test(value),
        mediaType: binding.element.tagName === 'SOURCE' ? 'video' : 'image',
        order: orderedElements.indexOf(binding.element) });
    }
    for (const field of fields.filter(item => item.section === root)) {
      sectionFields.push({ id: `text:${field.key}`, source: 'staticText', key: field.key,
        base: field.base, mode: 'text', label: field.label, value: field.value, order: orderedElements.indexOf(field.element) });
    }
    for (const field of attributes.filter(item => item.section === root)) {
      sectionFields.push({ id: `attribute:${field.key}`, source: 'staticAttribute', key: field.key,
        base: field.base, mode: field.name, label: field.label, value: field.base,
        target: field.name === 'href' ? field.element.getAttribute('target') || '_self' : undefined,
        mediaType: field.element.tagName === 'SOURCE' ? 'video' : 'image',
        order: orderedElements.indexOf(field.element) });
    }
    const owners = new Map();
    for (const field of sectionFields) {
      const binding = field.source === 'content' ? mapped.find(item => `content:${item.path.join('.')}:${item.mode}` === field.id)
        : (field.source === 'staticText' ? fields : attributes).find(item => item.key === field.key);
      const element = binding?.element;
      if (!element) continue;
      const owner = element.closest('[data-cms-item]') || element.closest('[data-cms-component]') || (element.matches('img,video,source') ? (element.closest('video') || element) : element.closest('a,button')) || element;
      if (!owners.has(owner)) owners.set(owner, `${key}:element:${owners.size}`);
      field.groupId = owners.get(owner);
      field.groupType = owner.matches('img,video,source') ? 'image' : owner.matches('a,button,[data-cms-component]') ? 'component' : 'text';
      field.groupLabel = owner.dataset.cmsComponent || (field.groupType === 'component' ? 'Button' : field.groupType === 'image' ? 'Image' : /^H[1-6]$/.test(owner.tagName) ? 'Heading' : 'Text');
      owner.dataset.cmsGroupId = field.groupId;
      owner.dataset.cmsGroupType = field.groupType;
    }
    sectionFields.sort((a, b) => a.order - b.order);
    return { id: key, anchorId: root.id || null, label, contentKey: root.dataset.cmsSection || null, fields: sectionFields };
  });
  let sections = buildStructure();
  const sendStructure = () => {
    sections = buildStructure();
    parent.postMessage({ type: 'CMS_STRUCTURE', page: location.pathname, sections }, parentOrigin);
  };
  sendStructure();
  addEventListener('cms-bindings-changed', sendStructure);
  const selectionStyle = document.createElement('style');
  selectionStyle.textContent = '[data-cms-group-id]:hover{outline:2px solid #22c55e!important;outline-offset:3px;cursor:pointer!important}[data-cms-group-type="image"]:hover{outline-color:#3b82f6!important}[data-cms-group-id]:hover .cms-editable{outline:none!important}.cms-object-selected{outline:2px solid #22c55e!important;outline-offset:3px}[data-cms-group-type="image"].cms-object-selected{outline-color:#3b82f6!important}';
  document.head.append(selectionStyle);
  let selectedGroup = null;
  addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== parent || event.data?.type !== 'CMS_SELECT_GROUP') return;
    selectedGroup = event.data.id;
    document.querySelectorAll('[data-cms-group-id]').forEach(element => element.classList.toggle('cms-object-selected', element.dataset.cmsGroupId === selectedGroup));
  });
  let blockClicks = true;
  const stopInteraction = event => {
    if (event.target.closest?.('[data-cms-editor-ui]')) return;
    if (!blockClicks) return;
    if (event.type === 'keydown' && (event.key !== 'Enter' && event.key !== ' ' || event.target.closest('.cms-editing'))) return;
    if (event.type === 'click') {
      const owner = event.target.closest?.('[data-cms-group-id]');
      if (owner) parent.postMessage({ type: 'CMS_GROUP_FOCUS', id: owner.dataset.cmsGroupId }, parentOrigin);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of ['click', 'auxclick', 'submit']) document.addEventListener(type, stopInteraction, true);
  document.addEventListener('keydown', stopInteraction, true);
  let lastActiveSection = null;
  let scrollFrame = 0;
  let requestedSection = null;
  let requestedUntil = 0;
  const reportActiveSection = () => {
    scrollFrame = 0;
    if (requestedSection && performance.now() < requestedUntil) return;
    requestedSection = null;
    const line = Math.min(innerHeight * .25, 220);
    let index = roots.findIndex(root => { const rect = root.getBoundingClientRect(); return rect.top <= line && rect.bottom > line; });
    if (index < 0 && roots.length) index = roots.reduce((best, root, candidate) => Math.abs(root.getBoundingClientRect().top - line) < Math.abs(roots[best].getBoundingClientRect().top - line) ? candidate : best, 0);
    const id = sections[index]?.id;
    if (id && id !== lastActiveSection) {
      lastActiveSection = id;
      parent.postMessage({ type: 'CMS_ACTIVE_SECTION', page: location.pathname, id }, parentOrigin);
    }
  };
  const queueSection = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(reportActiveSection); };
  addEventListener('scroll', queueSection, { passive: true });
  addEventListener('resize', queueSection);
  addEventListener('wheel', () => { requestedSection = null; }, { passive: true });
  reportActiveSection();
  window.addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== parent) return;
    if (event.data?.type === 'CMS_FOCUS_SECTION') {
      const index = sections.findIndex(section => section.id === event.data.id);
      if (index >= 0) {
        requestedSection = sections[index].id; requestedUntil = performance.now() + 950;
        lastActiveSection = requestedSection;
        roots[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(queueSection, 1000);
      }
      return;
    }
    if (event.data?.type === 'CMS_HIGHLIGHT_FIELD') {
      const id = event.data.id;
      const matched = new Set(mapped.filter(binding => `content:${binding.path.join('.')}:${binding.mode}` === id).map(binding => binding.element));
      for (const binding of mapped) binding.element.classList.toggle('cms-field-selected', matched.has(binding.element));
      for (const field of fields) field.element.classList.toggle('cms-field-selected', field.element.dataset.cmsFieldId === id);
      for (const field of attributes) field.element.classList.toggle('cms-field-selected', `attribute:${field.key}` === id);
      const selected = [...document.querySelectorAll('.cms-field-selected')][0];
      selected?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (event.data?.type === 'CMS_HIGHLIGHT_CONST') {
      selectedConstKey = event.data.key || null;
      for (const field of fields) field.element.classList.toggle('cms-const-selected', Boolean(selectedConstKey) && field.element.dataset.cmsConstKey === selectedConstKey);
      for (const field of attributes) field.element.classList.toggle('cms-const-selected', Boolean(selectedConstKey) && field.element.dataset.cmsConstKey === selectedConstKey);
      return;
    }
    if (event.data?.type !== 'CMS_DRAFT_UPDATE') return;
    blockClicks = event.data.blockClicks !== false;
    apply(event.data.content);
  });
  parent.postMessage({ type: 'CMS_PREVIEW_READY' }, parentOrigin);
})();
