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
  const resolveConst = (value, consts) => typeof value !== 'string' ? value : value.replace(/\{\{const\.([a-z][a-zA-Z0-9]*)(?:\|(tel|mailto))?\}\}/g, (token, key, format) => {
    const text = consts?.[key]?.value; if (typeof text !== 'string') return token;
    return format === 'tel' ? `tel:${text.replace(/[^+\d]/g, '')}` : format === 'mailto' ? `mailto:${text.trim()}` : text;
  });
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
  const excluded = 'script,style,svg,noscript,code,pre,textarea,select,option,[data-cms-ignore],[data-cms-const-fragment]';
  const semanticRoots = [...document.querySelectorAll('main section, main header, main footer')]
    .filter(element => !element.parentElement?.closest('section,header,footer'));
  const roots = semanticRoots.length ? semanticRoots : [...document.querySelectorAll('main')];
  const fields = [];
  const attributes = [];
  const mapped = previewMode ? window.__cmsPreviewBindings || [] : [];
  const structuredPage = location.pathname === '/';
  const sectionKey = (root, index) => {
    // Anchor IDs can repeat in imported pages; editor identities must not.
    const key = root.dataset.cmsSection || root.id || `${root.tagName.toLowerCase()}-${index}`;
    const first = roots.findIndex(element => (element.dataset.cmsSection || element.id) === key);
    return first >= 0 && first !== index ? `${key}-${index}` : key;
  };
  const ownSection = element => roots.find(root => root.contains(element));
  const labelFor = (element, mode, value) => {
    if (mode === 'href') return 'Link · ' + (element.textContent || '').trim().slice(0, 42);
    if (mode === 'src' || mode === 'poster' || mode === 'data-image') return (element.tagName === 'SOURCE' ? 'Video · ' : 'Image · ') + (element.getAttribute('alt') || element.getAttribute('aria-label') || '').slice(0, 42);
    if (mode === 'alt') return element.closest('[aria-hidden="true"]') ? 'Decorative image description' : 'Image description';
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
      if (/\{\{const\./.test(field.value)) return;
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
      if (window.CMSConstPreview) window.CMSConstPreview.render(field.element, field.prefix + value + field.suffix, consts);
      else field.element.textContent = field.prefix + resolveConst(value, consts) + field.suffix;
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
  previewStyle.textContent = '.cms-editable:hover{outline:2px dashed #3b82f6!important;outline-offset:3px;cursor:text!important}.cms-editing{outline:3px solid #3b82f6!important;outline-offset:3px;user-select:text!important}.cms-field-selected{outline:3px solid #fff!important;outline-offset:4px!important}.cms-variable:hover{outline:none!important}.cms-variable::after{content:none!important}.cms-const-selected{outline:2px solid #b780ff!important;outline-offset:4px!important;background-color:#a15ce91c!important}';
  previewStyle.textContent += 'html{color-scheme:dark;scrollbar-width:thin!important;scrollbar-color:#454545 transparent!important}*{scrollbar-width:thin!important;scrollbar-color:#454545 transparent!important}*::-webkit-scrollbar{width:5px!important;height:5px!important;background:transparent!important}*::-webkit-scrollbar-track{background:transparent!important}*::-webkit-scrollbar-thumb{background:#454545!important;border-radius:8px!important}*::-webkit-scrollbar-thumb:hover{background:#737373!important}*::-webkit-scrollbar-corner{background:transparent!important}';
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
      const value = binding.mode === 'text' ? binding.element.textContent.trim() : binding.element.getAttribute(binding.mode) || '';
      sectionFields.push({ id, source: 'content', path: [...binding.path], mode: binding.mode, bindingIndex: mapped.indexOf(binding),
        label: labelFor(binding.element, binding.mode, value), value,
        target: binding.mode === 'href' ? binding.element.getAttribute('target') || '_self' : undefined,
        htmlLines: binding.element.hasAttribute('data-cms-html-lines') || /<br\s*\/?\s*>/i.test(value),
        mediaType: binding.element.closest('video') && binding.mode === 'src' ? 'video' : 'image',
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
        mediaType: field.element.closest('video') && field.name === 'src' ? 'video' : 'image',
        order: orderedElements.indexOf(field.element) });
    }
    // Infer the rendered boundary of each record from its indexed bindings.
    const recordBindings = new Map();
    for (const binding of mapped.filter(binding => root.contains(binding.element))) {
      const offset = binding.path.findIndex(part => typeof part === 'number');
      if (offset < 1) continue;
      const path = binding.path.slice(0, offset), index = binding.path[offset], key = path.join('.');
      const identity = `${key}:${index}`;
      if (!recordBindings.has(identity)) recordBindings.set(identity, { key, path, index, elements: [] });
      recordBindings.get(identity).elements.push(binding.element);
    }
    // Infer only the smallest shared boundary, never grow a record into the section.
    const recordRoots = [...recordBindings.values()].flatMap(record => {
      let node = record.elements[0];
      while (node && !record.elements.every(element => node.contains(element))) node = node.parentElement;
      if (!node || node === root || node.matches('section,header,footer,main')) return [];
      const mixed = mapped.some(binding => {
        if (!node.contains(binding.element)) return false;
        const offset = binding.path.findIndex(part => typeof part === 'number');
        return offset < 1 || binding.path.slice(0, offset).join('.') !== record.key || binding.path[offset] !== record.index;
      });
      return mixed ? [] : [{ ...record, root: node }];
    });
    const fromBinding = binding => {
      const offset = binding.path.findIndex(part => typeof part === 'number');
      if (offset < 1) return null;
      const path = binding.path.slice(0, offset); return { key: path.join('.'), path, index: binding.path[offset] };
    };
    const recordFor = (element, field) => {
      // A field's own indexed path is stronger evidence than DOM proximity.
      if (field?.source === 'content') { const own = fromBinding(field); if (own) return own; }
      const direct = mapped.find(binding => binding.element === element && fromBinding(binding));
      if (direct) return fromBinding(direct);
      const item = element.closest('[data-cms-item]');
      if (item && root.contains(item)) {
        const declared = item.dataset.cmsCollection || item.closest('[data-cms-collection]')?.dataset.cmsCollection;
        const ownBindings = mapped.filter(binding => item.contains(binding.element)).map(fromBinding).filter(Boolean);
        const keys = [...new Set(ownBindings.map(record => record.key))];
        const key = declared || (keys.length === 1 ? keys[0] : null);
        const index = Number(item.dataset.cmsItem);
        if (key && Number.isInteger(index) && index >= 0) return { key, path: key.split('.'), index };
      }
      // Explicit static fields outside a record remain section fields.
      if (field?.source === 'content' || mapped.some(binding => binding.element === element && !fromBinding(binding))) return null;
      const candidates = recordRoots.filter(record => record.root.contains(element));
      const identities = new Set(candidates.map(record => `${record.key}:${record.index}`));
      if (identities.size !== 1) return null;
      const record = candidates.sort((a,b) => a.root.contains(b.root) ? 1 : -1)[0];
      return record ? { key: record.key, path: record.path, index: record.index } : null;
    };
    for (const element of root.querySelectorAll('[data-cms-group-id]')) { delete element.dataset.cmsGroupId; delete element.dataset.cmsGroupType; }
    const owners = new Map();
    for (const field of sectionFields) {
      const binding = field.source === 'content' ? mapped[field.bindingIndex]
        : (field.source === 'staticText' ? fields : attributes).find(item => item.key === field.key);
      const element = binding?.element;
      if (!element) continue;
      const mediaOwner = element.matches('img,video,source') ? (element.closest('video') || (element.closest('picture')?.querySelector('img')) || element) : null;
      const owner = mediaOwner || element.closest('[data-cms-instance]') || element.closest('a,button') || element;
      const imageBinding = mediaOwner && mapped.find(binding => binding.element === owner && binding.mode === 'src');
      if (!owners.has(owner)) {
        let componentId; try { componentId = JSON.parse(owner.dataset.cmsInstance).id; } catch {}
        owners.set(owner, imageBinding ? `${key}:media:${imageBinding.path.join('.')}` : componentId ? `${key}:component:${componentId}` : `${key}:dom:${elementPath(root, owner)}`);
      }
      field.groupId = owners.get(owner);
      field.record = recordFor(element, field);
      field.groupType = owner.hasAttribute('data-cms-instance') ? 'component' : owner.matches('img,picture,video,source') ? 'image' : owner.matches('a,button') ? 'link' : 'text';
      if (owner.dataset.cmsInstance) {
        try { field.component = JSON.parse(owner.dataset.cmsInstance); } catch {}
        field.componentProperty = element.dataset.cmsProperty || ({ href: 'href', target: 'target', 'aria-label': 'ariaLabel' })[field.mode];
      }
      field.groupLabel = owner.dataset.cmsComponent || (field.groupType === 'link' ? (owner.tagName === 'BUTTON' ? 'Button' : 'Link') : field.groupType === 'image' ? 'Image' : /^H[1-6]$/.test(owner.tagName) ? 'Heading' : 'Text');
      owner.dataset.cmsGroupId = field.groupId;
      owner.dataset.cmsGroupType = field.groupType;
    }
    for (const owner of root.querySelectorAll('[data-cms-instance]')) {
      if ([...owners.keys()].includes(owner)) continue;
      let descriptor; try { descriptor = JSON.parse(owner.dataset.cmsInstance); } catch { continue; }
      const groupId = `${key}:component:${descriptor.id}`;
      owner.dataset.cmsGroupId = groupId; owner.dataset.cmsGroupType = 'component';
      if (sectionFields.some(field => field.groupId === groupId)) continue;
      sectionFields.push({ id: groupId, groupId, groupType: 'component', groupLabel: owner.dataset.cmsComponent || 'Component', component: descriptor, record: recordFor(owner), mode: 'text', value: owner.textContent.trim(), order: orderedElements.indexOf(owner) });
    }
    for (const field of sectionFields) {
      const owner = [...root.querySelectorAll('[data-cms-group-id]')].find(element => element.dataset.cmsGroupId === field.groupId);
      let parent = owner?.parentElement;
      while (parent && parent !== root && !parent.dataset.cmsGroupId) parent = parent.parentElement;
      field.parentGroupId = parent && parent !== root ? parent.dataset.cmsGroupId || null : null;
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
      else {
        const collection = collectionRoots.find(collection => collection.root.contains(event.target));
        if (collection) openCollection(collection);
      }
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of ['click', 'auxclick', 'submit']) document.addEventListener(type, stopInteraction, true);
  document.addEventListener('keydown', stopInteraction, true);
  // Repeated fields share their array path. Explicit collection roots take
  // precedence; otherwise use the smallest common rendered container.
  const collectionEntries = new Map();
  for (const binding of mapped) {
    const index = binding.path.findIndex(part => typeof part === 'number');
    if (index < 1) continue;
    const key = binding.path.slice(0, index).join('.');
    if (!collectionEntries.has(key)) collectionEntries.set(key, []);
    collectionEntries.get(key).push(binding.element);
  }
  const collectionRoots = [];
  for (const [key, elements] of collectionEntries) {
    let root = [...document.querySelectorAll('[data-cms-collection]')].find(element => element.dataset.cmsCollection === key);
    if (!root) {
      root = elements[0];
      while (root?.parentElement && !elements.every(element => root.contains(element))) root = root.parentElement;
      if (!root || root === document.body || root === document.documentElement) continue;
    }
    const label = root.dataset.cmsCollectionLabel || key.split('.').at(-1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
    collectionRoots.push({ key, label, root });
  }
  // Include explicitly marked empty lists too.
  for (const root of document.querySelectorAll('[data-cms-collection]')) {
    const key = root.dataset.cmsCollection;
    if (!collectionRoots.some(collection => collection.key === key)) collectionRoots.push({ key, label: root.dataset.cmsCollectionLabel || key, root });
  }
  const collectionStyle = document.createElement('style');
  collectionStyle.textContent = '.cms-collection-frame{position:fixed;z-index:2147483000;pointer-events:none;border:2px solid #a970ff;box-sizing:border-box}.cms-collection-frame[hidden]{display:none!important}.cms-collection-tag{position:absolute;top:0;left:-2px;transform:translateY(-100%);pointer-events:auto;background:#8740df;color:#fff;border:0;border-radius:4px 4px 0 0;padding:5px 9px;font:500 13px/1.3 system-ui,sans-serif;letter-spacing:0;cursor:pointer;white-space:nowrap;text-transform:none}.cms-collection-tag:focus-visible{outline:2px solid #fff;outline-offset:2px}.cms-collection-frame.is-selected{border-color:#b48aff}';
  document.head.append(collectionStyle);
  let hoveredCollection = null, activeCollection = null;
  const frame = document.createElement('div');
  frame.className = 'cms-collection-frame'; frame.hidden = true;
  frame.dataset.cmsEditorUi = 'collection';
  const tag = document.createElement('button');
  tag.type = 'button'; tag.className = 'cms-collection-tag';
  frame.append(tag); document.body.append(frame);
  const drawCollectionFrame = () => {
    const collection = hoveredCollection || activeCollection;
    if (!collection) { frame.hidden = true; return; }
    const rect = collection.root.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) { frame.hidden = true; return; }
    frame.hidden = false;
    Object.assign(frame.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    tag.textContent = '▤ ' + collection.label + ' · CMS';
    tag.setAttribute('aria-label', 'Open ' + collection.label + ' collection');
    // Keep the collection handle accessible when the list begins above the viewport.
    tag.style.top = Math.max(0, 30 - rect.top) + 'px';
    frame.classList.toggle('is-selected', activeCollection?.key === collection.key);
  };
  const openCollection = collection => {
    if (!collection) return;
    activeCollection = collection; hoveredCollection = null; drawCollectionFrame();
    parent.postMessage({ type: 'CMS_COLLECTION_FOCUS', key: collection.key }, parentOrigin);
  };
  tag.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openCollection(hoveredCollection || activeCollection); });
  document.addEventListener('pointerover', event => {
    if (event.target.closest?.('[data-cms-editor-ui]')) return;
    if (!blockClicks) { hoveredCollection = null; drawCollectionFrame(); return; }
    const candidates = collectionRoots.filter(collection => collection.root.contains(event.target));
    hoveredCollection = candidates.sort((a, b) => a.root.contains(b.root) ? 1 : -1)[0] || null;
    drawCollectionFrame();
  });
  document.addEventListener('pointerleave', () => { hoveredCollection = null; drawCollectionFrame(); });
  addEventListener('scroll', drawCollectionFrame, { passive: true });
  addEventListener('resize', drawCollectionFrame);
  addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== parent || event.data?.type !== 'CMS_SELECT_COLLECTION') return;
    activeCollection = collectionRoots.find(collection => collection.key === event.data.key) || null;
    hoveredCollection = null; drawCollectionFrame();
  });

  let lastActiveSection = null;
  let scrollFrame = 0;
  let requestedSection = null;
  let requestedUntil = 0;
  const reportActiveSection = () => {
    scrollFrame = 0;
    if (requestedSection && performance.now() < requestedUntil) return;
    requestedSection = null;
    const line = Math.min(innerHeight * .25, 220);
    const scroller = document.scrollingElement || document.documentElement;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    // A short footer cannot always reach the usual activation line. Give the
    // final section its own end-of-page trigger, excluding it from earlier ones.
    const candidates = roots.length > 1 ? roots.slice(0, -1) : roots;
    let index = atBottom && roots.length ? roots.length - 1 : candidates.findIndex(root => {
      const rect = root.getBoundingClientRect(); return rect.top <= line && rect.bottom > line;
    });
    if (index < 0 && candidates.length) index = candidates.reduce((best, root, candidate) => Math.abs(root.getBoundingClientRect().top - line) < Math.abs(candidates[best].getBoundingClientRect().top - line) ? candidate : best, 0);
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
        if (index === roots.length - 1) {
          const scroller = document.scrollingElement || document.documentElement;
          window.scrollTo({ top: Math.max(0, scroller.scrollHeight - scroller.clientHeight), behavior: 'smooth' });
        } else roots[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
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
