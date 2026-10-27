import { getEntry } from './store.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export async function renderDraftPreview(collection, id) {
  const entry = await getEntry(collection, id);
  const data = entry.draft?.data;
  if (!data) return null;
  const paragraphs = String(data.body || '').split(/\n\s*\n/).filter(Boolean).map(value => `<p>${escape(value)}</p>`).join('');
  const cover = data.cover?.src
    ? `<img class="cover" src="${escape(data.cover.src)}" alt="${escape(data.cover.alt)}">`
    : '';
  const gallery = collection === 'projects' && Array.isArray(data.gallery)
    ? `<div class="gallery">${data.gallery.map(image => `<img src="${escape(image.src)}" alt="${escape(image.alt)}">`).join('')}</div>`
    : '';
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Чернетка: ${escape(data.title)}</title>
<style>
body{margin:0;background:#101010;color:#f4f4f0;font:18px/1.6 system-ui,sans-serif}
header{position:sticky;top:0;background:#d4af37;color:#111;padding:10px 24px;font:700 14px system-ui,sans-serif}
main{max-width:960px;margin:auto;padding:64px 24px}h1{font-size:clamp(44px,7vw,90px);line-height:1.05;margin:0 0 24px}
.summary{font-size:24px;color:#bbb}.cover,.gallery img{width:100%;height:auto;display:block;margin:32px 0}
.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.gallery img{margin:0}
@media(max-width:650px){.gallery{grid-template-columns:1fr}}
</style></head><body><header>ПРИВАТНЕ ПРЕВ'Ю ЧЕРНЕТКИ · ${escape(collection === 'posts' ? 'СТАТТЯ' : 'ПРОЄКТ')}</header>
<main><h1>${escape(data.title)}</h1><p class="summary">${escape(data.excerpt || data.summary)}</p>${cover}${paragraphs}${gallery}</main></body></html>`;
}
