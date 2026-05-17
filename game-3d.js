/**
 * トイレ我慢ゲーム - Three.js 3D版
 * Blender生成GLBアセットを使用したフルポリゴン版
 *
 * 既存 game.js を置き換える形で動作。HUDのDOM要素は共通。
 * 当たり判定はグリッドJSON、見た目はGLB。
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";

// ===== 定数 =====
const CELL_SIZE = 2.0;
const WALL_HEIGHT = 2.4;
const PLAYER_MOVE_DURATION = 0.34;
const PLAYER_BACK_DURATION = 0.44;
const PLAYER_TURN_DURATION = 0.18;
const INPUT_REPEAT_DELAY = 0.1;
const INPUT_BLOCK_DELAY = 0.24;
const GLB_BASE = "./assets-3d/glb";
const CAMERA_BACK = 3.8;
const CAMERA_MIN_BACK = 1.7;
const CAMERA_HEIGHT = 2.65;
const CAMERA_LOOK_HEIGHT = 1.18;
const CAMERA_LOOK_AHEAD = 3.2;

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

// ★ 2.5D: キャラはGLBではなくPNGスプライト（参照画像を直接使用）
const SPRITE_BASE = "./assets/sprites3d";
const PLAYER_SPRITES = {
  idle: "player_idle_alt.png",
  // run cycle 3 frames (chroma抜き、サイズ大、リアル走り)
  run: ["player_run_1.png", "player_run_2.png", "player_run_3.png"],
};
const ENEMY_DEFS = {
  business: { sprite_idle: "player_idle_alt.png", sprite_run: ["player_run_1.png", "player_run_3.png"], radius: 0.27, hitRadius: 0.18, speedMul: 1.18, worldH: 1.40 },
  ol:       { sprite_idle: "enemy_ol_idle.png",   sprite_run: ["enemy_ol_run.png", "enemy_ol_idle.png"], radius: 0.25, hitRadius: 0.17, speedMul: 1.00, worldH: 1.30 },
  student:  { sprite_idle: "enemy_student_idle.png", sprite_run: ["enemy_student_run.png", "enemy_student_idle.png"], radius: 0.25, hitRadius: 0.17, speedMul: 0.96, worldH: 1.30 },
  traveler: { sprite_idle: "enemy_traveler_idle.png", sprite_run: ["enemy_traveler_run.png", "enemy_traveler_idle.png"], radius: 0.40, hitRadius: 0.25, speedMul: 0.82, worldH: 1.32 },
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

function worldToCellCoord(value) {
  return Math.floor(value / CELL_SIZE);
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

function softenCameraBlockerMaterial(material, opacity = 0.18) {
  if (!material) return material;
  if (Array.isArray(material)) return material.map((m) => softenCameraBlockerMaterial(m, opacity));
  const cloned = material.clone();
  cloned.transparent = true;
  cloned.opacity = opacity;
  cloned.depthWrite = false;
  return cloned;
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
renderer.toneMappingExposure = 0.78;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2330);
// フォグ薄め（駅構内の奥行き感は出しつつ視界確保）
scene.fog = new THREE.Fog(0x1b2330, 20, 55);

const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 80);
camera.position.set(0, 2, 0);

// シンプル2灯+α構成（白飛び防止のため控えめに）
const ambient = new THREE.AmbientLight(0xffffff, 0.28);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xfff2da, 0x252a36, 0.48);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xfff2d8, 0.85);
dirLight.position.set(5, 16, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1536, 1536);
dirLight.shadow.camera.left = -22;
dirLight.shadow.camera.right = 22;
dirLight.shadow.camera.top = 22;
dirLight.shadow.camera.bottom = -22;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.bias = -0.0006;
scene.add(dirLight);

// 軽めフィル（影側の最低限）
const fillLight = new THREE.DirectionalLight(0xc8dcff, 0.22);
fillLight.position.set(-8, 10, -6);
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
const texLoader = new THREE.TextureLoader();
const assets = {
  stages: [null, null, null, null, null],
  playerTex: { idle: null, run: [] },
  enemyTex: {},  // { business: {idle, run:[...]}, ... }
};

function loadSpriteTexture(filename) {
  return new Promise((resolve) => {
    texLoader.load(`${SPRITE_BASE}/${filename}`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      resolve(tex);
    });
  });
}

async function loadAllAssets() {
  const tasks = [];
  for (let i = 1; i <= 5; i++) {
    tasks.push(
      loader.loadAsync(`${GLB_BASE}/stage-${String(i).padStart(2, "0")}.glb`).then((g) => {
        assets.stages[i - 1] = g.scene;
      }),
    );
  }
  // プレイヤースプライト (idle + run3枚)
  tasks.push(
    loadSpriteTexture(PLAYER_SPRITES.idle).then((t) => { assets.playerTex.idle = t; }),
  );
  PLAYER_SPRITES.run.forEach((f, i) => {
    tasks.push(
      loadSpriteTexture(f).then((t) => { assets.playerTex.run[i] = t; }),
    );
  });
  // 敵スプライト
  for (const [key, def] of Object.entries(ENEMY_DEFS)) {
    assets.enemyTex[key] = { idle: null, run: [] };
    tasks.push(
      loadSpriteTexture(def.sprite_idle).then((t) => { assets.enemyTex[key].idle = t; }),
    );
    def.sprite_run.forEach((f, i) => {
      tasks.push(
        loadSpriteTexture(f).then((t) => { assets.enemyTex[key].run[i] = t; }),
      );
    });
  }
  await Promise.all(tasks);
  console.log("Assets loaded (5 stages + 4 chars sprites)");
}

/** スプライトを作成（カメラ常時正対のbillboard、アスペクト比保持） */
function createCharacterSprite(idleTex, worldHeight = 1.4) {
  const mat = new THREE.SpriteMaterial({
    map: idleTex,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  // アスペクト比保持: テクスチャの縦横比から幅算出
  const aspect = idleTex.image.width / idleTex.image.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  // 中心を足元基準にするため、位置はY+worldHeight/2に置く前提
  sprite.center.set(0.5, 0);  // 下中央
  return sprite;
}

/** スプライト用「フレーム切替＋向き反転」ヘルパー */
function spriteController(sprite, frames, options = {}) {
  // frames: テクスチャ配列（順に切り替え）
  const fps = options.fps || 6;
  const facingLeft = options.facingLeft ?? false;
  return {
    sprite,
    frames,
    idx: 0,
    timer: 0,
    facingLeft,
    update(dt, isMoving, faceLeft) {
      if (!isMoving) {
        // idle: 最初のフレームに戻す
        this.idx = 0;
        sprite.material.map = frames[0];
        sprite.material.needsUpdate = true;
      } else {
        this.timer += dt;
        if (this.timer >= 1 / fps) {
          this.timer = 0;
          this.idx = (this.idx + 1) % frames.length;
          sprite.material.map = frames[this.idx];
          sprite.material.needsUpdate = true;
        }
      }
      // 左右反転: スプライトのscale.x符号で
      const absX = Math.abs(sprite.scale.x);
      sprite.scale.x = faceLeft ? -absX : absX;
    },
  };
}

/**
 * GLBに含まれるwalk/idleアニメーションをAnimationMixerにセットアップ。
 * 返り値: { mixer, walkAction, idleAction, current, play(name, fadeDuration) }
 */
function setupCharacterMixer(rootScene, animations, defaultName = "idle") {
  if (!animations || animations.length === 0) return null;
  const mixer = new THREE.AnimationMixer(rootScene);
  const actions = {};
  for (const clip of animations) {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat);
    a.clampWhenFinished = false;
    actions[clip.name] = a;
    // 名前の正規化（"Player_walk" → "walk"等）
    const short = clip.name.split(/[_:]/).pop().toLowerCase();
    if (!actions[short]) actions[short] = a;
  }
  // デフォルトを開始
  let current = actions[defaultName] || actions["idle"] || Object.values(actions)[0];
  if (current) current.play();
  return {
    mixer,
    actions,
    current,
    play(name, fadeDuration = 0.2) {
      const next = actions[name];
      if (!next || next === this.current) return;
      if (this.current) {
        next.reset();
        next.play();
        next.crossFadeFrom(this.current, fadeDuration, false);
      } else {
        next.play();
      }
      this.current = next;
    },
  };
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
  playerMixer: null,
  enemyObj3Ds: [],
  enemyMixers: [],
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

function resetInputState() {
  state.keys.left = false;
  state.keys.right = false;
  state.keys.forward = false;
  state.keys.back = false;
  state.inputCooldown = 0;
  state.queuedAction = null;
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
      if (/overhead_sign|next_train_panel|station_map_panel/i.test(obj.name || "")) {
        const opacity = /next_train_panel/i.test(obj.name || "") ? 0.12 : 0.22;
        obj.material = softenCameraBlockerMaterial(obj.material, opacity);
        obj.renderOrder = 2;
      }
    }
  });
  scene.add(state.stageObj3D);

  // ★ プレイヤーはSprite (参照画像そのまま、カメラ常時正対)
  if (state.playerObj3D) scene.remove(state.playerObj3D);
  state.playerMixer = null;
  const playerSprite = createCharacterSprite(assets.playerTex.idle, 1.50);
  scene.add(playerSprite);
  state.playerObj3D = playerSprite;
  state.playerCtrl = spriteController(
    playerSprite,
    [assets.playerTex.idle, ...assets.playerTex.run],  // [idle, run1, run2, run3] の4テクスチャ
    { fps: 8 },
  );

  // 敵生成
  state.enemyObj3Ds.forEach((e) => scene.remove(e));
  state.enemyObj3Ds = [];
  state.enemyMixers = [];
  state.enemies = [];

  const spawnOpen = stage.open.filter((c) => {
    if (c.x === stage.start.x && c.z === stage.start.z) return false;
    const startDist = Math.abs(c.x - stage.start.x) + Math.abs(c.z - stage.start.z);
    return startDist >= 5;
  });
  const stageOpen = spawnOpen.length >= stage.enemyCount
    ? spawnOpen
    : stage.open.filter((c) => !(c.x === stage.start.x && c.z === stage.start.z));
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
    // ★ 敵もSprite
    const tex = assets.enemyTex[typeKey];
    const sprite = createCharacterSprite(tex.idle, def.worldH || 1.30);
    const wp = gridToWorld(enemy.x - 0.5, enemy.z - 0.5);
    sprite.position.copy(wp);
    scene.add(sprite);
    state.enemyObj3Ds.push(sprite);
    state.enemyMixers.push(spriteController(sprite, [tex.idle, ...tex.run], { fps: 5 }));
  }
  // enemyMixersクリアは前ループで実施済

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
  state.paused = false;
  resetInputState();

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

  // (Spriteベース化のため AnimationMixer は不使用)

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/**
 * 手続き型ウォークアニメーション
 * - 移動中: 上下バウンス + 前傾 + 左右ロック揺れ
 * - 停止中: 微小ブレス（idle bobbing）
 * - hit中:  左右シェイク
 * obj はGLB scene root（_Root正規化済み前提）
 */
function applyWalkAnimation(obj, baseAngle, dt, opts) {
  const isMoving = !!opts.isMoving;
  const stepHz = opts.stepHz || 4.6; // 1秒あたり脚切替回数（≒歩行ピッチ）
  const bobAmp = opts.bobAmp ?? 0.13;
  const leanRad = opts.leanRad ?? 0.13; // 前傾角(7.5°)
  const rollAmp = opts.rollAmp ?? 0.10; // 左右揺れ(5.7°)
  const hitTimer = opts.hitTimer || 0;

  if (typeof obj.userData.walkPhase !== "number") obj.userData.walkPhase = 0;
  if (typeof obj.userData.idlePhase !== "number") obj.userData.idlePhase = Math.random() * Math.PI * 2;

  obj.userData.idlePhase += dt;
  if (isMoving) {
    obj.userData.walkPhase += dt * stepHz * Math.PI * 2;
  }

  const walk = obj.userData.walkPhase;
  const idle = obj.userData.idlePhase;

  let bobY = 0, pitch = 0, roll = 0, shakeX = 0;

  if (isMoving) {
    bobY = Math.abs(Math.sin(walk * 0.5)) * bobAmp;
    pitch = -leanRad; // 前傾
    roll = Math.sin(walk * 0.5) * rollAmp;
  } else {
    bobY = (Math.sin(idle * 2.0) + 1) * 0.012; // ごく薄い呼吸
    pitch = 0;
    roll = 0;
  }
  if (hitTimer > 0) {
    shakeX = Math.sin(performance.now() / 25) * 0.06 * hitTimer;
  }

  obj.position.y = bobY;
  obj.position.x += shakeX;
  obj.rotation.set(pitch, baseAngle, roll, "YXZ");
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
  // ★ Sprite位置更新 + アニメフレーム切替
  if (state.playerObj3D) {
    const wp = gridToWorld(p.x - 0.5, p.z - 0.5);
    state.playerObj3D.position.copy(wp);
    // 走り中は少し上下バウンス
    if (p.moveDuration > 0) {
      const t = p.moveTime / p.moveDuration;
      state.playerObj3D.position.y += Math.abs(Math.sin(t * Math.PI * 2)) * 0.06;
    }
    // hit中シェイク
    if (state.hitTimer > 0) {
      state.playerObj3D.position.x += Math.sin(performance.now() / 25) * 0.05 * state.hitTimer;
    }
    // 進行方向で左右反転（カメラから見て、進行方向が-Xなら左向き）
    // playerは前方を見ているので、p.angle で判定。
    // angle 0 = +Z, π/2 = +X (右向き), π = -Z, -π/2 = -X (左向き)
    // sin(angle) > 0 なら +X向き = 右、< 0 なら -X向き = 左
    const faceLeft = Math.sin(p.angle) < -0.1;
    state.playerCtrl?.update(dt, p.moveDuration > 0, faceLeft);
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
    // ★ Sprite位置更新 + フレーム切替（敵）
    const sprite = state.enemyObj3Ds[idx];
    if (sprite) {
      const wp = gridToWorld(e.x - 0.5, e.z - 0.5);
      sprite.position.copy(wp);
      // 軽くバウンス
      const isMoving = e.behavior !== "blocker";
      if (isMoving) {
        sprite.position.y += Math.abs(Math.sin(performance.now() / 200 + idx)) * 0.04;
      }
      // 進行方向で左右反転
      const faceLeft = e.dx < -0.1;
      const ctrl = state.enemyMixers[idx];
      if (ctrl) ctrl.update(dt, isMoving, faceLeft);
    }
  });
}

function updateCamera() {
  if (!state.playerObj3D) return;
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const pWorld = gridToWorld(p.x - 0.5, p.z - 0.5);
  const ax = Math.sin(p.angle);
  const az = Math.cos(p.angle);
  let back = CAMERA_BACK;
  while (back > CAMERA_MIN_BACK) {
    const gx = worldToCellCoord(pWorld.x - ax * back);
    const gz = worldToCellCoord(pWorld.z - az * back);
    if (!isWall(stage, gx, gz)) break;
    back -= 0.25;
  }
  camera.position.set(
    pWorld.x - ax * back,
    CAMERA_HEIGHT,
    pWorld.z - az * back,
  );
  camera.lookAt(
    pWorld.x + ax * CAMERA_LOOK_AHEAD,
    CAMERA_LOOK_HEIGHT,
    pWorld.z + az * CAMERA_LOOK_AHEAD,
  );
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
  resetInputState();
  state.cleared[state.stageIndex] = true;
  if (boardStatus) boardStatus.textContent = "クリア！";
  updateStageList();
  const next = state.stageIndex + 1;
  showOverlay("clear", { next });
}

function gameOver() {
  state.mode = "gameover";
  resetInputState();
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
    if ((k === "left" || k === "right") && ev.repeat) {
      ev.preventDefault();
      return;
    }
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
window.addEventListener("blur", resetInputState);

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
