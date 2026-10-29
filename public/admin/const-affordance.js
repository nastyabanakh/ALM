(() => {


  if (parent === window || new URLSearchParams(location.search).get('cms-preview') !== '1') return;
  if (!document.querySelector('link[data-cms-ui-tokens]')) { const tokens=document.createElement('link'); tokens.rel='stylesheet'; tokens.href='/admin/design-tokens.css'; tokens.dataset.cmsUiTokens=''; document.head.append(tokens); }
  const frame = document.createElement('div'); frame.dataset.cmsEditorUi = 'const-frame'; frame.hidden = true;
  frame.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid var(--ui-color-const);box-sizing:border-box';
  const button = document.createElement('button'); button.type = 'button'; button.dataset.cmsEditorUi = 'true';
  button.setAttribute('aria-label', 'Edit shared Const');
  button.style.cssText = 'position:absolute;left:-2px;bottom:100%;display:flex;align-items:center;gap:5px;min-height:23px;padding:3px 6px;border:0;border-radius:4px 4px 0 0;background:var(--ui-color-const-strong);color:var(--ui-white);pointer-events:auto;font:500 12px/1.3 system-ui;white-space:nowrap;cursor:pointer';
  const icon = document.createElement('span');
  icon.style.cssText = "width:14px;height:14px;background:currentColor;mask:url('/admin/icons/variable.svg') center/contain no-repeat;-webkit-mask:url('/admin/icons/variable.svg') center/contain no-repeat";
  const label = document.createElement('span'); button.append(icon, label); frame.append(button); document.body.append(frame);
  const style = document.createElement('style');
  style.textContent = '.cms-const-fragment{font:inherit;color:inherit;letter-spacing:inherit}.cms-const-fragment:hover{background:var(--ui-color-const-soft)!important}.cms-const-fragment.cms-const-selected{outline:2px solid var(--ui-color-const)!important;outline-offset:2px!important}';
  document.head.append(style);
  let target = null, selected = null;
  function draw() {
    if (!target?.isConnected) { frame.hidden = true; return; }
    const rect = target.getBoundingClientRect();
    frame.style.left = rect.left - 2 + 'px'; frame.style.top = rect.top - 2 + 'px';
    frame.style.width = rect.width + 4 + 'px'; frame.style.height = rect.height + 4 + 'px';
    button.style.bottom = rect.top >= 28 ? '100%' : 'auto'; button.style.top = rect.top >= 28 ? 'auto' : '100%';
    label.textContent = target.dataset.cmsConstName || target.dataset.cmsConstKey; frame.hidden = false;
  }
  document.addEventListener('pointermove', event => {
    if (frame.contains(event.target)) return;
    target = event.target.closest?.('[data-cms-const-fragment],[data-cms-const-key]') || null; draw();
  }, true);
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (target?.dataset.cmsConstKey) parent.postMessage({ type: 'CMS_CONST_FOCUS', key: target.dataset.cmsConstKey }, location.origin);
  });
  document.addEventListener('pointerleave', () => { target = null; draw(); });
  addEventListener('scroll', draw, { passive: true }); addEventListener('resize', draw);
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.type === 'CMS_HIGHLIGHT_CONST') selected = event.data.key;
    requestAnimationFrame(() => { document.querySelectorAll('[data-cms-const-fragment]').forEach(node => node.classList.toggle('cms-const-selected', Boolean(selected) && node.dataset.cmsConstKey === selected)); draw(); });
  });
})();
