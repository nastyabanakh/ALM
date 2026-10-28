import { getEntry } from 'astro:content';
import { HOME_PAGE_ID } from './model.mjs';
import { definitions, resolveProps } from '../public/admin/component-model.mjs';
import { resolveConstReference } from './constants.mjs';

export async function componentProps(component, id, props, page, paths = {}) {
  const home = await getEntry('pages', HOME_PAGE_ID);
  const content = home?.data.content || {};
  const raw = { ...props };
  for (const [property, path] of Object.entries(paths)) {
    if (!path) continue;
    const value = path.split('.').reduce((value, key) => value?.[key], content);
    if (value !== undefined) raw[property] = value;
  }
  const descriptor = { component, id, page, props: raw, paths };
  const values = Object.fromEntries(Object.entries(resolveProps(content, descriptor)).map(([key, value]) => [key, resolveConstReference(value, content.consts)]));
  if (values.href && !/^(#|\/(?!\/)|https?:\/\/|mailto:|tel:)/i.test(values.href)) values.href = '#';
  return { descriptor: JSON.stringify(descriptor), values, name: definitions[component].name };
}
