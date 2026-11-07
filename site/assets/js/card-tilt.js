// 作品カードを、カーソルの位置に合わせて 3D に傾け、表面に光が走るように見せる。
// マウスなど細かく指せる入力のときだけ動かす（タッチ操作や「視差効果を減らす」設定のときは何もしない）。
(() => {
  const grid = document.getElementById('works-grid');
  if (!grid) return;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_TILT = 6; // 最大の傾き（度）

  let frame = 0;
  let pending = null;

  function apply() {
    frame = 0;
    if (!pending) return;
    const { card, x, y } = pending;
    pending = null;
    const rect = card.getBoundingClientRect();
    const px = Math.min(Math.max((x - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((y - rect.top) / rect.height, 0), 1);
    card.style.setProperty('--tilt-x', `${((0.5 - py) * MAX_TILT * 2).toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${((px - 0.5) * MAX_TILT * 2).toFixed(2)}deg`);
    card.style.setProperty('--shine-x', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--shine-y', `${(py * 100).toFixed(1)}%`);
    card.classList.add('is-tilting');
  }

  function reset(card) {
    if (pending?.card === card) pending = null;
    card.classList.remove('is-tilting');
    for (const name of ['--tilt-x', '--tilt-y', '--shine-x', '--shine-y']) {
      card.style.removeProperty(name);
    }
  }

  grid.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !finePointer.matches || reduceMotion.matches) return;
    const card = event.target.closest('.work-card');
    if (!card) return;
    pending = { card, x: event.clientX, y: event.clientY };
    // 1 フレームに 1 回だけ計算する
    if (!frame) frame = requestAnimationFrame(apply);
  });

  grid.addEventListener('pointerout', (event) => {
    const card = event.target.closest('.work-card');
    if (!card || card.contains(event.relatedTarget)) return;
    reset(card);
  });
})();
