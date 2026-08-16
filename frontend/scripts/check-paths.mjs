// Cross-checks every `paths.<ns>.<key>` usage in src against routes/paths.js.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../src/routes/paths.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * A link built from a key that does not exist is dead navigation, and it only
 * shows up when that branch renders — which is how TC-003 shipped.
 */
export function findPathProblems() {
  const problems = [];
  const re = /paths\.([A-Za-z]+)\.([A-Za-z0-9_]+)/g;

  for (const file of sourceFiles(SRC)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(re)) {
          const [expr, ns, key] = m;
          const group = paths[ns];
          const at = `${file}:${i + 1}`;
          if (group === undefined) {
            problems.push(`${at}  UNKNOWN NAMESPACE   ${expr}`);
          } else if (!(key in group)) {
            problems.push(`${at}  MISSING KEY         ${expr}`);
          } else {
            const called = line.slice(m.index + expr.length).startsWith('(');
            const isFn = typeof group[key] === 'function';
            if (called && !isFn) problems.push(`${at}  CALLED NON-FUNCTION ${expr}`);
            if (!called && isFn) problems.push(`${at}  FUNCTION NOT CALLED ${expr}`);
          }
        }
      });
  }
  return problems;
}

if (process.argv[1]?.endsWith('check-paths.mjs')) {
  const problems = findPathProblems();
  if (problems.length === 0) {
    console.log('OK: every paths.* usage resolves');
  } else {
    problems.forEach((p) => console.log(p));
    process.exitCode = 1;
  }
}
