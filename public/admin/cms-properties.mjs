import {h,icon,button,disclosure,compactSearch,loading} from './ui-components.mjs';
import {openGraphEditor} from './open-graph-editor.mjs';
import {dateControl} from './date-control.mjs';
import {imageEditor} from './media-editor.mjs';
import {startSortable} from './sortable.mjs';
import {richTextEditor} from './rich-text-editor.mjs';

export function groupedProperties({schema,renderField}){
  const root=h('div',{class:'cms-properties'});
  for(const group of schema.groups){
    const fields=schema.fields.filter(field=>field.group===group.id&&!field.hidden);if(!fields.length)continue;
    const titleID='cms-group-'+crypto.randomUUID();
    root.append(h('section',{class:'cms-property-section','aria-labelledby':titleID},h('h2',{id:titleID,class:'cms-property-section-title'},group.label),h('div',{class:'cms-property-group-fields'},...fields.map(renderField))));
  }
  const orphans=schema.fields.filter(field=>!field.hidden&&!schema.groups.some(group=>group.id===field.group));if(orphans.length)root.append(...orphans.map(renderField));return root;
}
export function referencePicker({value,multiple,options,onChange}){
  let selected=multiple?Array.isArray(value)?[...value]:[]:value?[value]:[],activeIndex=0;
  const root=h('div',{class:'reference-picker'}),chips=h('div',{class:'reference-selected'}),search=h('input',{type:'search',placeholder:'Search items…','aria-label':'Search reference items'}),results=h('div',{class:'reference-choices',role:'listbox','aria-label':'Reference items','aria-multiselectable':String(Boolean(multiple))}),popup=h('div',{class:'reference-menu',popover:'auto'}),add=button('',{variant:'ghost',size:'small',icon:'plus','aria-label':multiple?'Choose items':'Choose item','aria-haspopup':'listbox','aria-expanded':'false'});
  const hide=()=>{if(popup.matches(':popover-open'))popup.hidePopover();};
  const change=()=>onChange(multiple?[...selected]:selected[0]||'');
  const filtered=()=>options.filter(item=>item.title.toLowerCase().includes(search.value.trim().toLowerCase()));
  function choose(item){if(multiple)selected=selected.includes(item.id)?selected.filter(id=>id!==item.id):[...selected,item.id];else selected=[item.id];change();drawChips();drawOptions();if(!multiple){hide();add.focus({preventScroll:true});}else search.focus({preventScroll:true});}
  function drawChips(){
    chips.replaceChildren(...selected.map(id=>{
      const item=options.find(item=>item.id===id),chip=h('div',{class:'reference-chip'+(!item?' missing':''),'data-reference-id':id}),grip=multiple?h('button',{type:'button',class:'drag-grip','aria-label':'Move '+(item?.title||'reference')},'⠿'):null;
      if(grip){const move=to=>{const from=selected.indexOf(id);if(to<0||to>=selected.length)return;selected.splice(to,0,selected.splice(from,1)[0]);change();drawChips();chips.querySelectorAll('.drag-grip')[to]?.focus({preventScroll:true});};grip.onpointerdown=event=>startSortable(event,{row:chip,root:chips,listSelector:'.reference-selected',rowSelector:'.reference-chip',layout:'grid',onDrop:({index})=>move(index)});grip.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(selected.indexOf(id)+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1));}};}
      chip.append(...[grip,icon('file-text'),h('span',{class:'reference-chip-label',title:item?.title||'Missing item'},item?.title||'Missing item'),h('button',{type:'button',class:'reference-remove','aria-label':'Remove '+(item?.title||'reference'),onclick:()=>{selected=selected.filter(value=>value!==id);change();drawChips();drawOptions();}},'×')].filter(Boolean));return chip;
    }));
    add.classList.toggle('reference-add-empty',!selected.length);add.replaceChildren(icon('plus'),...(!selected.length?[document.createTextNode(multiple?'Choose items':'Choose item')]:[]));
  }
  function drawOptions(){
    const items=filtered();activeIndex=Math.max(0,Math.min(activeIndex,items.length-1));
    results.replaceChildren(...items.map((item,index)=>h('button',{type:'button',class:'reference-option'+(index===activeIndex?' focused':''),role:'option','aria-selected':String(selected.includes(item.id)),onpointerdown:e=>e.preventDefault(),onclick:()=>choose(item)},icon('file-text'),h('span',{class:'reference-option-label'},item.title),selected.includes(item.id)?icon('check'):h('span',{class:'reference-check-space'}))));
    if(!items.length)results.append(h('p',{class:'reference-empty'},'No matching active items'));
  }
  search.oninput=()=>{activeIndex=0;drawOptions();};search.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();activeIndex=(activeIndex+(e.key==='ArrowDown'?1:-1)+Math.max(filtered().length,1))%Math.max(filtered().length,1);drawOptions();results.children[activeIndex]?.scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&filtered()[activeIndex]){e.preventDefault();choose(filtered()[activeIndex]);}if(e.key==='Escape'){e.preventDefault();hide();add.focus({preventScroll:true});}};
  add.onclick=()=>{if(popup.matches(':popover-open'))return hide();activeIndex=0;drawOptions();popup.showPopover();const rect=root.getBoundingClientRect();popup.style.width=Math.min(420,innerWidth-24,Math.max(280,rect.width))+'px';const box=popup.getBoundingClientRect();popup.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left))+'px';popup.style.top=Math.max(12,rect.bottom+box.height+8<innerHeight?rect.bottom+8:rect.top-box.height-8)+'px';search.focus({preventScroll:true});};
  const dismiss=event=>{if(!popup.contains(event.target))hide();};popup.addEventListener('toggle',()=>{const open=popup.matches(':popover-open');add.setAttribute('aria-expanded',String(open));document[open?'addEventListener':'removeEventListener']('scroll',dismiss,true);window[open?'addEventListener':'removeEventListener']('resize',hide);});
  popup.append(h('div',{class:'reference-menu-search'},icon('search'),search),results);root.append(h('div',{class:'reference-control'},chips,add),popup);drawChips();drawOptions();return root;
}
export function propertyControl(field,{value,onChange,richValue,onRichChange,pickAsset,uploadAsset,resolveMedia,referenceOptions,altValue='',onMediaChange,renderText,resolveValue=value=>value}){
  const wrap=h('div',{class:'auto-field cms-property','data-schema-field':field.key}),label=h('label',{class:'cap'},field.label+(field.required?' *':''));wrap.append(label);
  if(field.help)wrap.append(h('p',{class:'hint'},field.help));
  const input=(type='text')=>{const el=h('input',{type,'aria-label':field.label,...(field.required?{required:''}:{})});el.value=value??field.default??'';return el;};
  if(field.key==='ogImage')wrap.append(openGraphEditor({value:value||'',alt:altValue,onChange:media=>{if(onMediaChange)onMediaChange(media);else onChange(media.url);},pickAsset,uploadAsset,resolveMedia:resolveMedia||resolveValue}));
  else if(field.type==='richtext')wrap.append(richTextEditor({value:richValue ?? value ?? '',onChange:onRichChange,pickAsset,uploadAsset,resolveMedia}));
  else if(['reference','multireference'].includes(field.type)){
    const content=h('div',null,loading('Loading related items…'));wrap.append(content);
    Promise.resolve(referenceOptions(field.collection)).then(options=>content.replaceChildren(referencePicker({value:value??field.default,multiple:field.type==='multireference',options,onChange}))).catch(error=>content.replaceChildren(h('p',{class:'field-error',role:'alert'},error.message)));
  }else if(['select','status','multiselect'].includes(field.type)){
    if(field.type==='multiselect'){
      const selected=Array.isArray(value)?[...value]:[...(field.default||[])];wrap.append(h('div',{class:'property-options'},...(field.options||[]).map(option=>{const check=h('input',{type:'checkbox'});check.checked=selected.includes(option);check.onchange=()=>{const next=new Set(selected);if(check.checked)next.add(option);else next.delete(option);selected.splice(0,selected.length,...next);onChange([...next]);};return h('label',null,check,option);})));}
    else{const select=h('select',{'aria-label':field.label},h('option',{value:''},'Choose…'),...(field.options||[]).map(option=>h('option',{value:option},option)));select.value=value??field.default??'';select.onchange=()=>onChange(select.value);wrap.append(select);}
  }else if(field.type==='checkbox'){
    const check=h('input',{type:'checkbox','aria-label':field.label});check.checked=Boolean(value??field.default);check.onchange=()=>onChange(check.checked);wrap.append(check);
  }else if(['date','datetime'].includes(field.type)){wrap.append(dateControl({value:value??field.default??'',withTime:field.type==='datetime',label:field.label,required:field.required,onChange}));
  }else if(field.type==='number'){
    const el=input(field.type==='datetime'?'datetime-local':field.type);if(field.type==='datetime')el.value=(value||'').slice(0,16);if(field.min!=null)el.min=field.min;if(field.max!=null)el.max=field.max;
    el.onchange=()=>{if(!el.checkValidity())return el.reportValidity();onChange(field.type==='number'?el.value===''?'':el.valueAsNumber:field.type==='datetime'&&el.value?new Date(el.value).toISOString():el.value);};wrap.append(el);
  }else if(['image','gallery'].includes(field.type)){
    let images=field.type==='gallery'?(Array.isArray(value)?structuredClone(value):[]):value?[{src:value,alt:altValue}]:[];
    const grid=h('div',{class:'property-gallery image-property-gallery'});wrap.append(grid);
    const commit=()=>{if(field.type==='gallery')onChange(structuredClone(images));else if(onMediaChange)onMediaChange(images[0]||{src:'',alt:''});else onChange(images[0]?.src||'');};
    const draw=()=>{
      grid.replaceChildren(...images.map((image,index)=>{
        const row=h('div',{class:'property-image','data-image-index':index}),control=imageEditor({value:image,compact:true,caption:false,pickAsset,uploadAsset,resolveMedia:resolveMedia||resolveValue,onChange:next=>{if(!next.url)images.splice(index,1);else images[index]={src:next.url,alt:next.alt};commit();draw();}});
        row.append(control);
        if(field.type==='gallery'){const grip=h('button',{type:'button',class:'drag-grip','aria-label':'Move image'},'⠿');grip.onpointerdown=event=>startSortable(event,{row,root:grid,listSelector:'.property-gallery',rowSelector:'.property-image',layout:'grid',onDrop:({index:to})=>{images.splice(to,0,images.splice(index,1)[0]);commit();draw();}});grip.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const to=index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);if(to<0||to>=images.length)return;images.splice(to,0,images.splice(index,1)[0]);commit();draw();grid.querySelectorAll('.drag-grip')[to]?.focus({preventScroll:true});};row.append(grip);}
        return row;
      }));
      if(field.type==='gallery'||!images.length)grid.append(imageEditor({value:{},compact:true,caption:false,pickAsset,uploadAsset,resolveMedia:resolveMedia||resolveValue,onChange:next=>{if(next.url){images.push({src:next.url,alt:next.alt});commit();draw();}}}));
    };draw();
  }else if(field.type==='file'){
    let media=field.type==='gallery'?(Array.isArray(value)?structuredClone(value):[]):value?[{src:value,alt:altValue}]:[],selectedIndex=0;
    const box=h('div',{class:'property-media'});wrap.append(box);
    const commit=()=>{if(field.type==='gallery')onChange(structuredClone(media));else if(onMediaChange)onMediaChange(media[0] || {src:'',alt:''});else onChange(media[0]?.src||'');};
    function draw(){
      const grid=h('div',{class:'property-gallery'});
      for(const [index,item]of media.entries()){
        const card=h('div',{class:'property-media-card'+(selectedIndex===index?' on':''),'data-image-index':index});
        const thumb=field.type==='file'?h('span',{class:'property-file-icon'},icon('files')):h('img',{src:resolveValue(item.src),alt:item.alt||'',loading:'lazy'});
        const grip=h('button',{type:'button',class:'drag-grip','aria-label':'Reorder image'},'⠿');
        grip.onpointerdown=event=>startSortable(event,{row:card,root:grid,listSelector:'.property-gallery',rowSelector:'.property-media-card',onDrop:({index:to})=>{media.splice(to,0,media.splice(index,1)[0]);selectedIndex=to;commit();draw();}});
        card.append(h('button',{type:'button',class:'property-thumb','aria-label':'Image '+(index+1),onclick:()=>{selectedIndex=index;draw();}},thumb),h('div',{class:'property-media-actions'},field.type==='gallery'?grip:null,button('',{variant:'danger',size:'small',icon:'trash','aria-label':'Remove file',onclick:()=>{media.splice(index,1);selectedIndex=Math.max(0,index-1);commit();draw();}})));grid.append(card);
      }
      const item=media[selectedIndex],detail=h('div',{class:'property-media-detail'});
      if(item){const alt=h('input',{type:'text',value:item.alt||'',placeholder:'Image description','aria-label':'Image description'});alt.oninput=()=>{item.alt=alt.value;commit();};if(field.type!=='file')detail.append(alt);
        detail.append(h('div',{class:'field-actions'},button('Replace',{variant:'ghost',size:'small',onclick:()=>pickAsset(field.type==='file'?'file':'image',url=>{item.src=url;commit();draw();})}),disclosure('File path',h('code',null,item.src))));}
      box.replaceChildren(grid,detail,button(field.type==='gallery'?'Add image':media.length?'Choose another':'Choose '+field.type,{variant:'ghost',size:'small',icon:'plus',onclick:()=>pickAsset(field.type==='file'?'file':'image',url=>{if(field.type==='gallery')media.push({src:url,alt:''});else media=[{src:url,alt:''}];selectedIndex=media.length-1;commit();draw();})}));
    }draw();
  }else if(renderText)wrap.append(renderText(field));
  else{const el=field.type==='textarea'?h('textarea',{rows:3,'aria-label':field.label},value??field.default??''):input(['email','url','phone'].includes(field.type)?field.type==='phone'?'tel':field.type:'text');el.oninput=()=>onChange(el.value);wrap.append(el);}
  return wrap;
}
