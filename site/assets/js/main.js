// data/works.json を読み込み、作品カードの一覧を表示する。

const ACTION_LABELS = {
  app: '使ってみる',
  game: '遊ぶ',
};

function createWorkCard(work) {
  const card = document.createElement('li');
  card.className = 'work-card';

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
    tagItem.textContent = tag;
    tagList.append(tagItem);
  }

  const action = document.createElement('a');
  action.className = 'work-action';
  action.href = work.url;
  action.target = '_blank';
  action.rel = 'noopener';
  action.textContent = ACTION_LABELS[work.kind];
  action.setAttribute('aria-label', `${work.title}を${ACTION_LABELS[work.kind]}（新しいタブで開く）`);

  body.append(title, summary, tagList, action);
  card.append(thumbnailFrame, body);
  return card;
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
    grid.append(...works.map(createWorkCard));
    status.remove();
  } catch (error) {
    console.error(error);
    status.textContent = '作品の一覧を読み込めませんでした。時間をおいてもう一度お試しください。';
  }
}

showWorks();
