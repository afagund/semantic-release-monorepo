'use strict';

// Shareable semantic-release config for one project in a subdirectory of a
// repo. Run semantic-release from that directory, with a .releaserc.json there
// of { "extends": "@afagund/semantic-release-monorepo", "repositoryUrl": "<repo>" }
// (or a preset such as "@afagund/semantic-release-monorepo/helm").
//
// Only the commits touching the directory count, its CHANGELOG.md lives in it,
// and its tags are prefixed with the directory's name (helm-1.2.0), so several
// projects in one repo release independently.

const path = require('node:path');

// semantic-release loads its config from the directory it runs in.
const project = path.basename(process.cwd());

module.exports = {
  // A repo releases from whichever of these it has.
  branches: ['main', 'master'],
  tagFormat: `${project}-\${version}`,
  plugins: [
    // In place of commit-analyzer and release-notes-generator.
    path.join(__dirname, 'lib', 'path-filter.js'),
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.gitTag} [skip ci]',
      },
    ],
  ],
};
