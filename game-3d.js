/**
 * トイレ我慢ゲーム - Three.js 3D版
 * Blender生成GLBアセットを使用したフルポリゴン版
 *
 * 既存 game.js を置き換える形で動作。HUDのDOM要素は共通。
 * 当たり判定はグリッドJSON、見た目はGLB。
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// ===== 定数 =====
const CELL_SIZE = 2.0;
const WALL_HEIGHT = 2.4;
const PLAYER_MOVE_DURATION = 0.34;
const PLAYER_BACK_DURATION = 0.44;
const PLAYER_TURN_DURATION = 0.18;
const INPUT_REPEAT_DELAY = 0.1;
const INPUT_BLOCK_DELAY = 0.24;
const GLB_BASE = "./assets-3d/glb";

// 4方向: gridDX, gridDZ, angle(Three.js Y軸まわり)
// Hyper3D生成キャラは+Z方向を正面として出力されるため、angle = atan2(dx, dz)
const DIRS = [
  { dx: 1, dz: 0, angle: Math.PI / 2 },     // right (+X)
  { dx: 0, dz: 1, angle: 0 },               // front (+Z)
  { dx: -1, dz: 0, angle: -Math.PI / 2 },   // left (-X)
  { dx: 0, dz: -1, angle: Math.PI },        // back (-Z)
];

// ===== ステージデータ (game.jsと完全同期) =====
const STAGES = [
  {
    name: "ホーム迷宮", note: "降車直後。正面から来る客はまだ素直",
    time: 22, drain: 0.55, hitPenalty: 13,
    enemyCount: 6, enemySpeed: 0.92,
    behaviors: ["patrol", "patrol", "patrol"],
    pool: ["student", "ol", "business"],
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
    name: "改札前ジグザグ", note: "スマホ歩きが左右へ読みにくく流れる",
    time: 23, drain: 0.62, hitPenalty: 14,
    enemyCount: 8, enemySpeed: 0.98,
    behaviors: ["zigzag", "patrol", "zigzag"],
    pool: ["ol", "student", "traveler"],
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
    name: "階段横の狭路", note: "キャリーケースが幅を取り、曲がり角を塞ぐ",
    time: 24, drain: 0.72, hitPenalty: 15,
    enemyCount: 9, enemySpeed: 0.94,
    behaviors: ["blocker", "patrol", "zigzag", "blocker"],
    pool: ["traveler", "traveler", "student", "business"],
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
    name: "巨大ターミナル", note: "急ぐビジネスマンが見つけると一直線に突っ込む",
    time: 23, drain: 0.82, hitPenalty: 16,
    enemyCount: 11, enemySpeed: 1.06,
    behaviors: ["sprinter", "patrol", "zigzag", "sprinter"],
    pool: ["business", "business", "ol", "traveler"],
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
    name: "トイレ前最終防衛線", note: "目前でフェイントと追跡が重なる",
    time: 25, drain: 0.95, hitPenalty: 18,
    enemyCount: 13, enemySpeed: 1.12,
    behaviors: ["ambush", "sprinter", "zigzag", "blocker", "ambush"],
    pool: ["business", "ol", "student", "traveler", "traveler"],
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
].map((s, i) => ({ ...s, ...parseMap(s.map), index: i }));

const ENEMY_DEFS = {
  business: { glb: "enemy-business.glb", radius: 0.27, hitRadius: 0.18, speedMul: 1.18 },
  ol:       { glb: "enemy-ol.glb",       radius: 0.25, hitRadius: 0.17, speedMul: 1.00 },
  student:  { glb: "enemy-student.glb",  radius: 0.25, hitRadius: 0.17, speedMul: 0.96 },
  traveler: { glb: "enemy-traveler.glb", radius: 0.40, hitRadius: 0.25, speedMul: 0.82 },
};

function parseMap(rows) {
  const height = rows.length;
  const width = rows[0].length;
  let start = { x: 1, z: 1 };
  let goal = { x: width - 2, z: 1 };
  const open = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const t = rows[z][x];
      if (t === "S") start = { x, z };
      else if (t === "G") goal = { x, z };
      if (t === "." || t === "S" || t === "G") open.push({ x, z });
    }
  }
  return { width, height, start, goal, open };
}

// ===== グリッド↔ワールド変換 =====
function gridToWorld(gx, gz) {
  return new THREE.Vector3(
    gx * CELL_SIZE + CELL_SIZE / 2,
    0,
    gz * CELL_SIZE + CELL_SIZE / 2,
  );
}

function isWall(stage, x, z) {
  if (x < 0 || z < 0 || x >= stage.width || z >= stage.height) return true;
  return stage.map[z][x] === "#";
}

function cellKey(x, z) {
  return `${x},${z}`;
}

function cellDistance(stage, from, to) {
  if (isWall(stage, from.x, from.z) || isWall(stage, to.x, to.z)) return Infinity;

  const queue = [{ x: from.x, z: from.z, d: 0 }];
  const seen = new Set([cellKey(from.x, from.z)]);
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (cur.x === to.x && cur.z === to.z) return cur.d;
    for (const dir of DIRS) {
      const nx = cur.x + dir.dx;
      const nz = cur.z + dir.dz;
      const key = cellKey(nx, nz);
      if (seen.has(key) || isWall(stage, nx, nz)) continue;
      seen.add(key);
      queue.push({ x: nx, z: nz, d: cur.d + 1 });
    }
  }
  return Infinity;
}

function startDirFor(stage) {
  let best = null;
  DIRS.forEach((dir, index) => {
    const nx = stage.start.x + dir.dx;
    const nz = stage.start.z + dir.dz;
    if (isWall(stage, nx, nz)) return;
    const score = cellDistance(stage, { x: nx, z: nz }, stage.goal);
    if (!best || score < best.score) best = { index, score };
  });
  return best ? best.index : 1;
}

function characterRootName(typeKey) {
  return {
    player: "ChibiPlayer_Root",
    business: "ChibiBusiness_Root",
    ol: "ChibiOL_Root",
    student: "ChibiStudent_Root",
    traveler: "ChibiTraveler_Root",
  }[typeKey] || null;
}

function findCharacterRoot(instance, typeKey) {
  const expectedName = characterRootName(typeKey);
  if (expectedName) {
    const expected = instance.getObjectByName(expectedName);
    if (expected) return expected;
  }

  let root = null;
  instance.traverse((obj) => {
    if (!root && obj.name.endsWith("_Root")) root = obj;
  });
  return root || instance;
}

// ===== DOM =====
const canvas = document.getElementById("gameCanvas");
const screenLayer = document.getElementById("screenLayer");
const screenTitle = document.querySelector(".title-panel h1");
const screenKicker = document.querySelector(".kicker");
const screenCopy = document.getElementById("screenCopy");
const screenActions = document.getElementById("screenActions");
const stageNo = document.getElementById("stageNo");
const stageName = document.getElementById("stageName");
const timeValue = document.getElementById("timeValue");
const dignityFill = document.getElementById("dignityFill");
const distanceFill = document.getElementById("distanceFill");
const facePortrait = document.getElementById("facePortrait");
const pauseButton = document.getElementById("pauseButton");
const stageList = document.getElementById("stageList");
const boardStatus = document.getElementById("boardStatus");
const turnLeftBtn = document.getElementById("leftButton");
const turnRightBtn = document.getElementById("rightButton");
const forwardBtn = document.getElementById("runButton");
const backBtn = document.getElementById("backButton");

// ===== Three.js セットアップ =====
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12161c);
scene.fog = new THREE.Fog(0x12161c, 14, 34);

const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 80);
camera.position.set(0, 2, 0);

// 半球光（自然な上下グラデーション）
const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a4a, 0.85);
scene.add(hemi);

// メイン照明（影付き）
const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
dirLight.position.set(8, 14, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
dirLight.shadow.bias = -0.0008;
scene.add(dirLight);

// フィルライト（影を柔らかく）
const fillLight = new THREE.DirectionalLight(0xb8d4ff, 0.4);
fillLight.position.set(-6, 8, -4);
scene.add(fillLight);

function resizeRenderer() {
  const w = canvas.clientWidth || 760;
  const h = canvas.clientHeight || 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);

// ===== アセット =====
const loader = new GLTFLoader();
const assets = {
  stages: [null, null, null, null, null],
  player: null,
  enemies: {},
};

async function loadAllAssets() {
  const tasks = [];
  for (let i = 1; i <= 5; i++) {
    tasks.push(
      loader.loadAsync(`${GLB_BASE}/stage-${String(i).padStart(2, "0")}.glb`).then((g) => {
        assets.stages[i - 1] = g.scene;
      }),
    );
  }
  tasks.push(
    loader.loadAsync(`${GLB_BASE}/player-businessman.glb`).then((g) => {
      assets.player = g.scene;
    }),
  );
  for (const [key, def] of Object.entries(ENEMY_DEFS)) {
    tasks.push(
      loader.loadAsync(`${GLB_BASE}/${def.glb}`).then((g) => {
        assets.enemies[key] = g.scene;
      }),
    );
  }
  await Promise.all(tasks);
  console.log("All GLB assets loaded");
}

// ===== ゲームステート =====
const state = {
  mode: "title", // title | playing | gameover | clear
  stageIndex: 0,
  timeLeft: 0,
  dignity: 100,
  cleared: [false, false, false, false, false],
  player: {
    x: 0, z: 0, angle: 0, dirIndex: 1,
    fromX: 0, fromZ: 0, targetX: 0, targetZ: 0,
    fromAngle: 0, targetAngle: 0,
    moveTime: 0, moveDuration: 0,
    turnTime: 0, turnDuration: 0,
  },
  enemies: [],
  stageObj3D: null,
  playerObj3D: null,
  playerRoot3D: null,
  enemyObj3Ds: [],
  enemyRoot3Ds: [],
  keys: { left: false, right: false, forward: false, back: false },
  inputCooldown: 0,
  queuedAction: null,
  hitTimer: 0,
  paused: false,
};

// ===== ステージリスト UI =====
function buildStageList() {
  if (!stageList) return;
  stageList.innerHTML = "";
  STAGES.forEach((stage, idx) => {
    const li = document.createElement("li");
    li.dataset.index = String(idx);
    li.innerHTML = `<strong>${idx + 1}. ${stage.name}</strong><small>${stage.note}</small>`;
    li.addEventListener("click", () => {
      if (state.mode === "title" || state.mode === "clear" || state.mode === "gameover") {
        startStage(idx);
      }
    });
    stageList.appendChild(li);
  });
}

function updateStageList() {
  if (!stageList) return;
  [...stageList.children].forEach((item, idx) => {
    item.classList.toggle("current", idx === state.stageIndex && state.mode !== "title");
    item.classList.toggle("cleared", state.cleared[idx]);
  });
}

// ===== ステージ開始 =====
function startStage(index) {
  const stage = STAGES[index];
  if (!stage || !assets.stages[index]) return;

  // 既存ステージ削除
  if (state.stageObj3D) scene.remove(state.stageObj3D);
  state.stageObj3D = assets.stages[index].clone(true);
  // 床/壁は影を受ける、emission以外は影も落とす
  state.stageObj3D.traverse((obj) => {
    if (obj.isMesh) {
      obj.receiveShadow = true;
      // エミッション強度がある=自発光オブジェクト(蛍光灯/看板)は影キャストしない
      const mat = obj.material;
      const isEmissive = mat && mat.emissiveIntensity > 0.5;
      obj.castShadow = !isEmissive;
    }
  });
  scene.add(state.stageObj3D);

  // プレイヤー追加 (clone + 原点正規化)
  // Blender側で_Rootに-5/-8/...のXオフセットを付けているため、
  // 「_Root世界座標が(0,0,0)」になるよう全直下の子をシフト。
  // 以降は state.playerObj3D.position = wp で正しい位置に置ける。
  if (state.playerObj3D) scene.remove(state.playerObj3D);
  state.playerObj3D = assets.player.clone(true);
  state.playerRoot3D = findCharacterRoot(state.playerObj3D, "player");
  if (state.playerRoot3D && state.playerRoot3D !== state.playerObj3D) {
    state.playerObj3D.updateMatrixWorld(true);
    const rootWorld = new THREE.Vector3();
    state.playerRoot3D.getWorldPosition(rootWorld);
    state.playerObj3D.children.forEach((c) => c.position.sub(rootWorld));
    state.playerObj3D.updateMatrixWorld(true);
  }
  state.playerObj3D.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  scene.add(state.playerObj3D);

  // 敵生成
  state.enemyObj3Ds.forEach((e) => scene.remove(e));
  state.enemyObj3Ds = [];
  state.enemyRoot3Ds = [];
  state.enemies = [];

  const stageOpen = stage.open.filter((c) => !(c.x === stage.start.x && c.z === stage.start.z));
  for (let i = 0; i < stage.enemyCount; i++) {
    const typeKey = stage.pool[i % stage.pool.length];
    const def = ENEMY_DEFS[typeKey];
    const cell = stageOpen[(i * 7 + 3) % stageOpen.length];
    const behavior = stage.behaviors[i % stage.behaviors.length];
    // 初期方向: 隣接通路から1つ選ぶ
    const startDirs = DIRS.filter((d) => !isWall(stage, cell.x + d.dx, cell.z + d.dz));
    const startDir = startDirs.length > 0
      ? startDirs[Math.floor(Math.random() * startDirs.length)]
      : DIRS[0];
    const enemy = {
      type: typeKey,
      x: cell.x + 0.5,
      z: cell.z + 0.5,
      dx: startDir.dx, dz: startDir.dz,
      speed: stage.enemySpeed * def.speedMul,
      def,
      behavior,
      turnTimer: rand(0.5, 1.5),
    };
    state.enemies.push(enemy);
    const mesh = assets.enemies[typeKey].clone(true);
    const root = findCharacterRoot(mesh, typeKey);
    // 原点正規化: _Root世界座標が(0,0,0)になるよう全直下の子をシフト
    if (root && root !== mesh) {
      mesh.updateMatrixWorld(true);
      const rootWorld = new THREE.Vector3();
      root.getWorldPosition(rootWorld);
      mesh.children.forEach((c) => c.position.sub(rootWorld));
      mesh.updateMatrixWorld(true);
    }
    mesh.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });
    // 初期位置（正規化済みなので mesh.position 直接でOK）
    const wp = gridToWorld(enemy.x - 0.5, enemy.z - 0.5);
    mesh.position.copy(wp);
    mesh.rotation.y = Math.atan2(enemy.dx, enemy.dz);
    scene.add(mesh);
    state.enemyObj3Ds.push(mesh);
    state.enemyRoot3Ds.push(root);
  }

  // プレイヤー初期化: 実際に通れる最短経路の初手へ向ける
  const sp = stage.start;
  const initDirIdx = startDirFor(stage);
  const initAngle = DIRS[initDirIdx].angle;
  Object.assign(state.player, {
    x: sp.x + 0.5,
    z: sp.z + 0.5,
    fromX: sp.x + 0.5,
    fromZ: sp.z + 0.5,
    targetX: sp.x + 0.5,
    targetZ: sp.z + 0.5,
    dirIndex: initDirIdx,
    angle: initAngle,
    fromAngle: initAngle,
    targetAngle: initAngle,
    moveTime: 0, moveDuration: 0,
    turnTime: 0, turnDuration: 0,
  });

  state.mode = "playing";
  state.stageIndex = index;
  state.timeLeft = stage.time;
  state.dignity = 100;
  state.hitTimer = 0;
  state.inputCooldown = 0;
  state.queuedAction = null;
  state.paused = false;

  hideOverlay();
  if (stageNo) stageNo.textContent = `STAGE ${index + 1}`;
  if (stageName) stageName.textContent = stage.name;
  if (boardStatus) boardStatus.textContent = `STAGE ${index + 1} 進行中`;
  updateStageList();
}

// ===== 入力 =====
function setHeld(key, active) {
  if (key in state.keys) state.keys[key] = active;
}

function tryAction(action, opts = {}) {
  if (state.mode !== "playing" || state.paused) return;
  if (opts.repeat && state.inputCooldown > 0) return;
  if (isPlayerBusy()) {
    if (!opts.repeat) state.queuedAction = action;
    return;
  }
  if (opts.repeat) state.inputCooldown = INPUT_REPEAT_DELAY;

  switch (action) {
    case "left":  startTurn(-1); break;
    case "right": startTurn(1); break;
    case "forward": startStep(1); break;
    case "back":    startStep(-1); break;
  }
}

function startTurn(dir) {
  const p = state.player;
  p.dirIndex = (p.dirIndex + dir + 4) % 4;
  p.fromAngle = p.angle;
  p.targetAngle = DIRS[p.dirIndex].angle;
  p.turnTime = 0;
  p.turnDuration = PLAYER_TURN_DURATION;
}

function startStep(forward) {
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const d = DIRS[p.dirIndex];
  const moveDir = forward;
  const nx = Math.round(p.x - 0.5) + d.dx * moveDir;
  const nz = Math.round(p.z - 0.5) + d.dz * moveDir;
  if (isWall(stage, nx, nz)) {
    state.queuedAction = null;
    state.inputCooldown = INPUT_BLOCK_DELAY;
    return;
  }
  p.fromX = p.x; p.fromZ = p.z;
  p.targetX = nx + 0.5; p.targetZ = nz + 0.5;
  p.moveTime = 0;
  p.moveDuration = forward > 0 ? PLAYER_MOVE_DURATION : PLAYER_BACK_DURATION;
}

function isPlayerBusy() {
  return state.player.moveDuration > 0 || state.player.turnDuration > 0;
}

function consumeQueuedAction() {
  if (!state.queuedAction || isPlayerBusy() || state.mode !== "playing") return;
  const a = state.queuedAction;
  state.queuedAction = null;
  tryAction(a);
}

function updateHeldInput() {
  if (state.mode !== "playing" || isPlayerBusy() || state.queuedAction) return;
  const action =
    state.keys.left ? "left" :
    state.keys.right ? "right" :
    state.keys.forward ? "forward" :
    state.keys.back ? "back" : null;
  if (action) tryAction(action, { repeat: true });
}

// ===== ループ =====
let lastTs = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - lastTs) / 1000);
  lastTs = now;

  if (state.mode === "playing" && !state.paused) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateCamera();
    updateTimerAndDignity(dt);
    updateHUD();
    checkCollisions();
    checkGoal();
    consumeQueuedAction();
    updateHeldInput();
    if (state.inputCooldown > 0) state.inputCooldown -= dt;
    if (state.hitTimer > 0) state.hitTimer -= dt;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function updatePlayer(dt) {
  const p = state.player;
  // 回転
  if (p.turnDuration > 0) {
    p.turnTime += dt;
    const t = Math.min(p.turnTime / p.turnDuration, 1);
    const e = easeInOut(t);
    let delta = p.targetAngle - p.fromAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    p.angle = p.fromAngle + delta * e;
    if (t >= 1) {
      p.angle = p.targetAngle;
      p.turnDuration = 0;
    }
  }
  // 移動
  if (p.moveDuration > 0) {
    p.moveTime += dt;
    const t = Math.min(p.moveTime / p.moveDuration, 1);
    const e = easeInOut(t);
    p.x = p.fromX + (p.targetX - p.fromX) * e;
    p.z = p.fromZ + (p.targetZ - p.fromZ) * e;
    if (t >= 1) {
      p.x = p.targetX; p.z = p.targetZ;
      p.moveDuration = 0;
    }
  }
  // メッシュ反映
  if (state.playerRoot3D) {
    const wp = gridToWorld(p.x - 0.5, p.z - 0.5);
    state.playerRoot3D.position.copy(wp);
    // 走り中は軽く上下バウンス
    if (p.moveDuration > 0) {
      const bobT = (p.moveTime / p.moveDuration) * Math.PI * 2;
      state.playerRoot3D.position.y = Math.abs(Math.sin(bobT)) * 0.08;
    } else {
      state.playerRoot3D.position.y = 0;
    }
    state.playerRoot3D.rotation.y = p.angle;
  }
}

function updateEnemies(dt) {
  const stage = STAGES[state.stageIndex];
  state.enemies.forEach((e, idx) => {
    e.turnTimer -= dt;
    if (e.turnTimer <= 0) {
      // 適当に向き選択（曲がり角で）
      const choices = [];
      for (const d of DIRS) {
        const nx = Math.round(e.x - 0.5) + d.dx;
        const nz = Math.round(e.z - 0.5) + d.dz;
        if (!isWall(stage, nx, nz)) choices.push(d);
      }
      // patrol: 直進継続。曲がり角でランダム選択
      // zigzag: 頻繁に方向転換
      // blocker: ほぼ静止
      // sprinter: 高速直進
      // ambush: 時々ジャンプ
      if (e.behavior === "blocker") {
        if (Math.random() < 0.3 && choices.length > 0) {
          const c = choices[Math.floor(Math.random() * choices.length)];
          e.dx = c.dx; e.dz = c.dz;
        }
        e.turnTimer = rand(1.5, 3.5);
      } else if (e.behavior === "zigzag") {
        if (choices.length > 0) {
          const c = choices[Math.floor(Math.random() * choices.length)];
          e.dx = c.dx; e.dz = c.dz;
        }
        e.turnTimer = rand(0.5, 1.2);
      } else {
        // patrol/sprinter/ambush
        const sameDir = choices.find((c) => c.dx === e.dx && c.dz === e.dz);
        if (sameDir && Math.random() < 0.75) {
          // 直進継続
        } else if (choices.length > 0) {
          const c = choices[Math.floor(Math.random() * choices.length)];
          e.dx = c.dx; e.dz = c.dz;
        }
        e.turnTimer = rand(0.8, 2.0);
      }
    }
    // 移動
    const speedMul = e.behavior === "blocker" ? 0.3 : e.behavior === "sprinter" ? 1.4 : 1.0;
    const speed = e.speed * speedMul;
    const nx = e.x + e.dx * speed * dt;
    const nz = e.z + e.dz * speed * dt;
    // 衝突チェック
    const cellX = Math.round(nx - 0.5);
    const cellZ = Math.round(nz - 0.5);
    if (!isWall(stage, cellX, cellZ)) {
      e.x = nx; e.z = nz;
    } else {
      // 反転
      e.dx = -e.dx; e.dz = -e.dz;
    }
    // メッシュ反映
    const root = state.enemyRoot3Ds[idx];
    if (root) {
      const wp = gridToWorld(e.x - 0.5, e.z - 0.5);
      root.position.copy(wp);
      // 進行方向を向く（+Z正面想定）、滑らかに補間
      const targetAngle = Math.atan2(e.dx, e.dz);
      let cur = root.rotation.y;
      let delta = targetAngle - cur;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      // 1フレームあたり最大10ラジアン/秒で旋回
      const maxStep = 10 * dt;
      if (Math.abs(delta) <= maxStep) {
        root.rotation.y = targetAngle;
      } else {
        root.rotation.y = cur + Math.sign(delta) * maxStep;
      }
    }
  });
}

function updateCamera() {
  if (!state.playerRoot3D) return;
  const p = state.player;
  const pWorld = gridToWorld(p.x - 0.5, p.z - 0.5);
  // 後方TPS: angle方向の逆 + 上
  const back = 3.0;
  const ax = Math.sin(p.angle);
  const az = Math.cos(p.angle);
  camera.position.set(
    pWorld.x - ax * back,
    1.8,
    pWorld.z - az * back,
  );
  camera.lookAt(pWorld.x + ax * 2, 1.0, pWorld.z + az * 2);
}

function updateTimerAndDignity(dt) {
  const stage = STAGES[state.stageIndex];
  state.timeLeft -= dt;
  state.dignity -= stage.drain * dt;
  if (state.timeLeft <= 0 || state.dignity <= 0) {
    state.timeLeft = Math.max(0, state.timeLeft);
    state.dignity = Math.max(0, state.dignity);
    gameOver();
  }
}

function updateHUD() {
  if (timeValue) timeValue.textContent = state.timeLeft.toFixed(1);
  if (dignityFill) dignityFill.style.width = `${Math.max(0, Math.min(100, state.dignity))}%`;
  // 距離: 開始からゴールまでの進捗
  const stage = STAGES[state.stageIndex];
  const totalDist = Math.hypot(stage.goal.x - stage.start.x, stage.goal.z - stage.start.z);
  const curDist = Math.hypot(stage.goal.x - (state.player.x - 0.5), stage.goal.z - (state.player.z - 0.5));
  const pct = totalDist > 0 ? (1 - curDist / totalDist) * 100 : 0;
  if (distanceFill) distanceFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  // 表情
  if (facePortrait) {
    let src = "./assets/sprites/face-normal.png";
    if (state.dignity < 30) src = "./assets/sprites/face-limit.png";
    else if (state.dignity < 60) src = "./assets/sprites/face-panic.png";
    if (!facePortrait.src.endsWith(src.split("/").pop())) facePortrait.src = src;
  }
}

function checkCollisions() {
  if (state.hitTimer > 0) return;
  const stage = STAGES[state.stageIndex];
  const px = state.player.x; const pz = state.player.z;
  for (const e of state.enemies) {
    const d2 = (e.x - px) ** 2 + (e.z - pz) ** 2;
    const r = (e.def.hitRadius + 0.2);
    if (d2 < r * r) {
      state.dignity -= stage.hitPenalty;
      state.hitTimer = 0.6;
      if (state.dignity <= 0) {
        state.dignity = 0;
        gameOver();
      }
      break;
    }
  }
}

function checkGoal() {
  const stage = STAGES[state.stageIndex];
  const gx = stage.goal.x + 0.5;
  const gz = stage.goal.z + 0.5;
  const d2 = (state.player.x - gx) ** 2 + (state.player.z - gz) ** 2;
  if (d2 < 0.5 * 0.5) {
    clearStage();
  }
}

function clearStage() {
  state.mode = "clear";
  state.cleared[state.stageIndex] = true;
  if (boardStatus) boardStatus.textContent = "クリア！";
  updateStageList();
  const next = state.stageIndex + 1;
  showOverlay("clear", { next });
}

function gameOver() {
  state.mode = "gameover";
  if (boardStatus) boardStatus.textContent = "失敗…";
  showOverlay("gameover");
}

// ===== オーバーレイ =====
function showOverlay(type, opts = {}) {
  if (!screenLayer) return;
  screenLayer.classList.add("active");
  screenLayer.dataset.screen = type;
  screenLayer.setAttribute("aria-hidden", "false");
  if (type === "title") {
    if (screenTitle) screenTitle.textContent = "トイレ我慢ゲーム";
    if (screenKicker) screenKicker.textContent = "満員電車後の尊厳防衛戦";
    if (screenCopy) screenCopy.textContent = "TPS視点で駅構内の迷路を走り、トイレドアへ触れろ。";
    screenActions.innerHTML = `<button class="primary" type="button" data-action="start">START</button>`;
  } else if (type === "clear") {
    if (screenTitle) screenTitle.textContent = "クリア！";
    if (screenKicker) screenKicker.textContent = `STAGE ${state.stageIndex + 1} ${STAGES[state.stageIndex].name}`;
    if (screenCopy) screenCopy.textContent = opts.next < STAGES.length ? "次のステージへ進もう。" : "全ステージ制覇！";
    const next = opts.next < STAGES.length
      ? `<button class="primary" data-action="next">NEXT STAGE</button>`
      : `<button class="primary" data-action="title">TITLE</button>`;
    screenActions.innerHTML = next + `<button class="ghost" data-action="retry">RETRY</button>`;
  } else if (type === "gameover") {
    if (screenTitle) screenTitle.textContent = "ゲームオーバー";
    if (screenKicker) screenKicker.textContent = `STAGE ${state.stageIndex + 1} ${STAGES[state.stageIndex].name}`;
    if (screenCopy) screenCopy.textContent = "尊厳を守りきれなかった…";
    screenActions.innerHTML = `<button class="primary" data-action="retry">RETRY</button><button class="ghost" data-action="title">TITLE</button>`;
  }
  // ボタンハンドラ
  screenActions.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "start" || a === "retry") startStage(state.stageIndex);
      else if (a === "next") startStage(Math.min(state.stageIndex + 1, STAGES.length - 1));
      else if (a === "title") showTitle();
    }, { once: true });
  });
}

function hideOverlay() {
  if (!screenLayer) return;
  screenLayer.classList.remove("active");
  screenLayer.setAttribute("aria-hidden", "true");
}

function showTitle() {
  state.mode = "title";
  state.stageIndex = 0;
  showOverlay("title");
  if (boardStatus) boardStatus.textContent = "尊厳防衛中";
  updateStageList();
}

// ===== 入力イベント =====
const KEY_MAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "forward", ArrowDown: "back",
  KeyA: "left", KeyD: "right", KeyW: "forward", KeyS: "back",
};
window.addEventListener("keydown", (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) {
    setHeld(k, true);
    tryAction(k);
    ev.preventDefault();
  } else if (ev.code === "Space" && state.mode === "playing") {
    state.paused = !state.paused;
  } else if (ev.code === "KeyR" && state.mode !== "title") {
    startStage(state.stageIndex);
  }
});
window.addEventListener("keyup", (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) setHeld(k, false);
});

// タッチ/ボタン
function bindButton(btn, action) {
  if (!btn) return;
  const down = (e) => { e.preventDefault(); setHeld(action, true); tryAction(action); };
  const up = (e) => { e.preventDefault(); setHeld(action, false); };
  btn.addEventListener("mousedown", down);
  btn.addEventListener("mouseup", up);
  btn.addEventListener("mouseleave", up);
  btn.addEventListener("touchstart", down, { passive: false });
  btn.addEventListener("touchend", up, { passive: false });
  btn.addEventListener("touchcancel", up, { passive: false });
}
bindButton(turnLeftBtn, "left");
bindButton(turnRightBtn, "right");
bindButton(forwardBtn, "forward");
bindButton(backBtn, "back");

if (pauseButton) {
  pauseButton.addEventListener("click", () => {
    if (state.mode === "playing") state.paused = !state.paused;
  });
}

// ヘルパー
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function rand(a, b) { return a + Math.random() * (b - a); }

// ===== 起動 =====
async function bootstrap() {
  resizeRenderer();
  buildStageList();
  showTitle();
  // ローディング表示
  if (screenCopy) screenCopy.textContent = "アセット読み込み中…";
  if (screenActions) screenActions.innerHTML = "";
  try {
    await loadAllAssets();
  } catch (err) {
    console.error("Asset load failed:", err);
    if (screenCopy) screenCopy.textContent = "アセット読み込み失敗。コンソールを確認してください。";
    return;
  }
  console.log("Game ready");
  showOverlay("title");
  requestAnimationFrame(tick);
}

bootstrap();
