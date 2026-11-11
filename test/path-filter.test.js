'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { filterCommits, analyzeCommits, generateNotes, webRepositoryUrl } = require('../lib/path-filter');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// A repo with a chart in helm/ and other files at the root, and one commit per
// entry of `changes` ([file, message]), returning their hashes and messages.
function makeRepo(changes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'srh-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  git(root, 'config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(root, 'helm'));
  const commits = changes.map(([file, message], i) => {
    fs.writeFileSync(path.join(root, file), `${i}\n`);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', message);
    return { hash: git(root, 'rev-parse', 'HEAD'), message };
  });
  return { root, commits: commits.reverse() };
}

const logger = { log() {} };

test('keeps only the commits that touch the cwd', () => {
  const { root, commits } = makeRepo([
    ['helm/Chart.yaml', 'feat(helm): add the chart'],
    ['README.md', 'fix(readme): typo'],
    ['helm/values.yaml', 'fix(helm): default port'],
  ]);
  const kept = filterCommits({ cwd: path.join(root, 'helm'), commits, lastRelease: {}, logger });
  assert.deepStrictEqual(kept.map((c) => c.message), ['fix(helm): default port', 'feat(helm): add the chart']);
});

test('only looks at commits after the last release', () => {
  const { root, commits } = makeRepo([
    ['helm/Chart.yaml', 'feat(helm): add the chart'],
    ['helm/values.yaml', 'fix(helm): default port'],
  ]);
  const lastRelease = { gitHead: commits[1].hash };
  const kept = filterCommits({ cwd: path.join(root, 'helm'), commits: commits.slice(0, 1), lastRelease, logger });
  assert.deepStrictEqual(kept.map((c) => c.message), ['fix(helm): default port']);
});

test('a release-triggering commit outside the cwd releases nothing', async () => {
  const { root, commits } = makeRepo([
    ['helm/Chart.yaml', 'chore(helm): add the chart'],
    ['README.md', 'feat(readme): add a section'],
  ]);
  const type = await analyzeCommits({}, { cwd: path.join(root, 'helm'), commits, lastRelease: {}, logger });
  assert.strictEqual(type, null);
});

test('passes the kept commits to the commit analyzer', async () => {
  const { root, commits } = makeRepo([
    ['README.md', 'feat(readme): add a section'],
    ['helm/values.yaml', 'fix(helm): default port'],
  ]);
  const type = await analyzeCommits({}, { cwd: path.join(root, 'helm'), commits, lastRelease: {}, logger });
  assert.strictEqual(type, 'patch');
});

test('maps ssh.bitbucket.org to bitbucket.org and leaves other hosts alone', () => {
  assert.strictEqual(webRepositoryUrl('git@ssh.bitbucket.org:afagund/x.git'), 'git@bitbucket.org:afagund/x.git');
  assert.strictEqual(
    webRepositoryUrl('ssh://git@ssh.bitbucket.org:443/afagund/x.git'),
    'ssh://git@bitbucket.org:443/afagund/x.git'
  );
  assert.strictEqual(webRepositoryUrl('git@github.com:afagund/x.git'), 'git@github.com:afagund/x.git');
});

test('release notes from ssh.bitbucket.org link to bitbucket.org commits', async () => {
  const { root, commits } = makeRepo([['helm/values.yaml', 'fix(helm): default port']]);
  const notes = await generateNotes(
    {},
    {
      cwd: path.join(root, 'helm'),
      commits,
      lastRelease: { gitTag: 'helm-1.0.0' },
      nextRelease: { version: '1.0.1', gitTag: 'helm-1.0.1' },
      options: { repositoryUrl: 'git@ssh.bitbucket.org:afagund/x.git' },
      logger,
    }
  );
  assert.match(notes, new RegExp(`https://bitbucket\\.org/afagund/x/commits/${commits[0].hash}`));
  assert.doesNotMatch(notes, /ssh\.bitbucket\.org/);
});
