import {h,icon,button} from './ui-components.mjs';
import {safeURL} from './rich-text-model.mjs';

// One image control for article blocks and CMS media properties.
export function imageEditor({value={},onChange,pickAsset,uploadAsset,resolveMedia=url=>url,compact=false,caption=true,validateImage}){
  let media={url:value.url||value.src||'',alt:value.alt||'',caption:value.caption||''};
  const root=h('div',{class:'image-editor'+(compact?' image-editor--compact':'')});
  function open(tab=media.url?'upload':'upload',initial=media){
    if(tab==='settings')tab='upload';
    const opener=document.activeElement,draft={...initial},dialog=h('dialog',{class:'image-dialog','aria-label':'Image settings'}),body=h('div',{class:'image-dialog-body'}),preview=h('div',{class:'image-dialog-preview'}),error=h('p',{class:'field-error',role:'alert',hidden:true});let busy=false;
    const close=()=>{if(busy)return;dialog.close();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});};
    const commit=async()=>{if(busy)return;if(draft.url&&!safeURL(draft.url,true)){report(new Error('Use an HTTPS URL or a site asset'));return;}try{busy=true;save.disabled=true;cancel.disabled=true;media=validateImage?await validateImage({...draft}):{...draft};onChange({...media});draw();busy=false;close();}catch(err){busy=false;drawTab();if(err.name!=='AbortError')report(err);}};
    const report=err=>{error.hidden=false;error.textContent=err.message||String(err);};
    const save=button('Save image',{variant:'primary',onclick:commit}),cancel=button('Cancel',{variant:'ghost',onclick:close});
    const alt=h('textarea',{rows:2,'aria-label':'Alt text',placeholder:'Describe this image',maxlength:250},draft.alt),captionInput=h('input',{type:'text','aria-label':'Caption',value:draft.caption,placeholder:'Add a caption'});
    alt.oninput=()=>draft.alt=alt.value;captionInput.oninput=()=>draft.caption=captionInput.value;
    const metadata=h('div',{class:'image-metadata'},h('label',{class:'auto-field'},h('span',{class:'cap'},'Alt text'),alt),caption?h('label',{class:'auto-field'},h('span',{class:'cap'},'Caption'),captionInput):null);
    const tabs=h('div',{class:'seg image-dialog-tabs'});
    const upload=async file=>{if(!file||busy)return;try{if(!uploadAsset)throw new Error('Upload is not available in this demo');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose PNG, JPEG or WebP');busy=true;drawTab();draft.url=await uploadAsset(file);busy=false;drawTab();}catch(err){busy=false;drawTab();if(err.name!=='AbortError')report(err);}};
    function drawTab(){
      error.hidden=true;save.disabled=busy||!draft.url;cancel.disabled=busy;alt.disabled=busy;captionInput.disabled=busy;
      tabs.replaceChildren(...[['upload','Upload'],['library','Library'],['link','Link']].map(([key,label])=>h('button',{type:'button',class:key===tab?'on':'',disabled:busy,onclick:()=>{tab=key;drawTab();}},label)));
      preview.replaceChildren(...(draft.url?[h('img',{src:resolveMedia(draft.url),alt:draft.alt,onerror:()=>report(new Error('Image could not be loaded'))})]:[]));body.replaceChildren();
      if(tab==='upload'){
        const file=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp',hidden:true});file.onchange=()=>upload(file.files?.[0]);
        body.append(h('div',{class:'image-drop',ondragover:e=>{e.preventDefault();e.currentTarget.classList.add('on');},ondragleave:e=>e.currentTarget.classList.remove('on'),ondrop:e=>{e.preventDefault();e.currentTarget.classList.remove('on');upload(e.dataTransfer.files?.[0]);}},icon('image'),h('p',null,busy?'Uploading…':'Drop an image here'),button(draft.url?'Upload another':'Upload file',{onclick:()=>file.click(),disabled:busy||!uploadAsset}),file));
      }else if(tab==='library')body.append(button('Choose from library',{icon:'images',disabled:!pickAsset,onclick:()=>{close();pickAsset('image',url=>open('library',{...draft,url}));}}));
      else{
        const url=h('input',{type:'text',value:draft.url,'aria-label':'Image URL',placeholder:'https://… or /assets/…'});
        url.oninput=()=>{draft.url=url.value.trim();save.disabled=!draft.url;};url.onchange=()=>{if(draft.url&&!safeURL(draft.url,true))report(new Error('Use an HTTPS URL or a site asset'));};body.append(url);
      }
    }
    const remove=media.url?button('Remove image',{variant:'danger',onclick:()=>{draft.url='';commit();}}):null;
    dialog.append(h('div',{class:'cms-item-heading'},h('strong',null,'Image'),h('button',{type:'button',class:'icon-btn','aria-label':'Close image settings',onclick:close},'×')),preview,tabs,body,metadata,error,h('div',{class:'image-dialog-footer'},remove,h('div',{class:'confirmation-actions'},cancel,save)));
    dialog.oncancel=e=>{e.preventDefault();close();};dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}};
    document.body.append(dialog);drawTab();dialog.showModal();
  }
  function draw(){
    if(!media.url){root.replaceChildren(button('Add an image',{variant:'ghost',icon:'image',class:'image-add',onclick:()=>open('upload')}));return;}
    const img=h('img',{src:resolveMedia(media.url),alt:media.alt,loading:'lazy',draggable:false,ondragstart:event=>event.preventDefault()}),error=h('p',{class:'field-error',role:'alert',hidden:true});img.onerror=()=>{error.hidden=false;error.textContent='Image could not be loaded';};
    root.replaceChildren(...[h('div',{class:'image-preview'},h('button',{type:'button',class:'image-open','aria-label':'Image settings',onclick:()=>open('settings')},img),h('div',{class:'image-actions'},button('Replace',{variant:'ghost',size:'small',onclick:()=>open('upload')}),button('',{variant:'ghost',size:'small',icon:'settings-2','aria-label':'Image settings',onclick:()=>open('settings')}))),media.caption&&caption?h('p',{class:'image-caption'},media.caption):null,error].filter(node=>node!=null));
  }
  draw();return root;
}
