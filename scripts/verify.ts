import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const env = process.env;
const target = env.WORKER_TARGET ?? '';
const tag = env.RELEASE_TAG ?? '';
const commit = env.SOURCE_COMMIT ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target) || !/^[0-9a-f]{40}$/.test(commit)
  || (tag && !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag))) throw new Error('Invalid target, commit or release tag');

const workspace = realpathSync(env.GITHUB_WORKSPACE ?? process.cwd());
const project = realpathSync(resolve(workspace, env.WORKER_PROJECT ?? '.'));
if (relative(workspace, project).split('/')[0] === '..') throw new Error('Project must be inside the checkout');

function run(command: string, args: string[], options: { capture?: boolean; extraEnv?: NodeJS.ProcessEnv } = {}): string {
  const result = spawnSync(command, args, {
    cwd: project,
    env: { ...env, ...options.extraEnv, WRANGLER_SEND_METRICS: 'false' },
    encoding: 'utf8',
    stdio: ['ignore', options.capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args[0]} failed`, { cause: result.error });
  return result.stdout?.trim() ?? '';
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
if (run('git', ['rev-parse', 'HEAD'], { capture: true }) !== commit
  || (tag && run('git', ['rev-parse', `refs/tags/${tag}^{commit}`], { capture: true }) !== commit)) {
  throw new Error('Checkout, commit and tag must identify the same source');
}
if (run('git', ['status', '--porcelain', '--untracked-files=no'], { capture: true })) {
  throw new Error('Verification requires a clean tracked checkout');
}

const configName = `${target}.wrangler.json`;
const configPath = join(project, configName);
const lockPath = join(project, 'package-lock.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!/^[a-z0-9][a-z0-9-]*$/.test(config.name) || typeof config.main !== 'string'
  || !/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date)
  || ['account_id', 'assets', 'build', 'env', 'find_additional_modules', 'rules', 'site'].some(key => key in config)) {
  throw new Error('Expected an explicit Worker name and a single-module standalone target config');
}
const configDigest = sha256(configPath);
const lockDigest = sha256(lockPath);
const scratch = mkdtempSync(join(env.RUNNER_TEMP ?? '/tmp', 'worker-ci-'));
const artifact = join(scratch, 'artifact');
const build = join(scratch, 'build');
const wrangler = join(project, 'node_modules/wrangler/bin/wrangler.js');
const extraEnv = { WRANGLER_LOG_PATH: join(scratch, 'wrangler.log') };

run('npm', ['ci', '--no-audit', '--no-fund']);
for (const script of ['check', 'lint', 'test']) run('npm', ['run', script], { extraEnv });
run('node', [wrangler, 'deploy', '--dry-run', '--config', configPath, '--outdir', build], { extraEnv });
const entry = basename(config.main).replace(/\.[^.]+$/, '.js');
if (readdirSync(build).some(name => !['README.md', entry, entry + '.map'].includes(name))) {
  throw new Error('The single-module profile cannot publish additional bundle files');
}
mkdirSync(artifact);
const bundle = join(artifact, 'worker.mjs');
copyFileSync(join(build, entry), bundle);
const digest = sha256(bundle);
const upload = join(scratch, 'upload');
run('node', [wrangler, 'versions', 'upload', bundle, '--no-bundle', '--no-upload-source-maps', '--dry-run',
  '--config', configPath, '--outdir', upload], { extraEnv });
if (sha256(join(upload, 'worker.mjs')) !== digest
  || readdirSync(upload).some(name => !['worker.mjs', 'README.md'].includes(name))) {
  throw new Error('Wrangler changed the bundle in the no-bundle upload path');
}
run('npm', ['run', 'test:bundle', '--', bundle, configPath], { extraEnv });
// Leave the verified artifact in runner temp for the workflow to publish.
if (sha256(bundle) !== digest || sha256(configPath) !== configDigest || sha256(lockPath) !== lockDigest
  || run('git', ['status', '--porcelain', '--untracked-files=no'], { capture: true })) {
  throw new Error('Verification changed a tracked input or the tested bundle');
}
const wranglerVersion = JSON.parse(readFileSync(join(dirname(dirname(wrangler)), 'package.json'), 'utf8')).version;
writeFileSync(join(artifact, 'manifest.json'), JSON.stringify({
  schema: 1, commit, tag, target, worker: config.name, digest, configDigest, lockDigest,
  node: run('node', ['--version'], { capture: true }), wrangler: wranglerVersion,
}, null, 2) + '\n');
appendFileSync(env.GITHUB_OUTPUT!, `artifact=${artifact}\ndigest=${digest}\n`);
