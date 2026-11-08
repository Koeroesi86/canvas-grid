import { execFileSync } from 'node:child_process';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const version = requireEnv('VERSION');
const last = process.env.LAST;

// creating the release also creates the tag, at the exact commit that was built
execFileSync('gh', [
  'release', 'create', `v${version}`,
  '--repo', requireEnv('GITHUB_REPOSITORY'),
  '--target', requireEnv('SHA'),
  '--generate-notes',
  '--latest',
  ...(last ? ['--notes-start-tag', last] : []),
], { stdio: 'inherit' });
