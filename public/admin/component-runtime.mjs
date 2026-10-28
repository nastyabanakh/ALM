import { resolveProps } from './component-model.mjs';
import { resolve as resolveTokens } from './const-tokens.mjs';
let content = {};
try { content = JSON.parse(document.getElementById('cms-components-data')?.textContent || '{}'); } catch {}
const components = [...document.querySelectorAll('[data-cms-instance]')].flatMap(element => {
  try { return [{ element, descriptor: JSON.parse(element.dataset.cmsInstance) }]; } catch { return []; }
});
const resolve = value => resolveTokens(value, content.consts);

function apply() {
  for (const entry of components) {
    const { element } = entry;
    try { entry.descriptor = JSON.parse(element.dataset.cmsInstance); } catch {}
    const descriptor = entry.descriptor;
    const values = resolveProps(content, descriptor);
    for (const [key, raw] of Object.entries(values)) {
      const value = String(resolve(raw) ?? '');
      if (key === 'href') {
        if (element.tagName === 'A' && /^(#|\/(?!\/)|https?:\/\/|mailto:|tel:|$)/i.test(value)) element.setAttribute('href', value);
      } else if (key === 'target') {
        if (element.tagName === 'A') {
          element.setAttribute('target', value === '_blank' ? '_blank' : '_self');
          const rel = new Set((element.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
          if (value === '_blank') { rel.delete('opener'); rel.add('noopener'); rel.add('noreferrer'); }
          element.setAttribute('rel', [...rel].join(' '));
        }
      } else if (key === 'ariaLabel') element.setAttribute('aria-label', value);
      else for (const node of element.querySelectorAll('[data-cms-property]')) {
        if (node.dataset.cmsProperty !== key || node.closest('[data-cms-instance]') !== element || node.classList.contains('cms-editing')) continue;
        if (window.CMSConstPreview) { window.CMSConstPreview.render(node, raw, content.consts, true); continue; }
        node.replaceChildren(...value.split(/<br\s*\/?\s*>|\n/gi).flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
      }
    }
  }
}
apply();
addEventListener('cms-bindings-refresh', apply);
if (parent !== window && new URLSearchParams(location.search).get('cms-preview') === '1') {
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'CMS_DRAFT_UPDATE') return;
    content = event.data.content || {}; apply();
  });
}
