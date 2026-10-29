/* Page-backed collections share the site editor, authentication and preview pane. */
window.CMSWorkspace = function ({ duplicateAction, onDuplicate, S, h, $, toast, cmsTabs, renameHeading, editorLabel, recordChange, changed, updateHistoryButtons, baseStatus, recordEntryChange, api, refreshPages, backButton, valueControl, openMediaPicker, compactSearch, loading, pageBreadcrumbs, onListChange, onItemAction, renderProperties, saveRootDraft, documentText, resolveConst, onViewChange, pageURLLink, itemHeader, publishedToggle, activeStatusField, dateControl, slugify, uniqueSlug }) {
  const titles = { posts: 'Blog articles', projects: 'Portfolio' };
  const state = { collection: null, entries: null, fields: null, entry: null, saved: null, revision: null, published: null, busy: false, preview: false, loading: false, error: null, undo: [], redo: [] };
  const clone = value => structuredClone(value);
  let saveTimer=0,saveQueue=Promise.resolve();
  const pendingNormalizations=new Set();
  const scheduleSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(state.entry && dirty())save().catch(error=>toast('Draft was not saved: '+error.message,true));},600);};
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
    if(path==='title'&&state.entry.slugMode!=='manual'){
      state.entry.slugMode='auto';const used=new Set((state.entries||[]).filter(item=>item.id!==state.entry.id).flatMap(item=>item.slugs||[item.slug]));state.entry.slug=uniqueSlug(value,used);syncSlug();
    }
    if(path==='isPublished'){const toggle=$('ed').querySelector('.cms-published-switch');if(toggle)toggle.checked=value;}
    updateHistory(); status();onListChange?.();scheduleSave();
  }
  function syncSlug(){
    const input=$('ed').querySelector('[data-cms-slug]');if(input&&document.activeElement!==input)input.value=state.entry?.slug||'';
    const container=$('ed').querySelector('.slug-page-url');if(container)container.replaceChildren(...(state.entry?.slug?[pageURLLink(pageUrl())]:[]));
  }
  async function closeItem(){
    if(state.busy)return;
    try{await flush();state.entry=null;state.saved=null;state.published=null;state.revision=null;state.entries=null;render();}catch(error){toast(error.message,true);}
  }
  function writeRich(key,document){
    recordEntryChange(`entry:rich:${state.collection}:${state.entry.id}:${key}`,{kind:'entry-content',collection:state.collection,id:state.entry.id,content:clone(state.entry)});
    const text=documentText(document);
    const parts=key.split('.');let target=state.entry;for(const part of parts.slice(0,-1))target=target[part] ||= {};target[parts.at(-1)]=text;
    (state.entry.richText ||= {})[key]=document;updateHistory();status();onListChange?.();scheduleSave();
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
    while(pendingNormalizations.size)await Promise.all([...pendingNormalizations]);
    clearTimeout(saveTimer);await saveQueue;
    if (state.busy) throw new Error('Wait for the current CMS operation to finish.');
    if (state.entry && JSON.stringify(state.entry) !== JSON.stringify(state.saved)) await save();
    clearTimeout(saveTimer);
  }
  async function applyProjectHistory(snapshot) {
    clearTimeout(saveTimer);await saveQueue;
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
    if(state.entry?.id && result.entries?.some(entry=>entry.collection===state.collection && entry.id===state.entry.id && entry.data===null)){state.entry=null;state.saved=null;state.published=null;state.revision=null;}
    if (state.entry?.id) {
      const published = result.entries?.find(entry=>entry.collection===state.collection && entry.id===state.entry.id)?.data;
      const entry = published ? {published} : await request('entry', { collection: state.collection, id: state.entry.id });
      state.entry = clone(entry.published); state.saved = clone(entry.published); state.published = clone(entry.published); state.revision = null;
    }
    state.entries = null;
    await refreshPages(result.pages);
    if (selected()) render();
  }
  function save() {
    const collection=state.collection,id=state.entry?.id;
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      if(!state.entry || state.collection!==collection || state.entry.id!==id || !dirty())return;
      const data=clone(state.entry),result=await request('save-draft',{collection},{id,data,expectedDraftRevision:state.revision});
      if(state.collection===collection && state.entry?.id===id){if(state.entry.title===data.title&&state.entry.slug===data.slug){state.entry.slug=result.draft.data.slug;syncSlug();}state.saved=clone(result.draft.data);state.revision=result.draft.revision;if(dirty())scheduleSave();}
      S.projectPending=(await api('project-status')).entryChanges>0;status();return result;
    });return saveQueue;
  }
  async function leave() {
    clearTimeout(saveTimer);try{await saveQueue;}catch(error){toast(error.message,true);return false;}
    if (state.busy) return false;
    if (dirty()) {
      try { state.busy = true; await save(); }
      catch (error) { toast('Draft was not saved: ' + error.message, true); return false; }
      finally { state.busy = false; }
    }
    state.collection = null; state.entry = null; state.entries = null; state.preview = false;
    return true;
  }
  async function open(collection) {
    if (!await leave()) return;
    state.collection = collection; state.error = null;S.collectionKey=null; render();
  }
  function catalog() { return Object.entries(titles).map(([key,title])=>({key:'page:'+key,label:editorLabel('pageCollection:'+key,title),onOpen:()=>open(key)})); }
  function cards() {
    return Object.entries(titles).map(([key, title]) => h('button', { class: 'collection-card', type: 'button', onclick: () => open(key) },
      h('strong', null, editorLabel('pageCollection:' + key, title)), h('small', null, 'CMS Page')));
  }
  function lockedMode() { return h('span',{class:'ui-badge ui-badge--cms'},'CMS Page'); }
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
      state.busy=true;clearTimeout(saveTimer);await saveQueue;if(dirty())await save();
      state.preview = false;
      const entry = await request('entry', { collection: state.collection, id });
      state.entry = clone(entry.draft?.data || entry.published);
      state.saved = clone(state.entry); state.revision = entry.draft?.revision || null; state.published = entry.published;
      state.undo = []; state.redo = [];
    } catch (error) { toast(error.message, true); }
    finally { state.busy = false; if (active()) render(); }
  }
  async function restore(collection,id){
    if(!await leave())return;state.collection=collection;state.error=null;state.entries=null;await loadList();
    if(id)await load(id);
  }
  async function create() {
    if(state.busy)return;clearTimeout(saveTimer);
    try{state.busy=true;await saveQueue;if(dirty())await save();}catch(error){toast(error.message,true);return;}finally{state.busy=false;}
    state.preview = false;
    state.entry = state.collection === 'posts'
      ? { title: '', slug: '', excerpt: '', body: '', seo: { title: '', description: '' } }
      : { title: '', slug: '', summary: '', body: '', gallery: [], seo: { title: '', description: '' } };
    state.entry.id = crypto.randomUUID();state.entry.slugMode='auto';state.entry.isPublished=true;
    recordEntryChange(`entry:create:${state.entry.id}`, { kind: 'entry-content', collection: state.collection, id: state.entry.id, content: null });
    state.saved = null; state.published = null; state.revision = null; state.undo = []; state.redo = []; render();
  }
  async function duplicate(name){
    if(state.busy||!state.entry)throw new Error('Wait for the item to finish saving');
    clearTimeout(saveTimer);await saveQueue;if(dirty())await save();
    const previous={entry:state.entry,saved:state.saved,published:state.published,revision:state.revision};
    const copy=clone(state.entry);copy.id=crypto.randomUUID();copy.title=name;copy.slug=uniqueSlug(name,new Set((state.entries||[]).flatMap(item=>item.slugs||[item.slug])));copy.slugMode='auto';copy.isPublished=true;delete copy.cmsState;
    state.entry=copy;state.saved=null;state.published=null;state.revision=null;
    try{await save();recordEntryChange(`entry:duplicate:${copy.id}`,{kind:'entry-content',collection:state.collection,id:copy.id,content:null});state.entries=null;render();}
    catch(error){Object.assign(state,previous);throw error;}
  }
  const pageUrl = () => `/${state.collection === 'posts' ? 'blog' : 'portfolio'}/${encodeURIComponent(state.entry.slug)}/`;
  async function previewDraft() {
    if (state.busy) return;
    try {
      state.busy = true; status(); await saveRootDraft(); await save();
      state.preview = true;
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
      if(field.type==='datetime'){wrap.append(dateControl({value:get(field.key)||'',withTime:true,label:field.label,required:field.required,onChange:value=>write(field.key,value)}));return wrap;}
      input = h('input', { 'aria-label': field.label, type: field.type === 'datetime' ? 'datetime-local' : 'text' });
      input.value = field.type === 'datetime' ? (get(field.key) || '').slice(0,16) : get(field.key) || '';
      input.required = Boolean(field.required);if(field.type==='slug'){input.dataset.cmsSlug='true';input.maxLength=120;}
      const pageLink=h('div',{class:'slug-page-url'}),slugError=h('p',{class:'field-error',hidden:true,role:'status'});
      const validateSlug=()=>{
        if(field.type!=='slug')return;
        const normalized=slugify(input.value),used=new Set((state.entries||[]).filter(item=>item.id!==state.entry.id).flatMap(item=>item.slugs||[item.slug]));
        const message=!normalized?'Enter a title or URL':used.has(normalized)?'This URL is already used in this collection':'';
        input.setCustomValidity(message);input.setAttribute('aria-invalid',String(Boolean(message)));slugError.hidden=!message;slugError.textContent=message;
      };
      const updatePageLink=()=>{if(field.type!=='slug')return;pageLink.replaceChildren(...(state.entry.slug?[pageURLLink(pageUrl())]:[]));};
      input.oninput = () => {if(field.type==='slug')write('slugMode','manual');write(field.key, field.type === 'datetime' && input.value ? new Date(input.value).toISOString() : input.value);updatePageLink();validateSlug();};
      if(field.type==='slug')input.onblur=()=>{
        const id=state.entry?.id,value=input.value;
        const task=import('/cms/slug.mjs').then(({slugify})=>{
          if(state.entry?.id!==id || input.value!==value)return;
          input.value=slugify(value);write(field.key,input.value);updatePageLink();validateSlug();
        });
        pendingNormalizations.add(task);
        task.then(()=>pendingNormalizations.delete(task),error=>{pendingNormalizations.delete(task);toast('Could not normalize URL: '+error.message,true);});
      };
      wrap.append(input);if(field.type==='slug'){updatePageLink();wrap.append(slugError,pageLink);}
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
    pageBreadcrumbs(name(),state.entry?resolveConst(state.entry.title) || 'Untitled':null,async()=>{if(!state.entry || state.busy)return;try{state.busy=true;if(dirty())await save();state.entry=null;state.entries=null;}catch(error){toast(error.message,true);}finally{state.busy=false;render();updateHistoryButtons();}},()=>{});
    onViewChange(state.entry?(state.preview?'cms-record':'cms-page'):'cms-list');
    const heading = h('div', { class: 'sec-h' }, renameHeading(name(), 'pageCollection:' + state.collection, render));
    if (!state.entry) {
      const back = backButton('All pages', async () => { if (await leave()) { S.collectionKey = null; S.collectionItem = null; $('modeCms').click(); } });
      if (!state.entries) {
        $('ed').replaceChildren(back, heading, lockedMode(), state.error?h('p',{class:'hint'},state.error):loading('Loading records…'), state.error ? h('button', { class: 'btn ghost', onclick: () => { state.error = null; loadList(); } }, 'Retry') : null);
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
      $('ed').replaceChildren(back, heading, lockedMode(), h('button', { class: 'btn sm accent', type: 'button', onclick: create }, '+ New entry'), compactSearch(search), list);
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
    $('ed').replaceChildren(itemHeader(title,closeItem,duplicateAction(onDuplicate)),activeStatusField((S.c.editorSettings?.entryStates?.[state.collection+':'+state.entry.id]?.state || (state.entry.cmsState==='archived'||state.entry.isPublished===false?'archived':'active'))==='active',value=>onItemAction(value?'restore':'archive',state.entry.id)),
      renderProperties({collection:state.collection,item:state.entry,fields:state.fields?.[state.collection] || [],write,writeRich,renderText:(field,full)=>full?fieldControl(field):valueControl({source:'cmsEntry',key:field.key,mode:field.type==='url'?'href':'text',label:field.label},{multi:field.type==='textarea'})}),h('div',{class:'cms-item-footer'},h('button',{type:'button',class:'btn sm bad',onclick:()=>onItemAction('delete',state.entry.id)},'Delete item')));
    updateHistory(); status();
  }
  addEventListener('beforeunload', event => { if (dirty() || state.busy) { event.preventDefault(); event.returnValue = ''; } });
  return { duplicate,restore,closeItem,snapshot:()=>({...state,label:state.collection?name():''}),read:id=>request('entry',{collection:state.collection,id}),clearEntry:()=>{clearTimeout(saveTimer);state.entry=null;state.saved=null;state.published=null;state.revision=null;},open,load,create,get, write, active, selected, cards, catalog, render, leave, flush, pending, applyProjectHistory, afterProjectPublish, status };
};
