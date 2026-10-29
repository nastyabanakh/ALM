import {startSortable} from './sortable.mjs';
import {h,icon,badge,button,publishedToggle,compactSearch,loading} from './ui-components.mjs';

export function cmsCatalogView({groups,active,onOpen,collapsed=new Set()}) {
  return h('div',{class:'cms-catalog-content'},h('h2',null,'CMS'),...groups.map((group,index)=>{
    const key=group.id || group.label || String(index),details=h('details',{class:'cms-catalog-group'},h('summary',null,icon('chevron-right'),group.label),
      ...group.items.map(item=>h('button',{type:'button',class:'cms-catalog-link'+(active===item.key?' on':''),onclick:()=>onOpen(item)},icon(item.kind==='page'?'file':'database'),h('span',null,item.label),item.count!=null?badge(String(item.count)):null)));
    details.open=!collapsed.has(key);details.addEventListener('toggle',()=>{if(details.open)collapsed.delete(key);else collapsed.add(key);});return details;
  }));
}
export function cmsRecordsView({label,kind,items,selectedId,selection,archived=false,filterMode,onRename,onEdit,search='',busy=false,error='',onSearch,onFilter,onOpen,onSelect,onSelectAll,onCreate,onArchive,onDelete,onMove,onPublished}) {
  const input=h('input',{type:'search',value:search,placeholder:'Search items…','aria-label':'Search items'});
  const rows=h('div',{class:'cms-table-body'}),status=h('span',{class:'hint'});
  const all=h('input',{type:'checkbox','aria-label':'Select all visible items'});
  let visible=[];
  const draw=()=>{
    visible=items.filter(item=>(!filterMode||filterMode==='all'||Boolean(item.archived)===(filterMode==='archive')) && item.title.toLowerCase().includes(input.value.toLowerCase()));
    status.textContent=`${visible.length} ${visible.length===1?'item':'items'}`;all.checked=visible.length>0 && visible.every(item=>selection.has(item.id));all.indeterminate=visible.some(item=>selection.has(item.id))&&!all.checked;
    rows.replaceChildren(...visible.map(item=>{
      const checkbox=h('input',{type:'checkbox','aria-label':'Select '+item.title});checkbox.checked=selection.has(item.id);checkbox.onchange=()=>onSelect(item.id,checkbox.checked);
      const row=h('div',{class:'cms-table-row'+(selectedId===item.id?' on':''),'data-id':item.id,'data-reorderable':!item.archived?'true':'false',role:'row'});
      const grip=onMove && !item.archived && !(filterMode?filterMode==='archive':archived) && !input.value?h('button',{type:'button',class:'drag-grip','aria-label':'Reorder '+item.title,title:'Drag or use arrow keys'},'⠿'):h('span');
      if(onMove && !item.archived && !(filterMode?filterMode==='archive':archived) && !input.value){
        grip.addEventListener('pointerdown',event=>startSortable(event,{row,root:rows,listSelector:'.cms-table-body',rowSelector:'.cms-table-row[data-reorderable=true]',onDrop:({index})=>onMove(item,index-items.filter(other=>!other.archived).indexOf(item))}));
        grip.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();onMove(item,event.key==='ArrowUp'?-1:1);}});
      }
      row.append(h('label',{class:'cms-table-check'},checkbox),...(onMove?[grip]:[]),h('button',{type:'button',class:'cms-table-open',onclick:()=>onOpen(item)},icon('file-text'),h('span',null,item.title || 'Untitled')),onPublished?publishedToggle(!item.archived,value=>onPublished(item,value),{label:item.archived?'Archive':'Active',disabled:busy}):badge(item.archived?'Archived':item.status || 'Active',item.archived?'neutral':'cms'));return row;
    }));
    if(!visible.length)rows.append(h('div',{class:'cms-table-empty'},busy?loading():h('p',{class:'hint'},error || (items.length?'No matching items.':'No items yet.'))));
  };
  input.oninput=()=>{onSearch(input.value);draw();};all.onchange=()=>onSelectAll(visible.map(item=>item.id),all.checked);draw();
  const activeFilter=['active','archive'].includes(filterMode)?filterMode:'all';
  const filterMenu=h('div',{class:'cms-filter-menu',popover:'auto',role:'dialog','aria-label':'Filter items'}),filter=h('button',{type:'button',class:'icon-btn cms-filter-button'+(activeFilter!=='all'?' on':''),'aria-label':'Filters','aria-expanded':'false',title:activeFilter==='all'?'Filters':activeFilter==='active'?'Active items only':'Archived items only'},icon('filter'));
  filterMenu.append(h('strong',null,'Status'),... [['all','All items'],['active','Active'],['archive','Archive']].map(([value,text])=>h('button',{type:'button',class:'cms-filter-option','aria-pressed':String(value===activeFilter),onclick:()=>{filterMenu.hidePopover();onFilter(value);}},h('span',null,text),value===activeFilter?icon('check'):null)));
  filter.onclick=()=>{if(filterMenu.matches(':popover-open'))return filterMenu.hidePopover();filterMenu.showPopover();const rect=filter.getBoundingClientRect(),box=filterMenu.getBoundingClientRect();filterMenu.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.right-box.width))+'px';filterMenu.style.top=Math.min(innerHeight-box.height-12,rect.bottom+8)+'px';};filterMenu.addEventListener('toggle',()=>filter.setAttribute('aria-expanded',String(filterMenu.matches(':popover-open'))));
  const heading=h('h1',{class:onRename?'rename-title':'',...(onRename?{tabindex:'0',title:'Double-click to rename'}:{})},label || 'Select a collection');
  if(onRename){const edit=()=>{if(heading.querySelector('input'))return;const name=h('input',{class:'rename-input',type:'text',value:label,'aria-label':'Collection name',maxlength:120});let done=false;const finish=save=>{if(done)return;done=true;const value=name.value.trim();heading.replaceChildren(value&&save?value:label);if(save&&value&&value!==label)onRename(value);};name.onblur=()=>finish(true);name.onkeydown=event=>{event.stopPropagation();if(['Enter','Escape'].includes(event.key)){event.preventDefault();finish(event.key==='Enter');}};heading.replaceChildren(name);name.focus();name.select();};heading.ondblclick=edit;heading.onkeydown=event=>{if(event.key==='Enter'&&event.target===heading){event.preventDefault();edit();}};}
  const actions=selection.size?h('div',{class:'cms-selection-actions'},h('span',null,`${selection.size} selected`),... (items.some(item=>selection.has(item.id)&&item.archived)?[button('Activate',{size:'small',onclick:()=>onArchive(false)})]:[]),... (items.some(item=>selection.has(item.id)&&!item.archived)?[button('Archive',{size:'small',onclick:()=>onArchive(true)})]:[]),button('Delete',{variant:'danger',size:'small',icon:'trash',onclick:onDelete})):null;
  return h('div',{class:'cms-records-content'},h('header',{class:'cms-records-header'},h('div',{class:'cms-records-title'},heading,label&&kind?badge(kind,'cms'):null),label?h('div',{class:'cms-header-actions'},compactSearch(input),filter,filterMenu,onEdit?button('Edit',{variant:'ghost',size:'small',icon:'settings-2',onclick:onEdit,disabled:busy}):null,button('New item',{size:'small',icon:'plus',onclick:onCreate,disabled:busy})):null),actions,
    label?h('div',{class:'cms-table'+(onMove?' cms-table--sortable':''),role:'table','aria-label':label},h('div',{class:'cms-table-heading',role:'row'},h('label',{class:'cms-table-check'},all),onMove?h('span'):null,h('span',null,'Name'),status),rows):h('div',{class:'cms-table-empty'},h('p',{class:'hint'},'Choose a collection on the left.')));
}
