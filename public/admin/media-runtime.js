(() => {
  let media = {};
  try { media = JSON.parse(document.getElementById('cms-media-data')?.textContent || '{}'); } catch {}
  const preview = parent !== window && new URLSearchParams(location.search).get('cms-preview') === '1';
  const assetPath = value => { try { const url = new URL(value,location.href); return url.origin===location.origin?decodeURIComponent(url.pathname):null; } catch {return null;} };
  function apply() {
    const changedVideos = new Set();
    for(const element of document.querySelectorAll('img,video,source')) {
      const actual=element.getAttribute('src')||'';
      let original=element.dataset.cmsMediaSource||actual;
      const actualPath=assetPath(actual);
      if(actualPath?.startsWith('/assets/')) {
        const url=new URL(actual,location.href);url.searchParams.delete('cmsv');original=decodeURIComponent(url.pathname)+url.search+url.hash;
      }
      element.dataset.cmsMediaSource=original;
      if(element.tagName==='SOURCE' && /\.(mp4|webm)(?:[?#]|$)/i.test(original)) element.setAttribute('type',/\.webm(?:[?#]|$)/i.test(original)?'video/webm':'video/mp4');
      const info=media[assetPath(original)];if(!info)continue;
      if(element.tagName==='IMG') {if(!element.hasAttribute('data-cms-base-alt'))element.dataset.cmsBaseAlt=element.getAttribute('alt')||'';element.alt=info.alt||element.dataset.cmsBaseAlt||'';}
      let next=preview&&info.previewUrl?info.previewUrl:original;
      if(info.updatedAt) {const url=new URL(next,location.href);url.searchParams.set('cmsv',String(Date.parse(info.updatedAt)||info.updatedAt));next=url.pathname+url.search+url.hash;}
      if(actual!==next) {element.setAttribute('src',next);const video=element.tagName==='VIDEO'?element:element.closest('video');if(video)changedVideos.add(video);}
    }
    for(const element of document.querySelectorAll('video[poster]')) {
      const original=element.getAttribute('poster'),info=media[assetPath(original)];if(!info?.updatedAt)continue;
      const next=new URL(preview&&info.previewUrl?info.previewUrl:original,location.href);next.searchParams.set('cmsv',String(Date.parse(info.updatedAt)||info.updatedAt));element.setAttribute('poster',next.pathname+next.search);
    }
    for(const video of changedVideos) {video.load();if(video.autoplay)video.play().catch(()=>{});}
  }
  apply();
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||!preview)return;
    if(event.data?.type==='CMS_MEDIA_UPDATE'&&event.data.media) {media=event.data.media;apply();}
    if(event.data?.type==='CMS_DRAFT_UPDATE')queueMicrotask(apply);
  });
})();
