// トップページの見出しを粒子で描き、カーソルを近づけると文字が「ほどけて」、離すと組み直る演出。
// 本物の見出しの文字は残したまま（検索エンジン・読み上げ用）透明にし、その上に canvas で粒子を描く。
// 「視差効果を減らす」設定のときや canvas が使えないときは何もせず、普通の文字のまま表示する。
(() => {
  const hero = document.querySelector('.hero');
  const title = hero?.querySelector('[data-particle-title]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (!hero || !title || reduceMotion.matches) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'hero-particles';
  canvas.setAttribute('aria-hidden', 'true');

  // 粒子の動き方（1 フレームあたりの値）
  const SPRING = 0.075; // 元の位置へ戻ろうとする強さ
  const FRICTION = 0.8; // 速度の減衰
  const PUSH = 3.2; // カーソルが粒子を押しのける強さ
  const BURST = 14; // クリック・タップで弾き飛ばす強さ
  const SETTLE = 0.04; // これより遅く、元の位置に近ければ止まったとみなす

  let width = 0;
  let height = 0;
  let dpr = 1;
  let size = 2; // 粒子 1 個の大きさ（CSS ピクセル）
  let radius = 80; // カーソルの影響が届く半径
  let count = 0;
  let homeX;
  let homeY;
  let posX;
  let posY;
  let velX;
  let velY;
  let faint; // 文字の縁の、薄く描く粒子なら 1
  let color = '';
  let frame = 0;
  let visible = true;
  let stopped = false;
  let resizeTimer = 0;
  const pointer = { x: 0, y: 0, active: false };

  function readColor() {
    color = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#2a2521';
  }

  // 見出しの文字を 1 文字ずつ、画面上と同じ位置に裏の canvas へ書き、その画素から粒子の位置を作る。
  // 1 文字ずつ位置を測るので、画面幅による折り返しにもそのまま追従する。
  function build(intro) {
    const heroRect = hero.getBoundingClientRect();
    width = heroRect.width;
    height = heroRect.height;
    if (width === 0 || height === 0) return false;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const style = getComputedStyle(title);
    const fontSize = parseFloat(style.fontSize);
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    size = Math.max(2, Math.round(fontSize / 34));
    radius = Math.max(60, fontSize * 1.4);

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    offCtx.scale(dpr, dpr);
    offCtx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = '#000';

    const range = document.createRange();
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.data;
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (/\s/.test(char)) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        // 文字の幅には字間（letter-spacing）が含まれるので、その分を除いて中央に置く
        const x = rect.left - heroRect.left + (rect.width - letterSpacing) / 2;
        const y = rect.top - heroRect.top + rect.height / 2;
        offCtx.fillText(char, x, y);
      }
    }

    const { data } = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const step = size * dpr;
    const xs = [];
    const ys = [];
    const faints = [];
    for (let y = step / 2; y < offscreen.height; y += step) {
      for (let x = step / 2; x < offscreen.width; x += step) {
        const alpha = data[(Math.floor(y) * offscreen.width + Math.floor(x)) * 4 + 3];
        if (alpha > 64) {
          xs.push(x / dpr);
          ys.push(y / dpr);
          faints.push(alpha < 170 ? 1 : 0);
        }
      }
    }

    count = xs.length;
    if (count === 0) return false;
    homeX = Float32Array.from(xs);
    homeY = Float32Array.from(ys);
    faint = Uint8Array.from(faints);
    posX = new Float32Array(count);
    posY = new Float32Array(count);
    velX = new Float32Array(count);
    velY = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      if (intro) {
        // 最初の表示では、ばらばらの位置から集まってくる
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * width * 0.5;
        posX[i] = homeX[i] + Math.cos(angle) * distance;
        posY[i] = homeY[i] + Math.sin(angle) * distance * 0.6;
      } else {
        posX[i] = homeX[i];
        posY[i] = homeY[i];
      }
    }
    return true;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    const half = size / 2;
    // 濃い粒子と薄い粒子をまとめて描く（1 個ずつ透明度を変えるより速い）
    for (const level of [0, 1]) {
      ctx.globalAlpha = level === 0 ? 1 : 0.45;
      for (let i = 0; i < count; i += 1) {
        if (faint[i] === level) {
          ctx.fillRect(posX[i] - half, posY[i] - half, size, size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    frame = 0;
    const radiusSquared = radius * radius;
    let moving = false;

    for (let i = 0; i < count; i += 1) {
      const x = posX[i];
      const y = posY[i];
      let vx = velX[i];
      let vy = velY[i];

      if (pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared && distanceSquared > 0.01) {
          const distance = Math.sqrt(distanceSquared);
          // 少しだけ揺らぎを加えて、糸がほどけるようなざわめきを出す
          const force = (1 - distance / radius) * PUSH * (0.8 + Math.random() * 0.4);
          vx += (dx / distance) * force;
          vy += (dy / distance) * force;
        }
      }

      vx = (vx + (homeX[i] - x) * SPRING) * FRICTION;
      vy = (vy + (homeY[i] - y) * SPRING) * FRICTION;
      posX[i] = x + vx;
      posY[i] = y + vy;
      velX[i] = vx;
      velY[i] = vy;

      if (
        !moving &&
        (Math.abs(vx) > SETTLE ||
          Math.abs(vy) > SETTLE ||
          Math.abs(homeX[i] - posX[i]) > 0.3 ||
          Math.abs(homeY[i] - posY[i]) > 0.3)
      ) {
        moving = true;
      }
    }

    if (!moving && !pointer.active) {
      // 止まったら元の位置にそろえて、文字をくっきり見せる
      posX.set(homeX);
      posY.set(homeY);
    }
    draw();

    // 動いている間だけ描き続ける（止まったら CPU を使わない）
    if (moving) request();
  }

  function request() {
    if (!frame && visible && !stopped) {
      frame = requestAnimationFrame(tick);
    }
  }

  function updatePointer(event) {
    const rect = hero.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  }

  function onPointerMove(event) {
    updatePointer(event);
    pointer.active = true;
    request();
  }

  function onPointerLeave() {
    pointer.active = false;
    request();
  }

  // クリック・タップした場所の周りの粒子を弾き飛ばす
  function onPointerDown(event) {
    updatePointer(event);
    const reach = radius * 2.2;
    for (let i = 0; i < count; i += 1) {
      const dx = posX[i] - pointer.x;
      const dy = posY[i] - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < reach && distance > 0.1) {
        const force = (1 - distance / reach) * BURST * (0.6 + Math.random() * 0.8);
        velX[i] += (dx / distance) * force;
        velY[i] += (dy / distance) * force;
      }
    }
    request();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (stopped) return;
      const rect = hero.getBoundingClientRect();
      if (Math.abs(rect.width - width) < 0.5 && Math.abs(rect.height - height) < 0.5) return;
      if (build(false)) {
        draw();
      } else {
        stop();
      }
    }, 150);
  }

  // 途中で「視差効果を減らす」設定に変わったときなどに、普通の文字の表示へ戻す
  function stop() {
    stopped = true;
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.remove();
    title.classList.remove('is-particle');
    hero.removeEventListener('pointermove', onPointerMove);
    hero.removeEventListener('pointerleave', onPointerLeave);
    hero.removeEventListener('pointerdown', onPointerDown);
  }

  function start() {
    if (reduceMotion.matches) return;
    readColor();
    hero.append(canvas);
    if (!build(true)) {
      canvas.remove();
      return;
    }
    title.classList.add('is-particle');
    request();

    hero.addEventListener('pointermove', onPointerMove);
    hero.addEventListener('pointerleave', onPointerLeave);
    hero.addEventListener('pointerdown', onPointerDown);
    new ResizeObserver(onResize).observe(hero);

    // 画面の外にあるときは描かない
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) request();
    }).observe(hero);

    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) stop();
    });
    darkScheme.addEventListener('change', () => {
      readColor();
      if (!stopped) draw();
    });
  }

  // フォントの読み込みを待ってから文字の形を取る
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
