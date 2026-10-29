import {startSortable} from './sortable.mjs';
import {h, icon, badge} from './ui-components.mjs';

// Organization is editor metadata; Const definitions and token identities stay global.
export function constGroups(consts, saved = []) {
  const seen = new Set();
  const groups = saved.filter(group => group.id !== '').map(group => ({id:group.id, name:group.name,
    keys:group.keys.filter(key => Object.hasOwn(consts,key) && !seen.has(key) && seen.add(key))}));
  const loose = saved.find(group=>group.id === '')?.keys || [];
  groups.push({id:'', name:'Ungrouped', keys:[...loose,...Object.keys(consts)].filter(key => Object.hasOwn(consts,key) && !seen.has(key) && seen.add(key))});
  return groups;
}

export function moveConst(groups, key, targetId, before = null) {
  if (!groups.some(group=>group.keys.includes(key)) || !groups.some(group=>group.id === targetId) || key === before) return groups;
  const next = groups.map(group=>({...group,keys:group.keys.filter(item=>item !== key)}));
  const target = next.find(group=>group.id === targetId);
  const index = before === null ? -1 : target.keys.indexOf(before);
  target.keys.splice(index < 0 ? target.keys.length : index,0,key);
  return next;
}

export function constBrowser({consts, groups, collapsed = new Set(), onOpen, onChange, onEditGroup, usage = () => 0, iconName = 'variable', emptyLabel = 'Drop Const here'}) {
  const root = h('div',{class:'const-browser', 'data-kind':iconName==='variable'?'const':'cms'});
  for (const group of groups) {
    const list = h('div',{class:'const-group-list','data-group-id':group.id});
    for (const key of group.keys) {
      const row = h('div',{class:'const-row', 'data-kind':iconName==='variable'?'const':'cms', 'data-const-key':key});
      const grip = h('button',{type:'button',class:'drag-grip','aria-label':`Move ${consts[key].label}`,title:'Drag to move · ↑ / ↓ to reorder'},'⠿');
      grip.addEventListener('pointerdown',event=>startSortable(event,{row,root,listSelector:'.const-group-list',rowSelector:'.const-row',onDrop:({list,before})=>onChange(moveConst(groups,key,list.dataset.groupId,before?.dataset.constKey || null))}));
      grip.addEventListener('keydown',event=>{
        if (!['ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();const index=group.keys.indexOf(key), step=event.key==='ArrowUp'?-1:1;
        if (index+step<0 || index+step>=group.keys.length) return;
        const before=step<0?group.keys[index-1]:group.keys[index+2] || null;
        const parent=root.parentElement;
        onChange(moveConst(groups,key,group.id,before));
        queueMicrotask(()=>[...parent.querySelectorAll('[data-const-key]')].find(row=>row.dataset.constKey===key)?.querySelector('.drag-grip')?.focus());
      });
      row.append(grip,h('button',{type:'button',class:'const-open',onclick:()=>onOpen(key)},icon(iconName),h('strong',null,consts[key].label),badge(String(usage(key))),icon('chevron-right')));
      list.append(row);
    }
    if (!group.keys.length) list.append(h('p',{class:'const-group-empty'},emptyLabel));
    const details = h('details',{class:'const-group'},
      h('summary',null,icon('chevron-right'),h('span',{class:'const-group-name'},group.name),badge(String(group.keys.length))),
      list);
    details.open = !collapsed.has(group.id);
    details.addEventListener('toggle',()=>{if(details.open)collapsed.delete(group.id);else collapsed.add(group.id);});
    if (group.id) details.querySelector('summary').append(h('button',{type:'button',class:'icon-btn group-edit','aria-label':`Edit ${group.name}`,onclick:event=>{event.preventDefault();onEditGroup(group);}},icon('settings-2')));
    root.append(details);
  }
  return root;
}
