import {collectionSchema,inferFields,getPath,valueIssue,pageFields} from '../public/admin/cms-schema-model.mjs';
import {asDocument,blockText,richTextIssues} from '../public/admin/rich-text-model.mjs';
const skip=new Set(['editorSettings','custom','richText','components','componentInstances','consts','linkSettings','staticText','staticAttributes','pageOverrides','pageSettings','meta','pub']);
export function inlineCollectionMap(content){
  const result=new Map();function walk(value,path){if(Array.isArray(value)){if(value.every(item=>item&&typeof item==='object'&&!Array.isArray(item)))result.set('content:'+path.join('.'),value);return;}if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))if(!skip.has(key))walk(child,[...path,key]);}walk(content,[]);return result;
}
export function validateConfiguredContent(content,pageEntries,builtinFields){
  const issues=[],catalog=inlineCollectionMap(content),operations=content.editorSettings?.entryStates || {};
  for(const collection of ['posts','projects'])catalog.set('page:'+collection,(pageEntries[collection] || []).filter(item=>!['archived','deleted'].includes(operations[collection+':'+item.id]?.state || item.cmsState)));
  const configurations={...content.editorSettings?.collectionSchemas};for(const [key,mode]of Object.entries(content.editorSettings?.collectionModes||{}))if(mode==='page')configurations['content:'+key] ||= {};
  for(const [scope,configuration]of Object.entries(configurations)){
    if(!catalog.has(scope)){issues.push({path:['editorSettings','collectionSchemas',scope],message:'Collection no longer exists'});continue;}
    const entries=catalog.get(scope),builtin=scope.startsWith('page:')?builtinFields[scope.slice(5)] || []:inferFields(entries[0]);
    if(scope.startsWith('content:')&&content.editorSettings?.collectionModes?.[scope.slice(8)]==='page')for(const field of pageFields(builtin))if(!builtin.some(item=>item.key===field.key))builtin.push(field);
    const schema=collectionSchema(content.editorSettings,scope,builtin),ids=new Set(),keys=new Set(),groupIDs=new Set();
    for(const group of schema.groups){if(groupIDs.has(group.id))issues.push({path:['editorSettings','collectionSchemas',scope],message:'Duplicate group'});groupIDs.add(group.id);}
    for(const field of schema.fields){
      const path=['editorSettings','collectionSchemas',scope,field.key];
      if(ids.has(field.id)||keys.has(field.key))issues.push({path,message:'Duplicate field'});ids.add(field.id);keys.add(field.key);
      if(field.key.split('.').some(part=>['__proto__','prototype','constructor'].includes(part)) || !builtin.some(item=>item.key===field.key)&&!/^custom\.[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key))issues.push({path,message:'Invalid field key'});
      if(!schema.groups.some(group=>group.id===field.group))issues.push({path,message:'Choose a field group'});
      if(['reference','multireference'].includes(field.type)&&!catalog.has(field.collection))issues.push({path,message:'Choose an existing reference collection'});
      if(['select','multiselect','status'].includes(field.type)&&!field.options?.length)issues.push({path,message:'Add field options'});
      if(field.required&&field.hidden)issues.push({path,message:'A required field cannot be hidden'});
      if(field.default!==undefined){const defaultIssue=valueIssue(field,field.default);if(defaultIssue)issues.push({path,message:'Invalid default: '+defaultIssue});}
      const targets=new Set((catalog.get(field.collection)||[]).filter(item=>item.id!=null&&(item.isPublished!==false||operations[field.collection?.replace('page:','')+':'+item.id]?.state==='active')).map(item=>String(item.id)));
      for(const [index,entry]of entries.entries()){
        const raw=getPath(entry,field.key) ?? field.default,value=field.type==='richtext'?entry.richText?.[field.key] ?? raw:raw;
        let message=valueIssue(field,value,targets);
        if(field.type==='richtext' && value!=null){const doc=typeof value==='string'?asDocument(value):value;const errors=richTextIssues(doc);if(errors.length)message=errors[0];else if(field.required && !doc.blocks.some(block=>blockText(block).trim()||block.url||block.rows?.some(row=>row.some(cell=>cell.trim()))))message='This field is required';}
        if(message)issues.push({path:[scope,String(entry.id||index),field.key],message:`${entry.title||entry.question||entry.name||'Item '+(index+1)} · ${field.label}: ${message}`});
      }
    }
    if(scope.startsWith('content:')&&content.editorSettings?.collectionModes?.[scope.slice(8)]==='page'){const seen=new Set();for(const entry of entries){if(typeof entry.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)||entry.slug.length>120)issues.push({path:[scope,'slug'],message:'Enter a valid page slug'});else if(seen.has(entry.slug))issues.push({path:[scope,'slug'],message:'Page slug is already used in this collection'});seen.add(entry.slug);}}
  }return issues;
}
