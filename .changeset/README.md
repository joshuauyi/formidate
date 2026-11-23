# Changesets

Run `npm run changeset` to describe a change (patch / minor / major). The release workflow turns
pending changesets into a "Version Packages" PR; merging it publishes to npm.

While `pre.json` exists the repo is in **pre-release mode** (`beta` tag). Leave it with
`npx changeset pre exit` before the stable 2.0.0 release.
