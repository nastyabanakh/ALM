export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(child) : child);
  }
  return el;
}
export const icon = name => h('span', {class:'ui-icon','aria-hidden':'true',style:`--icon:url('/admin/icons/${name}.svg')`});
export const badge = (text, kind='neutral') => h('span',{class:`ui-badge ui-badge--${kind}`},text);
export const button = (text, {variant='secondary', size='', icon:iconName, ...attrs}={}) => h('button',{type:'button',class:`btn ${variant==='primary'?'accent':variant==='danger'?'bad':variant==='ghost'?'quiet':'ghost'} ${size==='small'?'sm':''}`,...attrs},iconName?icon(iconName):null,text);
export const duplicateAction = onClick => h('button',{type:'button',class:'icon-btn','aria-label':'Duplicate item',title:'Duplicate item',onclick:onClick},icon('copy'));
export function disclosure(title, content, {open=false, note=''}={}) {
  const el=h('details',{class:'ui-disclosure'},h('summary',null,h('span',null,title),note?badge(note):null,icon('chevron-down')),h('div',{class:'ui-disclosure-body'},content));
  el.open=open; return el;
}
export const emptyState = (title, description='', action=null, iconName='files') => h('div',{class:'ui-empty'},h('span',{class:'ui-empty-icon'},icon(iconName)),h('strong',null,title),description?h('p',null,description):null,action);
export const componentIcon = () => h('span',{class:'component-icon','aria-hidden':'true'},...Array.from({length:4},()=>h('i')));
export function elementCard({label, value, type='text', thumbnail, selected=false, onClick=()=>{}}) {
  return h('button',{type:'button',class:`element-card${selected?' on':''}`,'data-kind':type,onclick:onClick},
    thumbnail?h('img',{src:thumbnail,alt:''}):type==='component'?componentIcon():h('span',{class:'element-symbol'},icon(type==='link'?'link':type==='const'?'variable':type==='cms'?'database':type==='cms-item'?'file-text':type==='image'?'image':'type')),
    h('span',{class:'element-copy'},h('small',null,label),h('strong',null,value)),icon('chevron-right'));
}
export const navItems=[['modeAdmin','panels-top-left','Editor','Page editor'],['modeCms','database','CMS','CMS collections'],['modeMedia','images','Media','Media library'],['modeConst','variable','Const','Const'],['modeSettings','settings-2','Settings','Page settings']];
export function sidebar({active='modeAdmin',kit=false}={}) {
  const aside=h('aside',{class:'mode-rail','aria-label':'Workspace navigation'},h('a',{class:'rail-logo',href:kit?'/admin/':'#','aria-label':'ALM workspace',title:'ALM workspace'},'A'),
    h('button',{id:'quickFind',class:'rail-search',type:'button',title:'Quick find (⌘K / Ctrl+K)','aria-label':'Quick find'},icon('search'),h('span',{class:'rail-label'},'Find')),
    h('div',{class:'rail-divider'}),
    ...navItems.map(([id,name,label,title])=>h(kit?'a':'button',{...(kit?{href:`/admin/${id==='modeAdmin'?'':'#'+({modeCms:'cms',modeMedia:'media',modeConst:'const',modeSettings:'settings'}[id]||'')}`}:{id,type:'button'}),class:active===id?'on':'',title,'aria-label':title,...(active===id?{'aria-current':'page'}:{})},icon(name),h('span',{class:'rail-label'},label))),
    h('div',{class:'rail-bottom'},h('a',{class:kit?'on':'',href:'/admin/ui-kit.html',...(kit?{}:{target:'_blank',rel:'noopener'}),title:'UI Kit','aria-label':'UI Kit'},icon('swatch-book'),h('span',{class:'rail-label'},'UI Kit')),
    h(kit?'a':'button',{...(kit?{href:'/admin/'}:{id:'bOut',type:'button'}),class:'rail-logout',title:kit?'Back to editor':'Log out','aria-label':kit?'Back to editor':'Log out'},icon(kit?'arrow-left':'log-out'),h('span',{class:'rail-label'},kit?'Editor':'Log out'))));
  return aside;
}
export function createToast(element) {
  let timer;
  return (message, error=false) => {
    clearTimeout(timer); element.classList.toggle('bad',error); element.textContent=message; element.hidden=false;
    timer=setTimeout(()=>element.hidden=true,3500);
  };
}
export function createModalController({overlay,content,background=[],isBusy=()=>false}) {
  let opener=null;
  const close=()=>{
    if(isBusy())return;
    overlay.hidden=true; for(const node of background)node.inert=false;
    content.replaceChildren(); if(opener?.isConnected)opener.focus(); opener=null;
  };
  overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
  document.addEventListener('keydown',event=>{
    if(overlay.hidden)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=[...content.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=file]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"],[contenteditable="true"]')].filter(node=>node.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();content.focus();}
    else if(event.shiftKey&&(document.activeElement===first||!content.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!content.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  return {close,open(node){
    if(overlay.hidden)opener=document.activeElement;
    content.style.width=''; content.replaceChildren(node);
    content.setAttribute('role','dialog');content.setAttribute('aria-modal','true');content.tabIndex=-1;
    const title=content.querySelector('h2,h1');
    content.removeAttribute('aria-label');content.removeAttribute('aria-labelledby');
    if(title){title.id='modal-title';content.setAttribute('aria-labelledby',title.id);}else content.setAttribute('aria-label','Editor dialog');
    overlay.hidden=false;for(const node of background)node.inert=true;
    (content.querySelector('input:not([type=file]),textarea,select,button:not([disabled])')||content).focus();
  }};
}

export function quickFind({open,close,items}) {
  const input=h('input',{type:'search',placeholder:'Find a view or section…','aria-label':'Find a view or section',autocomplete:'off'});
  const list=h('div',{class:'command-results'});let index=0,filtered=[];
  const choose=item=>{close();item.run();};
  const draw=()=>{filtered=items.filter(item=>item.label.toLowerCase().includes(input.value.toLowerCase()));index=Math.min(index,Math.max(0,filtered.length-1));list.replaceChildren(...filtered.map((item,i)=>h('button',{type:'button',class:'command-result','aria-selected':String(i===index),onclick:()=>choose(item)},icon(item.icon||'arrow-up-right'),h('strong',null,item.label),h('small',null,item.group||''))));if(!filtered.length)list.append(emptyState('No results','Try a different name.',null,'search'));};
  input.oninput=()=>{index=0;draw();};
  input.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();index=(index+(event.key==='ArrowDown'?1:-1)+filtered.length)%Math.max(1,filtered.length);draw();list.children[index]?.scrollIntoView({block:'nearest'});}if(event.key==='Enter'&&filtered[index]){event.preventDefault();choose(filtered[index]);}};
  draw();open(h('div',{class:'command-palette'},h('h2',{class:'sr-only'},'Quick find'),h('div',{class:'command-search'},icon('search'),input,h('kbd',null,'Esc')),list,h('div',{class:'command-footer'},h('span',null,'↑ ↓ Navigate'),h('span',null,'↵ Open'))));input.focus();
}

export function breadcrumbs(items) {
  return h('nav', {class:'editor-breadcrumbs', 'aria-label':'Editor structure'},
    ...items.flatMap((item, index) => [index ? icon('chevron-right') : null,
      h('button', {type:'button', 'data-kind':item.kind || 'text', ...(index === items.length - 1 ? {'aria-current':'location'} : {}), onclick:item.onClick},
        item.kind === 'component' ? componentIcon() : icon(({cms:'database','cms-item':'file-text',const:'variable',link:'link',image:'image'})[item.kind] || 'type'), item.label)]));
}

export const backAction = (label, onClick) => h('button',{type:'button',class:'btn quiet sm inspector-back',onclick:onClick},icon('arrow-left'),h('span',null,label));
export const groupFooter = onClick => h('div',{class:'group-add'},button('New group',{variant:'ghost',size:'small',icon:'plus',onclick:onClick}));

export function compactSearch(input) {
  const toggle=h('button',{type:'button',class:'icon-btn','aria-label':input.getAttribute('aria-label') || 'Search','aria-expanded':'false'},icon('search'));
  const wrap=h('div',{class:'compact-search'},toggle,input);
  input.hidden=!input.value;toggle.setAttribute('aria-expanded',String(!input.hidden));
  const close=()=>{if(input.value)return;input.hidden=true;toggle.setAttribute('aria-expanded','false');};
  toggle.onclick=()=>{input.hidden=false;toggle.setAttribute('aria-expanded','true');input.focus();};
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));close();toggle.focus();}});
  input.addEventListener('blur',close);return wrap;
}
export const loadingSquares = () => h('span',{class:'ui-loading-squares','aria-hidden':'true'},...Array.from({length:5},()=>h('i',{class:'ui-loading-square'})));
export const loading = (label='Loading…') => h('div',{class:'ui-loading',role:'status','aria-label':label},loadingSquares());
export function targetToggle(value,onChange) {
  return h('div',{class:'seg target-toggle','aria-label':'Open link in'},...[[ '_self','This tab'],['_blank','New tab']].map(([key,label])=>h('button',{type:'button',class:value===key?'on':'','aria-pressed':String(value===key),onclick:()=>onChange(key)},label)));
}
export function folderTree({paths,selected,onSelect,onRename=()=>{},onContextMenu=()=>{},collapsed=new Set()}) {
  const tree=h('div',{class:'folder-tree'});
  function node(path){
    const children=paths.filter(child=>child!==path && child.slice(0,child.lastIndexOf('/'))===path).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const row=h('div',{class:'folder-tree-row'});
    let selectTimer=0;
    const button=h('button',{type:'button',class:'folder-link'+(selected===path?' on':''),onclick:()=>{clearTimeout(selectTimer);selectTimer=setTimeout(()=>onSelect(path),230);},ondblclick:event=>{event.preventDefault();clearTimeout(selectTimer);onRename(path,button);},oncontextmenu:event=>onContextMenu(event,path,button),onkeydown:event=>{if(event.key==='F2'){event.preventDefault();onRename(path,button);}}},icon('folder'),path==='/assets'?'All media':path.split('/').at(-1));
    const branch=h('div',{class:'folder-tree-children'},...children.map(node));branch.hidden=collapsed.has(path);
    const toggle=children.length?h('button',{type:'button',class:'icon-btn folder-tree-toggle','aria-label':'Toggle '+(path==='/assets'?'All media':path.split('/').at(-1)),'aria-expanded':String(!branch.hidden),onclick:()=>{branch.hidden=!branch.hidden;toggle.setAttribute('aria-expanded',String(!branch.hidden));if(branch.hidden)collapsed.add(path);else collapsed.delete(path);}},icon('chevron-right')):h('span',{class:'folder-tree-spacer'});
    row.append(toggle,button);return h('div',{class:'folder-tree-node'},row,children.length?branch:null);
  }
  tree.append(node('/assets'));return tree;
}

export function openGroupDialog({group=null,open,close,onSave,onDelete}) {
  const name=h('input',{type:'text',value:group?.name || '',placeholder:'Group name','aria-label':'Group name',maxlength:80});
  const actions=h('div',{class:'mod-f mod-f--split'},
    group?button('Delete',{variant:'danger',onclick:()=>{
      open(h('div',null,h('h2',null,'Delete group?'),h('p',{class:'hint'},`Delete “${group.name}”? Items will move to Ungrouped.`),
        h('div',{class:'mod-f confirmation-actions'},button('Cancel',{variant:'ghost',onclick:close}),button('Delete',{variant:'danger',onclick:()=>{onDelete();close();}}))));
    }}):null,
    button('Save',{variant:'primary',class:'btn accent group-save',onclick:()=>{if(!name.value.trim())return name.focus();onSave(name.value.trim());close();}}));
  open(h('div',null,h('h2',null,group?'Edit group':'New group'),name,actions));name.focus();
}

export const pageURLLink = url => h('a',{class:'slug-page-link',href:url,target:'_blank',rel:'noopener noreferrer','aria-label':'Open page: '+url},h('span',null,url),icon('arrow-up-right'));

export function publishedToggle(value,onChange,{label='Active',disabled=false,showLabel=true,publicationHint=true}={}) {
  let checked=Boolean(value);const copy=h('span',null,label==='Archive'?'Inactive':label),control=h('button',{type:'button',class:'cms-switch',role:'switch','aria-label':['Active','Archive','Inactive'].includes(label)?'Active':label,'aria-checked':String(checked),disabled},h('span',{class:'cms-switch-thumb','aria-hidden':'true'}));
  control.onclick=()=>{checked=!checked;control.setAttribute('aria-checked',String(checked));if(['Active','Archive','Inactive'].includes(label))copy.textContent=checked?'Active':'Inactive';onChange(checked);};
  return h('span',{class:'published-toggle',...(publicationHint?{title:'Applied with Publish'}:{})},control,showLabel?copy:null);
}
export const itemHeader = (title,onClose,...actions) => h('div',{class:'sec-h cms-item-heading'},typeof title==='string'?h('h1',null,title):title,h('div',{class:'cms-item-heading-actions'},...actions,onClose?h('button',{type:'button',class:'icon-btn cms-item-close','aria-label':'Close item',title:'Close item',onclick:onClose},'×'):null));

export const activeStatusField = (active,onChange) => h('div',{class:'cms-status-field'},publishedToggle(active,onChange,{label:active?'Active':'Inactive'}));


export function constPickerList(entries,{current,onChoose}={}){
  return h('div',{class:'const-list const-insert-list'},...entries.map(entry=>h('button',{type:'button',class:entry.key===current?'on':'',onclick:()=>onChoose(entry.key)},icon('variable'),h('span',{class:'const-insert-copy'},h('strong',null,entry.label),h('span',{class:'const-insert-value',title:entry.value||'Empty'},entry.value||'Empty')),Number.isFinite(entry.uses)?h('small',{class:'const-insert-uses'},`${entry.uses} uses`):null)));
}


export function duplicateDialog({onConfirm,onClose}){
  const name=h('input',{type:'text',required:true,maxlength:'120',placeholder:'New item name','aria-label':'Name',autofocus:''}),submit=button('Duplicate',{variant:'primary',type:'submit'});
  const form=h('form',null,h('h2',null,'Duplicate item'),h('label',{class:'auto-field'},h('span',{class:'cap'},'Name'),name),h('div',{class:'mod-f'},button('Cancel',{variant:'ghost',onclick:onClose}),submit));
  form.onsubmit=async event=>{event.preventDefault();name.setCustomValidity(name.value.trim()?'':'Enter a name');if(!name.reportValidity())return;submit.disabled=true;try{await onConfirm(name.value.trim());onClose();}catch(error){name.setCustomValidity(error.message);name.reportValidity();}finally{submit.disabled=false;}};name.oninput=()=>name.setCustomValidity('');queueMicrotask(()=>name.focus());return form;
}
