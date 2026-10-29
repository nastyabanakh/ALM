import {h,button} from './ui-components.mjs';
import {imageEditor} from './media-editor.mjs';
export const OG_WIDTH=1200,OG_HEIGHT=630;

async function prepareOGFile(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a JPG or PNG image');
  const source=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Image could not be opened. Upload another file.'));img.src=source;});
    const width=img.naturalWidth,height=img.naturalHeight;
    if(width*height>40000000)throw new Error('Image is too large to process. Upload an image below 40 megapixels.');
    if(width<OG_WIDTH||height<OG_HEIGHT)throw new Error(`Image is too small (${width} × ${height}). Upload another image at least 1200 × 630.`);
    if(width===OG_WIDTH&&height===OG_HEIGHT&&file.type!=='image/webp')return file;
    return await new Promise((resolve,reject)=>{
      const canvas=h('canvas',{width:OG_WIDTH,height:OG_HEIGHT,class:'og-crop-canvas','aria-label':'Open Graph crop preview'}),context=canvas.getContext('2d'),base=Math.max(OG_WIDTH/width,OG_HEIGHT/height);
      const slider=(label,min,max,value,step)=>{const control=h('input',{type:'range',min,max,value,step,'aria-label':label});return control;};
      const zoom=slider('Zoom',1,1/base,1,.01),horizontal=slider('Horizontal position',0,100,50,1),vertical=slider('Vertical position',0,100,50,1);zoom.disabled=1/base<=1;
      const dialog=h('dialog',{class:'og-crop-dialog','aria-label':'Crop Open Graph image'});let finished=false;
      const close=(result,error)=>{if(finished)return;finished=true;dialog.close();dialog.remove();error?reject(error):resolve(result);};
      function draw(){const scale=base*Number(zoom.value),w=OG_WIDTH/scale,hh=OG_HEIGHT/scale,x=(width-w)*Number(horizontal.value)/100,y=(height-hh)*Number(vertical.value)/100;context.clearRect(0,0,OG_WIDTH,OG_HEIGHT);context.drawImage(img,x,y,w,hh,0,0,OG_WIDTH,OG_HEIGHT);}
      for(const control of [zoom,horizontal,vertical])control.oninput=draw;
      const cancel=()=>close(null,new DOMException('Crop cancelled','AbortError'));
      const apply=()=>{const png=file.type==='image/png';canvas.toBlob(blob=>{if(!blob)return close(null,new Error('Crop could not be saved'));close(new File([blob],file.name.replace(/\.[^.]+$/,'')+'-og.'+(png?'png':'jpg'),{type:blob.type}));},png?'image/png':'image/jpeg',.9);};
      dialog.append(h('h2',null,'Crop Open Graph image'),h('p',{class:'hint'},'1200 × 630'),canvas,h('div',{class:'og-crop-controls'},...[['Zoom',zoom],['Horizontal',horizontal],['Vertical',vertical]].map(([label,control])=>h('label',null,h('span',{class:'cap'},label),control))),h('div',{class:'confirmation-actions'},button('Cancel',{variant:'ghost',onclick:cancel}),button('Use crop',{variant:'primary',onclick:apply})));
      dialog.oncancel=e=>{e.preventDefault();cancel();};document.body.append(dialog);draw();dialog.showModal();
    });
  }finally{URL.revokeObjectURL(source);}
}
export function openGraphEditor({value='',alt='',onChange,pickAsset,uploadAsset,resolveMedia=url=>url}){
  const validated=new Set();
  async function upload(file){const prepared=await prepareOGFile(file),url=await uploadAsset(prepared);validated.add(url);return url;}
  async function validate(media){
    if(!media.url||validated.has(media.url))return media;
    const response=await fetch(resolveMedia(media.url));if(!response.ok)throw new Error('Image could not be opened. Upload another file.');
    const blob=await response.blob(),file=new File([blob],'open-graph.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'),{type:blob.type});
    const prepared=await prepareOGFile(file);
    if(prepared===file&&media.url.startsWith('/assets/')&&!/[?#]/.test(media.url)){validated.add(media.url);return media;}
    if(!uploadAsset)throw new Error('Image processing is unavailable in this preview.');const url=await uploadAsset(prepared);validated.add(url);return {...media,url};
  }
  return h('div',{class:'og-image-editor'},imageEditor({value:{url:value,alt},caption:false,onChange,pickAsset,uploadAsset:uploadAsset?upload:undefined,resolveMedia,validateImage:validate}),h('p',{class:'hint'},'1200 × 630 · JPG or PNG'));
}
