const { execSync } = require('child_process');

const { TRAVIS_TAG, TRAVIS_BUILD_NUMBER } = process.env;

const minor = (TRAVIS_BUILD_NUMBER || '1').padStart(3, '0');
const major = Math.floor(TRAVIS_BUILD_NUMBER / 1000);
const version = `1.${major}.${minor}-${TRAVIS_TAG || 'release'}`;

execSync(`yarn version --no-git-tag-version --new-version "v${version}"`, { shell: true });
console.log('version set', version);
