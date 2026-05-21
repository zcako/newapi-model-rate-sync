import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const esbuild = join(
  process.cwd(),
  'node_modules',
  '.bin',
  isWindows ? 'esbuild.cmd' : 'esbuild'
);

rmSync(join(process.cwd(), '.test-dist'), { recursive: true, force: true });

const build = spawnSync(
  esbuild,
  [
    'electron/backend/pricing.ts',
    'electron/backend/channelSafety.ts',
    '--bundle=false',
    '--platform=node',
    '--format=esm',
    '--target=es2020',
    '--outdir=.test-dist',
    '--outbase=.',
  ],
  { stdio: 'inherit', shell: isWindows }
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

writeFileSync(
  join(process.cwd(), '.test-dist', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2)
);

const tests = spawnSync(
  process.execPath,
  ['--test', 'tests/electron-backend/*.test.mjs'],
  { stdio: 'inherit', shell: isWindows }
);

process.exit(tests.status ?? 1);
