const transliteration = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ъ: '', ё: 'yo'
};

export function slugify(value) {
  const mapped = [...String(value).toLowerCase()]
    .map(character => transliteration[character] ?? character).join('');
  return mapped.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 120).replace(/-$/g, '');
}

export function uniqueSlug(value, used = new Set()) {
  const base = slugify(value) || 'untitled';
  if (!used.has(base)) return base;
  for (let index = 2; ; index++) {
    const suffix = '-' + index;
    const candidate = base.slice(0, 120 - suffix.length).replace(/-+$/, '') + suffix;
    if (!used.has(candidate)) return candidate;
  }
}
