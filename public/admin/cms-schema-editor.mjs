import {h,icon,button,publishedToggle,backAction,groupFooter} from './ui-components.mjs';
import {slugify} from '../cms/slug.mjs';
import {dateControl} from './date-control.mjs';
import {startSortable} from './sortable.mjs';
import {fieldTypes,valueIssue} from './cms-schema-model.mjs';

export function collectionDesigner({label,schema,collections,onSave,onClose}){
  const draft=structuredClone(schema),root=h('div',{class:'collection-designer'}),error=h('p',{class:'field-error',role:'alert'});
  const title=h('input',{type:'text',value:label,'aria-label':'Collection name',maxlength:120});
  const input=(value='',attrs={})=>h('input',{type:'text',value,...attrs});
  const field=(label,control)=>h('label',{class:'schema-setting'},h('span',{class:'cap'},label),control);
  const optionsSelect=(options,value,label)=>{const el=h('select',{'aria-label':label},...options.map(([key,label])=>h('option',{value:key},label)));el.value=value;return el;};
  const typeIcons={text:'type',textarea:'file-text',richtext:'panels-top-left',number:'variable',checkbox:'check',date:'calendar',datetime:'calendar',url:'link',email:'globe-2',phone:'smartphone',select:'chevron-down',multiselect:'files',status:'settings-2',image:'image',file:'file',gallery:'images',reference:'link',multireference:'database',slug:'link'};
  const typeHints={text:'A single line',textarea:'Multiple lines',richtext:'Formatted blocks',number:'Numeric values',checkbox:'On or off',date:'Calendar date',datetime:'Date and time',url:'Website link',email:'Email address',phone:'Phone number',select:'One option',multiselect:'Several options',status:'Custom stages',image:'One image',file:'Downloadable file',gallery:'Ordered images',reference:'One CMS item',multireference:'Several CMS items'};
  function editField(existing=null,groupId=draft.groups[0]?.id){
    const value=existing?structuredClone(existing):{id:crypto.randomUUID(),key:'custom.field'+crypto.randomUUID().replace(/-/g,''),label:'',type:'text',group:groupId,required:false};
    const protectedPageField=value.builtin&&value.required&&['title','name','question','stageTitle','label','titleLine1','slug','seo.title','seo.description'].includes(value.key);
    const allowed=protectedPageField?[[value.type,fieldTypes.find(([type])=>type===value.type)?.[1]||'URL slug']]:value.builtin?(value.type==='slug'?[['slug','URL slug']]:fieldTypes.filter(([type])=>type===value.type || ['text','textarea','richtext'].includes(value.type)&&['text','textarea','richtext'].includes(type))):fieldTypes;
    const defaults=new Map([[value.type,value.default]]);
    function pickType(){
      const grid=h('div',{class:'field-type-grid',role:'group','aria-label':'Field type'});
      for(const [type,label]of allowed)grid.append(h('button',{type:'button',class:'field-type-card'+(existing&&value.type===type?' on':''),'aria-pressed':String(value.type===type),onclick:()=>{defaults.set(value.type,value.default);value.type=type;value.default=defaults.get(type);details();}},icon(typeIcons[type]),h('strong',null,label),h('small',null,typeHints[type]||label)));
      root.replaceChildren(backAction('Fields',draw),h('h2',null,existing?'Change field type':'Choose field type'),grid,error);grid.querySelector('button')?.focus();
    }
    function details(){
      error.textContent='';
      const name=input(value.label,{'aria-label':'Field name',placeholder:'Field name',maxlength:120}),group=optionsSelect(draft.groups.map(g=>[g.id,g.label]),value.group,'Field group'),help=input(value.help||'',{'aria-label':'Help text',placeholder:'Optional'}),required=h('input',{type:'checkbox','aria-label':'Required'});
      required.checked=Boolean(value.required);required.disabled=Boolean(value.builtin&&existing?.required);
      let defaultValue=value.default;
      const options=h('textarea',{rows:3,'aria-label':'Options',placeholder:'One option per line'},(value.options||[]).join('\n')),
        target=optionsSelect([['','Choose a collection…'],...collections.map(c=>[c.key,c.label])],value.collection||'','Reference collection'),
        min=input(value.min??'',{type:'number','aria-label':'Minimum'}),max=input(value.max??'',{type:'number','aria-label':'Maximum'}),settings=h('div',{class:'schema-field-settings'}),defaultWrap=h('div');
      const optionValues=()=>[...new Set(options.value.split('\n').map(v=>v.trim()).filter(Boolean))];
      const capture=()=>{value.label=name.value.trim();value.group=group.value;value.help=help.value.trim();value.required=required.checked;value.hidden=false;value.default=defaultValue;if(value.type==='number'){value.min=min.value===''?undefined:Number(min.value);value.max=max.value===''?undefined:Number(max.value);}if(['select','status','multiselect'].includes(value.type))value.options=optionValues();if(target.value)value.collection=target.value;};
      function drawDefault(){
        let control;const type=value.type;
        if(['richtext','gallery','reference','multireference'].includes(type)){defaultWrap.replaceChildren();return;}
        if(type==='checkbox')control=publishedToggle(Boolean(defaultValue),next=>defaultValue=next,{label:'Checked by default'});
        else if(type==='date'||type==='datetime')control=dateControl({value:typeof defaultValue==='string'?defaultValue:'',withTime:type==='datetime',label:'Default value',onChange:next=>defaultValue=next});
        else if(type==='select'||type==='status'){
          const choices=optionValues();if(defaultValue&&!choices.includes(defaultValue))defaultValue=undefined;
          control=optionsSelect([['','No default'],...choices.map(v=>[v,v])],defaultValue||'','Default value');control.onchange=()=>defaultValue=control.value||undefined;
        }else if(type==='multiselect'){
          const choices=optionValues();defaultValue=(Array.isArray(defaultValue)?defaultValue:[]).filter(v=>choices.includes(v));
          control=h('div',{class:'schema-default-options'},...choices.map(option=>{const check=h('input',{type:'checkbox'});check.checked=defaultValue.includes(option);check.onchange=()=>{defaultValue=check.checked?[...defaultValue,option]:defaultValue.filter(v=>v!==option);};return h('label',{class:'schema-check'},check,option);}));
        }else{
          control=type==='textarea'?h('textarea',{rows:3,'aria-label':'Default value'},defaultValue??''):input(defaultValue??'',{type:type==='number'?'number':'text','aria-label':'Default value',placeholder:'Optional'});
          control.oninput=()=>defaultValue=control.value===''?undefined:type==='number'?control.valueAsNumber:control.value;
        }
        defaultWrap.replaceChildren(field('Default value',control));
      }
      if(['select','status','multiselect'].includes(value.type)){settings.append(field('Options',options));options.oninput=drawDefault;}
      if(['reference','multireference'].includes(value.type))settings.append(field('Collection',target));
      if(value.type==='number')settings.append(h('div',{class:'schema-two-columns'},field('Minimum',min),field('Maximum',max)));
      drawDefault();settings.append(defaultWrap);
      const save=()=>{
        capture();if(!value.label)return name.focus();
        if(['select','status','multiselect'].includes(value.type)&&!value.options.length){error.textContent='Add at least one option.';options.focus();return;}
        if(['reference','multireference'].includes(value.type)){if(!target.value)return target.focus();value.collection=target.value;delete value.default;}
        else if(['richtext','gallery'].includes(value.type)||defaultValue===undefined||defaultValue==='')delete value.default;
        else value.default=defaultValue;
        if(!['select','status','multiselect'].includes(value.type))delete value.options;
        if(!['reference','multireference'].includes(value.type))delete value.collection;
        delete value.min;delete value.max;
        if(value.type==='number'){
          if(min.value!=='')value.min=Number(min.value);if(max.value!=='')value.max=Number(max.value);
          if((value.min!=null&&!Number.isFinite(value.min))||(value.max!=null&&!Number.isFinite(value.max))||value.min!=null&&value.max!=null&&value.min>value.max){error.textContent='Check the minimum and maximum.';return;}
        }
        if(value.default!=null){const issue=valueIssue(value,value.default);if(issue){error.textContent='Default value: '+issue;return;}}
        const index=draft.fields.findIndex(item=>item.id===value.id);if(index<0)draft.fields.push(value);else draft.fields[index]=value;draw();
      };
      const typeLabel=fieldTypes.find(([type])=>type===value.type)?.[1]||'URL slug',key=h('code',{class:'schema-field-key'},value.key);
      root.replaceChildren(backAction('Fields',draw),h('div',{class:'schema-edit-heading'},h('h2',null,existing?'Edit field':'New field'),button(typeLabel,{variant:'ghost',size:'small',icon:typeIcons[value.type],disabled:allowed.length<2,onclick:()=>{capture();pickType();}})),field('Name',name),key,field('Group',group),settings,field('Help text',help),h('label',{class:'schema-check'},required,'Required'),error,
        h('div',{class:'mod-f schema-field-footer'},existing&&!existing.builtin?button('Remove field',{variant:'danger',onclick:()=>{
          const confirmation=h('div',{class:'schema-confirm'},h('p',{class:'hint'},'Remove this field? Its stored content is preserved.'),h('div',{class:'confirmation-actions'},button('Cancel',{variant:'ghost',onclick:()=>confirmation.remove()}),button('Remove',{variant:'danger',onclick:()=>{draft.fields=draft.fields.filter(f=>f.id!==existing.id);draw();}})));root.append(confirmation);
        }}):null,button('Cancel',{variant:'ghost',onclick:draw}),button('Save field',{variant:'primary',onclick:save})));
      if(!existing)name.oninput=()=>{const parts=slugify(name.value).split('-').filter(Boolean);if(!parts.length)return;let base=parts[0]+parts.slice(1).map(part=>part[0].toUpperCase()+part.slice(1)).join('');if(!/^[a-z]/.test(base))base='field'+base;let candidate='custom.'+base,index=2;while(draft.fields.some(field=>field.id!==value.id&&field.key===candidate))candidate='custom.'+base+index++;value.key=candidate;key.textContent=candidate;};
      name.focus();
    }
    if(existing)details();else pickType();
  }
  function reorderField(field,target,before){
    draft.fields=draft.fields.filter(item=>item.id!==field.id);field.group=target;
    let index=before?draft.fields.findIndex(item=>item.id===before):-1;
    if(index<0){const last=draft.fields.map((item,index)=>item.group===target?index:-1).filter(index=>index>=0).at(-1);index=last==null?draft.fields.length:last+1;}
    draft.fields.splice(index,0,field);draw();
  }
  function draw(){
    error.textContent='';const groupList=h('div',{class:'schema-group-list'});
    for(const group of draft.groups){
      const list=h('div',{class:'schema-field-list','data-group-id':group.id});
      for(const fieldDef of draft.fields.filter(field=>field.group===group.id)){
        const row=h('div',{class:'schema-field','data-field-id':fieldDef.id}),grip=h('button',{type:'button',class:'drag-grip','aria-label':'Move '+fieldDef.label},'⠿');
        grip.onpointerdown=event=>startSortable(event,{row,root:groupList,listSelector:'.schema-field-list',rowSelector:'.schema-field',onDrop:({list,before})=>reorderField(fieldDef,list.dataset.groupId,before?.dataset.fieldId)});
        grip.onkeydown=event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const peers=draft.fields.filter(f=>f.group===group.id),index=peers.indexOf(fieldDef),target=index+(event.key==='ArrowUp'?-1:1);if(target<0||target>=peers.length)return;reorderField(fieldDef,group.id,event.key==='ArrowUp'?peers[target].id:peers[target+1]?.id);};
        row.append(grip,h('button',{type:'button',class:'schema-field-open',onclick:()=>editField(fieldDef)},icon(typeIcons[fieldDef.type]||'type'),h('strong',null,fieldDef.label),h('small',null,(fieldTypes.find(([type])=>type===fieldDef.type)?.[1]||'URL slug')+(fieldDef.required?' · Required':'')),icon('settings-2')));list.append(row);
      }
      if(!list.childElementCount)list.append(h('p',{class:'hint schema-drop'},'Drop fields here'));
      const name=input(group.label,{'aria-label':'Group name'});name.oninput=()=>group.label=name.value;
      const wrapper=h('section',{class:'schema-group','data-group-id':group.id}),groupGrip=h('button',{type:'button',class:'drag-grip','aria-label':'Reorder group'},'⠿');
      groupGrip.onpointerdown=event=>startSortable(event,{row:wrapper,root:groupList,listSelector:'.schema-group-list',rowSelector:'.schema-group',onDrop:({index})=>{draft.groups.splice(index,0,draft.groups.splice(draft.groups.indexOf(group),1)[0]);draw();}});
      wrapper.append(h('div',{class:'schema-group-header'},groupGrip,name,draft.groups.length>1?button('',{variant:'ghost',size:'small',icon:'trash','aria-label':'Remove group',onclick:()=>{const target=draft.groups.find(g=>g.id!==group.id);for(const field of draft.fields)if(field.group===group.id)field.group=target.id;draft.groups=draft.groups.filter(g=>g.id!==group.id);draw();}}):null),list,button('Add field',{variant:'ghost',size:'small',icon:'plus',onclick:()=>editField(null,group.id)}));groupList.append(wrapper);
    }
    root.replaceChildren(h('h2',null,'Edit collection'),field('Name',title),groupList,groupFooter(()=>{const group={id:crypto.randomUUID(),label:'New group'};draft.groups.push(group);draw();root.querySelector(`[data-group-id="${group.id}"] input`)?.focus();}),error,
      h('div',{class:'mod-f confirmation-actions'},button('Cancel',{variant:'ghost',onclick:onClose}),button('Save layout',{variant:'primary',onclick:async event=>{
        if(!title.value.trim()){title.focus();return;}if(draft.groups.some(group=>!group.label.trim())){error.textContent='Name every group.';return;}draft.name=title.value.trim();event.currentTarget.disabled=true;
        try{await onSave(draft);onClose();}catch(err){error.textContent=err.message;event.currentTarget.disabled=false;}
      }})));
  }draw();return root;
}
