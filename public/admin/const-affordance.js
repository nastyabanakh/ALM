(() => {
  if (parent === window || new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.cmsEditorUi = 'true';
  button.setAttribute('aria-label', 'Edit shared Const');
  button.hidden = true;
  const icon = document.createElement('span');
  icon.style.cssText = "display:block;width:15px;height:15px;background:currentColor;mask:url('/admin/icons/variable.svg') center/contain no-repeat;-webkit-mask:url('/admin/icons/variable.svg') center/contain no-repeat";
  button.append(icon);
  button.style.cssText = 'position:fixed;z-index:2147483647;width:24px;height:24px;padding:4px;border:1px solid #555;border-radius:6px;background:#fff;color:#111;box-shadow:0 2px 8px #0004;cursor:pointer;line-height:1';
  document.body.append(button);
  let key = null;
  document.addEventListener('pointermove', event => {
    if (button.contains(event.target)) return;
    const element = event.target.closest?.('[data-cms-const-key]');
    if (!element) { button.hidden = true; key = null; return; }
    key = element.dataset.cmsConstKey;
    const rect = element.getBoundingClientRect();
    button.title = `${element.dataset.cmsConstName || key} · shared Const · edits apply everywhere`;
    button.style.left = Math.max(2, Math.min(innerWidth - 27, rect.right - 12)) + 'px';
    button.style.top = Math.max(2, Math.min(innerHeight - 27, rect.top - 3)) + 'px';
    button.hidden = false;
  }, true);
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (key) parent.postMessage({ type: 'CMS_CONST_FOCUS', key }, location.origin);
  });
  document.addEventListener('pointerleave', () => { button.hidden = true; });
  addEventListener('scroll', () => { button.hidden = true; }, { passive: true });
})();
