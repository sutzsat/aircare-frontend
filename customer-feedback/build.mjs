import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, 'dist');
const apiBase = (process.env.AIRCARE_API_BASE || '').trim().replace(/\/$/, '');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
const excluded = new Set(['build.mjs', 'package.json', 'Dockerfile', 'README.md', 'vercel.json', 'dist']);
const entries = await readdir(rootDir, { withFileTypes: true });

for (const entry of entries) {
  if (excluded.has(entry.name)) {
    continue;
  }

  await cp(
    path.join(rootDir, entry.name),
    path.join(distDir, entry.name),
    { recursive: true },
  );
}

await writeFile(
  path.join(distDir, 'config.js'),
  `window.__AIRCARE_API_BASE__ = ${JSON.stringify(apiBase)};\n`,
  'utf8',
);

console.log(`Built customer-feedback with AIRCARE_API_BASE=${apiBase || '(same-origin)'}`);