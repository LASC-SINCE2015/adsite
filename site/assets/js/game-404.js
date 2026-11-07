// 404 ページのミニゲーム。「404」の形に並んだブロックを、ボールを打ち返してくずす。
// 画面の座標は 480 x 360 の固定の大きさで計算し、表示するときに canvas の大きさへ合わせて拡大・縮小する。
(() => {
  const canvas = document.getElementById('game-canvas');
  const startButton = document.getElementById('game-start');
  const status = document.getElementById('game-status');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !startButton || !status) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const W = 480;
  const H = 360;

  // 数字のドット絵（# がブロック）
  const DIGITS = {
    4: ['#.#', '#.#', '###', '..#', '..#'],
    0: ['###', '#.#', '#.#', '#.#', '###'],
  };
  const BRICK_W = 32;
  const BRICK_H = 18;
  const BRICK_GAP = 4;
  const BRICKS_TOP = 48;
  const BRICK_SCORE = 10;

  const PADDLE_W = 84;
  const PADDLE_H = 10;
  const PADDLE_Y = H - 30;
  const PADDLE_SPEED = 420; // キーボード操作の速さ（ピクセル / 秒）
  const MAX_BOUNCE = (60 * Math.PI) / 180; // バーの端で打ち返したときの最大の角度

  const BALL_R = 6;
  const BALL_SPEED_START = 250; // ピクセル / 秒
  const BALL_SPEED_MAX = 430;
  const BALL_SPEED_UP = 1.035; // ブロックを 1 個くずすごとに速くなる割合

  const LIVES = 3;

  let colors = {};
  let font = 'sans-serif';
  let bricks = [];
  let debris = [];
  let paddleX = W / 2;
  const ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, speed: BALL_SPEED_START };
  // ready: 始まる前 / serve: 発射待ち / playing: プレイ中 / paused: 一時停止 / over: ゲームオーバー / clear: クリア
  let state = 'ready';
  let score = 0;
  let best = 0;
  let lives = LIVES;
  const keys = { left: false, right: false };
  let frame = 0;
  let lastTime = 0;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    colors = {
      surface: read('--color-surface', '#fffdf9'),
      text: read('--color-text', '#2a2521'),
      muted: read('--color-muted', '#6c6157'),
      line: read('--color-line', '#e4dacb'),
      accent: read('--color-accent', '#a4482f'),
    };
    font = read('--font-sans', 'sans-serif');
  }

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function announce(message) {
    status.textContent = message;
  }

  function createBricks() {
    const rows = DIGITS[4].map((_, row) => [DIGITS[4][row], DIGITS[0][row], DIGITS[4][row]].join('.'));
    const columns = rows[0].length;
    const totalWidth = columns * (BRICK_W + BRICK_GAP) - BRICK_GAP;
    const left = (W - totalWidth) / 2;
    bricks = [];
    rows.forEach((pattern, row) => {
      [...pattern].forEach((cell, column) => {
        if (cell === '#') {
          bricks.push({
            x: left + column * (BRICK_W + BRICK_GAP),
            y: BRICKS_TOP + row * (BRICK_H + BRICK_GAP),
            row,
            alive: true,
          });
        }
      });
    });
  }

  function resetBall() {
    ball.speed = BALL_SPEED_START;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddleX;
    ball.y = PADDLE_Y - BALL_R - 1;
    state = 'serve';
  }

  function newGame() {
    createBricks();
    debris = [];
    score = 0;
    lives = LIVES;
    resetBall();
    announce('スタート。ボールを打ち返して、ブロックをくずしましょう。');
    kick();
  }

  function launch() {
    // 真上から左右 30 度の範囲で、ランダムな向きに打ち出す
    const angle = ((Math.random() - 0.5) * Math.PI) / 3;
    ball.vx = ball.speed * Math.sin(angle);
    ball.vy = -ball.speed * Math.cos(angle);
    state = 'playing';
    kick();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    announce('一時停止中です。');
    draw();
  }

  function resume() {
    state = 'playing';
    announce('');
    kick();
  }

  // クリック・タップ・スペースキーで行う操作（状態によって変わる）
  function primaryAction() {
    if (state === 'ready' || state === 'over' || state === 'clear') {
      newGame();
      launch();
    } else if (state === 'serve') {
      launch();
    } else if (state === 'paused') {
      resume();
    }
  }

  function speedUp() {
    const next = Math.min(ball.speed * BALL_SPEED_UP, BALL_SPEED_MAX);
    const ratio = next / ball.speed;
    ball.speed = next;
    ball.vx *= ratio;
    ball.vy *= ratio;
  }

  function spawnDebris(brick) {
    if (reduceMotion.matches) return;
    for (let i = 0; i < 6; i += 1) {
      debris.push({
        x: brick.x + Math.random() * BRICK_W,
        y: brick.y + Math.random() * BRICK_H,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 120,
        life: 0.6,
      });
    }
  }

  function loseLife() {
    lives -= 1;
    if (lives <= 0) {
      state = 'over';
      best = Math.max(best, score);
      announce(`ゲームオーバー。スコアは ${score} 点でした。`);
    } else {
      resetBall();
      announce(`ボールを落としました。のこり ${lives} 回です。`);
    }
  }

  function clearGame() {
    state = 'clear';
    best = Math.max(best, score);
    announce(`全部くずしました！ スコアは ${score} 点です。上のボタンからトップページへ戻れます。`);
  }

  // 1 回分の移動と衝突の判定。速いボールがブロックをすり抜けないよう、細かく分けて呼ぶ。
  function step(t) {
    ball.x += ball.vx * t;
    ball.y += ball.vy * t;

    // 壁
    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > W - BALL_R) {
      ball.x = W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    // バー: 当たった位置が端に近いほど、斜めに打ち返す
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
      Math.abs(ball.x - paddleX) <= PADDLE_W / 2 + BALL_R
    ) {
      const hit = clamp((ball.x - paddleX) / (PADDLE_W / 2), -1, 1);
      const angle = hit * MAX_BOUNCE;
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = -ball.speed * Math.cos(angle);
      ball.y = PADDLE_Y - BALL_R;
    }

    // 下に落ちた
    if (ball.y - BALL_R > H) {
      loseLife();
      return;
    }

    // ブロック: ボールに一番近いブロック上の点との距離で当たりを判定し、近い面で跳ね返す
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const nearestX = clamp(ball.x, brick.x, brick.x + BRICK_W);
      const nearestY = clamp(ball.y, brick.y, brick.y + BRICK_H);
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx = Math.sign(dx) * Math.abs(ball.vx);
      } else if (dy !== 0) {
        ball.vy = Math.sign(dy) * Math.abs(ball.vy);
      } else {
        ball.vy = -ball.vy;
      }

      brick.alive = false;
      score += BRICK_SCORE;
      spawnDebris(brick);
      speedUp();
      if (bricks.every((b) => !b.alive)) clearGame();
      break;
    }
  }

  function update(dt) {
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (direction !== 0) {
      paddleX = clamp(paddleX + direction * PADDLE_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);
    }

    if (state === 'serve') {
      ball.x = paddleX;
      ball.y = PADDLE_Y - BALL_R - 1;
    } else if (state === 'playing') {
      const steps = Math.max(1, Math.ceil((ball.speed * dt) / (BALL_R * 0.8)));
      for (let i = 0; i < steps && state === 'playing'; i += 1) {
        step(dt / steps);
      }
    }

    for (const piece of debris) {
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.vy += 400 * dt;
      piece.life -= dt;
    }
    debris = debris.filter((piece) => piece.life > 0);
  }

  function fillRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
  }

  function drawMessage(lines) {
    ctx.fillStyle = colors.surface;
    ctx.globalAlpha = 0.86;
    ctx.fillRect(0, H / 2 - 52, W, 104);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, index) => {
      const first = index === 0;
      ctx.fillStyle = first ? colors.text : colors.muted;
      ctx.font = `${first ? 600 : 400} ${first ? 20 : 14}px ${font}`;
      const offset = (index - (lines.length - 1) / 2) * 28;
      ctx.fillText(line, W / 2, H / 2 + offset);
    });
  }

  function draw() {
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, W, H);

    // 得点とのこりの回数
    ctx.font = `600 13px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    ctx.fillText(`SCORE ${score}`, 16, 22);
    if (best > 0) ctx.fillText(`BEST ${best}`, 120, 22);
    ctx.textAlign = 'right';
    ctx.fillText('LIFE', W - 16 - LIVES * 16, 22);
    for (let i = 0; i < LIVES; i += 1) {
      ctx.globalAlpha = i < lives ? 1 : 0.25;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(W - 16 - (LIVES - 1 - i) * 16 - 5, 22, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ブロック（下の段ほど少し薄く）
    for (const brick of bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 1 - brick.row * 0.1;
      fillRoundRect(brick.x, brick.y, BRICK_W, BRICK_H, 4);
    }
    ctx.globalAlpha = 1;

    // くずれたブロックのかけら
    ctx.fillStyle = colors.accent;
    for (const piece of debris) {
      ctx.globalAlpha = Math.max(piece.life / 0.6, 0);
      ctx.fillRect(piece.x, piece.y, 4, 4);
    }
    ctx.globalAlpha = 1;

    // バーとボール
    ctx.fillStyle = colors.text;
    fillRoundRect(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, PADDLE_H / 2);
    if (state !== 'ready') {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === 'ready') {
      drawMessage(['「404」をくずして、道をひらこう', 'クリック・タップ・スペースキーで開始']);
    } else if (state === 'serve') {
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.muted;
      ctx.font = `400 13px ${font}`;
      ctx.fillText('クリック・タップ・スペースキーで発射', W / 2, PADDLE_Y - 40);
    } else if (state === 'paused') {
      drawMessage(['一時停止中', 'クリック・タップ・スペースキーで再開']);
    } else if (state === 'over') {
      drawMessage(['ゲームオーバー', `スコア ${score}`, 'クリック・タップでもう一度']);
    } else if (state === 'clear') {
      drawMessage(['道がひらけました！', `スコア ${score}`, 'クリック・タップでもう一度']);
    }
  }

  function loop(now) {
    frame = 0;
    // タブの切り替えなどで間が空いても、ボールが飛びすぎないようにする
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    update(dt);
    draw();
    // 動くものがあるときだけ描き続ける
    if (state === 'playing' || state === 'serve' || debris.length > 0) {
      frame = requestAnimationFrame(loop);
    }
  }

  function kick() {
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }

  function movePaddleTo(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * W) / rect.width;
    paddleX = clamp(x, PADDLE_W / 2, W - PADDLE_W / 2);
    if (!frame) draw();
  }

  canvas.addEventListener('pointermove', movePaddleTo);
  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    movePaddleTo(event);
    primaryAction();
  });

  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      keys.left = true;
    } else if (event.key === 'ArrowRight') {
      keys.right = true;
    } else if (event.key === ' ' || event.key === 'Enter') {
      if (state === 'playing') {
        pause();
      } else {
        primaryAction();
      }
    } else {
      return;
    }
    // ゲームの操作中は、矢印キーやスペースキーで画面がスクロールしないようにする
    event.preventDefault();
    kick();
  });

  canvas.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') keys.left = false;
    if (event.key === 'ArrowRight') keys.right = false;
  });

  canvas.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
  });

  startButton.addEventListener('click', () => {
    canvas.focus({ preventScroll: true });
    newGame();
  });

  // ほかのタブを見ている間は一時停止する
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  darkScheme.addEventListener('change', () => {
    readColors();
    if (!frame) draw();
  });

  readColors();
  setupCanvas();
  createBricks();
  draw();
})();
