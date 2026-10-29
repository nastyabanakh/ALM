// Canvas text interaction shared by bound/static fields and the UI Kit.
(() => {
  const fields=new WeakMap();let selected=null;
  function select(element){selected=fields.has(element)?element:null;if(selected)selected.focus({preventScroll:true});}
  function begin(element=selected){
    const field=element && fields.get(element);if(!field || element.classList.contains('cms-editing'))return;
    if(field.canEdit && !field.canEdit())return;
    selected=element;field.notify?.();field.initial=String(field.read() ?? '');
    field.whiteSpace=element.style.whiteSpace;field.contentEditable=element.getAttribute('contenteditable');
    element.textContent=field.initial.replace(/<br\s*\/?\s*>/gi,'\n');
    element.style.whiteSpace='pre-wrap';element.contentEditable='plaintext-only';element.classList.add('cms-editing');
    element.focus({preventScroll:true});
    const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);
  }
  function finish(element){
    const field=fields.get(element);if(!field || !element.classList.contains('cms-editing'))return;
    const text=(element.textContent || '').trim(),value=field.htmlLines?text.replace(/\n/g,'<br />'):text;
    element.classList.remove('cms-editing');element.style.whiteSpace=field.whiteSpace;
    if(field.contentEditable===null)element.removeAttribute('contenteditable');else element.setAttribute('contenteditable',field.contentEditable);
    field.render?.(value);if(value!==field.initial)field.write(value);
  }
  function register(element,field){
    if(fields.has(element))return;fields.set(element,field);
    if(!element.hasAttribute('tabindex'))element.tabIndex=-1;
    element.title='Click to select · Enter to edit · Escape to finish';
    element.addEventListener('dblclick',event=>{if(element.classList.contains('cms-editing')){event.stopPropagation();return;}event.preventDefault();event.stopImmediatePropagation();begin(element);});
    element.addEventListener('keydown',event=>{
      if(!element.classList.contains('cms-editing'))return;
      if(event.key==='Escape' || event.key==='Enter' && !event.shiftKey){event.preventDefault();event.stopImmediatePropagation();element.blur();}
    });
    element.addEventListener('blur',()=>finish(element));
  }
  window.CMSTextEditing={register,select,begin,finish};
})();
