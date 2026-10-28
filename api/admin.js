// @ts-check
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HOME_PAGE_ID } from '../cms/model.mjs';
import { CmsError, getEntry, listHistory, publishDraft, saveDraft, uploadImage } from '../cms/store.mjs';
import { discoverPage } from '../cms/source-manifest.mjs';
import { withMediaMutation, moveMediaSelection, trashMediaSelection, restoreMediaSelection, renameMediaFolder, mediaFolderInfo, stashMediaFolder, restoreMediaFolder, createMediaFolder, listMedia, removeEmptyMediaFolder, replaceMedia, stashMedia, swapMediaBackup, unstashMedia, updateMedia, uploadMedia } from '../cms/media-library.mjs';
import { listDraftMedia, stageMediaOperation, mediaDraftHistory, discardMediaDraft, publishMediaDraft, serveMediaDraft, draftFolderInfo } from '../cms/media-draft.mjs';
import { projectDraftStatus, publishProject, withProjectLock } from '../cms/project-workspace.mjs';
import { publishMediaLayout } from '../cms/media-publish.mjs';
import { listSitePages } from '../cms/page-list.mjs';

/**
 * Vercel Serverless Function — ALM Admin API
 * Provides secure auth (cookie-based session), GitHub Git-backed commits,
 * image uploads, and history rollback for the ALM CMS.
 */

const GITHUB_REPO = process.env.GITHUB_REPO || 'nastyabanakh/ALM';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const LOCAL_MODE = process.env.CMS_LOCAL_MODE === '1';
const GITHUB_TOKEN = LOCAL_MODE ? '' : (process.env.GITHUB_TOKEN || '');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const JWT_SECRET = process.env.JWT_SECRET || '';

// Helper: parse cookies
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Sign a session token
function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// Verify a session token
function verifyToken(token) {
  if (!JWT_SECRET || !token || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  const actual = Buffer.from(signature || '');
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Check session in request
export function checkAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.alm_session;
  return verifyToken(token);
}

// GitHub API helper
async function githubRequest(endpoint, options = {}) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured in Vercel environment variables');
  const url = `https://api.github.com/repos/${GITHUB_REPO}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ALM-Admin-CMS',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const { op } = req.query;
  const body = req.body || {};

  try {
    if (!ADMIN_PASSWORD || !JWT_SECRET) {
      return res.status(503).json({ message: 'Set ADMIN_PASSWORD and JWT_SECRET on the server' });
    }
    // 1. GET /api/admin?op=me
    if (op === 'me') {
      const session = checkAuth(req);
      return res.status(200).json({
        user: session ? session.user : null,
        repo: GITHUB_REPO,
        ready: LOCAL_MODE,
        hasPassword: Boolean(ADMIN_PASSWORD)
      });
    }

    // 2. POST /api/admin?op=login
    if (op === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      const { user, email, password } = body;
      const inputUser = (user || email || '').trim();
      const inputPass = (password || '').trim();

      if (inputUser === ADMIN_USER && inputPass === ADMIN_PASSWORD) {
        const payload = {
          user: inputUser,
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        const token = signToken(payload);
        const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
        res.setHeader(
          'Set-Cookie',
          `alm_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${isProd ? '; Secure' : ''}`
        );
        return res.status(200).json({ ok: true, user: inputUser });
      }

      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 3. POST /api/admin?op=logout
    if (op === 'logout') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      res.setHeader('Set-Cookie', 'alm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ ok: true });
    }

    // 4. GET /api/admin?op=content
    if (op === 'content') {
      if (!checkAuth(req)) return res.status(401).json({ message: 'Admin sign-in required' });
      if (LOCAL_MODE) {
        const page = await getEntry('pages', HOME_PAGE_ID);
        return res.status(200).json({
          published: { content: page.published.content, sha: page.publishedRevision },
          draft: page.draft?.data.content || null,
          draftRevision: page.draft?.revision || null,
          draftLink: '/?preview'
        });
      }
      if (!GITHUB_TOKEN) return res.status(503).json({ message: 'Remote content access is not configured' });
      const file = await githubRequest(`/contents/src/content/pages/${HOME_PAGE_ID}.json?ref=${GITHUB_BRANCH}`);
      const page = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      return res.status(200).json({
        published: { content: page.content, sha: file.sha },
        draft: null,
        draftRevision: null,
        draftLink: '/?preview'
      });
    }

    // --- All routes below require valid session ---
    const session = checkAuth(req);
    if (!session) {
      return res.status(401).json({ message: 'Admin sign-in required' });
    }

    if (op === 'manifest') {
      if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
      if (!LOCAL_MODE) return res.status(501).json({ message: 'Code manifest is available locally only' });
      return res.status(200).json(await discoverPage('src/pages/index.astro'));
    }
    if (op === 'pages-list') {
      if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
      if (!LOCAL_MODE) return res.status(501).json({ message: 'Page list is available locally only' });
      return res.status(200).json({ pages: await listSitePages() });
    }

    if (op === 'project-status' && req.method === 'GET') return res.status(200).json(await projectDraftStatus());

    if (op?.startsWith('media-')) {
      if (!LOCAL_MODE) return res.status(501).json({ message: 'Media library is available locally only' });
      return withMediaMutation(async () => {
      const respondFileChange = async operation => {
        const result = await operation;
        if (result.filesystem?.files || result.filesystem?.folders) {
          const page = await getEntry('pages', HOME_PAGE_ID);
          result.siteState = { published: { content: page.published.content, sha: page.publishedRevision }, draft: page.draft?.data.content || null, draftRevision: page.draft?.revision || null };
        }
        return res.status(200).json(result);
      };
      if (op === 'media-preview' && req.method === 'GET') return serveMediaDraft(req,res);
      if (op === 'media-list' && req.method === 'GET') return res.status(200).json(await listDraftMedia());
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      if (op === 'media-draft-undo' || op === 'media-draft-redo') return res.status(200).json(await mediaDraftHistory({ ...body, direction: op.endsWith('undo') ? 'undo' : 'redo' }));
      if (op === 'media-draft-discard') return res.status(200).json(await discardMediaDraft());
      if (op === 'media-publish-folders' || op === 'media-draft-publish') throw new CmsError(409, 'Use the shared project Publish action.');
      if (op === 'media-folder-info') return res.status(200).json(await draftFolderInfo(body));
      if (['media-update','media-folder','media-folder-rename','media-move-selection','media-stash','media-trash-selection','media-folder-trash','media-folder-remove','media-upload','media-replace'].includes(op)) return res.status(200).json(await stageMediaOperation(op,body));
      if (['media-unstash','media-restore-selection','media-folder-restore','media-swap-backup'].includes(op)) return res.status(409).json({ message: 'Use media draft Undo or Redo.' });
      if (op === 'media-move-selection') return respondFileChange(moveMediaSelection(body));
      if (op === 'media-trash-selection') return res.status(200).json(await trashMediaSelection(body));
      if (op === 'media-restore-selection') return res.status(200).json(await restoreMediaSelection(body));
      if (op === 'media-upload') return res.status(200).json(await uploadMedia(body));
      if (op === 'media-update') return respondFileChange(updateMedia(body));
      if (op === 'media-replace') return res.status(200).json(await replaceMedia(body));
      if (op === 'media-swap-backup') return res.status(200).json(await swapMediaBackup(body));
      if (op === 'media-stash') return res.status(200).json(await stashMedia(body));
      if (op === 'media-unstash') return res.status(200).json(await unstashMedia(body));
      if (op === 'media-folder') return res.status(200).json(await createMediaFolder(body));
      if (op === 'media-folder-rename') return respondFileChange(renameMediaFolder(body));
      if (op === 'media-folder-info') return res.status(200).json(await mediaFolderInfo(body));
      if (op === 'media-folder-trash') return res.status(200).json(await stashMediaFolder(body));
      if (op === 'media-folder-restore') return res.status(200).json(await restoreMediaFolder(body));
      if (op === 'media-folder-remove') return res.status(200).json(await removeEmptyMediaFolder(body));
      return res.status(404).json({ message: 'Unknown media operation' });
      });
    }

    if (LOCAL_MODE && op === 'save-draft') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      const page = await getEntry('pages', HOME_PAGE_ID);
      const saved = await withProjectLock(() => saveDraft('pages', {
        id: HOME_PAGE_ID,
        data: { ...page.published, content: { ...page.published.content, ...body.content } },
        expectedDraftRevision: body.expectedDraftRevision || null
      }));
      return res.status(200).json({ draftRevision: saved.draft.revision });
    }

    if (LOCAL_MODE && op === 'publish') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      return res.status(200).json(await publishProject(body));
    }

    if (LOCAL_MODE && op === 'history') {
      const items = await listHistory('pages', HOME_PAGE_ID);
      return res.status(200).json(items.map(item => ({
        id: item.revision.slice(0, 7), at: item.at, by: 'CMS', msg: 'Previous home page version'
      })));
    }

    if (LOCAL_MODE && op === 'upload') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      return res.status(200).json(await uploadImage({ base64: body.base64 }));
    }

    if (op === 'save-draft' || op === 'publish') {
      return res.status(501).json({ message: 'Publishing the new CMS remotely is not configured. Work locally.' });
    }

    // 6. POST /api/admin?op=upload
    if (op === 'upload') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
      const { filename, base64, ext = 'webp' } = body;
      if (!base64) return res.status(400).json({ message: 'Image data is missing' });

      const safeName = (filename || `upload-${Date.now()}.${ext}`)
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-');
      const targetPath = `public/assets/uploads/${safeName}`;

      if (GITHUB_TOKEN) {
        // Upload directly into GitHub repository assets
        const existing = await githubRequest(`/contents/${targetPath}?ref=${GITHUB_BRANCH}`).catch(() => null);
        await githubRequest(`/contents/${targetPath}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: `CMS: Image upload ${safeName}`,
            content: base64,
            sha: existing ? existing.sha : undefined,
            branch: GITHUB_BRANCH
          })
        });
        return res.status(200).json({ url: `/assets/uploads/${safeName}` });
      } else {
        if (!LOCAL_MODE) {
          throw new Error('Vercel image uploads require GITHUB_TOKEN in environment variables');
        }
        // Local dev save
        const uploadDir = path.join(process.cwd(), 'public/assets/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, safeName);
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
        return res.status(200).json({ url: `/assets/uploads/${safeName}` });
      }
    }

    // 7. GET /api/admin?op=history
    if (op === 'history') {
      if (GITHUB_TOKEN) {
        const commits = await githubRequest(`/commits?path=src/content/pages/${HOME_PAGE_ID}.json&per_page=10`);
        const historyList = commits.map(c => ({
          id: c.sha.slice(0, 7),
          at: c.commit.author.date,
          by: c.commit.author.name || 'Admin',
          msg: c.commit.message
        }));
        return res.status(200).json(historyList);
      }
      return res.status(200).json([
        { id: 'local-1', at: new Date().toISOString(), by: session.user, msg: 'Local development' }
      ]);
    }

    return res.status(404).json({ message: `Unknown operation: ${op}` });
  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(error instanceof CmsError ? error.status : 500).json({ message: error.message || 'Internal server error', details: error.details });
  }
}
