/* Page-backed collections share the site editor, authentication and preview pane. */
window.CMSWorkspace = function ({ S, h, $, toast, cmsTabs, renameHeading, editorLabel, recordChange, changed, updateHistoryButtons, baseStatus, recordEntryChange, api, refreshPages, backButton, valueControl, openMediaPicker, saveRootDraft, resolveConst }) {
  const titles = { posts: 'Blog articles', projects: 'Portfolio' };
  const state = { collection: null, entries: null, fields: null, entry: null, saved: null, revision: null, published: null, busy: false, loading: false, error: null, undo: [], redo: [] };
  const clone = value => structuredClone(value);
  const selected = () => S.mode === 'cms' && Boolean(state.collection);
  const active = () => selected() && Boolean(state.entry);
  const dirty = () => active() && JSON.stringify(state.entry) !== JSON.stringify(state.saved);
  const name = () => editorLabel('pageCollection:' + state.collection, titles[state.collection]);
  const get = (path) => path.split('.').reduce((value, key) => value?.[key], state.entry);
  function write(path, value) {
    if (get(path) === value) return;
    recordEntryChange(`entry:${state.collection}:${state.entry.id}:${path}`, { kind: 'entry-content', collection: state.collection, id: state.entry.id, content: clone(state.entry) });
    const keys = path.split('.'); let target = state.entry;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    target[keys.at(-1)] = value;
    updateHistory(); status();
  }
  async function request(op, params = {}, body) {
    const response = await fetch('/api/cms?' + new URLSearchParams({ op, ...params }), body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.details?.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') || result.message || `Request failed: ${response.status}`);
    return result;
  }
  const pending = () => Boolean(state.entry && (JSON.stringify(state.entry) !== JSON.stringify(state.saved) || state.revision && JSON.stringify(state.entry) !== JSON.stringify(state.published)));
  function status() { baseStatus(); }
  function updateHistory() { updateHistoryButtons(); }
  async function flush() {
    if (state.busy) throw new Error('Wait for the current CMS operation to finish.');
    if (state.entry && JSON.stringify(state.entry) !== JSON.stringify(state.saved)) await save();
  }
  async function applyProjectHistory(snapshot) {
    if (state.busy) throw new Error('Wait for the current CMS operation to finish.');
    const same = state.collection === snapshot.collection && (state.entry?.id === snapshot.id || !state.entry && selected());
    let entry;
    try { entry = await request('entry', { collection: snapshot.collection, id: snapshot.id }); }
    catch(error) { if (!/not found/i.test(error.message)) throw error; entry = { draft: null, published: null }; }
    const current = state.collection === snapshot.collection && state.entry?.id === snapshot.id ? clone(state.entry) : clone(entry.draft?.data || entry.published || null);
    const inverse = { ...snapshot, content: current };
    if (snapshot.content === null) {
      if (entry.draft) await request('discard-draft', { collection: snapshot.collection }, { id: snapshot.id, expectedDraftRevision: entry.draft.revision });
      if (same) { state.entry = null; state.saved = null; state.revision = null; state.entries = null; }
    } else {
      const result = await request('save-draft', { collection: snapshot.collection }, { id: snapshot.id, data: snapshot.content, expectedDraftRevision: entry.draft?.revision || null });
      if (same) { state.entry = clone(result.draft.data); state.saved = clone(state.entry); state.revision = result.draft.revision; }
    }
    S.projectPending = (await api('project-status')).entryChanges > 0;
    state.entries = null; return inverse;
  }
  async function afterProjectPublish(result = {}) {
    if (state.entry?.id) {
      const published = result.entries?.find(entry=>entry.collection===state.collection && entry.id===state.entry.id)?.data;
      const entry = published ? {published} : await request('entry', { collection: state.collection, id: state.entry.id });
      state.entry = clone(entry.published); state.saved = clone(entry.published); state.published = clone(entry.published); state.revision = null;
    }
    state.entries = null;
    await refreshPages(result.pages);
    if (selected()) render();
  }
  async function save() {
    const result = await request('save-draft', { collection: state.collection }, {
      id: state.entry.id, data: state.entry, expectedDraftRevision: state.revision
    });
    state.entry = result.draft.data; state.saved = clone(state.entry); state.revision = result.draft.revision;
    S.projectPending = (await api('project-status')).entryChanges > 0;
    status(); return result;
  }
  async function leave() {
    if (state.busy) return false;
    if (dirty()) {
      try { state.busy = true; await save(); }
      catch (error) { toast('Draft was not saved: ' + error.message, true); return false; }
      finally { state.busy = false; }
    }
    state.collection = null; state.entry = null; state.entries = null;
    return true;
  }
  async function open(collection) {
    if (!await leave()) return;
    state.collection = collection; state.error = null; render();
  }
  function cards() {
    return Object.entries(titles).map(([key, title]) => h('button', { class: 'collection-card', type: 'button', onclick: () => open(key) },
      h('strong', null, editorLabel('pageCollection:' + key, title)), h('small', null, 'CMS Page · Open records →')));
  }
  function lockedMode() {
    const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'CMS Page', disabled: '' }); input.checked = true;
    return h('div', { class: 'cms-mode' }, h('label', null, h('span', null, 'CMS List'), input, h('span', null, 'CMS Page')),
      h('p', { class: 'hint' }, 'This collection creates pages. Its page mode is locked.'));
  }
  async function loadList() {
    if (state.loading) return;
    state.loading = true;
    const collection = state.collection;
    try {
      const [schema, list] = await Promise.all([state.fields ? Promise.resolve(null) : request('schema'), request('list', { collection })]);
      if (collection !== state.collection) return;
      if (schema) state.fields = schema.collections;
      state.entries = list.entries; state.error = null;
    } catch (error) { if (collection === state.collection) state.error = error.message; }
    finally { state.loading = false; if (selected()) render(); }
  }
  async function load(id) {
    if (state.busy) return;
    try {
      state.busy = true;
      const entry = await request('entry', { collection: state.collection, id });
      state.entry = clone(entry.draft?.data || entry.published);
      state.saved = clone(state.entry); state.revision = entry.draft?.revision || null; state.published = entry.published;
      state.undo = []; state.redo = [];
    } catch (error) { toast(error.message, true); }
    finally { state.busy = false; if (active()) render(); }
  }
  function create() {
    state.entry = state.collection === 'posts'
      ? { title: '', slug: '', excerpt: '', body: '', seo: { title: '', description: '' } }
      : { title: '', slug: '', summary: '', body: '', gallery: [], seo: { title: '', description: '' } };
    state.entry.id = crypto.randomUUID();
    recordEntryChange(`entry:create:${state.entry.id}`, { kind: 'entry-content', collection: state.collection, id: state.entry.id, content: null });
    state.saved = null; state.published = null; state.revision = null; state.undo = []; state.redo = []; render();
  }
  const pageUrl = () => `/${state.collection === 'posts' ? 'blog' : 'portfolio'}/${encodeURIComponent(state.entry.slug)}/`;
  async function previewDraft() {
    if (state.busy) return;
    try {
      state.busy = true; status(); await saveRootDraft(); await save();
      $('pvF').src = '/api/cms?' + new URLSearchParams({ op: 'preview', collection: state.collection, id: state.entry.id });
    } catch (error) { toast(error.message, true); }
    finally { state.busy = false; render(); }
  }
  function fieldControl(field) {
    const wrap = h('div', { class: 'auto-field' }, h('label', { class: 'cap' }, field.label));
    if (field.type === 'gallery') {
      const gallery = get('gallery') || [];
      gallery.forEach((image, index) => {
        const group=h('div',{class:'media-entry'},h('label',{class:'cap'},`Image ${index+1}`));
        if (image.src) group.append(h('img',{class:'media-preview',src:resolveConst(image.src),alt:''}));
        group.append(valueControl({source:'cmsEntry',key:`gallery.${index}.src`,mode:'src',label:`Image ${index+1} URL`}),
          h('label',{class:'cap'},'Image description'),valueControl({source:'cmsEntry',key:`gallery.${index}.alt`,mode:'alt',label:`Image ${index+1} alt text`}),
          h('button',{class:'btn sm ghost',type:'button',onclick:()=>openMediaPicker({source:'cmsEntry',key:`gallery.${index}.src`,mode:'src',mediaType:'image',label:`Image ${index+1}`})},'Replace image…'),
          h('button',{type:'button',class:'btn sm ghost',onclick:()=>{write('gallery',gallery.filter((_,i)=>i!==index));render();}},'Remove image'));
        wrap.append(group);
      });
      wrap.append(h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { write('gallery', [...gallery, { src: '', alt: '' }]); render(); } }, '+ Image'));
      return wrap;
    }
    let input;
    const item = { source: 'cmsEntry', key: field.key, mode: field.type === 'media' ? 'src' : 'text', mediaType: field.type === 'media' ? 'image' : undefined, label: field.label };
    if (['slug','datetime'].includes(field.type)) {
      input = h('input', { 'aria-label': field.label, type: field.type === 'datetime' ? 'datetime-local' : 'text' });
      input.value = field.type === 'datetime' ? (get(field.key) || '').slice(0,16) : get(field.key) || '';
      input.required = Boolean(field.required);
      input.oninput = () => write(field.key, field.type === 'datetime' && input.value ? new Date(input.value).toISOString() : input.value);
      if (field.type === 'slug') input.onblur = async () => {
        const { slugify } = await import('/cms/slug.mjs'); input.value = slugify(input.value); write(field.key,input.value);
      };
      wrap.append(input);
    } else wrap.append(valueControl(item, { multi: field.type === 'textarea', rows: field.key === 'body' ? 10 : 3 }));
    if (field.type === 'media') {
      const altKey = field.key.replace(/\.src$/, '.alt');
      wrap.append(h('label',{class:'cap'},'Image description'),valueControl({source:'cmsEntry',key:altKey,mode:'alt',label:'Cover alt text'}));
      wrap.append(h('button',{class:'btn sm ghost',type:'button',onclick:()=>openMediaPicker(item)},'Replace image…'));
      if (get(field.key)) wrap.prepend(h('img', { class: 'media-preview', src: S.media?.assets.find(asset => asset.url === resolveConst(get(field.key)))?.previewUrl || resolveConst(get(field.key)), alt: '' }));
      const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: '' });
      file.onchange = async () => {
        try {
          const selected = file.files[0]; if (!selected) return;
          if (selected.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller');
          const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(selected); });
          const result = await api('media-upload', { folder: S.media?.folders.includes('/assets/uploads') ? '/assets/uploads' : '/assets', filename: selected.name, base64 }); write(field.key, result.url); render();
        } catch (error) { toast(error.message, true); }
      };
      wrap.append(file, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => file.click() }, 'Upload image…'));
    }
    return wrap;
  }
  function render() {
    if (!selected()) return;
    const heading = h('div', { class: 'sec-h' }, renameHeading(name(), 'pageCollection:' + state.collection, render));
    if (!state.entry) {
      const back = backButton('All pages', async () => { if (await leave()) { S.collectionKey = null; S.collectionItem = null; $('modeCms').click(); } });
      if (!state.entries) {
        $('ed').replaceChildren(back, heading, lockedMode(), h('p', { class: 'hint' }, state.error || 'Loading records…'), state.error ? h('button', { class: 'btn ghost', onclick: () => { state.error = null; loadList(); } }, 'Retry') : null);
        if (!state.error) loadList(); return;
      }
      const search = h('input', { type: 'search', class: 'cms-entry-search', placeholder: 'Search records…', 'aria-label': 'Search records' });
      const list = h('div', { class: 'record-list' });
      const draw = () => {
        list.replaceChildren(...state.entries.filter(entry => (entry.title || '').toLowerCase().includes(search.value.toLowerCase())).map(entry =>
          h('div', { class: 'record-card' }, h('button', { class: 'record-open', type: 'button', onclick: () => load(entry.id) },
            h('strong', null, resolveConst(entry.title) || 'Untitled'), h('small', null, entry.draft ? 'Draft' : 'Published'), h('span', null, '›')))));
        if (!list.childElementCount) list.append(h('p', { class: 'hint' }, 'No records found.'));
      };
      search.oninput = draw; draw();
      $('ed').replaceChildren(back, heading, lockedMode(), h('button', { class: 'btn sm accent', type: 'button', onclick: create }, '+ New entry'), search, list);
      status(); updateHistory();
      return;
    }
    const back = backButton(name(), async () => {
      if (state.busy) return;
      try { state.busy = true; if (dirty()) await save(); state.entry = null; state.entries = null; }
      catch (error) { toast(error.message, true); }
      finally { state.busy = false; render(); updateHistoryButtons(); }
    });
    const title = h('h1', { class: 'rename-title', tabindex: '0', title: 'Double-click to edit title' }, resolveConst(state.entry.title) || 'New entry');
    const editTitle = () => { const input = $('ed').querySelector('[aria-label="Title"], [aria-label="Project name"]'); input?.focus(); if (input?.select) input.select(); else if (input) { const range=document.createRange();range.selectNodeContents(input);const selection=getSelection();selection.removeAllRanges();selection.addRange(range); } };
    title.ondblclick = editTitle; title.onkeydown = event => { if (event.key === 'Enter') editTitle(); };
    const actions = h('div', { class: 'cms-actions' },
      h('button', { class: 'btn ghost', type: 'button', ...(state.busy ? { disabled: '' } : {}), onclick: async () => {
        if (state.busy) return;
        try { state.busy = true; status(); await saveRootDraft(); await save(); toast('Draft saved'); } catch (error) { toast(error.message, true); } finally { state.busy = false; render(); }
      } }, 'Save draft'),
      h('button', { class: 'btn ghost', type: 'button', onclick: previewDraft }, 'Preview draft'));
    $('ed').replaceChildren(back, h('div', { class: 'sec-h' }, title),
      h('p', { class: 'inspector-eyebrow' }, 'CMS PAGE · ' + name()),
      ...(state.fields?.[state.collection] || []).filter(field=>!field.key.endsWith('.alt') || !(state.fields[state.collection].some(other=>other.type==='media' && other.key===field.key.replace(/\.alt$/,'.src')))).map(fieldControl), actions);
    updateHistory(); status();
  }
  addEventListener('beforeunload', event => { if (dirty() || state.busy) { event.preventDefault(); event.returnValue = ''; } });
  return { get, write, active, selected, cards, render, leave, flush, pending, applyProjectHistory, afterProjectPublish, status };
};
