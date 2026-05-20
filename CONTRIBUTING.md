# Contributing

Keep changes small, plain, and easy to audit.

## Workflow

Use pull requests for changes to `main`.

1. Branch from `main`.
2. Make the smallest change that solves the issue.
3. Update docs when behavior, install steps, privacy, or testing changes.
4. Open a pull request with what changed, why, and how it was tested.

Avoid unrelated cleanup in feature or bugfix PRs.

## Code

- Keep the userscript dependency-free unless there is a strong reason.
- Prefer DOM APIs and text nodes over `innerHTML`.
- Do not add GitHub tokens, background services, analytics, or local activity tracking.
- Treat GitHub selectors as unstable. Keep adapters small and covered by fixtures.
- Sorting should only move loaded timeline activity, not the initial issue or PR post.

## Testing

Before opening a PR, run:

```sh
node --check github-sortout.user.js
npm test
```

Run the live smoke checks when touching GitHub page selectors or timeline behavior:

```sh
npm run test:live
```

Manual browser testing is still useful for userscript changes, especially in Firefox with Violentmonkey.

## Releases

There is no build step and no automatic update channel.

For a release, update the userscript version, commit through a pull request, merge to `main`, and install from the raw script URL.
