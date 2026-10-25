import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Terms are assembled at runtime so this script does not contain them literally.
const banned = [['goo', 'gle'].join(''), ['alpha', 'bet inc'].join(''), ['job', ' posting'].join('')];
const skipDirs = new Set(['node_modules', '.git', 'dist', 'test-results', 'playwright-report', 'demo-output']);
const skipFiles = new Set(['package-lock.json']);
const textExt = /\.(md|ts|tsx|js|mjs|json|css|html|txt)$/i;

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!skipDirs.has(name)) walk(full);
    } else if (!skipFiles.has(name) && textExt.test(name)) {
      const text = readFileSync(full, 'utf8').toLowerCase();
      for (const term of banned) if (text.includes(term)) hits.push(`${relative('.', full)}: "${term}"`);
    }
  }
};
walk('.');

if (hits.length) {
  console.error('Neutrality check failed:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('Neutrality check passed: no company-specific references found.');
