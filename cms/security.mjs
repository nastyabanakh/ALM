import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CmsError } from './store.mjs';

// Local CMS security state survives a dev-server restart. Multi-instance hosting
// requires an atomic shared session/rate-limit store instead of this local file.
const file = path.join(process.cwd(), '.cms/security/state.json');
function state() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { revoked: {}, attempts: {} }; throw error; }
}
function save(data) {
  const now = Date.now();
  data.revoked = Object.fromEntries(Object.entries(data.revoked).filter(([, exp]) => exp > now));
  data.attempts = Object.fromEntries(Object.entries(data.attempts).filter(([, item]) => item.until > now));
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 }); fs.renameSync(tmp, file); }
  finally { fs.rmSync(tmp, { force: true }); }
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export function isRevoked(token) { return (state().revoked[digest(token)] || 0) > Date.now(); }
export function revokeSession(token, exp) {
  if (!token || !exp) return;
  const data = state(); data.revoked[digest(token)] = exp; save(data);
}
const attemptKey = (req, user) => digest(`${req.socket?.remoteAddress || 'local'}:${user}`);
export function checkLoginAttempts(req, user) {
  const item = state().attempts[attemptKey(req, user)];
  if (item?.until > Date.now() && item.count >= 5) throw new CmsError(429, 'Too many sign-in attempts. Try again in 5 minutes.');
}
export function recordLoginAttempt(req, user, success) {
  const data = state(), key = attemptKey(req, user), now = Date.now();
  if (success) delete data.attempts[key];
  else { const previous = data.attempts[key]; data.attempts[key] = { count: previous?.until > now ? previous.count + 1 : 1, until: now + 5 * 60 * 1000 }; }
  save(data);
}
export function assertTrustedWrite(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new CmsError(403, 'Cross-site changes are not allowed.');
  const origin = req.headers.origin;
  if (!origin) return; // Non-browser clients still require authentication.
  const trusted = (process.env.CMS_TRUSTED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  let parsed;
  try { parsed = new URL(origin); } catch { throw new CmsError(403, 'Invalid request origin.'); }
  const host = req.headers.host;
  const behindProxy = process.env.CMS_TRUST_PROXY === '1' || process.env.VERCEL === '1';
  const protocol = behindProxy && req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted ? 'https' : 'http';
  if (!['http:', 'https:'].includes(parsed.protocol) || (!trusted.includes(parsed.origin) && (!host || parsed.origin !== `${protocol}://${host}`))) throw new CmsError(403, 'Request origin is not trusted.');
}
