# @afagund/semantic-release-monorepo

[semantic-release](https://semantic-release.gitbook.io/) for one project in a
directory of a repo, so several projects in the same repo release on their own.
Run semantic-release from the project's directory and:

- only the commits that touch that directory count towards its release and its
  release notes;
- its `CHANGELOG.md` lives in the directory;
- its tags are prefixed with the directory's name (`helm-1.2.0`, `lib-0.3.0`);
- the release commit is `chore(release): <tag> [skip ci]`, with only that
  project's files.

It releases from `main` or `master`, whichever the repo has.

## Usage

In the project's directory, add a `.releaserc.json`:

```json
{
  "extends": "@afagund/semantic-release-monorepo",
  "repositoryUrl": "git@github.com:<owner>/<repo>.git"
}
```

and run semantic-release from there:

```sh
cd <project>
npx --yes -p semantic-release@25 -p @afagund/semantic-release-monorepo \
  semantic-release --no-ci --dry-run
```

Settings in the project's `.releaserc.json` override the shared ones (e.g.
`branches` or `tagFormat`).

## Presets

A preset is the base config plus the steps one kind of project needs.

| Preset | Extends with | Adds |
| --- | --- | --- |
| Helm chart | `@afagund/semantic-release-monorepo/helm` | sets `version` in `Chart.yaml` and regenerates the chart's `README.md` with [helm-docs](https://github.com/norwoodj/helm-docs) (which must be on the `PATH`), and commits both |

## Path filter only

For a config of your own, use the commit filter in place of
`@semantic-release/commit-analyzer` and
`@semantic-release/release-notes-generator`. It takes their options:

```json
{
  "plugins": [
    ["@afagund/semantic-release-monorepo/path-filter", { "preset": "angular" }],
    "@semantic-release/github"
  ]
}
```

## Development

```sh
npm install
npm test
```

## Releases

Releases of this package are cut with semantic-release from `main`, run locally
(there's no pipeline), with [.releaserc.json](.releaserc.json). It picks the
version from the commit types since the last tag (`fix`/`perf` → patch,
`feat` → minor, `!` / `BREAKING CHANGE:` → major; other types don't release),
publishes to npm, updates `CHANGELOG.md` and the version in `package.json`,
commits them as `chore(release): vX.Y.Z [skip ci]`, tags `vX.Y.Z` and pushes
both.

### Before the first release

- Log in to npm as `afagund` once: `npm login`. The token it saves in
  `~/.npmrc` is what semantic-release publishes with; `npm whoami` checks it.
- npm 2FA must be off or "authorization only". With "authorization and
  writes", `npm publish` asks for a code that semantic-release can't give, and
  you need a granular access token instead (publish rights on `@afagund`,
  "bypass 2FA" ticked), passed as `NPM_TOKEN`. A token in `~/.npmrc` takes
  precedence over `NPM_TOKEN`, so `npm logout` first in that case.
- Pushing the release commit and tag uses the repo's SSH key (`git push` must
  work from `main`).

### Cutting a release

1. Merge the changes into `main` through a PR. Only `feat`, `fix`, `perf` and
   breaking changes release.
2. Update and test `main`:

   ```sh
   git switch main
   git pull --ff-only
   npm ci
   npm test
   ```

3. Check what would be released (no changes made):

   ```sh
   npx semantic-release --no-ci --dry-run
   ```

   It should say "The next release version is X.Y.Z" and show the notes. "There
   are no relevant changes" means nothing releases.
4. Release:

   ```sh
   npx semantic-release --no-ci
   ```

   It sets the version, writes `CHANGELOG.md`, commits and pushes
   `chore(release): vX.Y.Z [skip ci]` and the `vX.Y.Z` tag, then runs
   `npm publish`.
5. Check it's out: `npm view @afagund/semantic-release-monorepo version`.

### If the publish fails

The release commit and tag are pushed before `npm publish` runs, so after a
failed publish the version is tagged but not on npm, and the next run won't
retry it. Fix the cause (usually auth), then publish the tag by hand; its
`package.json` already has the version:

```sh
git switch --detach vX.Y.Z
npm ci
npm publish --tag latest
git switch main
```

## License

[MIT](LICENSE)
