// Keep ownership rules identical for deletion guards and path rewrites.
export function isLocalAssetOccurrence(text, offset, match) {
  const prefix = text.slice(0, offset);
  const tokenPrefix = prefix.slice(Math.max(...['"', "'", '`', '(', ' ', '\n', '\r', '\t'].map(separator=>prefix.lastIndexOf(separator))) + 1);
  const absolute = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(tokenPrefix);
  if (absolute) {
    // Unknown origins belong to other servers, even when their pathname matches.
    const ownOrigins = (process.env.CMS_SITE_ORIGIN || '').split(',').map(value=>value.trim()).filter(Boolean);
    if (!ownOrigins.some(origin=>{try{return new URL(tokenPrefix+match,origin).origin===new URL(origin).origin;}catch{return false;}})) return false;
  } else if (match.startsWith('/assets/') && /[\p{L}\p{N}_./%-]$/u.test(prefix)) return false;
  const next = text[offset + match.length];
  return match.endsWith('/') || !next || !/[\p{L}\p{N}_.%-]/u.test(next);
}
export function hasLocalAssetReference(text, url) {
  let offset = text.indexOf(url);
  while (offset !== -1) {
    if (isLocalAssetOccurrence(text,offset,url)) return true;
    offset = text.indexOf(url,offset+url.length);
  }
  return false;
}
