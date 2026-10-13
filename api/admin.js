// @ts-check
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vercel Serverless Function — ALM Admin API
 * Provides secure auth (cookie-based session), GitHub Git-backed commits,
 * image uploads, and history rollback for the ALM CMS.
 */

const GITHUB_REPO = process.env.GITHUB_REPO || 'nastyabanakh/ALM';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'alm2026';
const JWT_SECRET = process.env.JWT_SECRET || 'alm-secret-session-key-change-in-env';

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
  if (!token || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Check session in request
function checkAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.alm_session;
  return verifyToken(token);
}

// GitHub API helper
async function githubRequest(endpoint, options = {}) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN не налаштовано у змінних середовища Vercel');
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
    throw new Error(`GitHub API помилка (${res.status}): ${errText}`);
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
    // 1. GET /api/admin?op=me
    if (op === 'me') {
      const session = checkAuth(req);
      return res.status(200).json({
        user: session ? session.user : null,
        repo: GITHUB_REPO,
        ready: Boolean(GITHUB_TOKEN),
        hasPassword: Boolean(ADMIN_PASSWORD)
      });
    }

    // 2. POST /api/admin?op=login
    if (op === 'login') {
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

      return res.status(401).json({ message: 'Невірний логін або пароль адміністратора' });
    }

    // 3. POST /api/admin?op=logout
    if (op === 'logout') {
      res.setHeader('Set-Cookie', 'alm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ ok: true });
    }

    // 4. GET /api/admin?op=content
    if (op === 'content') {
      // Allow read for authenticated or fallback
      let publishedContent = null;
      let sha = 'local-dev-sha';

      if (GITHUB_TOKEN) {
        try {
          const fileData = await githubRequest(`/contents/src/data/content.json?ref=${GITHUB_BRANCH}`);
          const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
          publishedContent = JSON.parse(contentStr);
          sha = fileData.sha;
        } catch (e) {
          console.warn('Fallback to local reading:', e.message);
        }
      }

      if (!publishedContent) {
        try {
          const localPath = path.join(process.cwd(), 'src/data/content.json');
          if (fs.existsSync(localPath)) {
            publishedContent = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          }
        } catch (e) {
          console.error(e);
        }
      }

      return res.status(200).json({
        published: { content: publishedContent, sha },
        draft: null,
        draftLink: '/?preview'
      });
    }

    // --- All routes below require valid session ---
    const session = checkAuth(req);
    if (!session) {
      return res.status(401).json({ message: 'Потрібна авторизація адміністратора' });
    }

    // 5. POST /api/admin?op=publish
    if (op === 'publish') {
      const { content, message } = body;
      if (!content) return res.status(400).json({ message: 'Немає вмісту для публікації' });

      const pubMeta = {
        at: new Date().toISOString(),
        by: session.user,
        id: crypto.randomBytes(6).toString('hex')
      };
      content.pub = pubMeta;

      const fileContent = JSON.stringify(content, null, 2);
      const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');
      const commitMessage = message ? `CMS: ${message}` : `CMS: Оновлення контенту (${pubMeta.id})`;

      let newSha = `sha-${Date.now()}`;

      if (GITHUB_TOKEN) {
        // 1. Get current SHA if not provided
        let currentSha = body.sha;
        if (!currentSha || currentSha === 'local-dev-sha') {
          const currentFile = await githubRequest(`/contents/src/data/content.json?ref=${GITHUB_BRANCH}`);
          currentSha = currentFile.sha;
        }

        // 2. Commit update to src/data/content.json
        const updateRes = await githubRequest(`/contents/src/data/content.json`, {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage,
            content: base64Content,
            sha: currentSha,
            branch: GITHUB_BRANCH
          })
        });
        newSha = updateRes.content.sha;

        // 3. Also sync public/content.json in the same repo if exists
        try {
          const pubFile = await githubRequest(`/contents/public/content.json?ref=${GITHUB_BRANCH}`).catch(() => null);
          await githubRequest(`/contents/public/content.json`, {
            method: 'PUT',
            body: JSON.stringify({
              message: `Sync public/content.json (${pubMeta.id})`,
              content: base64Content,
              sha: pubFile ? pubFile.sha : undefined,
              branch: GITHUB_BRANCH
            })
          });
        } catch (syncErr) {
          console.warn('Sync public/content.json skipped/failed:', syncErr.message);
        }
      } else {
        // In local development mode without token, write directly to local file
        const localPath = path.join(process.cwd(), 'src/data/content.json');
        fs.writeFileSync(localPath, fileContent, 'utf8');
        const publicPath = path.join(process.cwd(), 'public/content.json');
        fs.writeFileSync(publicPath, fileContent, 'utf8');
      }

      return res.status(200).json({
        ok: true,
        pub: pubMeta,
        sha: newSha
      });
    }

    // 6. POST /api/admin?op=upload
    if (op === 'upload') {
      const { filename, base64, ext = 'webp' } = body;
      if (!base64) return res.status(400).json({ message: 'Відсутні дані зображення' });

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
            message: `CMS: Завантаження зображення ${safeName}`,
            content: base64,
            sha: existing ? existing.sha : undefined,
            branch: GITHUB_BRANCH
          })
        });
        return res.status(200).json({ url: `/assets/uploads/${safeName}` });
      } else {
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
        const commits = await githubRequest(`/commits?path=src/data/content.json&per_page=10`);
        const historyList = commits.map(c => ({
          id: c.sha.slice(0, 7),
          at: c.commit.author.date,
          by: c.commit.author.name || 'Admin',
          msg: c.commit.message
        }));
        return res.status(200).json(historyList);
      }
      return res.status(200).json([
        { id: 'local-1', at: new Date().toISOString(), by: session.user, msg: 'Локальна розробка' }
      ]);
    }

    return res.status(404).json({ message: `Невідома операція: ${op}` });
  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ message: error.message || 'Внутрішня помилка сервера' });
  }
}
