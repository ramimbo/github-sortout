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

test('sorts current PR conversation timeline items', async ({ page }) => {
  await openFixture(page, 'https://github.com/owner/repo/pull/2', `
    <div class="pull-discussion-timeline">
      <div class="js-discussion">
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
  await page.locator('#ghs-sort-bar button[data-sort="newest"]').click();

  await expect(await labels(page, '.js-discussion > .js-timeline-item')).toEqual([
    'new-pr-comment',
    'old-pr-comment',
  ]);
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

