export type Version = readonly [major: number, minor: number, patch: number];

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Parses `1.2.3` or `v1.2.3`; anything else (e.g. `1.0.10-58738af`) is not a release version. */
export const parseVersion = (value: string): Version | undefined => {
  const match = VERSION_PATTERN.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
};

export const compareVersions = (a: Version, b: Version) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The highest release tag, e.g. `v26.11.2`, or `undefined` when there is none. */
export const findLatestTag = (tags: string[]) => tags
  .flatMap(tag => {
    const version = parseVersion(tag);
    return version ? [{ tag, version }] : [];
  })
  .sort((a, b) => compareVersions(a.version, b.version))
  .at(-1)?.tag;

/**
 * Next calendar version, `YY.M.N`: N is one more than the highest N already used in the
 * current UTC year and month, otherwise 1. The month is not zero-padded (semver forbids it).
 */
export const nextVersion = (now: Date, existingVersions: string[]) => {
  const year = now.getUTCFullYear() % 100;
  const month = now.getUTCMonth() + 1;
  const usedNumbers = existingVersions.flatMap(existing => {
    const version = parseVersion(existing);
    return version && version[0] === year && version[1] === month ? [version[2]] : [];
  });

  return `${year}.${month}.${Math.max(0, ...usedNumbers) + 1}`;
};
