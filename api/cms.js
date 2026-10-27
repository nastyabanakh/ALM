import { checkAuth } from './admin.js';
import { collectionFields } from '../cms/model.mjs';
import { CmsError, getEntry, listEntries, listHistory, publishDraft, restoreHistoryToDraft, saveDraft, uploadImage } from '../cms/store.mjs';
import { renderDraftPreview } from '../cms/preview.mjs';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) return res.status(503).json({ message: 'Configure CMS access' });
  if (!checkAuth(req)) return res.status(401).json({ message: 'Sign-in required' });
  if (process.env.CMS_LOCAL_MODE !== '1') return res.status(501).json({ message: 'Content API is available locally only' });

  const { op, collection, id } = req.query;
  const isGet = ['schema', 'list', 'entry', 'preview', 'history'].includes(op);
  if ((isGet && req.method !== 'GET') || (!isGet && req.method !== 'POST')) {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    if (op === 'schema') return res.status(200).json({ collections: collectionFields });
    if (op === 'list') return res.status(200).json({ entries: await listEntries(collection) });
    if (op === 'entry') return res.status(200).json(await getEntry(collection, id));
    if (op === 'history') return res.status(200).json({ versions: await listHistory(collection, id) });
    if (op === 'preview') {
      const html = await renderDraftPreview(collection, id);
      if (!html) return res.status(404).json({ message: 'Draft not found' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
      return res.status(200).end(html);
    }
    if (op === 'save-draft') return res.status(200).json(await saveDraft(collection, req.body || {}));
    if (op === 'publish') return res.status(200).json(await publishDraft(collection, req.body || {}));
    if (op === 'restore-draft') return res.status(200).json(await restoreHistoryToDraft(collection, req.body || {}));
    if (op === 'upload') return res.status(200).json(await uploadImage(req.body || {}));
    return res.status(404).json({ message: 'Unknown operation' });
  } catch (error) {
    if (error instanceof CmsError) return res.status(error.status).json({ message: error.message, details: error.details });
    console.error('CMS API Error:', error);
    return res.status(500).json({ message: 'CMS server error' });
  }
}
