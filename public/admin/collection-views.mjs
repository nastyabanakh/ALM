import {h,icon,badge,button,itemHeader,duplicateAction,backAction,compactSearch} from './ui-components.mjs';
import {startSortable} from './sortable.mjs';

export function collectionListView({label,kind='CMS List',items,title,onBack,backLabel,onOpen,onMove,onAdd,onSearchBlocked=()=>{}}) {
  const search=h('input',{type:'search',placeholder:'Search records…','aria-label':'Search records'}),list=h('div',{class:'record-list'});
  function draw(){
    list.replaceChildren(...items.flatMap((item,index)=>{
      const name=title(item,index);if(!name.toLowerCase().includes(search.value.toLowerCase()))return [];
      const row=h('div',{class:'record-card','data-index':index}),grip=h('button',{type:'button',class:'drag-grip',title:'Drag to reorder','aria-label':`Reorder ${name}. Use arrow keys or drag.`},'⠿');
      grip.addEventListener('pointerdown',event=>{
        if(search.value.trim()){onSearchBlocked();return;}
        startSortable(event,{row,root:list,listSelector:'.record-list',rowSelector:'.record-card',onDrop:({index:to})=>onMove(index,to)});
      });
      grip.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(search.value.trim()){onSearchBlocked();return;}const to=index+(event.key==='ArrowUp'?-1:1);if(to>=0&&to<items.length)onMove(index,to);});
      row.append(grip,h('button',{type:'button',class:'record-open',onclick:()=>onOpen(index)},h('small',null,String(index+1).padStart(2,'0')),h('strong',null,name),icon('chevron-right')));return [row];
    }));
    if(!list.childElementCount)list.append(h('p',{class:'hint'},items.length?'No records found.':'No items yet.'));
  }
  search.oninput=draw;draw();
  return [backAction(backLabel,onBack),h('div',{class:'sec-h'},h('h1',null,label),button('New item',{size:'small',icon:'plus',onclick:onAdd})),badge(kind,'cms'),h('div',{class:'list-toolbar'},h('span',{class:'hint'},`${items.length} records`),compactSearch(search)),list];
}
export function collectionItemView({label,backLabel,onBack,cards=[],fields=[],onDelete,onArchive,onClose,statusField,onDuplicate}) {
  return [onClose?null:backAction(backLabel,onBack),itemHeader(label,onClose,onDuplicate?duplicateAction(onDuplicate):null),statusField,cards.length?h('div',{class:'element-list'},...cards):null,...fields,h('div',{class:'cms-item-footer'},button('Delete item',{variant:'danger',size:'small',icon:'trash',onclick:onDelete}))].filter(Boolean);
}
