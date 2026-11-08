'use strict';

// Preset for a Helm chart: the base config, plus setting `version` in
// Chart.yaml and regenerating the chart's README.md with helm-docs (which must
// be on the PATH) before the release commit.

const base = require('../index');

const [filter, changelog, [gitPlugin, gitOptions]] = base.plugins;

module.exports = {
  ...base,
  plugins: [
    filter,
    changelog,
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          "sed -i 's/^version: .*/version: ${nextRelease.version}/' Chart.yaml && helm-docs --chart-search-root .",
      },
    ],
    [gitPlugin, { ...gitOptions, assets: [...gitOptions.assets, 'Chart.yaml', 'README.md'] }],
  ],
};
