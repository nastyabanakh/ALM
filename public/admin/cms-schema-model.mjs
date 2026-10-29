import {safeURL} from './rich-text-model.mjs';
export const fieldTypes=[['text','Text'],['textarea','Long text'],['richtext','Rich text'],['number','Number'],['checkbox','Checkbox'],['date','Date'],['datetime','Date & time'],['url','URL'],['email','Email'],['phone','Phone'],['select','Select'],['multiselect','Multi-select'],['status','Status'],['image','Image'],['file','File'],['gallery','Gallery'],['reference','Reference'],['multireference','Multi-reference']];
export const getPath=(item,path)=>path.split('.').reduce((value,key)=>value?.[key],item);
export function putPath(item,path,value){const parts=path.split('.');if(parts.some(part=>['__proto__','prototype','constructor'].includes(part)))throw new Error('Invalid field key');let target=item;for(const key of parts.slice(0,-1))target=target[key] ||= {};target[parts.at(-1)]=value;}
export function inferFields(item){
  const result=[];
  function walk(value,path){
    if(['richText','custom'].includes(path[0])||['id','_id','cmsState','active','slugMode','isPublished','ogImageAlt'].includes(path.at(-1)))return;
    const key=path.join('.'),name=path.at(-1)?.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
    if(value && typeof value==='object'&&!Array.isArray(value)){for(const [key,child]of Object.entries(value))walk(child,[...path,key]);return;}
    const type=Array.isArray(value)?value.every(v=>v?.src)?'gallery':'multiselect':typeof value==='boolean'?'checkbox':typeof value==='number'?'number':/^(image|photo|src|poster|cover)$/i.test(path.at(-1))||/^\/assets\//.test(String(value))?'image':/href|url/i.test(key)?'url':/body|article/i.test(key)?'richtext':String(value||'').length>100?'textarea':'text';
    result.push({id:key,key,label:name,type,group:type==='richtext'?'writing':['image','file','gallery'].includes(type)?'media':key.startsWith('seo.')?'seo':'content',builtin:true});
  }for(const [key,value]of Object.entries(item || {}))walk(value,[key]);return result;
}
export function pageFields(builtin=[]){
  const title=builtin.find(field=>['title','name','question','stageTitle','label','titleLine1'].includes(field.key))||{key:'title',label:'Page name'};
  return [{...title,type:'text',required:true},{key:'slug',label:'URL slug',type:'slug',required:true},{key:'seo.title',label:'SEO title',type:'text',required:true},{key:'seo.description',label:'SEO description',type:'textarea',required:true},{key:'ogImage',label:'Open Graph image',type:'image',required:false}];
}
export function collectionSchema(settings,scope,builtin=[]){
  const isPage=scope.startsWith('page:')||settings?.collectionModes?.[scope.slice(8)]==='page';
  const mandatory=isPage?pageFields(builtin):[];builtin=builtin.map(field=>mandatory.find(item=>item.key===field.key)||field);for(const field of mandatory)if(!builtin.some(item=>item.key===field.key))builtin.push(field);
  const base=builtin.filter(field=>!field.key.endsWith('.alt')||!builtin.some(other=>['media','image'].includes(other.type)&&other.key===field.key.replace(/\.alt$/,'.src'))).map(field=>({...field,id:field.key,builtin:true,type:field.key==='body'?'richtext':field.type==='media'?'image':field.type==='slug'?'slug':field.type,group:field.key==='body'?'writing':field.key.startsWith('seo.')||field.key==='ogImage'?'seo':['media','image','gallery'].includes(field.type)?'media':'content'}));
  const saved=settings?.collectionSchemas?.[scope] || {};
  const fields=(saved.fields || base).map(field=>{field={...field,hidden:false};const original=base.find(item=>item.key===field.key);return original?{...original,...field,key:original.key,builtin:true,required:Boolean(original.required||field.required),...(mandatory.some(item=>item.key===original.key)&&original.required?{type:original.type,required:true}:{} )}:field;});
  for(const field of base)if(!fields.some(item=>item.key===field.key))fields.push(field);
  const groups=saved.groups?.length?structuredClone(saved.groups):[{id:'content',label:'Details'},{id:'writing',label:'Content'},{id:'media',label:'Media'},{id:'seo',label:'SEO'},{id:'properties',label:'Properties'}];
  for(const field of fields)if(!groups.some(group=>group.id===field.group))groups.push({id:field.group,label:field.group==='seo'?'SEO':field.group==='media'?'Media':'Details'});
  return {name:saved.name || '',fields,groups};
}
export function valueIssue(field,value,targets){
  if(value===undefined || value===null || value==='' || Array.isArray(value)&&!value.length)return field.required?'This field is required':null;
  if(field.type==='number' && (typeof value!=='number'||!Number.isFinite(value)||field.min!=null&&value<field.min||field.max!=null&&value>field.max))return 'Enter a number within the allowed range';
  if(field.type==='checkbox' && typeof value!=='boolean')return 'Choose true or false';
  if(['text','textarea','url','email','phone','date','datetime','image','file','select','status','slug'].includes(field.type) && typeof value!=='string')return 'Enter a text value';
  if(['date','datetime'].includes(field.type)&&!Number.isFinite(Date.parse(value)))return 'Choose a valid date';
  if(field.type==='email'&&!/^\{\{const\./.test(value)&&!/^\S+@\S+\.\S+$/.test(value))return 'Enter an email address';
  if(field.type==='url'&&!/^\{\{const\./.test(value)&&!safeURL(value))return 'Use a safe URL';
  if(['image','file'].includes(field.type)&&!/^\{\{const\./.test(value)&&!safeURL(value,true))return 'Use a safe asset URL';
  if(['select','status'].includes(field.type)&&!(field.options || []).includes(value))return 'Choose one of the configured options';
  if(field.type==='multiselect'&&(!Array.isArray(value)||value.some(v=>!field.options?.includes(v))))return 'Choose configured options';
  if(field.type==='gallery'&&(!Array.isArray(value)||value.some(v=>!v||typeof v.src!=='string'||typeof v.alt!=='string'||!safeURL(v.src,true))))return 'Choose valid images';
  if(field.type==='reference' && (typeof value!=='string'||!targets?.has(value)))return 'Choose an existing active item';
  if(field.type==='multireference' && (!Array.isArray(value)||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||!targets?.has(v))))return 'Choose existing active items without duplicates';
  return null;
}
