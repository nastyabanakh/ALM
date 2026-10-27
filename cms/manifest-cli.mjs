import { discoverPage } from './source-manifest.mjs';

const page = process.argv[2] || 'src/pages/index.astro';
const manifest = await discoverPage(page);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
