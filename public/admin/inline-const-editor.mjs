import { references, resolve } from './const-tokens.mjs';

export function inlineConstEditor({ value, label, multiline, consts, onChange, onFocus, onEditConst }) {
  const element = document.createElement('div');
  element.className = 'inline-const-editor';
  element.contentEditable = 'true';
  element.setAttribute('role', 'textbox');
  element.setAttribute('aria-label', label);
  element.setAttribute('aria-multiline', String(multiline));
  element.dataset.placeholder = 'Type text or insert a Const…';
  let savedRange = null;
  const serialize = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
    if (node.dataset?.constToken) return node.dataset.constToken;
    if (node.nodeName === 'BR') return '\n';
    return [...node.childNodes].map((child, index) => (index && ['DIV', 'P'].includes(child.nodeName) ? '\n' : '') + serialize(child)).join('');
  };
  const makeFragment = text => {
    const fragment = document.createDocumentFragment(); let offset = 0;
    for (const ref of references(text)) {
      fragment.append(document.createTextNode(text.slice(offset, ref.index)));
      const chip = document.createElement('span');
      chip.className = 'inline-const-chip'; chip.contentEditable = 'false';
      chip.dataset.constToken = ref.token;
      chip.textContent = resolve(ref.token, consts());
      chip.title = `${consts()[ref.key]?.label || ref.key} · Double-click to edit Const`;
      chip.setAttribute('aria-label', `Const: ${consts()[ref.key]?.label || ref.key}: ${chip.textContent}`);
      chip.ondblclick = event => { event.preventDefault(); event.stopPropagation(); onEditConst(ref.key); };
      fragment.append(chip); offset = ref.index + ref.token.length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    return fragment;
  };
  element.append(makeFragment(value));
  function rememberSelection() {
    const selection = getSelection();
    if (selection?.rangeCount && element.contains(selection.anchorNode) && element.contains(selection.focusNode)) savedRange = selection.getRangeAt(0).cloneRange();
  }
  function emit() { onChange(serialize(element)); }
  function insert(text) {
    element.focus();
    const selection = getSelection();
    let range = savedRange;
    if (!range || !element.contains(range.commonAncestorContainer)) { range = document.createRange(); range.selectNodeContents(element); range.collapse(false); }
    range.deleteContents();
    const fragment = makeFragment(text), last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) range.setStartAfter(last);
    range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
    savedRange = range.cloneRange(); emit(); element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  element.addEventListener('input', () => { rememberSelection(); emit(); });
  element.addEventListener('keyup', rememberSelection);
  element.addEventListener('pointerup', rememberSelection);
  element.addEventListener('focus', onFocus);
  element.addEventListener('blur', rememberSelection);
  element.addEventListener('keydown', event => {
    rememberSelection();
    if (event.key === 'Enter' && !multiline) { event.preventDefault(); element.blur(); return; }
    if (!['Backspace', 'Delete'].includes(event.key) || !savedRange?.collapsed) return;
    const backward = event.key === 'Backspace';
    const { startContainer: node, startOffset: offset } = savedRange;
    let candidate = null;
    if (node.nodeType === Node.TEXT_NODE) {
      if (backward && offset === 0 || !backward && offset === node.textContent.length) candidate = backward ? node.previousSibling : node.nextSibling;
    } else candidate = node.childNodes[backward ? offset - 1 : offset];
    while (candidate?.nodeType === Node.TEXT_NODE && !candidate.textContent) candidate = backward ? candidate.previousSibling : candidate.nextSibling;
    if (candidate?.classList?.contains('inline-const-chip')) {
      event.preventDefault(); candidate.remove(); rememberSelection(); emit(); element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  element.addEventListener('paste', event => { event.preventDefault(); rememberSelection(); insert(event.clipboardData.getData('text/plain').replace(/\r\n/g, '\n')); });
  for (const type of ['copy', 'cut']) element.addEventListener(type, event => {
    rememberSelection(); if (!savedRange || savedRange.collapsed) return;
    event.preventDefault(); event.clipboardData.setData('text/plain', serialize(savedRange.cloneContents()));
    if (type === 'cut') { savedRange.deleteContents(); emit(); }
  });
  // Selection is captured on pointer/keyboard interaction and before opening the picker.
  return { element, rememberSelection, insert, value: () => serialize(element) };
}
