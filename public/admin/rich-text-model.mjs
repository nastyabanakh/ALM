export const blockTypes=[['paragraph','Text'],['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['h4','Heading 4'],['bullet','Bulleted list'],['numbered','Numbered list'],['todo','To-do'],['toggle','Toggle'],['quote','Quote'],['callout','Callout'],['code','Code'],['divider','Divider'],['image','Image'],['video','Video'],['file','File'],['bookmark','Bookmark'],['table','Table']];
const allowed=new Set(blockTypes.map(([type])=>type));
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeURL=(value,media=false)=>typeof value==='string' && (media?/^(https?:\/\/|\/assets\/)/i:/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i).test(value) && !/[\u0000-\u001f]/.test(value);
export const blockText=block=>Array.isArray(block?.runs)?block.runs.map(run=>typeof run?.text==='string'?run.text:'').join(''):typeof block?.text==='string'?block.text:'';
export function asDocument(value){
  if(value?.version===1 && Array.isArray(value.blocks))return structuredClone(value);
  const text=typeof value==='string'?value:'';
  return {version:1,blocks:text.split(/\n\s*\n/).map((text,index)=>({id:'legacy-'+index,type:'paragraph',runs:[{text}]}))};
}
export const documentText=value=>asDocument(value).blocks.map(block=>blockText(block)+(block.detail?'\n'+block.detail:'')+(block.rows?'\n'+block.rows.map(row=>row.join(' | ')).join('\n'):'' )).join('\n\n');
export function richTextIssues(value){
  const issues=[];if(!value || value.version!==1 || !Array.isArray(value.blocks))return ['Invalid rich text document'];
  if(value.blocks.length>2000)issues.push('Use fewer than 2000 blocks');
  const ids=new Set();
  for(const block of value.blocks){
    if(!block || typeof block.id!=='string' || ids.has(block.id))issues.push('Blocks need unique IDs');ids.add(block?.id);
    if(!allowed.has(block?.type))issues.push('Unknown block type');
    if(block?.runs && (!Array.isArray(block.runs)||block.runs.some(run=>!run||typeof run.text!=='string'||run.text.length>100000||run.href&&!safeURL(run.href)||run.target!=null&&!['_self','_blank'].includes(run.target))))issues.push('Invalid block text or link');
    if(block?.url && !safeURL(block.url,['image','video','file'].includes(block.type)))issues.push('Use a safe media or link URL');
    if(block?.rows && (!Array.isArray(block.rows)||block.rows.length>200||block.rows.some(row=>!Array.isArray(row)||row.length>50||row.some(cell=>typeof cell!=='string'||cell.length>100000))))issues.push('Invalid table');
    if(['text','detail','caption','alt'].some(key=>block?.[key]!=null&&(typeof block[key]!=='string'||block[key].length>100000)))issues.push('Invalid block content');
    if(block?.runs && Array.isArray(block.runs)&&block.runs.length>1000)issues.push('Too many text spans');
    if(block?.checked!=null&&typeof block.checked!=='boolean')issues.push('Invalid checkbox');
    if(block?.indent!=null && (!Number.isInteger(block.indent)||block.indent<0||block.indent>3))issues.push('Invalid block indentation');
  }return [...new Set(issues)];
}
function inline(block){
  return (block.runs || [{text:block.text || ''}]).map(run=>{
    let text=escapeHTML(run.text).replace(/\n/g,'<br>');
    if(run.underline)text='<u>'+text+'</u>';
    if(run.code)text='<code>'+text+'</code>';if(run.bold)text='<strong>'+text+'</strong>';if(run.italic)text='<em>'+text+'</em>';if(run.strike)text='<s>'+text+'</s>';
    if(run.href && safeURL(run.href))text='<a href="'+escapeHTML(run.href)+'" target="'+(run.target==='_blank'?'_blank':'_self')+'" rel="noopener noreferrer">'+text+'</a>';return text;
  }).join('');
}
export function renderRichText(value,{resolveMedia=url=>url}={}){
  const document=asDocument(value);if(richTextIssues(document).length)return '';
  let html='',openList='',openIndent=-1;
  const closeList=()=>{if(openList){html+=`</${openList}>`;openList='';}};
  for(const block of document.blocks){
    const text=inline(block),indent=Math.min(3,Math.max(0,block.indent||0)),attrs=`data-block="${escapeHTML(block.id)}" data-indent="${indent}"`;
    if(['bullet','numbered'].includes(block.type)){
      const tag=block.type==='bullet'?'ul':'ol';
      if(openList!==tag||openIndent!==indent){closeList();html+=`<${tag} data-indent="${indent}">`;openList=tag;openIndent=indent;}
      html+=`<li ${attrs}>${text}</li>`;continue;
    }
    closeList();
    if(/^h[1-4]$/.test(block.type)){html+=`<${block.type} ${attrs}>${text}</${block.type}>`;continue;}
    if(block.type==='todo'){html+=`<p ${attrs} class="cms-todo"><input type="checkbox" disabled ${block.checked?'checked':''}><span class="cms-todo-text">${text}</span></p>`;continue;}
    if(block.type==='toggle'){html+=`<details ${attrs}><summary>${text}</summary><p>${escapeHTML(block.detail||'').replace(/\n/g,'<br>')}</p></details>`;continue;}
    if(block.type==='quote'||block.type==='callout'){html+=`<blockquote ${attrs} class="cms-${block.type}">${text}</blockquote>`;continue;}
    if(block.type==='code'){html+=`<pre ${attrs}><code>${escapeHTML(blockText(block))}</code></pre>`;continue;}
    if(block.type==='divider'){html+='<hr '+attrs+'>';continue;}
    const url=escapeHTML(block.url&&safeURL(block.url,true)?resolveMedia(block.url):block.url||''),caption=escapeHTML(block.caption||'');
    if(block.type==='image'){if(block.url)html+=`<figure ${attrs}><img src="${url}" alt="${escapeHTML(block.alt||'')}">${caption?'<figcaption>'+caption+'</figcaption>':''}</figure>`;continue;}
    if(block.type==='video'){if(block.url)html+=`<figure ${attrs}><video src="${url}" controls preload="metadata"></video>${caption?'<figcaption>'+caption+'</figcaption>':''}</figure>`;continue;}
    if(block.type==='file'||block.type==='bookmark'){if(block.url)html+=`<p ${attrs}><a href="${url}" rel="noopener noreferrer">${caption||url}</a></p>`;continue;}
    if(block.type==='table'){html+=`<table ${attrs}><tbody>${(block.rows||[]).map(row=>'<tr>'+row.map(cell=>'<td>'+escapeHTML(cell)+'</td>').join('')+'</tr>').join('')}</tbody></table>`;continue;}
    html+=`<p ${attrs}>${text||'<br>'}</p>`;
  }
  closeList();return html;
}

// Markdown is an interchange format; the same allowlisted block document is used by drafts and publishing.
export function markdownRuns(text,marks={}){
  const runs=[],pattern=/\\([\\`*_~\[\]])|`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
  let from=0,match;
  while((match=pattern.exec(text))){
    if(match.index>from)runs.push({text:text.slice(from,match.index),...marks});
    if(match[1])runs.push({text:match[1],...marks});
    else if(match[2])runs.push({text:match[2],...marks,code:true});
    else if(match[3])runs.push(...markdownRuns(match[3],{...marks,...(safeURL(match[4])?{href:match[4],target:'_self'}:{})}));
    else runs.push(...markdownRuns(match[5]||match[6]||match[7]||match[8]||match[9],{...marks,...(match[5]||match[6]?{bold:true}:match[7]?{strike:true}:{italic:true})}));
    from=pattern.lastIndex;
  }
  if(from<text.length)runs.push({text:text.slice(from),...marks});return runs.length?runs:[{text:'',...marks}];
}
export function markdownShortcut(text){
  let match;
  if((match=/^(#{1,4}) $/.exec(text)))return {type:'h'+match[1].length};
  if(/^[*+-] $/.test(text))return {type:'bullet'};
  if(/^(?:\d+\.|[ai]\.) $/i.test(text))return {type:'numbered'};
  if(/^\[(?: |x|X)?\] ?$/.test(text))return {type:'todo',checked:/x/i.test(text)};
  if(/^[-*+] \[(?: |x|X)\] $/.test(text))return {type:'todo',checked:/x/i.test(text)};
  if(text==='> ')return {type:'toggle'};
  if(text==='" ')return {type:'quote'};
  if(/^```\w* ?$/.test(text))return {type:'code'};
  if(/^(---|\*\*\*|___) ?$/.test(text))return {type:'divider'};
  return null;
}
export function parseMarkdown(source){
  const lines=source.replace(/\r\n?/g,'\n').split('\n'),blocks=[];
  const make=(type,text='',extra={})=>({id:crypto.randomUUID(),type,runs:type==='code'?[{text}]:markdownRuns(text),...extra});
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i];let m;
    if(!line.trim()){continue;}
    if((m=/^\s*(`{3,}|~{3,})(.*)$/.exec(line))){const fence=m[1],body=[];while(++i<lines.length&&!lines[i].trim().startsWith(fence))body.push(lines[i]);blocks.push(make('code',body.join('\n')));continue;}
    if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[i+1])){const rows=[cells(line)];i++;while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim())rows.push(cells(lines[++i]));blocks.push(make('table','',{rows}));continue;}
    if((m=/^\s*!\[([^\]]*)\]\(([^\s)]+)\)\s*$/.exec(line))&&safeURL(m[2],true)){blocks.push(make('image','',{url:m[2],alt:m[1]}));continue;}
    if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){blocks.push(make('divider'));continue;}
    if((m=/^(#{1,4})\s+(.+)$/.exec(line))){blocks.push(make('h'+m[1].length,m[2].replace(/\s+#+\s*$/,'')));continue;}
    if((m=/^(\s*)(?:[-*+] )?\[([ xX]?)\]\s*(.*)$/.exec(line))){blocks.push(make('todo',m[3],{checked:/x/i.test(m[2]),indent:Math.min(3,Math.floor(m[1].replace(/\t/g,'  ').length/2))}));continue;}
    if((m=/^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line))){blocks.push(make(/\d/.test(m[2])?'numbered':'bullet',m[3],{indent:Math.min(3,Math.floor(m[1].replace(/\t/g,'  ').length/2))}));continue;}
    if((m=/^>\s?(.*)$/.exec(line))){blocks.push(make('quote',m[1]));continue;}
    // Soft line breaks stay in their paragraph, while block markers start a new block.
    const previous=blocks.at(-1);
    if(previous?.type==='paragraph'&&i>0&&lines[i-1].trim())previous.runs.push({text:'\n'},...markdownRuns(line));
    else blocks.push(make('paragraph',line));
  }
  return {version:1,blocks:blocks.length?blocks:[make('paragraph')]};
}
