// 作品カードの「いいね」ボタン。
// main.js がカードを並べ終えたら（works:rendered イベント）、いいねの数を /api/likes から読んでボタンを出す。
// 数を読めないとき（API が動いていない環境など）は、ボタンを出さないままにする。
// どの作品にいいねしたかは、このブラウザの localStorage にだけ覚えておく（サーバーには送らない）。

(() => {
  const API_URL = '/api/likes';
  const STORAGE_KEY = 'lasc-atelier:liked';

  function loadLiked() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function saveLiked(liked) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...liked]));
    } catch {
      // 保存できなくても、いいね自体は送れているので何もしない
    }
  }

  const liked = loadLiked();

  function render(button, count) {
    const isLiked = liked.has(button.dataset.workId);
    button.dataset.count = String(count);
    button.setAttribute('aria-pressed', String(isLiked));
    button.querySelector('.like-count').textContent = String(count);
    const title = button.dataset.workTitle;
    button.setAttribute(
      'aria-label',
      isLiked ? `${title}のいいねを取り消す（いいね ${count} 件）` : `${title}にいいねする（いいね ${count} 件）`,
    );
  }

  async function toggle(button) {
    const id = button.dataset.workId;
    const wasLiked = liked.has(id);
    const before = Number(button.dataset.count);
    const delta = wasLiked ? -1 : 1;

    // 先に見た目を変え、失敗したら元に戻す
    if (wasLiked) liked.delete(id);
    else liked.add(id);
    render(button, Math.max(before + delta, 0));
    if (!wasLiked) {
      button.classList.remove('is-popping');
      void button.offsetWidth; // アニメーションをやり直すため
      button.classList.add('is-popping');
    }
    button.disabled = true;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delta }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      saveLiked(liked);
      render(button, data.count);
    } catch (error) {
      console.error(error);
      if (wasLiked) liked.add(id);
      else liked.delete(id);
      render(button, before);
    } finally {
      button.disabled = false;
    }
  }

  async function setUp() {
    const buttons = [...document.querySelectorAll('.like-button[data-work-id]')];
    if (buttons.length === 0) return;

    let counts;
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      counts = await res.json();
    } catch (error) {
      // API が使えないときは、ボタンを出さない
      console.info('いいねの数を読み込めなかったため、いいねボタンを表示しません。', error);
      return;
    }

    for (const button of buttons) {
      render(button, counts[button.dataset.workId] ?? 0);
      button.addEventListener('click', () => toggle(button));
      button.hidden = false;
    }
  }

  document.addEventListener('works:rendered', setUp, { once: true });
})();
