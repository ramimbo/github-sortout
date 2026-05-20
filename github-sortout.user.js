// ==UserScript==
// @name         GitHub Sortout
// @namespace    https://github.com/github-sortout/github-sortout
// @version      1.0.1
// @description  Sort GitHub issue/PR timelines and show public recent activity
// @match        https://github.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// @downloadURL  none
// @updateURL    none
// ==/UserScript==

'use strict';

const SORT_BAR_ID = 'ghs-sort-bar';
const TRIGGER_ID = 'ghs-trigger';
const JUMP_UP_ID = 'ghs-jump-up';
const JUMP_DOWN_ID = 'ghs-jump-down';
const OVERLAY_ID = 'ghs-overlay';
const ACTIONS_LIST_ID = 'ghs-actions-list';
const ACTION_LIMIT_ID = 'ghs-action-limit';
const ACTION_LIMITS = [20, 50, 100];

const originalOrder = new WeakMap();
let nextOrder = 0;
let activeSort = 'default';
let lastPath = location.pathname;
let refreshTimer = null;

GM_addStyle(`
  #${SORT_BAR_ID} {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 12px;
    margin-bottom: 12px;
    background: var(--bgColor-muted, #f6f8fa);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    font-size: 12px;
  }
  #${SORT_BAR_ID} .ghs-label {
    color: var(--fgColor-muted, #636c76);
    margin-right: 4px;
    white-space: nowrap;
  }
  #${SORT_BAR_ID} button,
  #${OVERLAY_ID} button,
  #${OVERLAY_ID} input,
  #${OVERLAY_ID} select {
    font: inherit;
  }
  #${SORT_BAR_ID} button {
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.5;
  }
  #${SORT_BAR_ID} button:hover {
    background: var(--bgColor-neutral-muted, #eaeef2);
  }
  #${SORT_BAR_ID} button.active {
    background: var(--bgColor-accent-emphasis, #0969da);
    color: #fff;
    border-color: var(--bgColor-accent-emphasis, #0969da);
  }
  #${TRIGGER_ID} {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 9000;
    padding: 7px 10px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
  #${TRIGGER_ID}:hover {
    background: var(--bgColor-neutral-muted, #eaeef2);
  }
  #${JUMP_UP_ID},
  #${JUMP_DOWN_ID} {
    position: fixed;
    right: 20px;
    z-index: 9000;
    width: 34px;
    height: 34px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }
  #${JUMP_UP_ID} { bottom: 94px; }
  #${JUMP_DOWN_ID} { bottom: 56px; }
  #${JUMP_UP_ID}:hover,
  #${JUMP_DOWN_ID}:hover {
    background: var(--bgColor-neutral-muted, #eaeef2);
  }
  #${JUMP_UP_ID}.ghs-disabled,
  #${JUMP_DOWN_ID}.ghs-disabled {
    opacity: 0.45;
  }
  #${OVERLAY_ID} {
    position: fixed;
    inset: 0;
    z-index: 9001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 35, 40, 0.42);
  }
  #${OVERLAY_ID} .ghs-dialog {
    width: min(860px, 100%);
    max-height: min(720px, 100%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 8px;
    box-shadow: 0 16px 44px rgba(0,0,0,0.24);
    font-size: 14px;
  }
  #${OVERLAY_ID} .ghs-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--borderColor-default, #d0d7de);
    background: var(--bgColor-muted, #f6f8fa);
  }
  #${OVERLAY_ID} h2 {
    margin: 0;
    font-size: 16px;
  }
  #${OVERLAY_ID} .ghs-close,
  #${OVERLAY_ID} .ghs-submit {
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    cursor: pointer;
    padding: 5px 10px;
  }
  #${OVERLAY_ID} .ghs-submit {
    background: var(--bgColor-accent-emphasis, #0969da);
    border-color: var(--bgColor-accent-emphasis, #0969da);
    color: #fff;
  }
  #${OVERLAY_ID} .ghs-body {
    overflow: auto;
    padding: 16px;
  }
  #${OVERLAY_ID} .ghs-form {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  #${OVERLAY_ID} .ghs-options {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--fgColor-muted, #636c76);
    font-size: 13px;
  }
  #${OVERLAY_ID} input {
    min-width: 0;
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
  }
  #${OVERLAY_ID} select {
    padding: 4px 6px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
  }
  #${OVERLAY_ID} .ghs-status {
    color: var(--fgColor-muted, #636c76);
    margin: 0 0 12px;
  }
  #${ACTIONS_LIST_ID} {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  #${ACTIONS_LIST_ID} li {
    padding: 11px 0;
    border-top: 1px solid var(--borderColor-muted, #eaeef2);
  }
  #${ACTIONS_LIST_ID} a {
    display: block;
    color: var(--fgColor-default, #1f2328);
    font-weight: 600;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  #${ACTIONS_LIST_ID} a:hover {
    text-decoration: underline;
  }
  #${ACTIONS_LIST_ID} .ghs-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    color: var(--fgColor-muted, #636c76);
    font-size: 12px;
  }
  #${ACTIONS_LIST_ID} .ghs-kind {
    color: var(--fgColor-accent, #0969da);
    font-weight: 600;
  }
`);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function isTimelinePage() {
  return /^\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(location.pathname);
}

function make(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (name === 'className') node.className = value;
    else if (name === 'text') node.textContent = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function timeAgo(iso) {
  const date = new Date(iso).getTime();
  if (!date) return '';
  const sec = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function remember(items) {
  for (const item of items) {
    if (!originalOrder.has(item)) originalOrder.set(item, nextOrder++);
  }
}

function parseDate(item) {
  const time = $('relative-time[datetime], time-ago[datetime], time[datetime], [datetime]', item);
  return time ? new Date(time.getAttribute('datetime')).getTime() || 0 : 0;
}

function parseReactions(item) {
  let total = 0;

  for (const count of $$('.reaction-count, .js-reactions-box-count', item)) {
    total += parseInt(count.textContent.trim(), 10) || 0;
  }

  for (const button of $$('button[aria-label*="reaction" i]', item)) {
    const match = (button.getAttribute('aria-label') || '').match(/(\d+)\s+reactions?/i);
    total += match ? parseInt(match[1], 10) || 0 : 0;
  }

  return total;
}

const TYPE_ORDER = { comment: 0, review: 1, bot: 2, event: 3 };

function hasBotAuthor(item) {
  const author = $('.author, [data-testid="avatar-link"], [data-testid="issue-body-header-author"]', item);
  return !!author && /\[bot\]$/i.test(author.textContent.trim());
}

function itemType(item, adapterName) {
  if (hasBotAuthor(item)) return 'bot';

  if (adapterName === 'react') {
    const text = item.textContent;
    if (/\b(reviewed|approved|requested changes)\b/i.test(text)) return 'review';
    if ($('.react-issue-comment, [data-testid^="comment-viewer-outer-box"]', item)) return 'comment';
    return 'event';
  }

  if ($('.review-thread, .js-review-state, review-thread-collapsible', item)) return 'review';
  if ($('.timeline-comment-wrapper, .js-comment-container', item)) return 'comment';
  return 'event';
}

function sortItems(items, criteria, adapterName) {
  if (criteria === 'default') {
    return [...items].sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));
  }

  return [...items].sort((a, b) => {
    let result = 0;

    if (criteria === 'newest') result = parseDate(b) - parseDate(a);
    if (criteria === 'oldest') result = parseDate(a) - parseDate(b);
    if (criteria === 'react-d') result = parseReactions(b) - parseReactions(a);
    if (criteria === 'react-a') result = parseReactions(a) - parseReactions(b);
    if (criteria === 'type') {
      result = (TYPE_ORDER[itemType(a, adapterName)] ?? 99) - (TYPE_ORDER[itemType(b, adapterName)] ?? 99);
      if (!result) result = parseDate(a) - parseDate(b);
    }

    return result || ((originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));
  });
}

function directChildren(container) {
  return [...container.children].filter((child) => child.id !== SORT_BAR_ID);
}

function isTimedItem(item) {
  return !!$('relative-time[datetime], time-ago[datetime], time[datetime]', item);
}

function moveNodes(nodes, sortedNodes) {
  if (!nodes.length) return;
  const marker = document.createComment('github-sortout');
  nodes[0].before(marker);
  for (const node of sortedNodes) marker.before(node);
  marker.remove();
}

const TimelineSorter = (() => {
  const adapters = [
    {
      name: 'react',
      container: () => $('[data-testid="issue-timeline-container"]'),
      items(container) {
        return directChildren(container).filter(isTimedItem);
      },
      restoreNodes(container) {
        return directChildren(container);
      },
      insertBar(bar, container) {
        container.parentNode.insertBefore(bar, container);
      },
    },
    {
      name: 'pr',
      container: () => $('.js-discussion'),
      items(container) {
        return $$('.js-timeline-item', container);
      },
      restoreNodes(container) {
        return this.items(container);
      },
      insertBar(bar, container) {
        container.parentNode.insertBefore(bar, container);
      },
    },
  ];

  function adapter() {
    for (const candidate of adapters) {
      const container = candidate.container();
      if (container && candidate.items(container).length) return { ...candidate, container };
    }
    return null;
  }

  function buildBar() {
    const bar = make('div', { id: SORT_BAR_ID });
    bar.append(make('span', { className: 'ghs-label', text: 'Sort:' }));

    for (const [label, sort] of [
      ['Default', 'default'],
      ['Newest first', 'newest'],
      ['Oldest first', 'oldest'],
      ['Most reactions', 'react-d'],
      ['Fewest reactions', 'react-a'],
      ['By type', 'type'],
    ]) {
      const button = make('button', { type: 'button', text: label });
      button.dataset.sort = sort;
      if (sort === activeSort) button.classList.add('active');
      bar.append(button);
    }

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-sort]');
      if (!button) return;

      activeSort = button.dataset.sort;
      for (const other of $$('button', bar)) other.classList.toggle('active', other === button);
      applySort();
    });

    return bar;
  }

  function inject() {
    if (!isTimelinePage()) {
      $(`#${SORT_BAR_ID}`)?.remove();
      return;
    }

    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      activeSort = 'default';
      $(`#${SORT_BAR_ID}`)?.remove();
    }

    const current = adapter();
    if (!current) return;

    remember(current.restoreNodes(current.container));
    remember(current.items(current.container));

    if (!$(`#${SORT_BAR_ID}`)) {
      current.insertBar(buildBar(), current.container);
    }

    if (activeSort !== 'default') applySort();
  }

  function applySort() {
    const current = adapter();
    if (!current) return;

    if (activeSort === 'default') {
      const nodes = current.restoreNodes(current.container);
      remember(nodes);
      moveNodes(nodes, [...nodes].sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0)));
      return;
    }

    const items = current.items(current.container);
    remember(items);
    moveNodes(items, sortItems(items, activeSort, current.name));
  }

  return { inject };
})();

const JumpButtons = (() => {
  function scrollRoot() {
    return document.scrollingElement || document.documentElement;
  }

  function timelineItems() {
    const reactContainer = $('[data-testid="issue-timeline-container"]');
    if (reactContainer) return directChildren(reactContainer).filter(isTimedItem);
    return $$('.js-discussion .js-timeline-item');
  }

  function target(direction) {
    const items = timelineItems();
    if (!isTimelinePage() || !items.length) return null;
    if (direction === 'up') return $('[data-testid="issue-body"]') || items[0];
    return items[items.length - 1];
  }

  function jump(direction) {
    const node = target(direction);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: direction === 'up' ? 'start' : 'end' });
      return;
    }

    const root = scrollRoot();
    window.scrollTo({
      top: direction === 'up' ? 0 : root.scrollHeight,
      behavior: 'smooth',
    });
  }

  function update() {
    const root = scrollRoot();
    const atTop = window.scrollY <= 8;
    const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 8;

    for (const [id, disabled] of [[JUMP_UP_ID, atTop], [JUMP_DOWN_ID, atBottom]]) {
      const button = $(`#${id}`);
      if (!button) continue;
      button.classList.toggle('ghs-disabled', disabled);
      button.disabled = disabled;
    }
  }

  function inject() {
    if ($(`#${JUMP_UP_ID}`) && $(`#${JUMP_DOWN_ID}`)) {
      update();
      return;
    }

    const up = make('button', {
      id: JUMP_UP_ID,
      type: 'button',
      title: 'Jump to top',
      'aria-label': 'Jump to top',
      text: '↑',
    });
    const down = make('button', {
      id: JUMP_DOWN_ID,
      type: 'button',
      title: 'Jump to bottom',
      'aria-label': 'Jump to bottom',
      text: '↓',
    });

    up.addEventListener('click', () => jump('up'));
    down.addEventListener('click', () => jump('down'));
    document.body.append(up, down);
    update();
  }

  return { inject, update };
})();

const RecentActions = (() => {
  let actionLimit = ACTION_LIMITS[0];
  let lastActions = [];

  function currentUser() {
    return $('meta[name="user-login"]')?.content ||
      $('meta[name="octolytics-actor-login"]')?.content ||
      '';
  }

  function safeGitHubUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : 'https://github.com/';
    } catch {
      return 'https://github.com/';
    }
  }

  function eventAction(event) {
    const payload = event.payload || {};
    const repo = event.repo?.name || '';
    const createdAt = event.created_at || '';

    if (event.type === 'PullRequestEvent' && payload.pull_request) {
      return {
        kind: `PR ${payload.action || 'activity'}`,
        title: payload.pull_request.title || 'Pull request',
        url: payload.pull_request.html_url,
        repo,
        createdAt,
      };
    }

    if (event.type === 'IssuesEvent' && payload.issue) {
      return {
        kind: `Issue ${payload.action || 'activity'}`,
        title: payload.issue.title || 'Issue',
        url: payload.issue.html_url,
        repo,
        createdAt,
      };
    }

    if (event.type === 'IssueCommentEvent' && payload.issue && payload.comment) {
      return {
        kind: payload.issue.pull_request ? 'PR comment' : 'Issue comment',
        title: payload.issue.title || 'Comment',
        url: payload.comment.html_url || payload.issue.html_url,
        repo,
        createdAt,
      };
    }

    if (event.type === 'PullRequestReviewEvent' && payload.pull_request) {
      return {
        kind: 'PR review',
        title: payload.pull_request.title || 'Pull request review',
        url: payload.review?.html_url || payload.pull_request.html_url,
        repo,
        createdAt,
      };
    }

    if (event.type === 'PullRequestReviewCommentEvent' && (payload.pull_request || payload.comment)) {
      return {
        kind: 'Review comment',
        title: payload.pull_request?.title || payload.comment?.path || 'Review comment',
        url: payload.comment?.html_url || payload.pull_request?.html_url,
        repo,
        createdAt,
      };
    }

    return null;
  }

  async function fetchActions(username) {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const events = await response.json();
    return events
      .map(eventAction)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function close() {
    $(`#${OVERLAY_ID}`)?.remove();
  }

  function setStatus(text) {
    const status = $(`#${OVERLAY_ID} .ghs-status`);
    if (status) status.textContent = text;
  }

  function renderActions(actions = lastActions) {
    const list = $(`#${ACTIONS_LIST_ID}`);
    if (!list) return;

    list.replaceChildren();

    if (!actions.length) {
      list.append(make('li', { text: 'No public PR, issue, or comment activity found.' }));
      return;
    }

    for (const action of actions.slice(0, actionLimit)) {
      const link = make('a', { href: safeGitHubUrl(action.url), text: action.title || action.kind });
      const meta = make('div', { className: 'ghs-meta' }, [
        make('span', { className: 'ghs-kind', text: action.kind }),
        make('span', { text: action.repo }),
        make('span', { text: timeAgo(action.createdAt) }),
      ]);
      list.append(make('li', {}, [link, meta]));
    }
  }

  function renderOptions(body) {
    const select = make('select', { id: ACTION_LIMIT_ID, 'aria-label': 'Number of recent actions' });
    for (const limit of ACTION_LIMITS) {
      select.append(make('option', { value: String(limit), text: String(limit) }));
    }
    select.value = String(actionLimit);
    select.addEventListener('change', () => {
      actionLimit = parseInt(select.value, 10) || ACTION_LIMITS[0];
      renderActions();
    });

    body.append(make('div', { className: 'ghs-options' }, [
      make('span', { text: 'Show latest' }),
      select,
      make('span', { text: 'actions' }),
    ]));
  }

  function renderForm(body, username) {
    const form = make('form', { className: 'ghs-form' });
    const input = make('input', {
      name: 'username',
      autocomplete: 'off',
      placeholder: 'GitHub username',
      value: username,
      'aria-label': 'GitHub username',
    });
    const submit = make('button', { type: 'submit', className: 'ghs-submit', text: 'Load' });
    form.append(input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      load(input.value.trim());
    });
    body.append(form);
  }

  async function load(username) {
    if (!username) {
      setStatus('Enter a GitHub username to load public activity.');
      return;
    }

    setStatus(`Loading public activity for ${username}...`);
    lastActions = [];
    renderActions();

    try {
      lastActions = await fetchActions(username);
      setStatus(`Showing public activity for ${username}.`);
      renderActions();
    } catch (error) {
      setStatus(`Could not load activity: ${error.message}`);
      lastActions = [];
      renderActions();
    }
  }

  function open() {
    close();

    const username = currentUser();
    const closeButton = make('button', { type: 'button', className: 'ghs-close', text: 'Close' });
    closeButton.addEventListener('click', close);

    const body = make('div', { className: 'ghs-body' });
    if (!username) renderForm(body, '');
    renderOptions(body);
    body.append(make('p', { className: 'ghs-status', text: '' }));
    body.append(make('ul', { id: ACTIONS_LIST_ID }));

    const dialog = make('div', { className: 'ghs-dialog', role: 'dialog', 'aria-modal': 'true' }, [
      make('div', { className: 'ghs-head' }, [
        make('h2', { text: 'Recent actions' }),
        closeButton,
      ]),
      body,
    ]);

    const overlay = make('div', { id: OVERLAY_ID }, [dialog]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.body.append(overlay);

    load(username);
  }

  function injectTrigger() {
    if ($(`#${TRIGGER_ID}`)) return;
    const button = make('button', {
      id: TRIGGER_ID,
      type: 'button',
      title: 'GitHub Sortout recent actions',
      text: 'Sortout',
    });
    button.addEventListener('click', open);
    document.body.append(button);
  }

  return { close, injectTrigger };
})();

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    TimelineSorter.inject();
    JumpButtons.inject();
    RecentActions.injectTrigger();
  }, 250);
}

function init() {
  TimelineSorter.inject();
  JumpButtons.inject();
  RecentActions.injectTrigger();
}

document.addEventListener('turbo:load', init);
document.addEventListener('turbo:render', scheduleRefresh);
document.addEventListener('pjax:end', init);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') RecentActions.close();
});
document.addEventListener('scroll', () => JumpButtons.update(), { passive: true });

new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });

init();
