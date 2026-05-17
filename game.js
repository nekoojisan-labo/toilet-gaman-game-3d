(() => {
  "use strict";

  const W = 760;
  const H = 430;
  const FOV = Math.PI / 3;
  const FOCAL = W / 2 / Math.tan(FOV / 2);
  const HORIZON = 158;
  const CAMERA_HEIGHT = 0.58;
  const WALL_HEIGHT = 1.72;
  const NEAR = 0.16;
  const FAR = 13.8;
  const CAMERA_BACK = 1.42;
  const MIN_CAMERA_BACK = 0.24;
  const CAMERA_RADIUS = 0.08;
  const PLAYER_MOVE_DURATION = 0.34;
  const PLAYER_BACK_DURATION = 0.44;
  const PLAYER_TURN_DURATION = 0.18;
  const INPUT_REPEAT_DELAY = 0.1;
  const INPUT_BLOCK_DELAY = 0.24;
  const ASSET_VERSION = "run-v8";

  const DIRS = [
    { x: 1, z: 0, angle: 0 },
    { x: 0, z: 1, angle: Math.PI / 2 },
    { x: -1, z: 0, angle: Math.PI },
    { x: 0, z: -1, angle: -Math.PI / 2 },
  ];
  const PLAYER_RUN_FRAMES = ["player-run-1", "player-run-2", "player-run-3"];
  const PLAYER_WORLD_HEIGHT = 1.34;

  const RAW_STAGES = [
    {
      name: "ホーム迷宮",
      note: "降車直後。正面から来る客はまだ素直",
      time: 22,
      drain: 0.55,
      moveSpeed: 2.42,
      sprintSpeed: 3.1,
      turnSpeed: 2.72,
      hitPenalty: 13,
      enemyCount: 6,
      enemySpeed: 0.92,
      behaviors: ["patrol", "patrol", "patrol"],
      pool: ["student", "ol", "business"],
      tint: "rgba(22, 73, 102, 0.17)",
      accent: "#f4c430",
      wall: "#31495c",
      floor: "#6d6a61",
      map: [
        "###############",
        "#............G#",
        "#...###..###..#",
        "#.............#",
        "#.S...........#",
        "#.....###.....#",
        "###############",
      ],
    },
    {
      name: "改札前ジグザグ",
      note: "スマホ歩きが左右へ読みにくく流れる",
      time: 23,
      drain: 0.62,
      moveSpeed: 2.48,
      sprintSpeed: 3.16,
      turnSpeed: 2.78,
      hitPenalty: 14,
      enemyCount: 8,
      enemySpeed: 0.98,
      behaviors: ["zigzag", "patrol", "zigzag"],
      pool: ["ol", "student", "traveler"],
      tint: "rgba(36, 86, 55, 0.18)",
      accent: "#52b476",
      wall: "#385542",
      floor: "#656d58",
      map: [
        "###############",
        "#.....#......G#",
        "#..#....#.....#",
        "#........#....#",
        "#.S........#..#",
        "#....#........#",
        "###############",
      ],
    },
    {
      name: "階段横の狭路",
      note: "キャリーケースが幅を取り、曲がり角を塞ぐ",
      time: 24,
      drain: 0.72,
      moveSpeed: 2.54,
      sprintSpeed: 3.22,
      turnSpeed: 2.84,
      hitPenalty: 15,
      enemyCount: 9,
      enemySpeed: 0.94,
      behaviors: ["blocker", "patrol", "zigzag", "blocker"],
      pool: ["traveler", "traveler", "student", "business"],
      tint: "rgba(105, 70, 38, 0.18)",
      accent: "#d89535",
      wall: "#604a35",
      floor: "#726657",
      map: [
        "###############",
        "#..#.........G#",
        "#..###..###...#",
        "#.............#",
        "#.S.....#.....#",
        "#....#........#",
        "###############",
      ],
    },
    {
      name: "巨大ターミナル",
      note: "急ぐビジネスマンが見つけると一直線に突っ込む",
      time: 23,
      drain: 0.82,
      moveSpeed: 2.62,
      sprintSpeed: 3.32,
      turnSpeed: 2.92,
      hitPenalty: 16,
      enemyCount: 11,
      enemySpeed: 1.06,
      behaviors: ["sprinter", "patrol", "zigzag", "sprinter"],
      pool: ["business", "business", "ol", "traveler"],
      tint: "rgba(84, 42, 82, 0.18)",
      accent: "#d45c8b",
      wall: "#514061",
      floor: "#656070",
      map: [
        "###############",
        "#....#.......G#",
        "#..##..##.....#",
        "#.............#",
        "#.S........#..#",
        "#...#....#....#",
        "###############",
      ],
    },
    {
      name: "トイレ前最終防衛線",
      note: "目前でフェイントと追跡が重なる",
      time: 25,
      drain: 0.95,
      moveSpeed: 2.7,
      sprintSpeed: 3.42,
      turnSpeed: 3.04,
      hitPenalty: 18,
      enemyCount: 13,
      enemySpeed: 1.12,
      behaviors: ["ambush", "sprinter", "zigzag", "blocker", "ambush"],
      pool: ["business", "ol", "student", "traveler", "traveler"],
      tint: "rgba(118, 31, 28, 0.18)",
      accent: "#e1463f",
      wall: "#633839",
      floor: "#6f5b57",
      map: [
        "###############",
        "#...#........G#",
        "#..#....#.....#",
        "#.............#",
        "#.S...#...#...#",
        "#......#......#",
        "###############",
      ],
    },
  ];

  const ENEMIES = {
    business: {
      label: "急ぐビジネスマン",
      frames: ["enemy-business-1", "enemy-business-2", "enemy-business-3"],
      front: "enemy-business-front",
      radius: 0.27,
      hitRadius: 0.18,
      speed: 1.18,
      worldH: 1.44,
    },
    ol: {
      label: "スマホ歩き",
      frames: ["enemy-ol-1", "enemy-ol-2", "enemy-ol-3"],
      front: "enemy-ol-front",
      radius: 0.25,
      hitRadius: 0.17,
      speed: 1,
      worldH: 1.38,
    },
    student: {
      label: "学生の流れ",
      frames: ["enemy-student-1", "enemy-student-2", "enemy-student-3"],
      front: "enemy-student-front",
      radius: 0.25,
      hitRadius: 0.17,
      speed: 0.96,
      worldH: 1.38,
    },
    traveler: {
      label: "キャリーケース",
      frames: ["enemy-traveler-1", "enemy-traveler-2", "enemy-traveler-3"],
      front: "enemy-traveler-front",
      radius: 0.4,
      hitRadius: 0.25,
      speed: 0.82,
      worldH: 1.42,
    },
  };

  const ASSETS = {
    bg: "./assets/station-concourse-v2.png",
    "player-idle": "./assets/sprites/player-idle.png",
    "player-run-1": "./assets/sprites/player-run-1.png",
    "player-run-2": "./assets/sprites/player-run-2.png",
    "player-run-3": "./assets/sprites/player-run-3.png",
    "player-fall": "./assets/sprites/player-fall.png",
    "player-limit": "./assets/sprites/player-limit.png",
    "player-back-idle": "./assets/sprites/player-back-idle.png",
    "player-back-run-1": "./assets/sprites/player-back-run-1.png",
    "player-back-run-2": "./assets/sprites/player-back-run-2.png",
    "player-back-run-3": "./assets/sprites/player-back-run-3.png",
    "player-back-limit": "./assets/sprites/player-back-limit.png",
    "player-back-fall": "./assets/sprites/player-back-fall.png",
    "player-front-idle": "./assets/sprites/player-front-idle.png",
    "player-front-run-1": "./assets/sprites/player-front-run-1.png",
    "player-front-run-2": "./assets/sprites/player-front-run-2.png",
    "player-front-run-3": "./assets/sprites/player-front-run-3.png",
    "player-front-limit": "./assets/sprites/player-front-limit.png",
    "player-front-fall": "./assets/sprites/player-front-fall.png",
    "player-left-idle": "./assets/sprites/player-left-idle.png",
    "player-left-run-1": "./assets/sprites/player-left-run-1.png",
    "player-left-run-2": "./assets/sprites/player-left-run-2.png",
    "player-left-run-3": "./assets/sprites/player-left-run-3.png",
    "player-left-limit": "./assets/sprites/player-left-limit.png",
    "player-left-fall": "./assets/sprites/player-left-fall.png",
    "player-right-idle": "./assets/sprites/player-right-idle.png",
    "player-right-run-1": "./assets/sprites/player-right-run-1.png",
    "player-right-run-2": "./assets/sprites/player-right-run-2.png",
    "player-right-run-3": "./assets/sprites/player-right-run-3.png",
    "player-right-limit": "./assets/sprites/player-right-limit.png",
    "player-right-fall": "./assets/sprites/player-right-fall.png",
    "enemy-business-1": "./assets/sprites/enemy-business-1.png",
    "enemy-business-2": "./assets/sprites/enemy-business-2.png",
    "enemy-business-3": "./assets/sprites/enemy-business-3.png",
    "enemy-business-front": "./assets/sprites/enemy-business-front.png",
    "enemy-ol-1": "./assets/sprites/enemy-ol-1.png",
    "enemy-ol-2": "./assets/sprites/enemy-ol-2.png",
    "enemy-ol-3": "./assets/sprites/enemy-ol-3.png",
    "enemy-ol-front": "./assets/sprites/enemy-ol-front.png",
    "enemy-student-1": "./assets/sprites/enemy-student-1.png",
    "enemy-student-2": "./assets/sprites/enemy-student-2.png",
    "enemy-student-3": "./assets/sprites/enemy-student-3.png",
    "enemy-student-front": "./assets/sprites/enemy-student-front.png",
    "enemy-traveler-1": "./assets/sprites/enemy-traveler-1.png",
    "enemy-traveler-2": "./assets/sprites/enemy-traveler-2.png",
    "enemy-traveler-3": "./assets/sprites/enemy-traveler-3.png",
    "enemy-traveler-front": "./assets/sprites/enemy-traveler-front.png",
    stain: "./assets/effects/brown-stain.png",
    crowd: "./assets/effects/crowd-reaction.svg",
    gameover: "./assets/effects/gameover-accident.png",
    faceNormal: "./assets/sprites/face-normal.png",
    facePanic: "./assets/sprites/face-panic.png",
    faceLimit: "./assets/sprites/face-limit.png",
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const hud = document.querySelector(".hud");
  const screenLayer = document.getElementById("screenLayer");
  const screenTitle = document.querySelector(".title-panel h1");
  const screenKicker = document.querySelector(".kicker");
  const screenCopy = document.getElementById("screenCopy");
  const screenActions = document.getElementById("screenActions");
  const resultScene = document.getElementById("resultScene");
  const stageNo = document.getElementById("stageNo");
  const stageName = document.getElementById("stageName");
  const timeValue = document.getElementById("timeValue");
  const dignityFill = document.getElementById("dignityFill");
  const distanceFill = document.getElementById("distanceFill");
  const facePortrait = document.getElementById("facePortrait");
  const pauseButton = document.getElementById("pauseButton");
  const turnLeftButton = document.getElementById("leftButton");
  const turnRightButton = document.getElementById("rightButton");
  const forwardButton = document.getElementById("runButton");
  const backButton = document.getElementById("backButton");
  const stageList = document.getElementById("stageList");
  const boardStatus = document.getElementById("boardStatus");

  const images = {};
  const STAGES = RAW_STAGES.map((stage) => ({
    ...stage,
    data: parseMap(stage.map),
  }));

  const state = {
    mode: "title",
    stageIndex: 0,
    cleared: new Array(STAGES.length).fill(false),
    timeLeft: STAGES[0].time,
    dignity: 100,
    player: {
      x: 1.5,
      z: 3.5,
      fromX: 1.5,
      fromZ: 3.5,
      targetX: 1.5,
      targetZ: 3.5,
      angle: -Math.PI / 2,
      visualAngle: -Math.PI / 2,
      fromAngle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      dirIndex: 3,
      radius: 0.24,
      moveTime: 0,
      moveDuration: 0,
      turnTime: 0,
      turnDuration: 0,
    },
    enemies: [],
    keys: {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
    },
    hitTimer: 0,
    slowTimer: 0,
    shake: 0,
    playTime: 0,
    moving: false,
    turning: false,
    queuedAction: null,
    inputCooldown: 0,
    initialDistance: 1,
    currentDistance: 1,
    pointer: { x: 0, y: 0 },
    audio: null,
    muted: false,
  };

  let lastFrame = 0;
  let ready = false;

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loadAssets() {
    return Promise.all(Object.entries(ASSETS).map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        resolve();
      };
      img.onerror = () => {
        images[key] = null;
        resolve();
      };
      img.src = src.startsWith("./assets/") ? `${src}?${ASSET_VERSION}` : src;
    })));
  }

  function parseMap(rows) {
    const height = rows.length;
    const width = rows[0].length;
    const open = [];
    let start = null;
    let goal = null;

    rows.forEach((row, z) => {
      for (let x = 0; x < width; x += 1) {
        const tile = row[x];
        if (tile !== "#") open.push({ x, z });
        if (tile === "S") start = { x, z };
        if (tile === "G") goal = { x, z };
      }
    });

    return { rows, width, height, open, start, goal };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const next = [...list];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function normalizeAngle(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  function cellAt(x, z) {
    return { x: Math.floor(x), z: Math.floor(z) };
  }

  function tileAt(stage, x, z) {
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    if (gz < 0 || gz >= stage.data.height || gx < 0 || gx >= stage.data.width) return "#";
    return stage.data.rows[gz][gx];
  }

  function isWall(stage, x, z) {
    return tileAt(stage, x, z) === "#";
  }

  function isOpenCell(stage, x, z) {
    if (z < 0 || z >= stage.data.height || x < 0 || x >= stage.data.width) return false;
    return stage.data.rows[z][x] !== "#";
  }

  function circleBlocked(stage, x, z, radius) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);

    for (let cz = minZ; cz <= maxZ; cz += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        if (cz < 0 || cz >= stage.data.height || cx < 0 || cx >= stage.data.width || stage.data.rows[cz][cx] === "#") {
          const closestX = clamp(x, cx, cx + 1);
          const closestZ = clamp(z, cz, cz + 1);
          if (Math.hypot(x - closestX, z - closestZ) < radius) return true;
        }
      }
    }
    return false;
  }

  function moveCircle(entity, dx, dz, radius, stage) {
    let moved = false;
    if (dx !== 0 && !circleBlocked(stage, entity.x + dx, entity.z, radius)) {
      entity.x += dx;
      moved = true;
    }
    if (dz !== 0 && !circleBlocked(stage, entity.x, entity.z + dz, radius)) {
      entity.z += dz;
      moved = true;
    }
    return moved;
  }

  function cellDistance(stage, from, to) {
    const start = { x: clamp(Math.floor(from.x), 0, stage.data.width - 1), z: clamp(Math.floor(from.z), 0, stage.data.height - 1) };
    const goal = { x: clamp(Math.floor(to.x), 0, stage.data.width - 1), z: clamp(Math.floor(to.z), 0, stage.data.height - 1) };
    if (!isOpenCell(stage, start.x, start.z) || !isOpenCell(stage, goal.x, goal.z)) return Infinity;

    const seen = new Set([`${start.x},${start.z}`]);
    const queue = [{ ...start, d: 0 }];
    for (let i = 0; i < queue.length; i += 1) {
      const cur = queue[i];
      if (cur.x === goal.x && cur.z === goal.z) return cur.d;
      for (const dir of DIRS) {
        const nx = cur.x + dir.x;
        const nz = cur.z + dir.z;
        const key = `${nx},${nz}`;
        if (seen.has(key) || !isOpenCell(stage, nx, nz)) continue;
        seen.add(key);
        queue.push({ x: nx, z: nz, d: cur.d + 1 });
      }
    }
    return Infinity;
  }

  function hasLineOfSight(stage, ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(ax - bx, az - bz) / 0.08);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (isWall(stage, x, z)) return false;
    }
    return true;
  }

  function availableDirections(stage, x, z) {
    const cell = cellAt(x, z);
    return DIRS.filter((dir) => isOpenCell(stage, cell.x + dir.x, cell.z + dir.z));
  }

  function startDirFor(stage) {
    const start = stage.data.start;
    const goal = stage.data.goal;
    let best = null;

    DIRS.forEach((dir, index) => {
      const nx = start.x + dir.x;
      const nz = start.z + dir.z;
      if (!isOpenCell(stage, nx, nz)) return;
      const score = cellDistance(stage, { x: nx, z: nz }, goal);
      if (!best || score < best.score) best = { index, score };
    });

    return best ? best.index : 3;
  }

  function chooseDirection(stage, enemy, preferredAngle = null) {
    const dirs = availableDirections(stage, enemy.x, enemy.z);
    if (!dirs.length) return enemy.angle + Math.PI;

    if (preferredAngle !== null) {
      let best = dirs[0];
      let bestScore = Infinity;
      for (const dir of dirs) {
        const score = Math.abs(normalizeAngle(dir.angle - preferredAngle));
        if (score < bestScore) {
          best = dir;
          bestScore = score;
        }
      }
      return best.angle;
    }

    const reverse = normalizeAngle(enemy.angle + Math.PI);
    const forward = dirs.filter((dir) => Math.abs(normalizeAngle(dir.angle - reverse)) > 0.2);
    return pick(forward.length ? forward : dirs).angle;
  }

  function buildStageList() {
    stageList.innerHTML = "";
    STAGES.forEach((stage, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<b>${index + 1}</b><div><strong>${stage.name}</strong><span>${stage.note}</span></div>`;
      stageList.appendChild(item);
    });
    updateStageList();
  }

  function updateStageList() {
    [...stageList.children].forEach((item, index) => {
      item.classList.toggle("current", index === state.stageIndex && state.mode !== "title");
      item.classList.toggle("cleared", state.cleared[index]);
    });
  }

  function setHeld(key, active) {
    if (key in state.keys) state.keys[key] = active;
  }

  function releaseMovement() {
    Object.keys(state.keys).forEach((key) => {
      state.keys[key] = false;
    });
    forwardButton.classList.remove("is-held");
    turnLeftButton.classList.remove("is-held");
    turnRightButton.classList.remove("is-held");
    if (backButton) backButton.classList.remove("is-held");
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  function shortestAngle(from, to) {
    return normalizeAngle(to - from);
  }

  function isPlayerBusy() {
    return state.player.moveDuration > 0 || state.player.turnDuration > 0;
  }

  function heldAction() {
    if (state.keys.left) return "left";
    if (state.keys.right) return "right";
    if (state.keys.forward) return "forward";
    if (state.keys.back) return "back";
    return null;
  }

  function tryAction(action, options = {}) {
    if (state.mode !== "playing") return;
    if (options.repeat && state.inputCooldown > 0) return;

    if (isPlayerBusy()) {
      if (!options.repeat) state.queuedAction = action;
      return;
    }

    if (options.repeat) state.inputCooldown = INPUT_REPEAT_DELAY;

    if (action === "left") {
      startTurn(-1);
    } else if (action === "right") {
      startTurn(1);
    } else if (action === "forward") {
      startStep(1);
    } else if (action === "back") {
      startStep(-1);
    }
  }

  function startTurn(dir) {
    const player = state.player;
    state.queuedAction = null;
    player.dirIndex = (player.dirIndex + dir + DIRS.length) % DIRS.length;
    player.fromAngle = player.visualAngle;
    player.targetAngle = DIRS[player.dirIndex].angle;
    player.turnTime = 0;
    player.turnDuration = PLAYER_TURN_DURATION;
    state.turning = true;
    state.moving = false;
    boardStatus.textContent = `STAGE ${state.stageIndex + 1}`;
    tone(dir < 0 ? 420 : 470, 0.035, "square", 0.012);
  }

  function startStep(direction) {
    const stage = STAGES[state.stageIndex];
    const player = state.player;
    const dir = DIRS[player.dirIndex];
    const cell = cellAt(player.x, player.z);
    const nextX = cell.x + dir.x * direction;
    const nextZ = cell.z + dir.z * direction;

    if (!isOpenCell(stage, nextX, nextZ)) {
      state.queuedAction = null;
      state.inputCooldown = INPUT_BLOCK_DELAY;
      state.shake = Math.max(state.shake, 0.12);
      boardStatus.textContent = "壁に阻まれた";
      tone(118, 0.055, "square", 0.018);
      return;
    }

    state.queuedAction = null;
    player.fromX = player.x;
    player.fromZ = player.z;
    player.targetX = nextX + 0.5;
    player.targetZ = nextZ + 0.5;
    player.moveTime = 0;
    player.moveDuration = (direction > 0 ? PLAYER_MOVE_DURATION : PLAYER_BACK_DURATION) * (state.keys.sprint ? 0.78 : 1);
    state.moving = true;
    state.turning = false;
  }

  function consumeQueuedAction() {
    if (!state.queuedAction || state.mode !== "playing" || isPlayerBusy()) return;
    const action = state.queuedAction;
    state.queuedAction = null;
    tryAction(action);
  }

  function updateHeldInput() {
    if (state.mode !== "playing" || isPlayerBusy() || state.queuedAction) return;
    const action = heldAction();
    if (action) tryAction(action, { repeat: true });
  }

  function showOverlay(type, options = {}) {
    screenLayer.hidden = false;
    screenLayer.classList.add("active");
    screenLayer.setAttribute("aria-hidden", "false");
    screenLayer.dataset.screen = type;
    resultScene.hidden = true;
    resultScene.innerHTML = "";

    screenKicker.textContent = options.kicker || "満員電車後の尊厳防衛戦";
    screenTitle.textContent = options.title || "トイレ我慢ゲーム";
    screenCopy.textContent = options.copy || "TPS視点で駅の迷路を走り、時間内にトイレへ到達しろ。";

    screenActions.innerHTML = "";
    (options.actions || [{ label: "START", action: "start", primary: true }]).forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.dataset.action = action.action;
      if (action.primary) button.classList.add("primary");
      screenActions.appendChild(button);
    });

    if (options.scene === "gameover") {
      resultScene.hidden = false;
      resultScene.innerHTML = `
        <img class="result-gameover-art" src="${ASSETS.gameover}" alt="駅構内で限界を迎え、周囲が凍りつくゲームオーバー場面">
      `;
    }
  }

  function hideOverlay() {
    screenLayer.classList.remove("active");
    screenLayer.setAttribute("aria-hidden", "true");
    screenLayer.hidden = true;
  }

  function showTitle() {
    state.mode = "title";
    state.stageIndex = 0;
    releaseMovement();
    boardStatus.textContent = "尊厳防衛中";
    facePortrait.src = ASSETS.faceNormal;
    showOverlay("title", {
      kicker: "電車を降りたら迷路だった",
      title: "トイレ我慢ゲーム",
      copy: "尊厳をかけて駅構内の迷路をひた走る。果たして君はトイレに間に合うのか。",
      actions: [{ label: "START", action: "start", primary: true }],
    });
    updateStageList();
    updateHud();
  }

  function startStage(index) {
    const stage = STAGES[index];
    const start = stage.data.start;
    const goal = stage.data.goal;
    state.mode = "playing";
    state.stageIndex = index;
    state.timeLeft = stage.time;
    state.dignity = 100;
    state.player.x = start.x + 0.5;
    state.player.z = start.z + 0.5;
    state.player.fromX = state.player.x;
    state.player.fromZ = state.player.z;
    state.player.targetX = state.player.x;
    state.player.targetZ = state.player.z;
    state.player.dirIndex = startDirFor(stage);
    state.player.angle = DIRS[state.player.dirIndex].angle;
    state.player.visualAngle = state.player.angle;
    state.player.fromAngle = state.player.angle;
    state.player.targetAngle = state.player.angle;
    state.player.moveTime = 0;
    state.player.moveDuration = 0;
    state.player.turnTime = 0;
    state.player.turnDuration = 0;
    state.hitTimer = 0;
    state.slowTimer = 0;
    state.shake = 0;
    state.playTime = 0;
    state.moving = false;
    state.turning = false;
    state.queuedAction = null;
    state.inputCooldown = 0;
    state.initialDistance = Math.max(1, cellDistance(stage, start, goal));
    state.currentDistance = state.initialDistance;
    state.enemies = buildEnemies(stage);
    releaseMovement();
    boardStatus.textContent = `STAGE ${index + 1}`;
    hideOverlay();
    updateStageList();
    updateHud();
    tone(520, 0.08, "square", 0.03);
  }

  function isConnectorCell(stage, cell) {
    if (stage.data.height <= 5) return false;
    return isOpenCell(stage, cell.x, cell.z - 1) || isOpenCell(stage, cell.x, cell.z + 1);
  }

  function selectEnemyCells(candidates, count) {
    const shuffled = shuffle(candidates);
    const selected = [];
    const used = new Set();

    for (const cell of shuffled) {
      const spaced = selected.every((other) => Math.abs(cell.x - other.x) + Math.abs(cell.z - other.z) >= 3);
      if (!spaced) continue;
      selected.push(cell);
      used.add(`${cell.x},${cell.z}`);
      if (selected.length >= count) return selected;
    }

    for (const cell of shuffled) {
      const key = `${cell.x},${cell.z}`;
      if (used.has(key)) continue;
      selected.push(cell);
      used.add(key);
      if (selected.length >= count) break;
    }

    return selected;
  }

  function buildEnemies(stage) {
    const start = stage.data.start;
    const goal = stage.data.goal;
    const candidates = stage.data.open.filter((cell) => {
      if (stage.data.rows[cell.z][cell.x] !== ".") return false;
      if (isConnectorCell(stage, cell)) return false;
      const fromStart = Math.abs(cell.x - start.x) + Math.abs(cell.z - start.z);
      const fromGoal = Math.abs(cell.x - goal.x) + Math.abs(cell.z - goal.z);
      return fromStart > 3 && fromGoal > 2;
    });

    return selectEnemyCells(candidates, stage.enemyCount).map((cell, index) => {
      const type = pick(stage.pool);
      const spec = ENEMIES[type];
      const behavior = stage.behaviors[index % stage.behaviors.length];
      const enemy = {
        id: index,
        type,
        behavior,
        x: cell.x + 0.5 + rand(-0.1, 0.1),
        z: cell.z + 0.5 + rand(-0.1, 0.1),
        radius: behavior === "blocker" ? Math.max(0.34, spec.radius + 0.04) : spec.radius,
        hitRadius: behavior === "blocker" ? spec.hitRadius + 0.04 : spec.hitRadius,
        angle: 0,
        speed: stage.enemySpeed * spec.speed * (behavior === "blocker" ? 0.72 : 1),
        turnClock: rand(0.4, 1.8),
        phase: rand(0, Math.PI * 2),
        alert: 0,
        lunge: 0,
        hitCooldown: 0,
      };
      enemy.angle = chooseDirection(stage, enemy);
      return enemy;
    });
  }

  function clearStage() {
    if (state.mode !== "playing") return;
    state.mode = "clear";
    releaseMovement();
    state.cleared[state.stageIndex] = true;
    const final = state.stageIndex === STAGES.length - 1;
    boardStatus.textContent = final ? "尊厳は守られた" : "次の迷路へ";
    tone(720, 0.08, "triangle", 0.04);
    window.setTimeout(() => tone(960, 0.12, "triangle", 0.04), 95);
    showOverlay("clear", {
      kicker: `STAGE ${state.stageIndex + 1} CLEAR`,
      title: "尊厳は守られた",
      copy: final ? "最後のトイレドアへ滑り込み、社会的生命は守られた。" : "この区画は突破。トイレまではまだ迷路が続く。",
      actions: final
        ? [
            { label: "もう一度", action: "start", primary: true },
            { label: "タイトル", action: "title" },
          ]
        : [
            { label: "次のステージ", action: "next", primary: true },
            { label: "リトライ", action: "retry" },
            { label: "タイトル", action: "title" },
          ],
    });
    updateStageList();
  }

  function gameOver(reason = "尊厳ゲージは尽き、駅構内に重い沈黙だけが残った。") {
    if (state.mode !== "playing") return;
    state.mode = "gameover";
    releaseMovement();
    state.shake = 0;
    boardStatus.textContent = "社会的な「死」";
    facePortrait.src = ASSETS.faceLimit;
    tone(126, 0.36, "sawtooth", 0.035);
    showOverlay("gameover", {
      kicker: "GAME OVER",
      title: "社会的な「死」",
      copy: reason,
      scene: "gameover",
      actions: [
        { label: "リトライ", action: "retry", primary: true },
        { label: "タイトル", action: "title" },
      ],
    });
    updateStageList();
  }

  function pauseGame() {
    if (state.mode !== "playing") return;
    state.mode = "pause";
    releaseMovement();
    boardStatus.textContent = "一時停止";
    showOverlay("pause", {
      kicker: `STAGE ${state.stageIndex + 1}`,
      title: "PAUSE",
      copy: `${STAGES[state.stageIndex].name} / W・↑で1マス前進、A/Dまたは←/→で90度旋回。`,
      actions: [
        { label: "再開", action: "resume", primary: true },
        { label: "リトライ", action: "retry" },
        { label: "タイトル", action: "title" },
      ],
    });
  }

  function resumeGame() {
    if (state.mode !== "pause") return;
    state.mode = "playing";
    boardStatus.textContent = `STAGE ${state.stageIndex + 1}`;
    hideOverlay();
  }

  function currentStress() {
    const stage = STAGES[state.stageIndex];
    const timeStress = 1 - clamp(state.timeLeft / stage.time, 0, 1);
    const dignityStress = 1 - clamp(state.dignity / 100, 0, 1);
    return Math.max(timeStress, dignityStress);
  }

  function progressFor(stage) {
    const goal = stage.data.goal;
    const dist = cellDistance(stage, state.player, goal);
    state.currentDistance = Number.isFinite(dist) ? dist : state.currentDistance;
    return clamp(1 - state.currentDistance / state.initialDistance, 0, 1);
  }

  function update(dt) {
    const stage = STAGES[state.stageIndex];
    state.playTime += dt;
    state.timeLeft -= dt;
    state.dignity -= stage.drain * dt;
    state.hitTimer = Math.max(0, state.hitTimer - dt);
    state.slowTimer = Math.max(0, state.slowTimer - dt);
    state.shake = Math.max(0, state.shake - dt);
    state.inputCooldown = Math.max(0, state.inputCooldown - dt);

    updatePlayer(stage, dt);
    updateHeldInput();
    updateEnemies(stage, dt);
    checkEnemyHits(stage);

    if (state.dignity <= 0) {
      gameOver("尊厳ゲージが尽きた。トイレの案内板は、まだ遠い。");
      return;
    }

    if (state.timeLeft <= 0) {
      gameOver("制限時間切れ。ドアノブに触れる前に限界が来た。");
      return;
    }

    const goal = stage.data.goal;
    if (Math.hypot(state.player.x - (goal.x + 0.5), state.player.z - (goal.z + 0.5)) < 0.56) {
      clearStage();
      return;
    }

    updateHud();
  }

  function updatePlayer(stage, dt) {
    const player = state.player;
    const slow = state.slowTimer > 0 ? 0.52 : 1;

    if (player.turnDuration > 0) {
      player.turnTime += dt;
      const t = clamp(player.turnTime / player.turnDuration, 0, 1);
      const delta = shortestAngle(player.fromAngle, player.targetAngle);
      player.visualAngle = normalizeAngle(player.fromAngle + delta * easeInOut(t));
      player.angle = player.visualAngle;
      if (t >= 1) {
        player.visualAngle = player.targetAngle;
        player.angle = player.targetAngle;
        player.turnTime = 0;
        player.turnDuration = 0;
        state.turning = false;
        consumeQueuedAction();
      }
    }

    if (player.moveDuration > 0) {
      player.moveTime += dt * slow;
      const t = clamp(player.moveTime / player.moveDuration, 0, 1);
      const eased = easeInOut(t);
      player.x = player.fromX + (player.targetX - player.fromX) * eased;
      player.z = player.fromZ + (player.targetZ - player.fromZ) * eased;
      state.moving = true;
      if (t >= 1) {
        player.x = player.targetX;
        player.z = player.targetZ;
        player.fromX = player.x;
        player.fromZ = player.z;
        player.moveTime = 0;
        player.moveDuration = 0;
        state.moving = false;
        boardStatus.textContent = `STAGE ${state.stageIndex + 1}`;
        consumeQueuedAction();
      }
    } else if (player.turnDuration <= 0) {
      state.moving = false;
    }
  }

  function updateEnemies(stage, dt) {
    for (const enemy of state.enemies) {
      enemy.turnClock -= dt;
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      enemy.alert = Math.max(0, enemy.alert - dt);
      enemy.lunge = Math.max(0, enemy.lunge - dt);

      const toPlayer = Math.atan2(state.player.z - enemy.z, state.player.x - enemy.x);
      const distToPlayer = Math.hypot(state.player.x - enemy.x, state.player.z - enemy.z);
      const seesPlayer = distToPlayer < 5.1 && hasLineOfSight(stage, enemy.x, enemy.z, state.player.x, state.player.z);

      let speed = enemy.speed;
      let preferred = null;

      if (enemy.behavior === "sprinter" && seesPlayer) {
        preferred = toPlayer;
        speed *= 1.65;
        enemy.alert = 0.35;
      } else if (enemy.behavior === "ambush" && seesPlayer && distToPlayer < 4.2) {
        enemy.lunge = Math.max(enemy.lunge, 0.9);
        preferred = toPlayer;
        speed *= 1.95;
        enemy.alert = 0.45;
      } else if (enemy.behavior === "zigzag") {
        preferred = normalizeAngle(enemy.angle + Math.sin(state.playTime * 2.2 + enemy.phase) * 0.85);
        speed *= 1.06;
      } else if (enemy.behavior === "blocker") {
        speed *= 0.82 + Math.sin(state.playTime * 1.4 + enemy.phase) * 0.1;
      }

      if (enemy.turnClock <= 0 || preferred !== null) {
        enemy.angle = chooseDirection(stage, enemy, preferred);
        enemy.turnClock = preferred !== null ? 0.18 : rand(0.7, 1.75);
      }

      const moved = moveCircle(
        enemy,
        Math.cos(enemy.angle) * speed * dt,
        Math.sin(enemy.angle) * speed * dt,
        enemy.radius,
        stage,
      );

      if (!moved) {
        enemy.angle = chooseDirection(stage, enemy);
        enemy.turnClock = rand(0.3, 0.9);
      }
    }
  }

  function checkEnemyHits(stage) {
    if (state.hitTimer > 0) return;
    for (const enemy of state.enemies) {
      const spec = ENEMIES[enemy.type];
      const gap = Math.hypot(state.player.x - enemy.x, state.player.z - enemy.z);
      const playerHitRadius = state.player.radius * 0.68;
      const enemyHitRadius = enemy.hitRadius || spec.hitRadius || enemy.radius * 0.68;
      if (gap > playerHitRadius + enemyHitRadius) continue;
      if (!hasLineOfSight(stage, state.player.x, state.player.z, enemy.x, enemy.z)) continue;

      const penalty = stage.hitPenalty + (enemy.behavior === "blocker" ? 3 : 0);
      enemy.hitCooldown = 0.5;
      state.dignity -= penalty;
      state.timeLeft -= 1.25;
      state.hitTimer = 0.56;
      state.slowTimer = 0.72;
      state.shake = 0.32;
      state.player.moveTime = 0;
      state.player.moveDuration = 0;
      state.player.fromX = state.player.x;
      state.player.fromZ = state.player.z;
      state.player.targetX = state.player.x;
      state.player.targetZ = state.player.z;
      state.queuedAction = null;
      boardStatus.textContent = `${spec.label}に接触`;
      tone(90, 0.12, "sawtooth", 0.035);
      return;
    }
  }

  function updateHud() {
    const stage = STAGES[state.stageIndex];
    const progress = progressFor(stage);
    const dignity = clamp(state.dignity, 0, 100);
    const stress = currentStress();

    stageNo.textContent = `STAGE ${state.stageIndex + 1}`;
    stageName.textContent = stage.name;
    timeValue.textContent = Math.max(0, state.timeLeft).toFixed(1);
    dignityFill.style.transform = `scaleX(${dignity / 100})`;
    distanceFill.style.transform = `scaleX(${progress})`;
    hud.classList.toggle("danger", stress > 0.78);
    forwardButton.classList.toggle("is-held", state.keys.forward);
    turnLeftButton.classList.toggle("is-held", state.keys.left);
    turnRightButton.classList.toggle("is-held", state.keys.right);
    if (backButton) backButton.classList.toggle("is-held", state.keys.back);

    if (stress > 0.78) {
      facePortrait.src = ASSETS.faceLimit;
    } else if (stress > 0.46) {
      facePortrait.src = ASSETS.facePanic;
    } else {
      facePortrait.src = ASSETS.faceNormal;
    }
  }

  function cameraFor(stage) {
    const f = { x: Math.cos(state.player.visualAngle), z: Math.sin(state.player.visualAngle) };
    let best = null;

    for (let distanceBack = CAMERA_BACK; distanceBack >= MIN_CAMERA_BACK; distanceBack -= 0.06) {
      const x = state.player.x - f.x * distanceBack;
      const z = state.player.z - f.z * distanceBack;
      if (circleBlocked(stage, x, z, CAMERA_RADIUS)) continue;
      if (!hasLineOfSight(stage, x, z, state.player.x, state.player.z)) continue;
      best = { x, z, distanceBack };
      break;
    }

    if (!best) {
      best = {
        x: state.player.x - f.x * MIN_CAMERA_BACK,
        z: state.player.z - f.z * MIN_CAMERA_BACK,
        distanceBack: MIN_CAMERA_BACK,
      };
    }

    return {
      x: best.x,
      z: best.z,
      angle: state.player.visualAngle,
      distanceBack: best.distanceBack,
    };
  }

  function worldToCamera(camera, point) {
    const fx = Math.cos(camera.angle);
    const fz = Math.sin(camera.angle);
    const rx = -fz;
    const rz = fx;
    const relX = point.x - camera.x;
    const relZ = point.z - camera.z;
    return {
      side: relX * rx + relZ * rz,
      y: point.y,
      depth: relX * fx + relZ * fz,
    };
  }

  function cameraToScreen(point) {
    const scale = FOCAL / point.depth;
    return {
      x: W / 2 + point.side * scale,
      y: HORIZON - (point.y - CAMERA_HEIGHT) * scale,
      d: point.depth,
      s: scale,
    };
  }

  function lerpCameraPoint(a, b, t) {
    return {
      side: a.side + (b.side - a.side) * t,
      y: a.y + (b.y - a.y) * t,
      depth: a.depth + (b.depth - a.depth) * t,
    };
  }

  function clipAgainstNearPlane(points) {
    const clipped = [];

    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const previous = points[(i + points.length - 1) % points.length];
      const currentInside = current.depth >= NEAR;
      const previousInside = previous.depth >= NEAR;

      if (currentInside !== previousInside) {
        const t = (NEAR - previous.depth) / (current.depth - previous.depth);
        clipped.push(lerpCameraPoint(previous, current, t));
      }

      if (currentInside) clipped.push(current);
    }

    return clipped;
  }

  function projectPoint(camera, x, y, z) {
    const point = worldToCamera(camera, { x, y, z });
    if (point.depth <= NEAR || point.depth > FAR) return null;
    return cameraToScreen(point);
  }

  function projectPoly(camera, points) {
    const cameraPoints = points.map((point) => worldToCamera(camera, point));
    if (cameraPoints.every((point) => point.depth > FAR)) return null;
    const clipped = clipAgainstNearPlane(cameraPoints).filter((point) => point.depth <= FAR);
    if (clipped.length < 3) return null;
    return clipped.map(cameraToScreen);
  }

  function draw() {
    const stage = STAGES[state.stageIndex];
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (state.shake > 0 && state.mode === "playing") {
      const force = state.shake * 12;
      ctx.translate(rand(-force, force), rand(-force, force));
    }

    drawWorld(stage);
    drawPressureEffects();
    drawMiniMap(stage);
    ctx.restore();

    if (!ready) {
      ctx.fillStyle = "#f7f3e8";
      ctx.font = "900 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LOADING", W / 2, H / 2);
    }
  }

  function drawWorld(stage) {
    const camera = cameraFor(stage);
    drawBackdrop(stage);

    const drawables = [];
    addFloorCells(stage, camera, drawables);
    addWallFaces(stage, camera, drawables);
    addGoal(stage, camera, drawables);
    addEnemies(stage, camera, drawables);
    addPlayer(camera, drawables);

    drawables
      .sort((a, b) => b.depth - a.depth)
      .forEach((item) => item.draw());

    drawRestroomCompass(stage);
    drawVignette(stage);
  }

  function drawBackdrop(stage) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 60);
    sky.addColorStop(0, "#162332");
    sky.addColorStop(1, "#27384a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 48);

    if (images.bg) {
      ctx.save();
      ctx.globalAlpha = 0.48;
      drawCover(images.bg, 0, 0, W, H);
      ctx.restore();
    }

    ctx.fillStyle = stage.tint;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#d6d2c8";
    ctx.fillRect(0, HORIZON - 32, W, 18);
    ctx.fillStyle = stage.accent;
    for (let x = -40; x < W + 80; x += 118) {
      ctx.fillRect(x, HORIZON - 27, 62, 8);
    }

    const floor = ctx.createLinearGradient(0, HORIZON, 0, H);
    floor.addColorStop(0, "#57544f");
    floor.addColorStop(1, "#2d3135");
    ctx.fillStyle = floor;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
  }

  function drawCover(img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxRatio;
      sy = Math.max(0, (img.height - sh) * 0.34);
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function addFloorCells(stage, camera, drawables) {
    const cx = Math.floor(state.player.x);
    const cz = Math.floor(state.player.z);
    for (let z = Math.max(0, cz - 9); z < Math.min(stage.data.height, cz + 10); z += 1) {
      for (let x = Math.max(0, cx - 9); x < Math.min(stage.data.width, cx + 10); x += 1) {
        if (!isOpenCell(stage, x, z)) continue;
        const pts = projectPoly(camera, [
          { x, y: 0, z },
          { x: x + 1, y: 0, z },
          { x: x + 1, y: 0, z: z + 1 },
          { x, y: 0, z: z + 1 },
        ]);
        if (!pts) continue;
        const depth = pts.reduce((sum, point) => sum + point.d, 0) / pts.length;
        const tile = stage.data.rows[z][x];
        drawables.push({
          depth,
          draw: () => {
            ctx.save();
            ctx.fillStyle = tile === "G" ? "rgba(244, 196, 48, 0.24)" : floorShade(stage, depth, (x + z) % 2);
            drawPolygon(pts);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            ctx.stroke();
            if ((x + z) % 3 === 0 && pts.length >= 4) {
              ctx.globalAlpha = 0.16;
              ctx.fillStyle = stage.accent;
              drawPolygon([midPoint(pts[0], pts[1]), pts[1], pts[2], midPoint(pts[2], pts[3])]);
              ctx.fill();
            }
            ctx.restore();
          },
        });
      }
    }
  }

  function addWallFaces(stage, camera, drawables) {
    for (let z = 0; z < stage.data.height; z += 1) {
      for (let x = 0; x < stage.data.width; x += 1) {
        if (stage.data.rows[z][x] !== "#") continue;
        addWallFace(stage, camera, drawables, x, z, "north");
        addWallFace(stage, camera, drawables, x, z, "south");
        addWallFace(stage, camera, drawables, x, z, "west");
        addWallFace(stage, camera, drawables, x, z, "east");
      }
    }
  }

  function addWallFace(stage, camera, drawables, x, z, side) {
    const neighbor = {
      north: [x, z - 1],
      south: [x, z + 1],
      west: [x - 1, z],
      east: [x + 1, z],
    }[side];
    if (!neighbor || !isOpenCell(stage, neighbor[0], neighbor[1])) return;

    const corners = {
      north: [
        { x, y: 0, z },
        { x: x + 1, y: 0, z },
        { x: x + 1, y: WALL_HEIGHT, z },
        { x, y: WALL_HEIGHT, z },
      ],
      south: [
        { x: x + 1, y: 0, z: z + 1 },
        { x, y: 0, z: z + 1 },
        { x, y: WALL_HEIGHT, z: z + 1 },
        { x: x + 1, y: WALL_HEIGHT, z: z + 1 },
      ],
      west: [
        { x, y: 0, z: z + 1 },
        { x, y: 0, z },
        { x, y: WALL_HEIGHT, z },
        { x, y: WALL_HEIGHT, z: z + 1 },
      ],
      east: [
        { x: x + 1, y: 0, z },
        { x: x + 1, y: 0, z: z + 1 },
        { x: x + 1, y: WALL_HEIGHT, z: z + 1 },
        { x: x + 1, y: WALL_HEIGHT, z },
      ],
    }[side];

    const pts = projectPoly(camera, corners);
    if (!pts) return;
    if (!pts.some((point) => point.x > -80 && point.x < W + 80 && point.y > -260 && point.y < H + 180)) return;

    const depth = pts.reduce((sum, point) => sum + point.d, 0) / pts.length;
    drawables.push({
      depth,
      draw: () => {
        ctx.save();
        ctx.fillStyle = wallShade(stage, depth, side);
        drawPolygon(pts);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.13)";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (pts.length >= 4) {
          const stripeA = side === "north" || side === "south" ? [pts[0], pts[1], pts[2], pts[3]] : [pts[1], pts[0], pts[3], pts[2]];
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = stage.accent;
          drawPolygon([
            lerpPoint(stripeA[0], stripeA[3], 0.58),
            lerpPoint(stripeA[1], stripeA[2], 0.58),
            lerpPoint(stripeA[1], stripeA[2], 0.66),
            lerpPoint(stripeA[0], stripeA[3], 0.66),
          ]);
          ctx.fill();
        }
        ctx.restore();
      },
    });
  }

  function addGoal(stage, camera, drawables) {
    const goal = stage.data.goal;
    const x = goal.x + 0.5;
    const z = goal.z + 0.5;
    if (!hasLineOfSight(stage, camera.x, camera.z, x, z)) return;
    const base = projectPoint(camera, x, 0, z);
    const top = projectPoint(camera, x, 1.72, z);
    if (!base || !top) return;

    drawables.push({
      depth: base.d,
      draw: () => drawGoalBillboard(stage, base, top),
    });
  }

  function addEnemies(stage, camera, drawables) {
    for (const enemy of state.enemies) {
      if (!hasLineOfSight(stage, camera.x, camera.z, enemy.x, enemy.z)) continue;
      const base = projectPoint(camera, enemy.x, 0, enemy.z);
      if (!base) continue;
      const spec = ENEMIES[enemy.type] || ENEMIES.student;
      const top = projectPoint(camera, enemy.x, spec.worldH, enemy.z);
      if (!top) continue;
      drawables.push({
        depth: base.d,
        draw: () => drawEnemyBillboard(enemy, base, top),
      });
    }
  }

  function addPlayer(camera, drawables) {
    const base = projectPoint(camera, state.player.x, 0, state.player.z);
    const top = projectPoint(camera, state.player.x, PLAYER_WORLD_HEIGHT, state.player.z);
    if (!base || !top) return;

    drawables.push({
      depth: base.d,
      draw: () => drawPlayerBillboard(base, top),
    });
  }

  function drawGoalBillboard(stage, base, top) {
    const height = clamp(base.y - top.y, 64, 280);
    const width = height * 0.54;
    const x = base.x - width / 2;
    const y = base.y - height;

    ctx.save();
    ctx.globalAlpha = clamp(1.1 - base.d / FAR, 0.45, 1);
    ctx.fillStyle = "rgba(244,196,48,0.18)";
    ctx.beginPath();
    ctx.ellipse(base.x, base.y + 4, width * 0.58, height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e9f4f2";
    roundRect(ctx, x - width * 0.14, y - height * 0.22, width * 1.28, height * 0.2, 5);
    ctx.fill();
    ctx.strokeStyle = stage.accent;
    ctx.lineWidth = Math.max(2, height * 0.018);
    ctx.stroke();
    ctx.fillStyle = "#0b4f8a";
    ctx.font = `900 ${clamp(height * 0.07, 12, 22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("TOILET", base.x, y - height * 0.09);

    ctx.fillStyle = "#123c58";
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();
    ctx.fillStyle = "#1e6d91";
    ctx.fillRect(x + width * 0.12, y + height * 0.08, width * 0.76, height * 0.84);
    ctx.fillStyle = "#f4c430";
    ctx.beginPath();
    ctx.arc(x + width * 0.78, y + height * 0.55, Math.max(3, width * 0.045), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stage.accent;
    ctx.lineWidth = Math.max(2, height * 0.025);
    ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
    ctx.restore();
  }

  function drawEnemyBillboard(enemy, base, top) {
    const spec = ENEMIES[enemy.type] || ENEMIES.student;
    const height = clamp(base.y - top.y, 42, 210);
    const frame = spec.frames[Math.floor(state.playTime * 7 + enemy.phase) % spec.frames.length] || spec.front;
    const img = images[frame] || images[spec.front];
    const width = img ? height * (img.width / img.height) : height * 0.44;
    const wobble = enemy.alert > 0 ? Math.sin(state.playTime * 28) * 3 : 0;

    ctx.save();
    ctx.globalAlpha = enemy.hitCooldown > 0 ? 0.42 : clamp(1.12 - base.d / FAR, 0.45, 1);
    ctx.fillStyle = enemy.alert > 0 || enemy.lunge > 0 ? "rgba(225,70,63,0.34)" : "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(base.x, base.y + 3, width * 0.34, height * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img) {
      ctx.drawImage(img, base.x - width / 2 + wobble, base.y - height, width, height);
    } else {
      ctx.fillStyle = "#f4c430";
      ctx.fillRect(base.x - width / 2, base.y - height, width, height);
    }
    if (enemy.alert > 0 || enemy.lunge > 0) {
      ctx.strokeStyle = "#e1463f";
      ctx.lineWidth = Math.max(2, height * 0.02);
      ctx.strokeRect(base.x - width * 0.36, base.y - height * 0.98, width * 0.72, height * 0.95);
    }
    ctx.restore();
  }

  function playerFallbackKey(baseKey) {
    if (baseKey.includes("run")) {
      return PLAYER_RUN_FRAMES[Math.floor(state.playTime * 10) % PLAYER_RUN_FRAMES.length];
    }
    if (baseKey.includes("limit")) return "player-limit";
    if (baseKey.includes("fall")) return "player-fall";
    return "player-idle";
  }

  function playerDirectionName() {
    return ["right", "front", "left", "back"][state.player.dirIndex] || "right";
  }

  function playerBasePose() {
    const stress = currentStress();
    if (state.hitTimer > 0) return "fall";
    if (stress > 0.86) return "limit";
    if (state.moving && state.player.moveDuration > 0) {
      const moveProgress = clamp(state.player.moveTime / state.player.moveDuration, 0, 0.999);
      return `run-${Math.floor(moveProgress * PLAYER_RUN_FRAMES.length) + 1}`;
    }
    return "idle";
  }

  function playerSprite() {
    const direction = playerDirectionName();
    const pose = playerBasePose();
    const key = `player-${direction}-${pose}`;
    const fallback = playerFallbackKey(key);
    return {
      key: images[key] ? key : fallback,
      flip: !images[key] && direction === "left",
    };
  }

  function drawPlayerBillboard(base, top) {
    const sprite = playerSprite();
    const img = images[sprite.key];
    const height = clamp(base.y - top.y, 88, 190);
    const bob = state.moving ? Math.sin(state.playTime * 13) * 2.2 : Math.sin(state.playTime * 7) * 0.8;
    const x = base.x;
    const y = Math.min(base.y, H - 10);

    ctx.save();
    ctx.globalAlpha = state.mode === "gameover" ? 0.56 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, height * 0.31, height * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img) {
      const width = Math.max(height * (img.width / img.height), height * 0.5);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (sprite.flip) {
        ctx.translate(x + width / 2, y - height + bob);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, width, height);
      } else {
        ctx.drawImage(img, x - width / 2, y - height + bob, width, height);
      }
    } else {
      ctx.fillStyle = "#0f2741";
      ctx.fillRect(x - height * 0.18, y - height, height * 0.36, height);
    }
    ctx.restore();
  }

  function drawRestroomCompass(stage) {
    if (state.mode !== "playing") return;
    const goal = stage.data.goal;
    const gx = goal.x + 0.5;
    const gz = goal.z + 0.5;
    const target = Math.atan2(gz - state.player.z, gx - state.player.x);
    const diff = normalizeAngle(target - state.player.visualAngle);
    const x = W / 2 + Math.sin(diff) * 210;
    const y = HORIZON - 78;
    const pulse = Math.sin(state.playTime * 7) * 0.5 + 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(diff);
    ctx.fillStyle = `rgba(244,196,48,${0.76 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 13);
    ctx.lineTo(0, 7);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "900 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WC", x, y + 32);
  }

  function drawMiniMap(stage) {
    const mapW = 126;
    const cell = Math.min(7.6, mapW / Math.max(stage.data.width, stage.data.height));
    const x0 = 14;
    const y0 = H - stage.data.height * cell - 14;

    ctx.save();
    ctx.globalAlpha = state.mode === "playing" || state.mode === "pause" ? 1 : 0.72;
    ctx.fillStyle = "rgba(8,14,22,0.72)";
    roundRect(ctx, x0 - 8, y0 - 8, stage.data.width * cell + 16, stage.data.height * cell + 16, 6);
    ctx.fill();
    for (let z = 0; z < stage.data.height; z += 1) {
      for (let x = 0; x < stage.data.width; x += 1) {
        const tile = stage.data.rows[z][x];
        ctx.fillStyle = tile === "#" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.055)";
        if (tile === "G") ctx.fillStyle = stage.accent;
        ctx.fillRect(x0 + x * cell, y0 + z * cell, cell - 1, cell - 1);
      }
    }
    for (const enemy of state.enemies) {
      ctx.fillStyle = enemy.alert > 0 || enemy.lunge > 0 ? "#e1463f" : "rgba(225,70,63,0.66)";
      ctx.beginPath();
      ctx.arc(x0 + enemy.x * cell, y0 + enemy.z * cell, Math.max(1.5, cell * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x0 + state.player.x * cell, y0 + state.player.z * cell);
    ctx.rotate(state.player.visualAngle);
    ctx.fillStyle = "#f7f3e8";
    ctx.beginPath();
    ctx.moveTo(cell * 0.42, 0);
    ctx.lineTo(-cell * 0.28, -cell * 0.27);
    ctx.lineTo(-cell * 0.18, 0);
    ctx.lineTo(-cell * 0.28, cell * 0.27);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawPressureEffects() {
    if (state.mode !== "playing") return;
    const stress = currentStress();
    if (stress < 0.42) return;

    ctx.save();
    ctx.globalAlpha = clamp((stress - 0.38) * 1.08, 0, 0.62);
    ctx.strokeStyle = stress > 0.78 ? "#e1463f" : "#f4c430";
    ctx.lineWidth = stress > 0.78 ? 5 : 3;
    for (let i = 0; i < 10; i += 1) {
      const y = 112 + i * 29 + Math.sin(state.playTime * 6 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.lineTo(82, y + 21);
      ctx.moveTo(W - 22, y + 8);
      ctx.lineTo(W - 86, y + 29);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVignette(stage) {
    const stress = currentStress();
    const gradient = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.18, W / 2, H * 0.5, H * 0.82);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.72, "rgba(0,0,0,0.16)");
    gradient.addColorStop(1, `rgba(${stress > 0.78 ? "130,20,20" : "0,0,0"},${0.42 + stress * 0.24})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    if (stage.accent) {
      ctx.fillStyle = stage.accent;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, W, 3);
      ctx.fillRect(0, H - 3, W, 3);
      ctx.globalAlpha = 1;
    }
  }

  function floorShade(stage, depth, parity) {
    const alpha = clamp(0.4 - depth * 0.018, 0.16, 0.36);
    return parity ? `rgba(247,243,232,${alpha * 0.34})` : `rgba(5,12,18,${alpha})`;
  }

  function wallShade(stage, depth, side) {
    const sideBoost = side === "north" || side === "south" ? 18 : -6;
    const shade = clamp(74 - depth * 4 + sideBoost, 30, 96);
    if (stage.wall === "#604a35") return `rgb(${shade + 26}, ${shade + 12}, ${shade - 8})`;
    if (stage.wall === "#385542") return `rgb(${shade - 8}, ${shade + 20}, ${shade})`;
    if (stage.wall === "#514061") return `rgb(${shade + 4}, ${shade - 2}, ${shade + 22})`;
    if (stage.wall === "#633839") return `rgb(${shade + 26}, ${shade - 4}, ${shade - 4})`;
    return `rgb(${shade - 2}, ${shade + 10}, ${shade + 22})`;
  }

  function drawPolygon(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
  }

  function midPoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: (a.d + b.d) / 2 };
  }

  function lerpPoint(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, d: a.d + (b.d - a.d) * t };
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function tone(freq, duration, type, gain) {
    if (state.muted) return;
    try {
      if (!state.audio) {
        state.audio = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = state.audio.createOscillator();
      const amp = state.audio.createGain();
      osc.frequency.value = freq;
      osc.type = type;
      amp.gain.value = gain;
      amp.gain.exponentialRampToValueAtTime(0.0001, state.audio.currentTime + duration);
      osc.connect(amp);
      amp.connect(state.audio.destination);
      osc.start();
      osc.stop(state.audio.currentTime + duration);
    } catch {
      state.muted = true;
    }
  }

  function handleAction(action) {
    if (action === "start") {
      state.cleared = new Array(STAGES.length).fill(false);
      startStage(0);
    } else if (action === "retry") {
      startStage(state.stageIndex);
    } else if (action === "next") {
      startStage(clamp(state.stageIndex + 1, 0, STAGES.length - 1));
    } else if (action === "title") {
      showTitle();
    } else if (action === "resume") {
      resumeGame();
    }
  }

  function bindHoldButton(button, key) {
    if (!button) return;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (state.mode === "playing") {
        setHeld(key, true);
        tryAction(key);
      }
    });
    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      setHeld(key, false);
    });
    button.addEventListener("pointercancel", () => setHeld(key, false));
    button.addEventListener("lostpointercapture", () => setHeld(key, false));
  }

  function bindEvents() {
    window.addEventListener("resize", setupCanvas);
    window.addEventListener("blur", releaseMovement);
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if ((event.key === "Enter" || event.key === " ") && screenLayer.classList.contains("active")) {
        event.preventDefault();
        const primary = screenActions.querySelector(".primary") || screenActions.querySelector("button");
        if (primary) primary.click();
        return;
      }

      if (event.key === "ArrowUp" || key === "w" || event.key === " ") {
        event.preventDefault();
        if (state.mode === "playing") {
          setHeld("forward", true);
          tryAction("forward");
        }
      } else if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        if (state.mode === "playing") {
          setHeld("back", true);
          tryAction("back");
        }
      } else if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        if (state.mode === "playing") {
          setHeld("left", true);
          if (!event.repeat) tryAction("left");
        }
      } else if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        if (state.mode === "playing") {
          setHeld("right", true);
          if (!event.repeat) tryAction("right");
        }
      } else if (event.key === "Shift") {
        event.preventDefault();
        if (state.mode === "playing") setHeld("sprint", true);
      } else if (event.key === "Escape" || key === "p") {
        event.preventDefault();
        state.mode === "pause" ? resumeGame() : pauseGame();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w" || event.key === " ") {
        event.preventDefault();
        setHeld("forward", false);
      } else if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        setHeld("back", false);
      } else if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        setHeld("left", false);
      } else if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        setHeld("right", false);
      } else if (event.key === "Shift") {
        event.preventDefault();
        setHeld("sprint", false);
      }
    });

    screenActions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button) handleAction(button.dataset.action);
    });

    pauseButton.addEventListener("click", () => {
      state.mode === "pause" ? resumeGame() : pauseGame();
    });

    bindHoldButton(turnLeftButton, "left");
    bindHoldButton(turnRightButton, "right");
    bindHoldButton(forwardButton, "forward");
    bindHoldButton(backButton, "back");

    canvas.addEventListener("pointerdown", (event) => {
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
    });
    canvas.addEventListener("pointerup", (event) => {
      if (state.mode !== "playing") return;
      const dx = event.clientX - state.pointer.x;
      const dy = event.clientY - state.pointer.y;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        tryAction(dx > 0 ? "right" : "left");
      } else if (Math.abs(dy) > 30) {
        tryAction(dy < 0 ? "forward" : "back");
      }
    });
  }

  function loop(timestamp) {
    const dt = Math.min(0.034, (timestamp - lastFrame) / 1000 || 0);
    lastFrame = timestamp;
    if (ready && state.mode === "playing") update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  setupCanvas();
  bindEvents();
  buildStageList();
  showTitle();
  loadAssets().then(() => {
    ready = true;
    draw();
  });
  requestAnimationFrame(loop);
})();
