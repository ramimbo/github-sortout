import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const scriptPath = new URL('../github-sortout.user.js', import.meta.url);

async function installScript(page) {
  const script = await readFile(scriptPath, 'utf8');

  await page.evaluate((source) => {
    window.GM_addStyle = (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    };

    eval(source);
  }, script);
}

async function openFixture(page, url, body) {
  await page.route(url, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html>
      <html>
        <head><meta name="user-login" content="octocat"><title>Fixture</title></head>
        <body>${body}</body>
      </html>`,
  }));

  await page.goto(url);
}

async function labels(page, selector) {
  return page.locator(selector).evaluateAll((items) => items.map((item) => item.dataset.label));
}

test('sorts loaded React issue timeline items without moving the issue body', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/issues/1', `
    <main>
      <div data-testid="issue-body" data-label="issue-body">
        <relative-time datetime="2024-01-01T00:00:00.000Z"></relative-time>
        Issue description
      </div>
      <div data-testid="issue-viewer-comments-container">
        <div data-testid="issue-timeline-container">
          <div data-label="old-comment" class="LayoutHelpers-module__timelineElement__ARvqv">
            <div class="react-issue-comment">
              <a data-testid="avatar-link">alice</a>
              <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
              <div data-testid="markdown-body">Old comment</div>
            </div>
          </div>
          <div data-label="new-comment" class="LayoutHelpers-module__timelineElement__ARvqv">
            <div class="react-issue-comment">
              <a data-testid="avatar-link">bob</a>
              <relative-time datetime="2024-01-04T00:00:00.000Z"></relative-time>
              <div data-testid="markdown-body">New comment</div>
            </div>
          </div>
          <div data-label="event" class="LayoutHelpers-module__timelineElement__ARvqv">
            <relative-time datetime="2024-01-03T00:00:00.000Z"></relative-time>
            alice added a label
          </div>
        </div>
      </div>
    </main>
  `);

  await installScript(page);

  await expect(page.locator('#ghs-sort-bar')).toBeVisible();
  await page.locator('#ghs-sort-bar button[data-sort="newest"]').click();

  await expect(page.locator('[data-testid="issue-body"]')).toHaveText(/Issue description/);
  await expect(await labels(page, '[data-testid="issue-timeline-container"] > [data-label]')).toEqual([
    'new-comment',
    'event',
    'old-comment',
  ]);

  await page.locator('#ghs-sort-bar button[data-sort="default"]').click();
  await expect(await labels(page, '[data-testid="issue-timeline-container"] > [data-label]')).toEqual([
    'old-comment',
    'new-comment',
    'event',
  ]);
});

test('places sort controls below the initial issue post', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/issues/6', `
    <main>
      <div data-testid="issue-body" style="height: 120px;">Issue body</div>
      <div data-testid="issue-viewer-comments-container">
        <div data-testid="issue-timeline-container">
          <div data-label="comment">
            <div class="react-issue-comment">
              <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
              Comment
            </div>
          </div>
        </div>
      </div>
    </main>
  `);

  await installScript(page);

  const issueBottom = await page.locator('[data-testid="issue-body"]').evaluate((node) => node.getBoundingClientRect().bottom);
  const sortTop = await page.locator('#ghs-sort-bar').evaluate((node) => node.getBoundingClientRect().top);
  expect(sortTop).toBeGreaterThanOrEqual(issueBottom);
});

test('sorts loaded React comments across a load more divider', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/issues/4', `
    <div data-testid="issue-viewer-comments-container">
      <div data-testid="issue-timeline-container">
        <div data-label="old-comment" class="LayoutHelpers-module__timelineElement__ARvqv">
          <div class="react-issue-comment">
            <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
            Old loaded comment
          </div>
        </div>
        <div data-label="load-more" class="LayoutHelpers-module__timelineElement__ARvqv">
          <button>Load more</button>
        </div>
        <div data-label="newest-comment" class="LayoutHelpers-module__timelineElement__ARvqv">
          <div class="react-issue-comment">
            <relative-time datetime="2024-01-05T00:00:00.000Z"></relative-time>
            Newest loaded comment
          </div>
        </div>
      </div>
    </div>
  `);

  await installScript(page);
  await page.locator('#ghs-sort-bar button[data-sort="newest"]').click();

  await expect(await labels(page, '[data-testid="issue-timeline-container"] > [data-label]')).toEqual([
    'newest-comment',
    'old-comment',
    'load-more',
  ]);

  await page.locator('#ghs-sort-bar button[data-sort="default"]').click();
  await expect(await labels(page, '[data-testid="issue-timeline-container"] > [data-label]')).toEqual([
    'old-comment',
    'load-more',
    'newest-comment',
  ]);
});

test('sorts current PR conversation timeline items', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/pull/2', `
    <div class="pull-discussion-timeline">
      <div class="js-discussion">
        <div class="TimelineItem js-comment-container" data-label="initial-pr-post">
          <div class="js-comment-container">
            <a class="author">opener</a>
            <relative-time datetime="2024-01-01T00:00:00.000Z"></relative-time>
            Initial post
          </div>
        </div>
        <div class="js-timeline-item" data-label="old-pr-comment">
          <div class="js-comment-container">
            <a class="author">alice</a>
            <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
          </div>
        </div>
        <div class="js-timeline-item" data-label="new-pr-comment">
          <div class="js-comment-container">
            <a class="author">bob</a>
            <relative-time datetime="2024-01-05T00:00:00.000Z"></relative-time>
          </div>
        </div>
      </div>
    </div>
  `);

  await installScript(page);

  await expect(page.locator('#ghs-sort-bar')).toBeVisible();
  await expect(await labels(page, '.js-discussion > [data-label], .js-discussion > #ghs-sort-bar')).toEqual([
    'initial-pr-post',
    undefined,
    'old-pr-comment',
    'new-pr-comment',
  ]);

  await page.locator('#ghs-sort-bar button[data-sort="newest"]').click();

  await expect(await labels(page, '.js-discussion > .js-timeline-item')).toEqual([
    'new-pr-comment',
    'old-pr-comment',
  ]);
});

test('injects jump buttons that scroll between top and bottom', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/issues/5', `
    <main style="height: 2600px;">
      <div data-testid="issue-body">Issue body</div>
      <div data-testid="issue-viewer-comments-container">
        <div data-testid="issue-timeline-container">
          <div data-label="first-comment" style="margin-top: 800px;">
            <div class="react-issue-comment">
              <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
              First comment
            </div>
          </div>
          <div data-label="last-comment" style="margin-top: 900px;">
            <div class="react-issue-comment">
              <relative-time datetime="2024-01-05T00:00:00.000Z"></relative-time>
              Last comment
            </div>
          </div>
        </div>
      </div>
    </main>
  `);

  await installScript(page);

  await expect(page.locator('#ghs-jump-up')).toBeVisible();
  await expect(page.locator('#ghs-jump-down')).toBeVisible();

  await page.locator('#ghs-jump-down').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  await page.locator('#ghs-jump-up').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(100);
});

test('sorts by reaction counts on React issue and PR markup', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/issues/3', `
    <div data-testid="issue-viewer-comments-container">
      <div data-testid="issue-timeline-container">
        <div data-label="react-low" class="LayoutHelpers-module__timelineElement__ARvqv">
          <div class="react-issue-comment">
            <relative-time datetime="2024-01-01T00:00:00.000Z"></relative-time>
            <button aria-label="👍 2 reactions">👍 React with 👍 2</button>
          </div>
        </div>
        <div data-label="legacy-high" class="LayoutHelpers-module__timelineElement__ARvqv">
          <div class="react-issue-comment">
            <relative-time datetime="2024-01-02T00:00:00.000Z"></relative-time>
            <span class="reaction-count">7</span>
          </div>
        </div>
        <div data-label="none" class="LayoutHelpers-module__timelineElement__ARvqv">
          <div class="react-issue-comment">
            <relative-time datetime="2024-01-03T00:00:00.000Z"></relative-time>
          </div>
        </div>
      </div>
    </div>
  `);

  await installScript(page);
  await page.locator('#ghs-sort-bar button[data-sort="react-d"]').click();

  await expect(await labels(page, '[data-testid="issue-timeline-container"] > [data-label]')).toEqual([
    'legacy-high',
    'react-low',
    'none',
  ]);
});

test('renders public GitHub events in a full-screen overlay without executing HTML', async ({ page }) => {
  await openFixture(page, 'https://github.com/', '<main>Home</main>');
  await page.route('https://api.github.com/users/octocat/events/public?per_page=100', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([
      {
        type: 'PushEvent',
        created_at: '2026-05-20T10:00:00.000Z',
        repo: { name: 'owner/ignored' },
        payload: {},
      },
      {
        type: 'PullRequestEvent',
        created_at: '2026-05-20T12:00:00.000Z',
        repo: { name: 'owner/repo' },
        payload: {
          action: 'opened',
          pull_request: {
            title: '<img src=x onerror="window.__sortoutXss=1">',
            html_url: 'https://github.com/owner/repo/pull/1',
          },
        },
      },
      {
        type: 'IssueCommentEvent',
        created_at: '2026-05-20T11:00:00.000Z',
        repo: { name: 'owner/repo' },
        payload: {
          action: 'created',
          issue: {
            title: 'Bug report',
            html_url: 'https://github.com/owner/repo/issues/2',
          },
          comment: {
            html_url: 'https://github.com/owner/repo/issues/2#issuecomment-1',
          },
        },
      },
    ]),
  }));

  await installScript(page);
  await page.locator('#ghs-trigger').click();

  await expect(page.locator('#ghs-overlay')).toBeVisible();
  await expect(page.locator('#ghs-overlay h2')).toHaveText('Recent actions');
  await expect(page.locator('#ghs-actions-list a')).toHaveCount(2);
  await expect(page.locator('#ghs-actions-list a').first()).toHaveText('<img src=x onerror="window.__sortoutXss=1">');
  await expect(page.locator('#ghs-actions-list a').nth(1)).toHaveText('Bug report');
  await expect(page.locator('#ghs-actions-list img')).toHaveCount(0);
  await expect(page.evaluate(() => window.__sortoutXss)).resolves.toBeUndefined();
});

test('shows the latest 20 public actions by default with count options', async ({ page }) => {
  const events = Array.from({ length: 25 }, (_, index) => ({
    type: 'PullRequestEvent',
    created_at: new Date(Date.UTC(2026, 4, 20, 0, index)).toISOString(),
    repo: { name: 'owner/repo' },
    payload: {
      action: 'opened',
      pull_request: {
        title: `PR ${index}`,
        html_url: `https://github.com/owner/repo/pull/${index}`,
      },
    },
  })).reverse();

  await openFixture(page, 'https://github.com/', '<main>Home</main>');
  await page.route('https://api.github.com/users/octocat/events/public?per_page=100', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(events),
  }));

  await installScript(page);
  await page.locator('#ghs-trigger').click();

  await expect(page.locator('#ghs-actions-list a')).toHaveCount(20);
  await expect(page.locator('#ghs-actions-list a').first()).toHaveText('PR 24');
  await expect(page.locator('#ghs-actions-list a').last()).toHaveText('PR 5');

  await page.locator('#ghs-action-limit').selectOption('50');
  await expect(page.locator('#ghs-actions-list a')).toHaveCount(25);
  await expect(page.locator('#ghs-actions-list a').last()).toHaveText('PR 0');
});

test('sorts recent actions by newest, oldest, type, and repository', async ({ page }) => {
  const events = [
    {
      type: 'IssueCommentEvent',
      created_at: '2026-05-20T13:00:00.000Z',
      repo: { name: 'zeta/repo' },
      payload: {
        issue: { title: 'Comment newest', html_url: 'https://github.com/zeta/repo/issues/1' },
        comment: { html_url: 'https://github.com/zeta/repo/issues/1#issuecomment-1' },
      },
    },
    {
      type: 'PullRequestEvent',
      created_at: '2026-05-20T11:00:00.000Z',
      repo: { name: 'alpha/repo' },
      payload: {
        action: 'opened',
        pull_request: { title: 'PR oldest', html_url: 'https://github.com/alpha/repo/pull/1' },
      },
    },
    {
      type: 'IssuesEvent',
      created_at: '2026-05-20T12:00:00.000Z',
      repo: { name: 'middle/repo' },
      payload: {
        action: 'opened',
        issue: { title: 'Issue middle', html_url: 'https://github.com/middle/repo/issues/1' },
      },
    },
  ];

  await openFixture(page, 'https://github.com/', '<main>Home</main>');
  await page.route('https://api.github.com/users/octocat/events/public?per_page=100', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(events),
  }));

  await installScript(page);
  await page.locator('#ghs-trigger').click();

  await expect(page.locator('#ghs-actions-list a')).toHaveText([
    'Comment newest',
    'Issue middle',
    'PR oldest',
  ]);

  await page.locator('#ghs-action-sort').selectOption('oldest');
  await expect(page.locator('#ghs-actions-list a')).toHaveText([
    'PR oldest',
    'Issue middle',
    'Comment newest',
  ]);

  await page.locator('#ghs-action-sort').selectOption('type');
  await expect(page.locator('#ghs-actions-list a')).toHaveText([
    'Issue middle',
    'Comment newest',
    'PR oldest',
  ]);

  await page.locator('#ghs-action-sort').selectOption('repo');
  await expect(page.locator('#ghs-actions-list a')).toHaveText([
    'PR oldest',
    'Issue middle',
    'Comment newest',
  ]);
});
