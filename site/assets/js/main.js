// data/works.json を読み込み、作品カードの一覧を表示する。
// タグで絞り込めるようにし、View Transitions API が使えるブラウザでは、並びが変わる様子をアニメーションで見せる。

const ACTION_LABELS = {
  app: '使ってみる',
  game: '遊ぶ',
};

// 絞り込み中のタグは URL の ?tag= に入れる（そのまま共有・再読み込みできるように）
const TAG_PARAM = 'tag';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// 表示中のカードと、そのカードのタグ
const cards = [];
let currentTag = null;

function createTagButton(tag) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tag-button';
  button.dataset.tag = tag;
  button.textContent = tag;
  button.setAttribute('aria-label', `タグ「${tag}」の作品だけを表示`);
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    // 絞り込み中のタグをもう一度押したら、絞り込みを解除する
    applyFilter(currentTag === tag ? null : tag);
  });
  return button;
}

function createWorkCard(work, index) {
  const card = document.createElement('li');
  card.className = 'work-card';
  // 並び替えのアニメーションで、カードごとに動きを追うための名前
  card.style.viewTransitionName = `work-card-${index}`;

  const thumbnailFrame = document.createElement('div');
  thumbnailFrame.className = 'work-thumbnail';
  const thumbnail = document.createElement('img');
  thumbnail.src = work.thumbnail;
  thumbnail.alt = '';
  thumbnail.loading = 'lazy';
  thumbnailFrame.append(thumbnail);

  const body = document.createElement('div');
  body.className = 'work-body';

  const title = document.createElement('h3');
  title.textContent = work.title;

  const summary = document.createElement('p');
  summary.className = 'work-summary';
  summary.textContent = work.summary;

  const tagList = document.createElement('ul');
  tagList.className = 'tag-list';
  tagList.setAttribute('aria-label', 'タグ');
  for (const tag of work.tags) {
    const tagItem = document.createElement('li');
    tagItem.className = 'has-button';
    tagItem.append(createTagButton(tag));
    tagList.append(tagItem);
  }

  const action = document.createElement('a');
  action.className = 'work-action';
  action.href = work.url;
  action.target = '_blank';
  action.rel = 'noopener';
  action.textContent = ACTION_LABELS[work.kind];
  action.setAttribute('aria-label', `${work.title}を${ACTION_LABELS[work.kind]}（新しいタブで開く）`);

  const actions = document.createElement('div');
  actions.className = 'work-actions';
  actions.append(action);

  // 導入手順がある作品だけ、手順へのリンクを出す
  if (work.guide) {
    const guide = document.createElement('a');
    guide.className = 'work-guide';
    guide.href = work.guide.url;
    guide.target = '_blank';
    guide.rel = 'noopener';
    guide.textContent = work.guide.label;
    guide.setAttribute('aria-label', `${work.title}: ${work.guide.label}（新しいタブで開く）`);
    actions.append(guide);
  }

  body.append(title, summary, tagList, actions);
  card.append(thumbnailFrame, body);
  return card;
}

// 使われているタグを、作品数の多い順に並べる（同じ数なら最初に出てきた順）
function collectTags(works) {
  const counts = new Map();
  for (const work of works) {
    for (const tag of work.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

function createFilter(tags) {
  const filter = document.getElementById('works-filter');

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'filter-button';
  allButton.dataset.tag = '';
  allButton.textContent = 'すべて';
  allButton.setAttribute('aria-pressed', 'false');
  allButton.addEventListener('click', () => applyFilter(null));
  filter.append(allButton);

  for (const tag of tags) {
    const button = createTagButton(tag);
    button.className = 'filter-button';
    button.textContent = tag;
    button.removeAttribute('aria-label');
    filter.append(button);
  }
}

function renderFilter(tag) {
  currentTag = tag;

  let shown = 0;
  for (const { element, tags } of cards) {
    const match = tag === null || tags.includes(tag);
    element.hidden = !match;
    if (match) shown += 1;
  }

  // 絞り込みのボタンと、カードの中のタグのボタンの両方の状態をそろえる
  for (const button of document.querySelectorAll('#works button[data-tag]')) {
    const pressed = button.dataset.tag === (tag ?? '');
    button.setAttribute('aria-pressed', String(pressed));
  }

  const count = document.getElementById('works-count');
  count.textContent = tag === null ? `すべての作品: ${shown} 件` : `「${tag}」の作品: ${shown} 件`;

  const url = new URL(window.location.href);
  if (tag === null) {
    url.searchParams.delete(TAG_PARAM);
  } else {
    url.searchParams.set(TAG_PARAM, tag);
  }
  window.history.replaceState(null, '', url);
}

function applyFilter(tag) {
  if (tag === currentTag) return;
  // View Transitions API があれば、カードが新しい位置へ動く様子をアニメーションにする
  if (document.startViewTransition && !reduceMotion.matches) {
    document.startViewTransition(() => renderFilter(tag));
  } else {
    renderFilter(tag);
  }
}

async function showWorks() {
  const status = document.getElementById('works-status');
  const grid = document.getElementById('works-grid');

  try {
    const response = await fetch('data/works.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const works = await response.json();

    if (works.length === 0) {
      status.textContent = '作品を準備しています。';
      return;
    }

    // 公開日が新しい順に並べる
    works.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    works.forEach((work, index) => {
      const element = createWorkCard(work, index);
      cards.push({ element, tags: work.tags });
      grid.append(element);
    });

    const tags = collectTags(works);
    createFilter(tags);
    const requestedTag = new URL(window.location.href).searchParams.get(TAG_PARAM);
    renderFilter(tags.includes(requestedTag) ? requestedTag : null);
    document.getElementById('works-toolbar').hidden = false;

    status.remove();
  } catch (error) {
    console.error(error);
    status.textContent = '作品の一覧を読み込めませんでした。時間をおいてもう一度お試しください。';
  }
}

showWorks();
