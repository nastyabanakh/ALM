import {configuredFieldsHTML} from './published-fields.mjs';
import {renderRichText} from '../public/admin/rich-text-model.mjs';
import { listDraftMedia } from './media-draft.mjs';
import { HOME_PAGE_ID } from './model.mjs';
import { resolveEntryConstants, resolveContentConstants } from './constants.mjs';
import { getEntry, listEntries } from './store.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export async function renderDraftPreview(collection, id) {
  const entry = await getEntry(collection, id);
  if (!entry.draft?.data) return null;
  const home = await getEntry('pages', HOME_PAGE_ID).catch(error=>{if(error.status===404)return null;throw error;});
  const data = resolveEntryConstants(entry.draft.data,(home?.draft?.data||home?.published)?.content?.consts||{});
  const library = await listDraftMedia().catch(error=>{if(error.code==='ENOENT')return {assets:[]};throw error;});
  const previewSource = src => library.assets.find(asset=>asset.url===src)?.previewUrl || src;
  const paragraphs=renderRichText(data.richText?.body || data.body || '',{resolveMedia:previewSource});
  const pageEntries={};
  for(const kind of ['posts','projects'])pageEntries[kind]=await Promise.all((await listEntries(kind)).map(async summary=>{const entry=await getEntry(kind,summary.id);return resolveEntryConstants(entry.draft?.data||entry.published,(home?.draft?.data||home?.published)?.content?.consts||{});}));
  const extras=configuredFieldsHTML(resolveContentConstants((home?.draft?.data||home?.published)?.content||{}),'page:'+collection,data,pageEntries);
  const cover = data.cover?.src
    ? `<img class="cover" src="${escape(previewSource(data.cover.src))}" alt="${escape(data.cover.alt)}">`
    : '';
  const gallery = collection === 'projects' && Array.isArray(data.gallery)
    ? `<div class="gallery">${data.gallery.map(image => `<img src="${escape(previewSource(image.src))}" alt="${escape(image.alt)}">`).join('')}</div>`
    : '';
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Чернетка: ${escape(data.title)}</title>
<style>
body{margin:0;background:#101010;color:#f4f4f0;font:18px/1.6 system-ui,sans-serif}
header{position:sticky;top:0;background:#d4af37;color:#111;padding:10px 24px;font:700 14px system-ui,sans-serif}
main{max-width:960px;margin:auto;padding:64px 24px}h1{font-size:clamp(44px,7vw,90px);line-height:1.05;margin:0 0 24px}
.summary{font-size:24px;color:#bbb}.cover,.gallery img{width:100%;height:auto;display:block;margin:32px 0}
.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.gallery img{margin:0}.cms-rich-content>*{margin-block:20px}.cms-rich-content blockquote{border-left:2px solid currentColor;padding-left:20px}.cms-rich-content pre,.cms-rich-content table{overflow:auto}.cms-rich-content img,.cms-rich-content video{max-width:100%}
@media(max-width:650px){.gallery{grid-template-columns:1fr}}
</style></head><body><header>ПРИВАТНЕ ПРЕВ'Ю ЧЕРНЕТКИ · ${escape(collection === 'posts' ? 'СТАТТЯ' : 'ПРОЄКТ')}</header>
<main><h1>${escape(data.title)}</h1><p class="summary">${escape(data.excerpt || data.summary)}</p>${cover}<div class="cms-rich-content">${paragraphs}</div>${gallery}<div class="cms-extra-content">${extras}</div></main></body></html>`;
}
