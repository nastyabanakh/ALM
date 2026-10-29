// Local workspace preference only; content and publication state are never stored here.
export function installCMSLayout({workspace,handle,storageKey}){
  let preferred=360;try{const stored=Number(localStorage.getItem(storageKey));if(stored>=240&&stored<=560)preferred=stored;}catch{}
  const limits=()=>{
    const css=getComputedStyle(workspace),catalog=workspace.querySelector('.cms-catalog'),available=workspace.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-(catalog?.getBoundingClientRect().width||170)-2*(parseFloat(css.columnGap)||8);
    const max=Math.max(200,Math.min(560,available*.6,available-(innerWidth>1100?360:300))),min=Math.min(240,max);return {min,max};
  };
  function apply(){if(workspace.dataset.cmsDetail!=='true'||workspace.dataset.view!=='cms-workspace'||innerWidth<=900)return;const {min,max}=limits(),width=Math.round(Math.max(min,Math.min(max,preferred)));workspace.style.setProperty('--cms-list-width',width+'px');handle.setAttribute('aria-valuemin',String(Math.round(min)));handle.setAttribute('aria-valuemax',String(Math.round(max)));handle.setAttribute('aria-valuenow',String(width));}
  const persist=()=>{try{localStorage.setItem(storageKey,String(preferred));}catch{}};
  const widthAt=x=>{const {min,max}=limits(),left=workspace.querySelector('.cms-records').getBoundingClientRect().left;preferred=Math.max(min,Math.min(max,x-left));apply();};
  handle.onpointerdown=event=>{
    if(event.button!==0)return;event.preventDefault();const original=preferred;handle.setPointerCapture(event.pointerId);handle.classList.add('is-resizing');
    const move=e=>widthAt(e.clientX),finish=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);handle.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',escape);handle.classList.remove('is-resizing');if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);persist();},cancel=()=>{preferred=original;apply();finish();},escape=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',escape);
  };
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const {min,max}=limits();preferred=e.key==='Home'?min:e.key==='End'?max:Math.max(min,Math.min(max,preferred+(e.key==='ArrowRight'?20:-20)));apply();persist();};
  handle.ondblclick=()=>{preferred=360;apply();persist();};
  new ResizeObserver(apply).observe(workspace);window.addEventListener('resize',apply);
  return {refresh:()=>requestAnimationFrame(apply)};
}
