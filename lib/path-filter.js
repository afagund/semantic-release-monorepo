'use strict';

// semantic-release plugin that only counts the commits touching the directory
// semantic-release runs from (its cwd), so a component in a subdirectory of a
// repo (e.g. helm/) is versioned and described by its own changes. It wraps
// the official commit-analyzer and release-notes-generator, which take the
// same options as when used directly.

const { execFileSync } = require('node:child_process');
const { analyzeCommits: analyze } = require('@semantic-release/commit-analyzer');
const { generateNotes: generate } = require('@semantic-release/release-notes-generator');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// Hashes of the commits since the last release that change something under
// cwd. --full-history keeps commits a merge brought in from a side branch;
// merges themselves are left out, since their own diff isn't the change.
function hashesTouchingCwd(cwd, lastReleaseHead) {
  const range = lastReleaseHead ? `${lastReleaseHead}..HEAD` : 'HEAD';
  const out = git(cwd, ['log', '--full-history', '--no-merges', '--format=%H', range, '--', '.']);
  return new Set(out ? out.split('\n') : []);
}

function filterCommits(context) {
  const { cwd, commits, lastRelease, logger } = context;
  const hashes = hashesTouchingCwd(cwd, lastRelease && lastRelease.gitHead);
  const kept = commits.filter((commit) => hashes.has(commit.hash));
  const dir = git(cwd, ['rev-parse', '--show-prefix']) || './';
  logger.log('Kept %d of %d commits that touch %s', kept.length, commits.length, dir);
  return kept;
}

async function analyzeCommits(pluginConfig, context) {
  return analyze(pluginConfig, { ...context, commits: filterCommits(context) });
}

// ssh.bitbucket.org is Bitbucket's SSH-only host (it also listens on 443), so
// a repo cloned from it would get release notes linking to that host, which
// serves no web pages. Notes are written for bitbucket.org instead, which also
// makes the generator use Bitbucket's paths (/commits/<sha>).
function webRepositoryUrl(repositoryUrl) {
  return repositoryUrl.replace(/(^|[@/])ssh\.bitbucket\.org(?=[:/])/, '$1bitbucket.org');
}

// The angular preset links a release to GitHub's /compare/<previous>...<next>,
// which Bitbucket doesn't serve: it compares at
// /branches/compare/<next>%0D<previous> (source, then destination).
function bitbucketCompareLinks(notes, repositoryUrl, previousTag, nextTag) {
  if (!/(^|[@/])bitbucket\.org[:/]/.test(repositoryUrl) || !previousTag || !nextTag) return notes;
  return notes
    .split(`/compare/${previousTag}...${nextTag})`)
    .join(`/branches/compare/${nextTag}%0D${previousTag})`);
}

async function generateNotes(pluginConfig, context) {
  const repositoryUrl = webRepositoryUrl(context.options.repositoryUrl);
  const options = { ...context.options, repositoryUrl };
  const notes = await generate(pluginConfig, { ...context, options, commits: filterCommits(context) });
  const { lastRelease = {}, nextRelease = {} } = context;
  return bitbucketCompareLinks(notes, repositoryUrl, lastRelease.gitTag, nextRelease.gitTag);
}

module.exports = { analyzeCommits, generateNotes, filterCommits, webRepositoryUrl };
