import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareVersions, findLatestTag, nextVersion, parseVersion } from './release-version.mts';

describe('parseVersion', () => {
  it('accepts plain and v-prefixed versions', () => {
    assert.deepEqual(parseVersion('26.11.3'), [26, 11, 3]);
    assert.deepEqual(parseVersion('v1.0.15'), [1, 0, 15]);
  });

  it('rejects anything else', () => {
    assert.equal(parseVersion('1.0.10-58738af'), undefined);
    assert.equal(parseVersion('latest'), undefined);
    assert.equal(parseVersion(''), undefined);
  });
});

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    assert.ok(compareVersions([26, 11, 10], [26, 11, 9]) > 0);
    assert.ok(compareVersions([26, 2, 1], [26, 11, 1]) < 0);
    assert.equal(compareVersions([1, 0, 0], [1, 0, 0]), 0);
  });
});

describe('findLatestTag', () => {
  it('picks the highest version and ignores non-version tags', () => {
    assert.equal(findLatestTag(['v1.0.15', 'v26.11.9', 'v26.11.10', 'nightly']), 'v26.11.10');
  });

  it('returns undefined without release tags', () => {
    assert.equal(findLatestTag([]), undefined);
    assert.equal(findLatestTag(['nightly']), undefined);
  });
});

describe('nextVersion', () => {
  const november = new Date('2026-11-08T03:17:00Z');

  it('starts at 1 when nothing was released this month', () => {
    assert.equal(nextVersion(november, []), '26.11.1');
    assert.equal(nextVersion(november, ['1.0.15', 'v26.10.4']), '26.11.1');
  });

  it('increments past the highest number used this month, from tags or npm', () => {
    assert.equal(nextVersion(november, ['v26.11.1', '26.11.1']), '26.11.2');
    assert.equal(nextVersion(november, ['26.11.9', 'v26.11.2']), '26.11.10');
  });

  it('restarts at 1 in a new month and a new year', () => {
    assert.equal(nextVersion(new Date('2026-12-01T00:00:00Z'), ['26.11.9']), '26.12.1');
    assert.equal(nextVersion(new Date('2027-01-01T00:00:00Z'), ['26.12.3']), '27.1.1');
  });

  it('does not zero-pad the month', () => {
    assert.equal(nextVersion(new Date('2027-03-15T12:00:00Z'), []), '27.3.1');
  });

  it('uses UTC, not local time, around month boundaries', () => {
    assert.equal(nextVersion(new Date('2026-11-30T23:59:59Z'), []), '26.11.1');
    assert.equal(nextVersion(new Date('2026-12-01T00:00:00Z'), []), '26.12.1');
  });

  it('ignores versions that merely look similar', () => {
    assert.equal(nextVersion(november, ['26.111.4', '126.11.7', '26.11.5-rc1']), '26.11.1');
  });
});
