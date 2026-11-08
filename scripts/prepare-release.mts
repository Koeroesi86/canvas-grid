import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findLatestTag, nextVersion } from './release-version.mts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const setOutput = (name: string, value: string) => {
  console.log(`${name}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

const fetchPublishedVersions = async (packageName: string) => {
  const response = await fetch(`https://registry.npmjs.org/${packageName.replace('/', '%2f')}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`npm registry responded with ${response.status}`);

  const { versions = {} }: { versions?: Record<string, unknown> } = await response.json();
  return Object.keys(versions);
};

const { name }: { name: string } = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'));

const sha = git('rev-parse', 'HEAD');
const tags = git('tag', '--list', 'v*.*.*').split('\n').filter(Boolean);
const last = findLatestTag(tags);

setOutput('sha', sha);
setOutput('last', last ?? '');

if (last && Number(git('rev-list', '--count', `${last}..HEAD`)) === 0) {
  console.log(`No commits since ${last}, nothing to release.`);
  setOutput('release', 'false');
} else {
  // numbers already used come from git tags and from npm, so a missing tag can't cause a duplicate
  const version = nextVersion(new Date(), [...tags, ...await fetchPublishedVersions(name)]);

  setOutput('release', 'true');
  setOutput('version', version);
  console.log(`Releasing ${version} (previous: ${last ?? 'none'}) from ${sha}`);
}
