import { z } from 'astro/zod';
import { invalidConstReferences } from './constants.mjs';

const slug = z.string().trim().min(1, 'Enter a page URL').max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase Latin letters, numbers, and hyphens without spaces');
const text = z.string().trim();
const media = z.object({
  src: z.string().trim().refine(value=>value.startsWith('/assets/') || /^\{\{const\.[a-z][a-zA-Z0-9]*\}\}$/.test(value), 'Choose an asset or media Const'),
  alt: z.string().trim().max(250)
});
const seo = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(180)
});

const staticText = z.string().max(5000);
const staticImage = z.string().startsWith('/assets/');
const editableValue = z.lazy(() => z.union([
  z.string().max(5000), z.number(), z.boolean(), z.array(editableValue), z.record(editableValue)
]));
const constDefinition = z.object({
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'phone', 'email', 'url']),
  value: z.string().max(5000)
}).superRefine((entry, context) => {
  if (!entry.value) return;
  if (/\{\{const\./.test(entry.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Const values cannot contain another Const reference' });
  }
  if (entry.type === 'phone' && entry.value.replace(/\D/g, '').length < 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Enter a valid phone number' });
  }
  if (entry.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Enter a valid email address' });
  }
  if (entry.type === 'url' && !/^(https?:\/\/|\/(?!\/)|#)/i.test(entry.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Use an HTTPS, site, or anchor URL' });
  }
});
const homeContent = z.object({
  components: z.record(z.object({
    name: z.string().trim().min(1).max(120).optional(),
    defaults: z.record(z.union([z.string().max(5000), z.boolean(), z.number()]))
  })).optional(),
  componentInstances: z.record(z.object({
    overrides: z.record(z.union([z.string().max(5000), z.boolean(), z.number()])).default({}),
    inherited: z.array(z.string()).default([])
  })).optional(),
  editorSettings: z.object({
    labels: z.record(z.string().trim().min(1).max(120)).optional(),
    collectionModes: z.record(z.enum(['list', 'page'])).optional()
  }).optional(),
  linkSettings: z.record(z.object({
    page: z.string(), source: z.enum(['content', 'staticAttribute']),
    path: z.array(z.union([z.string(), z.number()])).optional(), key: z.string().optional(),
    type: z.enum(['url', 'page', 'section', 'email', 'phone']),
    target: z.enum(['_self', '_blank']).default('_self'),
    pageId: z.string().optional(), sectionId: z.string().optional()
  })).optional(),
  consts: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), constDefinition).optional(),
  sections: z.record(z.record(editableValue)),
  staticText: z.record(z.object({ base: staticText, value: staticText })).optional(),
  staticAttributes: z.record(z.object({ base: staticText, value: staticText })).optional(),
  pageOverrides: z.record(z.object({
    staticText: z.record(z.object({ base: staticText, value: staticText })).optional(),
    staticAttributes: z.record(z.object({ base: staticText, value: staticText })).optional()
  }).passthrough()).optional(),
  pageSettings: z.record(z.object({
    name: staticText.optional(), seoTitle: staticText.optional(), seoDescription: staticText.optional(),
    canonical: staticText.optional(), noIndex: z.boolean().optional(),
    ogTitle: staticText.optional(), ogDescription: staticText.optional(), ogImage: staticText.optional(),
    headCode: z.string().max(50000).optional(), bodyCode: z.string().max(50000).optional()
  }).passthrough()).optional(),
  meta: z.object({ title: staticText, description: staticText }).passthrough(),
  contacts: z.object({ email: staticText, phone: staticText, serviceArea: staticText }).passthrough(),
  hero: z.object({
    badgeText: staticText, title: staticText, aboutTag: staticText, aboutText: staticText,
    ctaText: staticText, ctaHref: staticText, videoPoster: staticImage, videoUrl: staticText
  }).passthrough(),
  startingPoints: z.object({
    barTitle: staticText,
    items: z.array(z.object({ id: z.string(), num: staticText, title: staticText, image: staticImage, note: staticText }).passthrough())
  }).passthrough(),
  featuredHome: z.object({
    barTitle: staticText, title: staticText, subtitle: staticText, heroKitchenImage: staticImage,
    cardCtaText: staticText, cardCtaHref: staticText,
    specs: z.array(z.object({ index: staticText, label: staticText, value: staticText }).passthrough()),
    stages: z.array(z.object({
      id: z.string(), num: staticText, stageTitle: staticText, title: staticText,
      desc: staticText, image: staticImage
    }).passthrough())
  }).passthrough(),
  completedHome: z.object({
    barLabel: staticText,
    images: z.object({ bathroom: staticImage, office: staticImage, kitchen: staticImage, livingRoom: staticImage }).passthrough(),
    specs: z.array(z.object({ label: staticText, value: staticText }).passthrough())
  }).passthrough(),
  faq: z.array(z.object({ question: staticText, answer: staticText }).passthrough()),
  localManagement: z.object({
    barLabel: staticText, headline: staticText, ownerImage: staticImage,
    principles: z.array(z.object({ title: staticText, description: staticText }).passthrough()),
    backgroundLabel: staticText, backgroundText: staticText
  }),
  builderAccountability: z.object({
    barLabel: staticText, title: staticText, description: staticText,
    commitments: z.array(z.object({ titleLine1: staticText, titleLine2: staticText, description: staticText }).passthrough()),
    ctaText: staticText
  }),
  pub: z.object({ at: z.string(), by: z.string(), id: z.string() }).optional()
}).passthrough();

export const HOME_PAGE_ID = '00000000-0000-4000-8000-000000000001';

export const collectionSchemas = {
  pages: z.object({
    id: z.literal(HOME_PAGE_ID),
    slug: z.literal('home'),
    template: z.literal('alm-home'),
    title: z.string().min(1),
    content: homeContent
  }).superRefine((page, context) => {
    for (const issue of invalidConstReferences(page.content)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', ...issue.path], message: issue.message });
    }
  }),
  posts: z.object({
    id: z.string().uuid(),
    slug,
    title: z.string().trim().min(1).max(180),
    excerpt: z.string().trim().max(500).default(''),
    cover: media.optional(),
    body: z.string().min(1),
    publishedAt: z.string().datetime().optional(),
    seo
  }),
  projects: z.object({
    id: z.string().uuid(),
    slug,
    title: z.string().trim().min(1).max(180),
    summary: text,
    cover: media.optional(),
    gallery: z.array(media).default([]),
    body: text.default(''),
    seo
  })
};

export const collectionFields = {
  posts: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'slug', label: 'URL slug', type: 'slug', required: true },
    { key: 'excerpt', label: 'Short description', type: 'textarea' },
    { key: 'body', label: 'Post body', type: 'textarea', required: true },
    { key: 'publishedAt', label: 'Publish date', type: 'datetime' },
    { key: 'cover.src', label: 'Cover image', type: 'media' },
    { key: 'cover.alt', label: 'Cover alt text', type: 'text' },
    { key: 'seo.title', label: 'SEO title', type: 'text', required: true },
    { key: 'seo.description', label: 'SEO description', type: 'textarea' }
  ],
  projects: [
    { key: 'title', label: 'Project name', type: 'text', required: true },
    { key: 'slug', label: 'URL slug', type: 'slug', required: true },
    { key: 'summary', label: 'Short description', type: 'textarea' },
    { key: 'cover.src', label: 'Cover image', type: 'media' },
    { key: 'cover.alt', label: 'Cover alt text', type: 'text' },
    { key: 'gallery', label: 'Gallery', type: 'gallery' },
    { key: 'body', label: 'Project description', type: 'textarea' },
    { key: 'seo.title', label: 'SEO title', type: 'text', required: true },
    { key: 'seo.description', label: 'SEO description', type: 'textarea' }
  ]
};

export function validateEntry(collection, value) {
  const schema = collectionSchemas[collection];
  if (!schema) return { success: false, issues: [{ path: [], message: 'Unknown collection' }] };
  const result = schema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, issues: result.error.issues.map(({ path, message }) => ({ path, message })) };
}
