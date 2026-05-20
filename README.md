# github-sortout

Userscript that adds sorting to GitHub issue/PR timelines and a recent public actions view.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Safari) or [Violentmonkey](https://violentmonkey.github.io/) (Firefox/Chrome)
2. Click [install script](../../raw/main/github-sortout.user.js)

No build step. Updates are manual, so you can review changes before installing them.

## Features

**Timeline sorting** - on issues and PRs, a sort bar appears above the loaded activity:

- Default (restores original order)
- Newest first / Oldest first
- Most reactions / Fewest reactions
- By type: comments -> reviews -> bot comments -> events

Sorting only affects activity GitHub has loaded on the page. Click GitHub's "Load more" first if older items are hidden.

**Recent actions** - the Sortout button opens a full-screen view of your recent public GitHub activity, newest first. It uses GitHub's public Events API for PRs, issues, comments, PR reviews, and review comments.

## Browser support

Any browser running Tampermonkey or Violentmonkey:
- Chrome/Chromium (Brave, Edge, Arc, Opera)
- Firefox
- Safari via [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)

## Notes

- Sorting is non-destructive - switching back to Default restores the original order without a reload
- Handles GitHub's Turbo/Pjax navigation so the sort bar survives in-page transitions
- Recent actions are public GitHub activity only
- No GitHub token is used or stored

## License

MIT
