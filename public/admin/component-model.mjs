/** Property inheritance shared by Astro rendering and the editor. */
export const definitions = {
  'main-button': { name: 'Main button', defaults: { text: 'REQUEST A CONSULTATION', href: '#consultation', target: '_self' }, modes: { text: 'text', href: 'href', target: 'target' } },
  'glass-card': { name: 'Glass card', defaults: { tag: 'About //', text: 'Tell us about your project.' }, modes: { tag: 'text', text: 'text' } },
  'circle-arrow': { name: 'Circle arrow', defaults: { ariaLabel: 'Select option', href: '#', target: '_self' }, modes: { ariaLabel: 'aria-label', href: 'href', target: 'target' } }
};
const baseValue = (content, descriptor, property) => {
  const path = descriptor.paths?.[property];
  return (path ? path.split('.').reduce((value, key) => value?.[key], content) : undefined) ?? descriptor.props[property];
};
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
export const instanceKey = descriptor => `${descriptor.page || '/'}|${descriptor.id}`;
export function defaultValue(content, descriptor, property) {
  return content?.components?.[descriptor.component]?.defaults?.[property] ?? definitions[descriptor.component]?.defaults[property] ?? descriptor.props[property];
}
export function isOverridden(content, descriptor, property) {
  const instance = content?.componentInstances?.[instanceKey(descriptor)];
  if (instance?.inherited?.includes(property)) return false;
  if (owns(instance?.overrides, property)) return true;
  // Preserve existing site content when components are first connected.
  return owns(descriptor.props, property) && baseValue(content, descriptor, property) !== definitions[descriptor.component]?.defaults[property];
}
export function propertyValue(content, descriptor, property) {
  const instance = content?.componentInstances?.[instanceKey(descriptor)];
  if (!isOverridden(content, descriptor, property)) return defaultValue(content, descriptor, property);
  return owns(instance?.overrides, property) ? instance.overrides[property] : baseValue(content, descriptor, property);
}
export function resolveProps(content, descriptor) {
  return Object.fromEntries(Object.keys(definitions[descriptor.component]?.defaults || descriptor.props).map(key => [key, propertyValue(content, descriptor, key)]));
}
export function writeOverride(content, descriptor, property, value) {
  const instance = ((content.componentInstances ||= {})[instanceKey(descriptor)] ||= { overrides: {}, inherited: [] });
  (instance.overrides ||= {})[property] = value;
  instance.inherited = (instance.inherited || []).filter(key => key !== property);
}
export function resetProperty(content, descriptor, property) {
  const instance = ((content.componentInstances ||= {})[instanceKey(descriptor)] ||= { overrides: {}, inherited: [] });
  delete (instance.overrides ||= {})[property];
  instance.inherited = [...new Set([...(instance.inherited || []), property])];
}
