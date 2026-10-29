import {h,icon,button,targetToggle} from './ui-components.mjs';
import {imageEditor} from './media-editor.mjs';
import {startSortable} from './sortable.mjs';
import {asDocument,blockTypes,blockText,safeURL,markdownRuns,markdownShortcut,parseMarkdown} from './rich-text-model.mjs';

const selectionEditors=new Set();
let selectionPointerDown=false;
function updateSelectionEditors(event){for(const editor of selectionEditors){if(!editor.root.isConnected){editor.dispose();selectionEditors.delete(editor);}else editor.update(event);}}
document.addEventListener('selectionchange',updateSelectionEditors);
document.addEventListener('pointerdown',event=>{selectionPointerDown=true;updateSelectionEditors(event);},true);
document.addEventListener('pointerup',event=>{selectionPointerDown=false;updateSelectionEditors(event);},true);
document.addEventListener('pointercancel',event=>{selectionPointerDown=false;updateSelectionEditors(event);},true);
document.addEventListener('scroll',updateSelectionEditors,true);
window.addEventListener('resize',updateSelectionEditors);

export function richTextEditor({value,onChange,pickAsset,uploadAsset,resolveMedia}){
  let documentValue=asDocument(value),menu=null,menuIndex=0,range=null,selected=new Set(),menuKey=null,menuBlock=null,selectionAnchor=null;
  const root=h('div',{class:'rich-editor',tabindex:'0'}),list=h('div',{class:'rich-block-list'});
  if(!documentValue.blocks.length)documentValue.blocks.push({id:crypto.randomUUID(),type:'paragraph',runs:[{text:''}]});
  const empty=block=>!blockText(block).replace(/[\s\u200b]/g,'');
  const commit=()=>onChange(structuredClone(documentValue));
  const makeBlock=(type='paragraph')=>({id:crypto.randomUUID(),type,runs:[{text:''}],...(type==='table'?{rows:[['',''],['','']]}:{})});
  function runsFrom(node,marks={}){
    if(node.nodeType===3)return [{text:node.textContent||'',...marks}];if(node.nodeType!==1&&node.nodeType!==11)return [];
    const tag=node.tagName,format={...marks};if(['B','STRONG'].includes(tag))format.bold=true;if(['I','EM'].includes(tag))format.italic=true;if(['S','STRIKE'].includes(tag))format.strike=true;if(tag==='U')format.underline=true;if(tag==='CODE')format.code=true;if(tag==='A'&&safeURL(node.getAttribute('href'))){format.href=node.getAttribute('href');format.target=node.getAttribute('target')==='_blank'?'_blank':'_self';}
    if(tag==='BR')return [{text:'\n',...marks}];return [...node.childNodes].flatMap(child=>runsFrom(child,format));
  }
  function paintRuns(node,runs){
    node.replaceChildren(...runs.map(run=>{let el=document.createTextNode(run.text);for(const [mark,tag]of [['code','code'],['bold','strong'],['italic','em'],['strike','s'],['underline','u']])if(run[mark]){const wrap=document.createElement(tag);wrap.append(el);el=wrap;}if(run.href&&safeURL(run.href)){const link=h('a',{href:run.href,target:run.target==='_blank'?'_blank':'_self',rel:'noopener noreferrer'},el);el=link;}return el;}));
  }
  function focusBlock(id,atEnd=false){queueMicrotask(()=>{const editor=[...list.querySelectorAll('[data-editor-id]')].find(node=>node.dataset.editorId===id);if(!editor){const row=[...list.children].find(node=>node.dataset.blockId===id);row?.querySelector('.rich-block-content input:not([hidden]),.rich-block-content textarea,.rich-block-content button')?.focus({preventScroll:true});return;}editor.focus({preventScroll:true});const selection=getSelection(),r=document.createRange();r.selectNodeContents(editor);r.collapse(!atEnd);selection.removeAllRanges();selection.addRange(r);});}
  function closeMenu(){if(menuBlock){const editor=list.querySelector(`[data-editor-id="${menuBlock}"]`);editor?.removeAttribute('aria-controls');editor?.removeAttribute('aria-expanded');editor?.removeAttribute('aria-activedescendant');}menu?.remove();menu=null;menuKey=null;menuBlock=null;}
  function changeType(block,type,clear=false){block.type=type;if(clear)block.runs=[{text:''}];if(type==='table')block.rows ||= [['',''],['','']];commit();draw();focusBlock(block.id);}
  const typeInfo={paragraph:['T','Plain text','text plain'],h1:['H1','Large heading','# heading'],h2:['H2','Medium heading','## heading'],h3:['H3','Small heading','### heading'],h4:['H4','Smallest heading','#### heading'],bullet:['•','A simple bullet list','* - + bullet'],numbered:['1.','An ordered list','1. num ordered'],todo:['☑','Track a task','[] task checkbox'],toggle:['▸','Collapsible content','> details'],quote:['❞','Highlight a quotation','quote "'],callout:['!','Draw attention to a note','note'],code:['<>','A code snippet','```'],divider:['—','Separate sections','--- div'],image:['image','Add an image','photo picture'],video:['▶','Add a video','movie'],file:['file','Attach a file','attachment'],bookmark:['link','Link to a page','url web'],table:['▦','Rows and columns','table grid']};
  function openMenu(block,anchor,query='',clear=false,insert=false){
    closeMenu();hideToolbar();menuIndex=0;menuBlock=block.id;const slash=clear&&anchor.matches('[contenteditable]');
    const input=h('input',{type:'search','aria-label':'Search blocks',placeholder:'Search blocks…',value:query}),options=h('div',{class:'rich-menu-options',id:'rich-options-'+block.id,role:'listbox','aria-label':'Block types'});
    const matchesFor=()=>blockTypes.filter(([type,label])=>(type+' '+label+' '+typeInfo[type][2]).toLowerCase().includes(input.value.trim().toLowerCase()));
    const choose=type=>{
      closeMenu();
      if(insert){const next=makeBlock(type);documentValue.blocks.splice(documentValue.blocks.indexOf(block)+1,0,next);commit();draw();focusBlock(next.id);}
      else changeType(block,type,clear);
    };
    const drawOptions=()=>{const matches=matchesFor();menuIndex=Math.max(0,Math.min(menuIndex,matches.length-1));options.replaceChildren(...matches.map(([type,label],index)=>{
      const [symbol,description]=typeInfo[type],glyph=['image','file','link'].includes(symbol)?icon(symbol):h('span',{class:'rich-menu-symbol','aria-hidden':'true'},symbol);
      return h('button',{type:'button',id:options.id+'-'+type,role:'option','aria-selected':String(index===menuIndex),class:index===menuIndex?'on':'',onpointerdown:event=>event.preventDefault(),onpointermove:()=>{menuIndex=index;for(const [i,node]of [...options.children].entries()){node.classList.toggle('on',i===index);node.setAttribute('aria-selected',String(i===index));}},onclick:()=>choose(type)},h('span',{class:'rich-menu-icon'},glyph),h('span',{class:'rich-menu-copy'},h('strong',null,label),h('small',null,description)));
    }));if(!matches.length)options.append(h('p',{class:'hint'},'No matching blocks'));const active=matches[menuIndex];if(active){input.setAttribute('aria-activedescendant',options.id+'-'+active[0]);anchor.setAttribute('aria-activedescendant',options.id+'-'+active[0]);}};
    input.oninput=()=>{menuIndex=0;drawOptions();};
    menuKey=event=>{
      if(!['Escape','ArrowDown','ArrowUp','Enter'].includes(event.key)||event.isComposing)return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='Escape'){closeMenu();focusBlock(block.id,true);return;}
      const matches=matchesFor();
      if(event.key==='Enter'){if(matches[menuIndex])choose(matches[menuIndex][0]);return;}
      menuIndex=(menuIndex+(event.key==='ArrowDown'?1:-1)+Math.max(matches.length,1))%Math.max(matches.length,1);drawOptions();options.children[menuIndex]?.scrollIntoView({block:'nearest'});
    };
    input.onkeydown=menuKey;
    menu=h('div',{class:'rich-block-menu',role:'dialog','aria-label':insert?'Insert block':'Choose block type'},h('div',{class:'rich-menu-search'},icon('search'),input),options,h('div',{class:'rich-menu-hint'},'↑ ↓ Navigate · Enter Select · Esc Close'));
    if(!clear&&!insert)menu.append(h('div',{class:'rich-menu-footer'},button('Duplicate',{variant:'ghost',size:'small',onclick:()=>{const copy=structuredClone(block);copy.id=crypto.randomUUID();documentValue.blocks.splice(documentValue.blocks.indexOf(block)+1,0,copy);closeMenu();commit();draw();focusBlock(copy.id);}}),button('Delete',{variant:'danger',size:'small',onclick:()=>removeBlocks(new Set([block.id]))})));
    document.body.append(menu);drawOptions();
    const rect=anchor.getBoundingClientRect(),box=menu.getBoundingClientRect(),edge=12;
    menu.style.left=Math.max(edge,Math.min(innerWidth-box.width-edge,rect.left))+'px';menu.style.top=(rect.bottom+8+box.height<innerHeight-edge?rect.bottom+8:Math.max(edge,rect.top-box.height-8))+'px';
    anchor.setAttribute('aria-controls',options.id);anchor.setAttribute('aria-expanded','true');
    if(!slash)input.focus({preventScroll:true});
  }
  function paintSelection(){for(const row of list.children)row.classList.toggle('selected',selected.has(row.dataset.blockId));}
  function selectBlock(block,event={}){
    if(event.shiftKey&&selectionAnchor){const ids=documentValue.blocks.map(item=>item.id),a=ids.indexOf(selectionAnchor),b=ids.indexOf(block.id);selected=new Set(ids.slice(Math.min(a,b),Math.max(a,b)+1));}
    else if(event.metaKey||event.ctrlKey){if(selected.has(block.id))selected.delete(block.id);else selected.add(block.id);selectionAnchor=block.id;}
    else if(!selected.has(block.id)){selected=new Set([block.id]);selectionAnchor=block.id;}
    getSelection()?.removeAllRanges();paintSelection();
  }
  function openBlockActions(block,anchor){
    selectBlock(block);closeMenu();hideToolbar();menuBlock=block.id;
    const ids=new Set(selected),count=ids.size;
    menu=h('div',{class:'rich-block-menu rich-action-menu',role:'dialog','aria-label':'Selected block actions'},h('p',{class:'rich-menu-hint'},`${count} ${count===1?'block':'blocks'} selected`),
      button('Turn into…',{variant:'ghost',size:'small',onclick:()=>{closeMenu();showToolbar([...ids],anchor.getBoundingClientRect(),false);typeOptions.hidden=false;positionToolbar();}}),
      button('Duplicate',{variant:'ghost',size:'small',onclick:()=>{const copies=documentValue.blocks.filter(item=>ids.has(item.id)).map(item=>({...structuredClone(item),id:crypto.randomUUID()}));const index=Math.max(...documentValue.blocks.map((item,i)=>ids.has(item.id)?i:-1));documentValue.blocks.splice(index+1,0,...copies);selected=new Set(copies.map(item=>item.id));commit();draw();root.focus({preventScroll:true});}}),
      button(count===1?'Delete':'Delete '+count+' blocks',{variant:'danger',size:'small',icon:'trash',onclick:()=>removeBlocks(ids)}));
    menu.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();closeMenu();root.focus({preventScroll:true});}};
    document.body.append(menu);const rect=anchor.getBoundingClientRect(),box=menu.getBoundingClientRect();menu.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left))+'px';menu.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.bottom+8))+'px';menu.querySelector('button')?.focus({preventScroll:true});
  }
  function removeBlocks(ids){if(!ids.size)return;const index=documentValue.blocks.findIndex(block=>ids.has(block.id));documentValue.blocks=documentValue.blocks.filter(block=>!ids.has(block.id));if(!documentValue.blocks.length)documentValue.blocks.push(makeBlock());selected.clear();closeMenu();commit();draw();focusBlock(documentValue.blocks[Math.max(0,index-1)]?.id||documentValue.blocks[0].id,true);}
  function addAfter(block){const next=makeBlock();documentValue.blocks.splice(block?documentValue.blocks.indexOf(block)+1:documentValue.blocks.length,0,next);commit();draw();focusBlock(next.id);}
  const typeLabel=h('span',null,'Text'),typeOptions=h('div',{class:'rich-selection-types',hidden:''});
  const inlineActions=h('div',{class:'rich-selection-actions'});
  const toolbar=h('div',{class:'rich-toolbar rich-selection-toolbar',role:'toolbar','aria-label':'Text and block formatting',hidden:''});
  let touched=[],selectionRect=null;
  const textTypes=blockTypes.filter(([type])=>!['image','video','file','bookmark','table','divider'].includes(type));
  function hideToolbar(){toolbar.hidden=true;typeOptions.hidden=true;toolbar.querySelector('.rich-link-popover')?.remove();}
  function rememberRange(){const selection=getSelection();if(selection?.rangeCount && list.contains(selection.anchorNode)&&list.contains(selection.focusNode)&&!selection.isCollapsed)range=selection.getRangeAt(0).cloneRange();}
  function touchedEditors(){return range?[...list.querySelectorAll('[data-editor-id]')].filter(el=>range.intersectsNode(el)):[];}
  function restoreRange(){if(!range||!list.contains(range.commonAncestorContainer))return false;const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return true;}
  function syncEditors(editors){for(const editor of editors){const block=documentValue.blocks.find(block=>block.id===editor.dataset.editorId);if(block)block.runs=runsFrom(editor);}commit();rememberRange();}
  function positionToolbar(){
    if(!selectionRect)return;
    if(!inlineActions.hidden&&range&&list.contains(range.commonAncestorContainer))selectionRect=range.getBoundingClientRect();
    else{const row=[...list.children].find(node=>node.dataset.blockId===touched.at(-1));if(!row)return hideToolbar();selectionRect=row.getBoundingClientRect();}
    let top=0,bottom=innerHeight,left=0,right=innerWidth;
    for(let parent=root;parent;parent=parent.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY+getComputedStyle(parent).overflowX)){const bounds=parent.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}}
    if(selectionRect.top<top||selectionRect.bottom>bottom||selectionRect.right<=left||selectionRect.left>=right)return hideToolbar();
    toolbar.hidden=false;if(!toolbar.isConnected)document.body.append(toolbar);
    const box=toolbar.getBoundingClientRect(),edge=12;
    toolbar.style.left=Math.max(edge,Math.min(innerWidth-box.width-edge,selectionRect.left))+'px';
    const below=selectionRect.bottom+8;toolbar.style.top=(below+box.height<innerHeight-edge?below:Math.max(edge,selectionRect.top-box.height-8))+'px';
  }
  function showToolbar(blockIDs,rect,hasText){
    touched=blockIDs;selectionRect=rect;
    const types=new Set(blockIDs.map(id=>documentValue.blocks.find(block=>block.id===id)?.type));
    typeLabel.textContent=types.size===1?(blockTypes.find(([type])=>types.has(type))?.[1]||'Text'):'Mixed blocks';
    inlineActions.hidden=!hasText;deleteSelection.hidden=hasText;
    for(const control of inlineActions.querySelectorAll('[data-command]'))control.setAttribute('aria-pressed',String(document.queryCommandState(control.dataset.command)));
    positionToolbar();
  }
  const typeButton=button('',{variant:'ghost',size:'small',class:'btn quiet sm rich-type-button',onpointerdown:event=>event.preventDefault(),onclick:()=>{typeOptions.hidden=!typeOptions.hidden;positionToolbar();}});typeButton.append(icon('type'),typeLabel,icon('chevron-down'));
  typeOptions.append(...textTypes.map(([type,label])=>button(label,{variant:'ghost',size:'small',onpointerdown:event=>event.preventDefault(),onclick:()=>{
    const ids=[...touched];for(const block of documentValue.blocks)if(ids.includes(block.id))block.type=type;
    hideToolbar();commit();draw();if(ids[0])focusBlock(ids[0]);
  }})));
  for(const [command,label,text]of [['bold','Bold','B'],['italic','Italic','I'],['underline','Underline','U'],['strikeThrough','Strikethrough','S']])inlineActions.append(h('button',{type:'button',class:'icon-btn','data-command':command,title:label,'aria-label':label,onpointerdown:event=>event.preventDefault(),onclick:()=>{const editors=touchedEditors();if(restoreRange()){document.execCommand(command);syncEditors(editors);showToolbar(editors.map(el=>el.dataset.editorId),selectionRect,true);}}},text));
  inlineActions.append(button('Code',{variant:'ghost',size:'small',onpointerdown:event=>event.preventDefault(),onclick:()=>{
    const editors=touchedEditors();if(!restoreRange()||editors.length!==1)return;
    const parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement,existing=parent.closest('code');
    if(existing)existing.replaceWith(...existing.childNodes);else{const code=h('code');code.append(range.extractContents());range.insertNode(code);range.selectNodeContents(code);}
    syncEditors(editors);
  }}),button('Link',{variant:'ghost',size:'small',icon:'link',onpointerdown:event=>event.preventDefault(),onclick:()=>{
    if(!range||range.collapsed||touchedEditors().length!==1)return;toolbar.querySelector('.rich-link-popover')?.remove();
    const editors=touchedEditors(),url=h('input',{type:'text','aria-label':'Link URL',placeholder:'https://…'});
    const parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;url.value=parent.closest('a')?.getAttribute('href')||'';
    let target=parent.closest('a')?.getAttribute('target')==='_blank'?'_blank':'_self';
    const targets=h('div');const drawTargets=()=>targets.replaceChildren(targetToggle(target,value=>{target=value;drawTargets();}));drawTargets();
    const apply=()=>{if(!safeURL(url.value)){url.setCustomValidity('Use a safe link URL');url.reportValidity();return;}if(!restoreRange())return;document.execCommand('createLink',false,url.value);range=getSelection().getRangeAt(0).cloneRange();for(const editor of editors)for(const link of editor.querySelectorAll('a'))if(range.intersectsNode(link)){link.setAttribute('target',target);link.setAttribute('rel','noopener noreferrer');}syncEditors(editors);hideToolbar();};
    url.oninput=()=>url.setCustomValidity('');url.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();apply();}if(event.key==='Escape')hideToolbar();};
    const popover=h('div',{class:'rich-link-popover'},url,targets,button('Apply',{size:'small',onclick:apply}),button('Remove link',{variant:'ghost',size:'small',onclick:()=>{if(restoreRange()){document.execCommand('unlink');syncEditors(editors);}hideToolbar();}}));toolbar.append(popover);positionToolbar();url.focus();
  }}));
  const deleteSelection=button('Delete blocks',{variant:'danger',size:'small',onpointerdown:event=>event.preventDefault(),onclick:()=>{hideToolbar();removeBlocks(new Set(touched));}});
  toolbar.append(typeButton,typeOptions,inlineActions,deleteSelection);
  selectionEditors.add({root,dispose:()=>{toolbar.remove();closeMenu();},update:event=>{
    if(event?.type==='resize'||event?.type==='scroll'&&menu&&!menu.contains(event.target))closeMenu();
    if(event?.type==='pointerdown'){
      if(menu&&!menu.contains(event.target)&&event.target.closest('[data-editor-id]')?.dataset.editorId!==menuBlock)closeMenu();
      if(toolbar.contains(event.target)||menu?.contains(event.target))return;
      if(event.target.closest('.rich-grip')&&list.contains(event.target)){const native=getSelection();if(native?.rangeCount&&!native.isCollapsed&&list.contains(native.anchorNode)){const r=native.getRangeAt(0),rows=[...list.children].filter(row=>r.intersectsNode(row));if(rows.length>1){selected=new Set(rows.map(row=>row.dataset.blockId));paintSelection();}}}
      if(!event.target.closest('.rich-grip')||!list.contains(event.target)){selected.clear();for(const row of list.querySelectorAll('.selected'))row.classList.remove('selected');}
      hideToolbar();return;
    }
    if(event?.type==='scroll'||event?.type==='resize'){if(!toolbar.hidden)positionToolbar();return;}
    if(selectionPointerDown)return;
    if(toolbar.contains(document.activeElement)&&document.activeElement.matches('input,button,select'))return;
    const selection=getSelection();
    if(!selection?.rangeCount||selection.isCollapsed||!list.contains(selection.anchorNode)||!list.contains(selection.focusNode)){if(!selected.size)hideToolbar();return;}
    rememberRange();const editors=touchedEditors();if(!editors.length)return hideToolbar();
    const rect=range.getBoundingClientRect(),pane=root.closest('.ed');if(pane){const bounds=pane.getBoundingClientRect();if(rect.bottom<bounds.top||rect.top>bounds.bottom)return hideToolbar();}
    showToolbar(editors.map(el=>el.dataset.editorId),rect,true);
  }});
  function editable(block){
    const el=h('div',{class:'rich-block-text','data-editor-id':block.id,contenteditable:'true',role:'textbox','aria-label':blockTypes.find(([type])=>type===block.type)?.[1]||'Text','data-placeholder':'Type / for blocks'});paintRuns(el,empty(block)?[]:block.runs || [{text:block.text||''}]);
    el.oninput=event=>{
      block.runs=runsFrom(el);if(block.type!=='code'&&!el.textContent.replace(/[\n\u200b]/g,'')){block.runs=[{text:''}];el.replaceChildren();}const text=blockText(block);
      if(!event?.isComposing&&block.type!=='code'){
        const shortcut=markdownShortcut(text.replace(/\u00a0/g,' '));
        if(shortcut){Object.assign(block,shortcut);block.runs=[{text:''}];commit();draw();if(shortcut.type==='divider')addAfter(block);else focusBlock(block.id);return;}
        if(/^\/[^\n]*$/.test(text)){commit();openMenu(block,el,text.slice(1),true);return;}
        if(menuBlock===block.id)closeMenu();
        const selection=getSelection();
        if(selection?.isCollapsed&&selection.rangeCount){const tail=selection.getRangeAt(0).cloneRange();tail.setEnd(el,el.childNodes.length);
          if(!tail.toString()&&/[*_`~\)]$/.test(text)){const runs=block.runs.flatMap(run=>{const {text,...marks}=run;return run.code?[run]:markdownRuns(text,marks);});if(runs.map(run=>run.text).join('')!==text){block.runs=runs;paintRuns(el,runs);focusBlock(block.id,true);}}
        }
      }
      commit();
    };
    el.onclick=event=>{if(event.target.closest('a'))event.preventDefault();};
    el.onkeyup=rememberRange;el.onpointerup=rememberRange;
    el.onkeydown=event=>{
      if(event.isComposing)return;
      if(menu&&menuBlock===block.id&&menuKey&&['Escape','ArrowUp','ArrowDown','Enter'].includes(event.key)){menuKey(event);return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu();el.blur();return;}
      if(event.key==='Tab'){event.preventDefault();block.indent=Math.max(0,Math.min(3,(block.indent||0)+(event.shiftKey?-1:1)));commit();draw();focusBlock(block.id);return;}
      if(event.key==='Backspace'&&empty(block)){
        event.preventDefault();closeMenu();const index=documentValue.blocks.indexOf(block);
        if(block.type!=='paragraph'){changeType(block,'paragraph',true);return;}
        if(documentValue.blocks.length>1){documentValue.blocks.splice(index,1);commit();draw();focusBlock(documentValue.blocks[Math.max(0,index-1)].id,index>0);}
        else{block.runs=[{text:''}];el.replaceChildren();commit();}return;
      }
      if(event.key==='Enter'&&!event.shiftKey && block.type!=='code'){
        event.preventDefault();closeMenu();if(empty(block)&&['bullet','numbered','todo'].includes(block.type)){changeType(block,'paragraph');return;}
        const selection=getSelection(),caret=selection?.rangeCount?selection.getRangeAt(0):null;
        let after=[];
        if(caret&&el.contains(caret.commonAncestorContainer)){caret.deleteContents();const tail=caret.cloneRange();tail.setEnd(el,el.childNodes.length);if(el.lastChild){after=runsFrom(tail.extractContents());block.runs=runsFrom(el);}}
        const next=makeBlock(['bullet','numbered','todo'].includes(block.type)?block.type:'paragraph');next.runs=after.length?after:[{text:''}];next.indent=block.indent||0;documentValue.blocks.splice(documentValue.blocks.indexOf(block)+1,0,next);commit();draw();focusBlock(next.id);
      }
    };
    el.addEventListener('paste',event=>{
      event.preventDefault();closeMenu();const text=event.clipboardData.getData('text/plain'),selection=getSelection();if(!selection?.rangeCount)return;
      const r=selection.getRangeAt(0);if(!el.contains(r.commonAncestorContainer))return;
      if(block.type==='code'){document.execCommand('insertText',false,text);block.runs=runsFrom(el);commit();return;}
      const parsed=parseMarkdown(text),hasBlocks=text.includes('\n')||parsed.blocks.some(item=>item.type!=='paragraph');
      if(!hasBlocks){r.deleteContents();const fragment=document.createDocumentFragment();paintRuns(fragment,markdownRuns(text));const last=fragment.lastChild;r.insertNode(fragment);if(last){r.setStartAfter(last);r.collapse(true);selection.removeAllRanges();selection.addRange(r);}block.runs=runsFrom(el);commit();return;}
      r.deleteContents();const tail=r.cloneRange();tail.setEnd(el,el.childNodes.length);const after=runsFrom(tail.extractContents());block.runs=runsFrom(el);
      const inserted=parsed.blocks,index=documentValue.blocks.indexOf(block),beforeEmpty=empty(block);
      if(!beforeEmpty&&inserted[0]?.type==='paragraph'){block.runs.push(...inserted.shift().runs);}
      const last=inserted.at(-1);let focusID=last?.id||block.id;
      if(after.some(run=>run.text)){
        if(last&&!['image','video','file','bookmark','table','divider'].includes(last.type)){last.runs.push(...after);}
        else if(!last&&!beforeEmpty)block.runs.push(...after);
        else{const next=makeBlock();next.runs=after;inserted.push(next);}
      }
      documentValue.blocks.splice(index+(beforeEmpty?0:1),beforeEmpty?1:0,...inserted);commit();draw();focusBlock(focusID,true);
    });return el;
  }
  function draw(){
    hideToolbar();closeMenu();list.replaceChildren(...documentValue.blocks.map(block=>{
      const row=h('div',{class:'rich-block'+(selected.has(block.id)?' selected':''),'data-block-id':block.id,'data-type':block.type,style:`--block-indent:${block.indent||0}`});
      const grip=h('button',{type:'button',class:'drag-grip rich-grip','aria-label':'Move or select block',title:'Drag to move · Shift-click to select'},'⠿');
      grip.addEventListener('pointerdown',event=>{
        if(event.shiftKey||event.metaKey||event.ctrlKey){event.preventDefault();selectBlock(block,event);closeMenu();showToolbar([...selected],row.getBoundingClientRect(),false);return;}
        hideToolbar();closeMenu();
        startSortable(event,{row,root:list,listSelector:'.rich-block-list',rowSelector:'.rich-block',onClick:()=>openBlockActions(block,grip),onDrop:({before})=>{
          const ids=selected.has(block.id)?new Set(selected):new Set([block.id]),moving=documentValue.blocks.filter(item=>ids.has(item.id));
          let next=before;while(next&&ids.has(next.dataset.blockId))next=next.nextElementSibling;
          const remaining=documentValue.blocks.filter(item=>!ids.has(item.id)),to=next?remaining.findIndex(item=>item.id===next.dataset.blockId):remaining.length;
          remaining.splice(to<0?remaining.length:to,0,...moving);documentValue.blocks=remaining;selected=ids;commit();draw();
        }});
      });
      grip.oncontextmenu=event=>{event.preventDefault();openBlockActions(block,grip);};
      grip.onkeydown=event=>{if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const from=documentValue.blocks.indexOf(block),to=from+(event.key==='ArrowUp'?-1:1);if(to<0||to>=documentValue.blocks.length)return;documentValue.blocks.splice(to,0,documentValue.blocks.splice(from,1)[0]);commit();draw();focusBlock(block.id);}};
      row.append(h('div',{class:'rich-block-handles'},button('',{variant:'ghost',size:'small',icon:'plus','aria-label':'Choose block to insert',onclick:event=>openMenu(block,event.currentTarget,'',empty(block),!empty(block))}),grip));
      const content=h('div',{class:'rich-block-content'});
      if(block.type==='image'){content.append(imageEditor({value:block,onChange:value=>{Object.assign(block,value);commit();},pickAsset,uploadAsset,resolveMedia}));}
      else if(['video','file','bookmark'].includes(block.type)){
        if(block.url&&safeURL(block.url,true)&&block.type==='image')content.append(h('img',{class:'rich-media-preview',src:block.url,alt:block.alt||''}));
        if(block.url&&safeURL(block.url,true)&&block.type==='video')content.append(h('video',{class:'rich-media-preview',src:block.url,controls:'',preload:'metadata'}));
        const url=h('input',{type:'text',value:block.url||'',placeholder:block.type==='bookmark'?'https://…':'Media URL','aria-label':'Block URL'});url.onchange=()=>{if(url.value&&!safeURL(url.value,true)){url.setCustomValidity('Use HTTPS or a site asset');url.reportValidity();return;}block.url=url.value;commit();draw();};
        const caption=h('input',{type:'text',value:block.caption||'',placeholder:'Caption','aria-label':'Caption'});caption.oninput=()=>{block.caption=caption.value;commit();};content.append(h('div',{class:'field-actions'},pickAsset&&block.type!=='bookmark'?button('Choose '+block.type,{size:'small',onclick:()=>pickAsset(block.type,url=>{block.url=url;commit();draw();})}):null,button('URL',{variant:'ghost',size:'small',onclick:()=>{url.hidden=!url.hidden;if(!url.hidden)url.focus();}})),url,caption);url.hidden=Boolean(pickAsset&&block.type!=='bookmark');
        if(block.type==='image'){const alt=h('input',{type:'text',value:block.alt||'',placeholder:'Image description','aria-label':'Image description'});alt.oninput=()=>{block.alt=alt.value;commit();};content.append(alt);}
      }else if(block.type==='divider')content.append(h('hr'));
      else if(block.type==='table'){
        const table=h('table');for(const cells of block.rows || []){const tr=h('tr');for(let i=0;i<cells.length;i++){const cell=h('td',{contenteditable:'true',role:'textbox','aria-label':'Table cell'},cells[i]);cell.oninput=()=>{cells[i]=cell.textContent;commit();};cell.onpaste=event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));};tr.append(cell);}table.append(tr);}content.append(table,h('div',{class:'field-actions'},button('+ Row',{variant:'ghost',size:'small',onclick:()=>{block.rows.push(Array(block.rows[0]?.length||2).fill(''));commit();draw();}}),button('+ Column',{variant:'ghost',size:'small',onclick:()=>{for(const row of block.rows)row.push('');commit();draw();}})));
      }else{
        if(block.type==='todo'){const check=h('input',{type:'checkbox','aria-label':'Completed'});check.checked=Boolean(block.checked);check.onchange=()=>{block.checked=check.checked;commit();};content.append(check);}
        if(block.type==='bullet')content.append(h('span',{class:'rich-list-marker','aria-hidden':'true'},'•'));
        if(block.type==='numbered'){let number=1;for(let i=documentValue.blocks.indexOf(block)-1;i>=0&&documentValue.blocks[i].type==='numbered';i--)number++;content.append(h('span',{class:'rich-list-marker','aria-hidden':'true'},number+'.'));}
        content.append(editable(block));
        if(block.type==='toggle'){const detail=h('textarea',{rows:2,'aria-label':'Toggle content',placeholder:'Toggle content…'},block.detail||'');detail.oninput=()=>{block.detail=detail.value;commit();};content.append(h('details',null,h('summary',null,'Details'),detail));}
      }
      row.append(content);return row;
    }));
  }
  root.append(list);draw();
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hideToolbar();closeMenu();selected.clear();paintSelection();}
    if(selected.size&&['Backspace','Delete'].includes(event.key)&&!event.target.closest('input,textarea,[contenteditable]')){event.preventDefault();removeBlocks(new Set(selected));}
    if((event.metaKey||event.ctrlKey)&&event.key==='a'&&!event.target.closest('input,textarea,[contenteditable]')){event.preventDefault();selected=new Set(documentValue.blocks.map(block=>block.id));paintSelection();showToolbar([...selected],root.getBoundingClientRect(),false);}
  });
  list.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.target.matches('.rich-block-list,.rich-block,.rich-block-content'))return;
    event.preventDefault();const start=event.clientY,id=event.pointerId;selected.clear();hideToolbar();closeMenu();list.setPointerCapture(id);
    const move=e=>{selected=new Set([...list.children].filter(row=>{const r=row.getBoundingClientRect();return r.bottom>=Math.min(start,e.clientY)&&r.top<=Math.max(start,e.clientY);}).map(row=>row.dataset.blockId));paintSelection();};
    const finish=()=>{list.removeEventListener('pointermove',move);list.removeEventListener('pointerup',finish);list.removeEventListener('pointercancel',finish);if(list.hasPointerCapture(id))list.releasePointerCapture(id);root.focus({preventScroll:true});if(selected.size)showToolbar([...selected],root.getBoundingClientRect(),false);};
    list.addEventListener('pointermove',move);list.addEventListener('pointerup',finish);list.addEventListener('pointercancel',finish);move(event);
  });
  return root;
}
