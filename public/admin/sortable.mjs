// Shared CMS-style pointer sorting: floating row, animated placeholder, edge scroll and Escape.
export function startSortable(event, options) {
  const {row,root,listSelector,rowSelector,onDrop,onClick,layout}=options;
  // Grips with an action menu activate sorting only after a deliberate pointer move.
  if(onClick&&event.button===0){
    event.preventDefault();const handle=event.currentTarget,start={x:event.clientX,y:event.clientY},id=event.pointerId;
    const cleanup=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel);handle.removeEventListener('lostpointercapture',cancel);};
    const cancel=()=>cleanup(),up=e=>{cleanup();if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);onClick(e);};
    const move=e=>{if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)return;cleanup();startSortable({button:0,currentTarget:handle,pointerId:id,clientX:e.clientX,clientY:e.clientY,preventDefault:()=>e.preventDefault()},{...options,onClick:null});};
    handle.setPointerCapture(id);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',cancel);return;
  }
  if (event.button !== 0 || document.body.classList.contains('record-dragging')) return;
  event.preventDefault();
  const handle=event.currentTarget, source=row.parentElement, next=row.nextSibling;
  // Preserve the rendered layout before leaving its table/container-query context.
  // Restore every original inline style on drop/cancel; keep the same live DOM nodes.
  const appearance=[row,...row.querySelectorAll('*')].map(node=>{
    const computed=getComputedStyle(node);return {node,original:node.getAttribute('style'),css:[...computed].map(property=>[property,computed.getPropertyValue(property)])};
  });
  const bounds=row.getBoundingClientRect(), offset=event.clientY-bounds.top,offsetX=event.clientX-bounds.left;
  const placeholder=document.createElement('div');placeholder.className='record-placeholder';placeholder.style.height=bounds.height+'px';if(layout==='grid'){placeholder.style.width=bounds.width+'px';placeholder.style.maxWidth='100%';}placeholder.setAttribute('aria-hidden','true');
  row.before(placeholder);
  for(const {node,css}of appearance)for(const [property,value]of css)node.style.setProperty(property,value);
  for(const {node}of appearance)node.style.pointerEvents='none';
  Object.assign(row.style,{position:'fixed',zIndex:'var(--ui-z-menu)',pointerEvents:'none',margin:'0',boxSizing:'border-box',transform:'none',transition:'none',left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  row.classList.add('record-floating');document.body.append(row);document.body.classList.add('record-dragging');
  handle.setPointerCapture(event.pointerId);
  const pane=root.closest('.ed,.cms-records,.kit-scroll') || root.parentElement;
  let y=event.clientY,x=event.clientX,frame=0,finished=false;
  const layoutRect=item=>{const r=item.getBoundingClientRect();if(layout!=='grid')return r;const transform=getComputedStyle(item).transform,matrix=transform==='none'?null:new DOMMatrixReadOnly(transform);return {top:r.top-(matrix?.m42||0),bottom:r.bottom-(matrix?.m42||0),left:r.left-(matrix?.m41||0),width:r.width,height:r.height};};
  function place(){
    row.style.top=y-offset+'px';if(layout==='grid')row.style.left=x-offsetX+'px';
    const details=document.elementFromPoint(x,y)?.closest('details');
    if(details && root.contains(details))details.open=true;
    const lists=[...(root.matches(listSelector)?[root]:[]),...root.querySelectorAll(listSelector)].filter(list=>list.getBoundingClientRect().height>0);
    const distance=list=>{const r=list.getBoundingClientRect();return y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;};
    const list=lists.sort((a,b)=>distance(a)-distance(b))[0];if(!list)return;
    const siblings=[...list.querySelectorAll(rowSelector)];
    let before;
    if(layout==='grid'){
      const rows=[];
      for(const item of siblings){const r=layoutRect(item);let group=rows.find(group=>Math.abs(group.top-r.top)<r.height/2);if(!group){group={top:r.top,bottom:r.bottom,items:[]};rows.push(group);}group.bottom=Math.max(group.bottom,r.bottom);group.items.push({item,r});}
      const group=rows.reduce((best,group)=>{const distance=y<group.top?group.top-y:y>group.bottom?y-group.bottom:0;return !best||distance<best.distance?{group,distance}:best;},null)?.group;
      if(group){if(y<group.top)before=group.items[0].item;else if(y>group.bottom)before=group.items.at(-1).item.nextElementSibling;else before=group.items.find(({r})=>x<r.left+r.width/2)?.item||group.items.at(-1).item.nextElementSibling;}
      if(before===placeholder)before=placeholder.nextElementSibling;
      if(!before)before=[...list.children].find(item=>item!==placeholder&&!item.matches(rowSelector));
    }else before=siblings.find(item=>{const r=item.getBoundingClientRect();return y<r.top+r.height/2;});
    if(placeholder.parentElement===list && (before?placeholder.nextElementSibling===before:list.lastElementChild===placeholder))return;
    const previous=new Map([...root.querySelectorAll(rowSelector)].map(item=>[item,layoutRect(item)]));
    if(before)before.before(placeholder);else list.append(placeholder);
    for(const [item,previousRect] of previous){const rect=layoutRect(item),dy=previousRect.top-rect.top,dx=previousRect.left-rect.left;if(dy||dx)item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:160,easing:'ease-out'});}
  }
  function tick(){if(finished)return;const r=pane.getBoundingClientRect();if(y<r.top+60)pane.scrollTop-=Math.min(18,(r.top+60-y)/4);else if(y>r.bottom-60)pane.scrollTop+=Math.min(18,(y-r.bottom+60)/4);place();frame=requestAnimationFrame(tick);}
  const move=e=>{x=e.clientX;y=e.clientY;place();};
  const up=()=>finish(false),cancel=()=>finish(true),key=e=>{if(e.key==='Escape'){e.preventDefault();finish(true);}};
  function finish(cancelled){
    if(finished)return;finished=true;cancelAnimationFrame(frame);
    handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel);handle.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',key);
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    const target=placeholder.parentElement,before=placeholder.nextElementSibling;
    if(cancelled){if(next?.parentElement===source)source.insertBefore(row,next);else source.append(row);placeholder.remove();}else placeholder.replaceWith(row);
    row.classList.remove('record-floating');for(const {node,original}of appearance){if(original===null)node.removeAttribute('style');else node.setAttribute('style',original);}
    document.body.classList.remove('record-dragging');
    if(!cancelled)onDrop({list:target,before,index:[...target.children].filter(el=>el.matches(rowSelector)).indexOf(row)});
    handle.focus({preventScroll:true});
  }
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',key);
  frame=requestAnimationFrame(tick);
}
