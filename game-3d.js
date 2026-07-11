/**
 * トイレ我慢ゲーム 3D - 駅構内ランニング版
 *
 * 設計方針:
 * - 主人公と通行人は共通HumanoidリグのSkinnedMeshを複製して描画する
 * - カメラ基準の連続移動と、実移動ベクトル基準の身体旋回を使う
 * - 見た目の駅設備と、衝突・ナビゲーション用グリッドを分離する
 * - 5ステージをホーム、改札、乗換、ターミナル、トイレ前として作り分ける
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// ===== 定数 =====
const CELL = 2.0;
const WALL_H = 2.48;
const PLAYER_H = 1.78;
const PLAYER_SPEED = 2.72;
const PLAYER_RADIUS = 0.24;
const PLAYER_TURN_SPEED = 12;
const ENEMY_TURN_SPEED = 8.5;
const DODGE_DURATION = 0.52;
const DODGE_STARTUP = 0.06;
const DODGE_WINDOW = 0.30;
const DODGE_COOLDOWN = 1.15;
const DODGE_SPEED = 2.5;
const DODGE_SUCCESS_RADIUS = 0.95;
const DODGE_REWARD = 2.5;
const VOXEL_MODE = true;
const RIG_BASE = "./assets-3d/rigged";
const TEX_BASE = "./assets-3d/textures";
const CAMERA_DISTANCE = 7.4;
const CAMERA_PITCH = 0.34;
const CAMERA_LOOK_HEIGHT = 1.16;
const WALL_FADE_NEAR_PLAYER = 3.25;
const WALL_FADE_NEAR_CAMERA = 4.2;
const WALL_FADE_OPACITY = 0.14;

const VOXEL = {
  sky: 0x8fb6c7,
  fog: 0x8fb6c7,
  floor: 0x7d8782,
  tileA: 0x9aa39a,
  tileB: 0x747e79,
  grout: 0x46504c,
  wallTop: 0xa2aa9b,
  dark: 0x17202b,
  signBlue: 0x1768a6,
  signGreen: 0x2c8f5e,
  glow: 0x69e4ff,
};

// 4方向: dx, dz が +Z正面前提
const DIRS = [
  { dx: 1, dz: 0, angle: Math.PI / 2 },
  { dx: 0, dz: 1, angle: 0 },
  { dx: -1, dz: 0, angle: -Math.PI / 2 },
  { dx: 0, dz: -1, angle: Math.PI },
];

// ===== ステージデータ =====
// 迷路探索型: G はフォールバック位置。実際のゴールは startStage が候補からランダムに選ぶ。
const STAGES = [
  {
    name: "深夜ホーム", note: "車両脇の入り組んだホーム", zone: "platform", time: 75, drain: 0.58, hitPenalty: 12,
    enemyCount: 7, enemySpeed: 0.92,
    behaviors: ["patrol", "patrol", "patrol"],
    pool: ["student", "ol", "business"],
    accent: 0xf4c430, wallColor: 0x345a70,
    sky: 0x98c5cf, fog: 0x98c5cf, floorColor: 0x44545b, tileA: 0x94a8a2, tileB: 0x6f8582, wallTopColor: 0xd4dfcf,
    map: [
      "#########################",
      "#..G#.............#.....#",
      "#.#.#.#...#.###.#.#.#.#.#",
      "#.#.#.#.....#...#...#.#.#",
      "#.###.#.#...#.#.#####.#.#",
      "#...#...#...#.#.#.....#.#",
      "#.#.###.###.#.#.#.#####.#",
      "#.#.........#.#.#...#...#",
      "###########.#.#.###.#.###",
      "#.....#...#.....#...#...#",
      "#.###...#.#######.#####.#",
      "#...#...#.......#...#...#",
      "#.#.#.#.######..###.#.#.#",
      "#...#.......S.......#...#",
      "#########################",
    ],
  },
  {
    name: "中央改札コンコース", note: "改札レーンの入り組む人波", zone: "gates", time: 80, drain: 0.66, hitPenalty: 13,
    enemyCount: 9, enemySpeed: 0.98,
    behaviors: ["zigzag", "patrol", "zigzag"],
    pool: ["ol", "student", "traveler"],
    accent: 0x52b476, wallColor: 0x315c4a,
    sky: 0x8fc2b3, fog: 0x8fc2b3, floorColor: 0x3f514a, tileA: 0x9bb59e, tileB: 0x6f8977, wallTopColor: 0xcce0c8,
    map: [
      "#########################",
      "#.....#.....#.......#G..#",
      "#.###....##.#.###.#.###.#",
      "#.#.......#...#...#.....#",
      "#.#####...#.###.#########",
      "#.......#.#...#.#.......#",
      "#####...#.#####.#.#####.#",
      "#.....#.#.#...#...#.....#",
      "#.#####.#.#.#.#####.###.#",
      "#.#.....#.#.#.....#...#.#",
      "#.#####.#.#.#...#.#.#.###",
      "#.#.....#.#.#...#.#.#...#",
      "#.#.#####.#.#####.#####.#",
      "#.#.........S...........#",
      "#########################",
    ],
  },
  {
    name: "地下乗換通路", note: "階段とエスカレーターの狭路", zone: "transfer", time: 85, drain: 0.76, hitPenalty: 15,
    enemyCount: 11, enemySpeed: 0.98,
    behaviors: ["blocker", "patrol", "zigzag"],
    pool: ["traveler", "traveler", "student", "business"],
    accent: 0xd89535, wallColor: 0x73563a,
    sky: 0xa7b1ad, fog: 0xa7b1ad, floorColor: 0x464d4b, tileA: 0xa7aea9, tileB: 0x747d78, wallTopColor: 0xd8dcd5,
    map: [
      "#########################",
      "#.......#.............#.#",
      "#.#####.#.#####.#####.#.#",
      "#.#...#.#.#...#.#.....#.#",
      "#.#.###.#.#.#.#.###..##.#",
      "#.#.....#.#.#.#...#.....#",
      "#.###.#####.#.#.#.#..##.#",
      "#...#.......#...#.....#.#",
      "#.#.###...###.###.###.###",
      "#.#.#.......#...#...#...#",
      "#.#.#.#####.###.#######.#",
      "#.#.#.....#.....#.....#.#",
      "#.#.#...#.#######.###.#.#",
      "#.G.#.......S.....#.....#",
      "#########################",
    ],
  },
  {
    name: "巨大ターミナル", note: "発車標下の分岐ホール", zone: "terminal", time: 90, drain: 0.86, hitPenalty: 16,
    enemyCount: 13, enemySpeed: 1.05,
    behaviors: ["sprinter", "patrol", "zigzag"],
    pool: ["business", "business", "ol", "traveler"],
    accent: 0xd45c8b, wallColor: 0x4d4772,
    sky: 0x96a3aa, fog: 0x96a3aa, floorColor: 0x434b50, tileA: 0xa8afb2, tileB: 0x707b80, wallTopColor: 0xd7dcdd,
    map: [
      "#########################",
      "#.......#.......#...#...#",
      "#.#.###.#.###.#.#.#.#.#.#",
      "#.....#.#.#.#.#...#...#.#",
      "#.###.#.#.#.#.######..#.#",
      "#.......#...#...#.....#.#",
      "#.#######...###.###...#.#",
      "#...#...#.....#...#.#...#",
      "#.#.#.#.#.#######.#.#.###",
      "#.#.......#.....#.#.#.#G#",
      "#####..####.###.#.#.#.#.#",
      "#.........#...#...#.#.#.#",
      "#.#######.###.#...#.#.#.#",
      "#...........S.#...#.....#",
      "#########################",
    ],
  },
  {
    name: "トイレ前サービス区画", note: "扉はどこだ、最後の迷宮", zone: "restroom", time: 100, drain: 0.98, hitPenalty: 18,
    enemyCount: 16, enemySpeed: 1.12,
    behaviors: ["ambush", "sprinter", "zigzag", "blocker"],
    pool: ["business", "ol", "student", "traveler"],
    accent: 0xe1463f, wallColor: 0x6d3338,
    sky: 0x96a39f, fog: 0x96a39f, floorColor: 0x484d4a, tileA: 0xa7ada5, tileB: 0x747c76, wallTopColor: 0xd8dbd3,
    map: [
      "#########################",
      "#...............#.......#",
      "#.###.###.#...###.#####.#",
      "#.#...#...............#.#",
      "#.#.#####.#.#########.#.#",
      "#.#.#...#...........#.#.#",
      "#.#.#.#.###########.#.#.#",
      "#.#...#...#.....#...#.#.#",
      "#.#######.#.#.#.#.###.#.#",
      "#...#.....#.#.#...#...#.#",
      "#####.#####.###.###...#.#",
      "#G....#.#.....#.#.......#",
      "#.#####.#.###.#.###.###.#",
      "#.#.........S.......#...#",
      "#########################",
    ],
  },
].map((s, i) => ({ ...s, ...parseMap(s.map), index: i }));

const PROGRESS_KEY = "toilet-gaman-game-progress-v2";
const LEGACY_PROGRESS_KEY = "toilet-gaman-game-progress-v1";
const PROGRESS_VERSION = 2;
const RANK_ORDER = ["C", "B", "A", "S"];

function createDefaultProgress() {
  return {
    version: PROGRESS_VERSION,
    highestUnlocked: 0,
    bestRecords: STAGES.map(() => null),
  };
}

function normalizeProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createDefaultProgress();
  const highestUnlocked = Number.isInteger(value.highestUnlocked)
    ? Math.max(0, Math.min(STAGES.length - 1, value.highestUnlocked))
    : 0;
  const rawRecords = Array.isArray(value.bestRecords) ? value.bestRecords : [];
  const bestRecords = STAGES.map((stage, index) => {
    const record = rawRecords[index];
    if (!record || typeof record !== "object" || !RANK_ORDER.includes(record.rank)) return null;
    const timeLeft = Number(record.timeLeft);
    if (!Number.isFinite(timeLeft) || timeLeft < 0 || timeLeft > stage.time) return null;
    return { rank: record.rank, timeLeft: Math.round(timeLeft * 10) / 10 };
  });
  return { version: PROGRESS_VERSION, highestUnlocked, bestRecords };
}

function loadProgress() {
  try {
    const current = window.localStorage.getItem(PROGRESS_KEY);
    const legacy = current ? null : window.localStorage.getItem(LEGACY_PROGRESS_KEY);
    const raw = current || legacy;
    if (!raw) return createDefaultProgress();
    if (raw.length > 20000) {
      window.localStorage.removeItem(PROGRESS_KEY);
      return createDefaultProgress();
    }
    const normalized = normalizeProgress(JSON.parse(raw));
    if (legacy) window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn("Progress data was reset:", error);
    try { window.localStorage.removeItem(PROGRESS_KEY); } catch (_) { /* storage unavailable */ }
    return createDefaultProgress();
  }
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalizeProgress(progress)));
    return true;
  } catch (error) {
    console.warn("Progress data could not be saved:", error);
    return false;
  }
}

const ENEMY_DEFS = {
  business: { glb: "enemy-business.glb", radius: 0.30, hitRadius: 0.30, speedMul: 1.15 },
  ol:       { glb: "enemy-ol.glb",       radius: 0.28, hitRadius: 0.28, speedMul: 1.00 },
  student:  { glb: "enemy-student.glb",  radius: 0.28, hitRadius: 0.28, speedMul: 0.95 },
  traveler: { glb: "enemy-traveler.glb", radius: 0.40, hitRadius: 0.36, speedMul: 0.85 },
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

function isWall(stage, x, z) {
  if (x < 0 || z < 0 || x >= stage.width || z >= stage.height) return true;
  return stage.map[z][x] === "#";
}

function gridToWorld(gx, gz) {
  return new THREE.Vector3(gx * CELL + CELL / 2, 0, gz * CELL + CELL / 2);
}

function cellKey(x, z) { return `${x},${z}`; }

function cellDistance(stage, from, to) {
  if (isWall(stage, from.x, from.z) || isWall(stage, to.x, to.z)) return Infinity;
  const queue = [{ x: from.x, z: from.z, d: 0 }];
  const seen = new Set([cellKey(from.x, from.z)]);
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur.x === to.x && cur.z === to.z) return cur.d;
    for (const dir of DIRS) {
      const nx = cur.x + dir.dx, nz = cur.z + dir.dz;
      const k = cellKey(nx, nz);
      if (seen.has(k) || isWall(stage, nx, nz)) continue;
      seen.add(k);
      queue.push({ x: nx, z: nz, d: cur.d + 1 });
    }
  }
  return Infinity;
}

function startDirFor(stage) {
  // TPS迷路として、開始時はまず奥へ走れる向きにする。
  // ここが横向きだと「前進したのに横へ滑る」ように感じやすい。
  const northIndex = 3;
  const north = DIRS[northIndex];
  const nx0 = stage.start.x + north.dx;
  const nz0 = stage.start.z + north.dz;
  if (!isWall(stage, nx0, nz0) && cellDistance(stage, { x: nx0, z: nz0 }, stage.goal) < Infinity) {
    return northIndex;
  }
  let best = null;
  DIRS.forEach((dir, index) => {
    const nx = stage.start.x + dir.dx, nz = stage.start.z + dir.dz;
    if (isWall(stage, nx, nz)) return;
    const score = cellDistance(stage, { x: nx, z: nz }, stage.goal);
    const direct = Math.abs(stage.goal.x - nx) + Math.abs(stage.goal.z - nz);
    if (!best || score < best.score || (score === best.score && direct < best.direct)) {
      best = { index, score, direct };
    }
  });
  return best ? best.index : 1;
}

function shortestPath(stage, from = stage.start, to = stage.goal) {
  const start = from;
  const goal = to;
  const queue = [{ x: start.x, z: start.z }];
  const seen = new Set([cellKey(start.x, start.z)]);
  const prev = new Map();
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur.x === goal.x && cur.z === goal.z) break;
    for (const dir of DIRS) {
      const nx = cur.x + dir.dx;
      const nz = cur.z + dir.dz;
      const key = cellKey(nx, nz);
      if (seen.has(key) || isWall(stage, nx, nz)) continue;
      seen.add(key);
      prev.set(key, cur);
      queue.push({ x: nx, z: nz });
    }
  }
  const goalKey = cellKey(goal.x, goal.z);
  if (!seen.has(goalKey)) return [];
  const path = [];
  let cur = goal;
  while (cur) {
    path.push(cur);
    if (cur.x === start.x && cur.z === start.z) break;
    cur = prev.get(cellKey(cur.x, cur.z));
  }
  return path.reverse();
}

function guidancePath(stage) {
  const north = { x: stage.start.x, z: stage.start.z - 1 };
  if (!isWall(stage, north.x, north.z) && cellDistance(stage, north, stage.goal) < Infinity) {
    return [stage.start, ...shortestPath(stage, north, stage.goal)];
  }
  return shortestPath(stage);
}

// スタートからの全セルBFS距離
function distanceField(stage, from = stage.start) {
  const dist = new Map([[cellKey(from.x, from.z), 0]]);
  const queue = [{ x: from.x, z: from.z }];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist.get(cellKey(cur.x, cur.z));
    for (const dir of DIRS) {
      const nx = cur.x + dir.dx, nz = cur.z + dir.dz;
      const k = cellKey(nx, nz);
      if (dist.has(k) || isWall(stage, nx, nz)) continue;
      dist.set(k, d + 1);
      queue.push({ x: nx, z: nz });
    }
  }
  return dist;
}

// ゴール候補: 北側が壁（ドアを貼れる）かつスタートから十分遠いセル
function goalCandidates(stage) {
  const dist = distanceField(stage);
  let maxDist = 0;
  dist.forEach((d) => { if (d > maxDist) maxDist = d; });
  const threshold = maxDist * 0.55;
  const candidates = stage.open.filter((c) => {
    if (c.x === stage.start.x && c.z === stage.start.z) return false;
    if (!isWall(stage, c.x, c.z - 1)) return false;
    const d = dist.get(cellKey(c.x, c.z));
    return d !== undefined && d >= threshold;
  });
  return candidates.length > 0 ? candidates : [stage.goal];
}

// 毎ラン、ゴール（トイレの扉）の位置をランダムに決める＝探して見つけるゲームにする
function pickStageGoal(stage) {
  const candidates = goalCandidates(stage);
  const chosen = candidates[Math.floor(Math.random() * candidates.length)] || stage.goal;
  stage.goal = { x: chosen.x, z: chosen.z };
  return stage.goal;
}

// ===== DOM =====
const canvas = document.getElementById("gameCanvas");
const cabinet = document.querySelector(".game-viewport");
const pageBody = document.body;
const impactLayer = document.getElementById("impactLayer");
const impactTitle = document.getElementById("impactTitle");
const impactDetail = document.getElementById("impactDetail");
const screenLayer = document.getElementById("screenLayer");
const screenTitle = document.querySelector(".title-panel h1");
const screenKicker = document.querySelector(".kicker");
const screenCopy = document.getElementById("screenCopy");
const resultScene = document.getElementById("resultScene");
const screenActions = document.getElementById("screenActions");
const hud = document.querySelector(".hud");
const stageNo = document.getElementById("stageNo");
const stageName = document.getElementById("stageName");
const timeValue = document.getElementById("timeValue");
const dignityFill = document.getElementById("dignityFill");
const distanceFill = document.getElementById("distanceFill");
const dignityValue = document.getElementById("dignityValue");
const distanceValue = document.getElementById("distanceValue");
const facePortrait = document.getElementById("facePortrait");
const pauseButton = document.getElementById("pauseButton");
const pauseLayer = document.getElementById("pauseLayer");
const stageSelect = document.getElementById("stageSelect");
const stageList = document.getElementById("stageList");
const boardStatus = document.getElementById("boardStatus");
const routeHud = document.querySelector(".route-hud");
const mobileStick = document.getElementById("mobileStick");
const stickKnob = document.getElementById("stickKnob");
const dodgeBtn = document.getElementById("dodgeButton");
const isLocalTestHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localTestParams = isLocalTestHost ? new URLSearchParams(window.location.search) : null;

// ===== Three.js セットアップ =====
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOXEL.sky);
scene.fog = new THREE.Fog(VOXEL.fog, 28, 58);

// === TPS Camera ===
// プレイヤーの背後から通路を見る。迷路の圧迫感を出しつつ、壁に入らないように追従する。
const camera = new THREE.PerspectiveCamera(62, canvas.width / canvas.height, 0.1, 110);
camera.position.set(0, 4.5, 0);

// 現在のステージサイズを記録（resize時の再計算用）
let currentStageMetrics = null;
const cameraDesired = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();
const mobileInput = new THREE.Vector2();
const moveInput = new THREE.Vector2();
let draggingCamera = false;
let cameraPointerId = null;
let previousPointerX = 0;
let previousPointerY = 0;
let joystickPointerId = null;

function applyStageCamera(stage) {
  currentStageMetrics = { stage };
  scene.background = new THREE.Color(stage.sky ?? VOXEL.sky);
  scene.fog = new THREE.Fog(stage.fog ?? stage.sky ?? VOXEL.fog, 26, 56);
  updateCamera(0, true);
}

function resizeRenderer() {
  const w = canvas.clientWidth || 760;
  const h = canvas.clientHeight || 430;
  const dprCap = w <= 700 ? 1.3 : 1.8;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dirLight.shadow.mapSize.set(w <= 700 ? 1024 : 2048, w <= 700 ? 1024 : 2048);
  if (currentStageMetrics) updateCamera(0, true);
}
window.addEventListener("resize", resizeRenderer);

// === ライト ===
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xffffff, 0x404856, 0.6);
scene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xfff0d8, 1.1);
dirLight.position.set(6, 14, 4);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -18;
dirLight.shadow.camera.right = 18;
dirLight.shadow.camera.top = 18;
dirLight.shadow.camera.bottom = -18;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
dirLight.shadow.bias = -0.0008;
scene.add(dirLight);

// ===== アセットローダー =====
const glbLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const assets = {
  riggedCharacter: null,
  animationClips: [],
  signTex: {},   // {exit, restroom, platform, gaman, wcdoor}
};

function loadTex(file, opts = {}) {
  return new Promise((resolve) => {
    texLoader.load(`${TEX_BASE}/${file}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestMipmapNearestFilter;
      if (opts.repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(opts.repeat, opts.repeat);
      }
      resolve(t);
    });
  });
}

async function loadAllAssets() {
  const tasks = [];
  tasks.push(
    glbLoader.loadAsync(`${RIG_BASE}/UAL1_Standard.glb`).then((gltf) => {
      const skinnedMesh = gltf.scene.getObjectByProperty("isSkinnedMesh", true);
      if (!skinnedMesh) throw new Error("Rigged character mesh is missing: UAL1_Standard.glb");
      assets.riggedCharacter = gltf.scene;
      assets.animationClips = gltf.animations;
    }),
  );
  // サインテクスチャ
  const sigFiles = {
    exit: "sign-exit.png",
    restroom: "sign-restroom.png",
    platform: "sign-platform.png",
    gaman: "poster-gaman.png",
    wcdoor: "wc-door.png",
    nextTrain: "sign-next-train.png",
    stationMap: "station-map.png",
    gatePass: "gate-pass.png",
    startMarker: "start-marker.png",
    vendingBlue: "vending-blue.png",
    vendingGreen: "vending-green.png",
    vendingRed: "vending-red.png",
  };
  for (const [key, file] of Object.entries(sigFiles)) {
    tasks.push(loadTex(file).then((t) => { assets.signTex[key] = t; }));
  }

  await Promise.all(tasks);
  console.log("Assets loaded:", assets.animationClips.length, Object.keys(assets.signTex));
}

const voxelMaterialCache = new Map();
function voxelMat(color, opts = {}) {
  const key = `${color}:${opts.emissive || 0}:${opts.opacity || 1}:${opts.metalness || 0}`;
  if (!voxelMaterialCache.has(key)) {
    voxelMaterialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.78,
      metalness: opts.metalness ?? 0,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
    }));
  }
  return voxelMaterialCache.get(key);
}

function addBox(group, geometry, material, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (opts.rotationY) mesh.rotation.y = opts.rotationY;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  group.add(mesh);
  return mesh;
}

function addOrientedBox(group, geometry, material, mount, y, push = 0, lateral = 0, opts = {}) {
  const pos = orientedPoint(mount, push, lateral);
  return addBox(group, geometry, material, pos.x, y, pos.z, {
    rotationY: mount.rotationY,
    castShadow: opts.castShadow,
    receiveShadow: opts.receiveShadow,
  });
}

function addWallPlane(group, texture, mount, width, height, y, push = 0.035, opts = {}) {
  if (!texture) return null;
  const pos = orientedPoint(mount, push, opts.lateral || 0);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    opacity: opts.opacity ?? 1,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(pos.x, y, pos.z);
  plane.rotation.y = mount.rotationY;
  plane.renderOrder = opts.renderOrder ?? 2;
  group.add(plane);
  return plane;
}

function stationMountForCell(stage, c, salt = 0) {
  const candidates = [
    { dx: 0, dz: -1, rotationY: 0, xOff: 0, zOff: -CELL * 0.49 },
    { dx: 0, dz: 1, rotationY: Math.PI, xOff: 0, zOff: CELL * 0.49 },
    { dx: -1, dz: 0, rotationY: Math.PI / 2, xOff: -CELL * 0.49, zOff: 0 },
    { dx: 1, dz: 0, rotationY: -Math.PI / 2, xOff: CELL * 0.49, zOff: 0 },
  ];
  for (let i = 0; i < candidates.length; i++) {
    const face = candidates[(i + salt) % candidates.length];
    if (isWall(stage, c.x + face.dx, c.z + face.dz)) {
      return {
        x: c.x * CELL + CELL / 2 + face.xOff,
        z: c.z * CELL + CELL / 2 + face.zOff,
        rotationY: face.rotationY,
      };
    }
  }
  return null;
}

function orientedPoint(mount, push = 0, lateral = 0) {
  const normal = { x: Math.sin(mount.rotationY), z: Math.cos(mount.rotationY) };
  const tangent = { x: Math.cos(mount.rotationY), z: -Math.sin(mount.rotationY) };
  return {
    x: mount.x + normal.x * push + tangent.x * lateral,
    z: mount.z + normal.z * push + tangent.z * lateral,
  };
}

function addZoneObstacle(group, stage, x, z, accentColor) {
  if (x === 0 || z === 0 || x === stage.width - 1 || z === stage.height - 1) return false;
  const obstacle = new THREE.Group();
  obstacle.position.set(x * CELL + CELL / 2, 0, z * CELL + CELL / 2);
  group.add(obstacle);
  group.userData.zoneObstacles.push({ x, z, group: obstacle });
  const steel = voxelMat(0x9aa5aa, { roughness: 0.42, metalness: 0.38 });
  const dark = voxelMat(0x26343d, { roughness: 0.66, metalness: 0.1 });
  const pale = voxelMat(0xd6d9d2, { roughness: 0.72 });
  const glow = voxelMat(accentColor.getHex(), { emissive: accentColor.getHex(), emissiveIntensity: 0.34 });

  if (stage.zone === "platform") {
    if (z === 6 && x >= 9 && x <= 12) {
      const step = x - 9;
      const height = 0.28 + step * 0.27;
      addBox(obstacle, new THREE.BoxGeometry(CELL * 0.92, height, CELL * 0.92), pale, 0, height / 2, 0);
      addBox(obstacle, new THREE.BoxGeometry(CELL * 0.92, 0.07, 0.16), glow, 0, height + 0.035, CELL * 0.37);
    } else {
      addBox(obstacle, new THREE.BoxGeometry(0.5, 3.6, 0.5), steel, 0, 1.8, 0);
      addBox(obstacle, new THREE.BoxGeometry(0.74, 0.16, 0.74), dark, 0, 0.08, 0);
      addBox(obstacle, new THREE.BoxGeometry(0.62, 0.34, 0.08), glow, 0, 2.48, 0.29);
    }
    return true;
  }

  if (stage.zone === "gates") {
    if (z === 6) {
      addTicketGate(obstacle, { x: 0, z: 0, rotationY: 0 }, accentColor);
    } else {
      addBox(obstacle, new THREE.BoxGeometry(1.56, 1.92, 0.72), dark, 0, 0.96, 0);
      addBox(obstacle, new THREE.BoxGeometry(1.36, 1.28, 0.08), pale, 0, 1.13, 0.4);
      addBox(obstacle, new THREE.BoxGeometry(1.05, 0.18, 0.09), glow, 0, 1.58, 0.45);
    }
    return true;
  }

  if (stage.zone === "transfer") {
    if ((x + z) % 2 === 0) {
      for (let i = 0; i < 4; i += 1) {
        const height = 0.22 + i * 0.25;
        addBox(obstacle, new THREE.BoxGeometry(CELL * 0.92, height, 0.42), pale, 0, height / 2, -0.65 + i * 0.43);
      }
      addBox(obstacle, new THREE.BoxGeometry(0.08, 1.35, 1.75), steel, -0.72, 0.7, 0);
      addBox(obstacle, new THREE.BoxGeometry(0.08, 1.35, 1.75), steel, 0.72, 0.7, 0);
    } else {
      addBox(obstacle, new THREE.BoxGeometry(1.72, 2.05, 0.7), steel, 0, 1.025, 0);
      [-0.54, 0, 0.54].forEach((offset) => {
        addBox(obstacle, new THREE.BoxGeometry(0.48, 1.72, 0.06), dark, offset, 1.02, 0.38);
      });
      addBox(obstacle, new THREE.BoxGeometry(1.55, 0.12, 0.08), glow, 0, 1.82, 0.42);
    }
    return true;
  }

  if (stage.zone === "terminal") {
    addBox(obstacle, new THREE.BoxGeometry(1.82, 2.18, 1.82), dark, 0, 1.09, 0);
    addBox(obstacle, new THREE.BoxGeometry(1.96, 0.18, 1.96), steel, 0, 2.16, 0);
    addBox(obstacle, new THREE.BoxGeometry(1.48, 0.34, 0.08), glow, 0, 1.65, 0.95);
    addBox(obstacle, new THREE.BoxGeometry(1.42, 0.72, 0.06), pale, 0, 0.9, 0.96);
    return true;
  }

  if (stage.zone === "restroom") {
    if (z === 8 || z === 12) {
      addBox(obstacle, new THREE.BoxGeometry(1.75, 0.12, 0.12), glow, 0, 0.88, 0);
      [-0.72, 0.72].forEach((offset) => {
        addBox(obstacle, new THREE.BoxGeometry(0.12, 1.15, 0.12), steel, offset, 0.57, 0);
        addBox(obstacle, new THREE.BoxGeometry(0.32, 0.08, 0.32), dark, offset, 0.04, 0);
      });
    } else {
      addBox(obstacle, new THREE.BoxGeometry(1.74, 2.28, 0.72), pale, 0, 1.14, 0);
      addBox(obstacle, new THREE.BoxGeometry(1.42, 1.75, 0.06), dark, 0, 1.02, 0.39);
      addBox(obstacle, new THREE.BoxGeometry(0.18, 0.18, 0.08), glow, 0.52, 1.02, 0.44);
    }
    return true;
  }
  group.userData.zoneObstacles.pop();
  group.remove(obstacle);
  return false;
}

// ===== ステージビルダー（Three.jsプリミティブ） =====
function buildStage(stage) {
  const group = new THREE.Group();
  group.name = `Stage_${stage.index}`;
  group.userData.wallBlocks = [];
  group.userData.zoneObstacles = [];

  const accentColor = new THREE.Color(stage.accent);
  const wallColor = new THREE.Color(stage.wallColor);
  const wallTopColor = stage.wallTopColor ?? VOXEL.wallTop;

  // --- 床（ブロック状の駅タイル） ---
  // 全体の床: 迷路外側にも薄く敷いて、ブロック空間の土台を作る。
  const floorMat = new THREE.MeshStandardMaterial({
    color: stage.floorColor ?? VOXEL.grout, roughness: 0.9, metalness: 0.0,
  });
  const floorW = stage.width * CELL;
  const floorD = stage.height * CELL;
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.08, floorD), floorMat);
  floorMesh.position.set(floorW / 2, -0.045, floorD / 2);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // 市松：通路セルごとに濃淡を分ける。箱にして段差と影を出す。
  const tileGeo = new THREE.BoxGeometry(CELL * 0.94, 0.08, CELL * 0.94);
  const tileDummy = new THREE.Object3D();
  const tileGroups = [
    { cells: stage.open.filter((cell) => (cell.x + cell.z) % 2 === 0), color: stage.tileA ?? VOXEL.tileA },
    { cells: stage.open.filter((cell) => (cell.x + cell.z) % 2 !== 0), color: stage.tileB ?? VOXEL.tileB },
  ];
  tileGroups.forEach(({ cells, color }) => {
    const tiles = new THREE.InstancedMesh(tileGeo, voxelMat(color), cells.length);
    cells.forEach((cell, index) => {
      tileDummy.position.set(cell.x * CELL + CELL / 2, 0.005, cell.z * CELL + CELL / 2);
      tileDummy.updateMatrix();
      tiles.setMatrixAt(index, tileDummy.matrix);
    });
    tiles.instanceMatrix.needsUpdate = true;
    tiles.receiveShadow = true;
    group.add(tiles);
  });

  // --- 黄色点字ブロック（装飾） ---
  // ゴールへの誘導には使わない。長い直線通路にだけ敷き、駅の雰囲気を出す。
  // ゴール探索は「案内板」と扉の目視で行う（探索ゲーム性の核）。
  const tactileMat = new THREE.MeshStandardMaterial({
    color: 0xf2c61f, roughness: 0.6, emissive: 0xb09010, emissiveIntensity: 0.18,
  });
  const path = guidancePath(stage);
  const tactileGeo = new THREE.BoxGeometry(CELL * 0.58, 0.06, CELL * 0.18);
  const paveCell = (x, z, alongZ) => {
    const block = new THREE.Mesh(tactileGeo, tactileMat);
    block.position.set(x * CELL + CELL / 2, 0.025, z * CELL + CELL / 2);
    if (alongZ) block.rotation.y = Math.PI / 2;
    block.receiveShadow = true;
    group.add(block);
  };
  const openSet = new Set(stage.open.map((c) => cellKey(c.x, c.z)));
  let paveCount = 0;
  for (let z = 1; z < stage.height - 1 && paveCount < 40; z += 2) {
    let run = [];
    for (let x = 1; x < stage.width; x++) {
      if (openSet.has(cellKey(x, z))) { run.push(x); continue; }
      if (run.length >= 6) run.forEach((rx) => { paveCell(rx, z, false); paveCount += 1; });
      run = [];
    }
  }
  for (let x = 1; x < stage.width - 1 && paveCount < 56; x += 2) {
    let run = [];
    for (let z = 1; z < stage.height; z++) {
      if (openSet.has(cellKey(x, z))) { run.push(z); continue; }
      if (run.length >= 6) run.forEach((rz) => { paveCell(x, rz, true); paveCount += 1; });
      run = [];
    }
  }

  // --- 壁（迷路感を出す高さ。カメラ側で壁侵入を避ける） ---
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const wallCapGeo = new THREE.BoxGeometry(CELL * 0.9, 0.14, CELL * 0.9);
  for (let z = 0; z < stage.height; z++) {
    for (let x = 0; x < stage.width; x++) {
      if (stage.map[z][x] !== "#") continue;
      if (x === 0 || z === 0 || x === stage.width - 1 || z === stage.height - 1) continue;
      // 迷路の壁は基本「壁」として建てる。設備（柱・改札・売店等）への変換は
      // 隙間から見通せてしまうため、まばらに散らすだけにする。
      const decorSlot = (x * 7 + z * 11 + stage.index * 5) % 19 === 0;
      if (decorSlot && addZoneObstacle(group, stage, x, z, accentColor)) continue;
      const wallMat = new THREE.MeshStandardMaterial({
        color: wallColor, roughness: 0.68, metalness: 0.03,
        transparent: true, opacity: 0.98,
      });
      const wallTopMat = new THREE.MeshStandardMaterial({
        color: wallTopColor, roughness: 0.78,
        transparent: true, opacity: 0.98,
      });
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x * CELL + CELL / 2, WALL_H / 2, z * CELL + CELL / 2);
      w.castShadow = true;
      w.receiveShadow = true;
      group.add(w);
      const cap = new THREE.Mesh(wallCapGeo, wallTopMat);
      cap.position.set(x * CELL + CELL / 2, WALL_H + 0.07, z * CELL + CELL / 2);
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);
      group.userData.wallBlocks.push({ x, z, meshes: [w, cap] });
    }
  }

  // --- 壁の上に細い装飾ライン（accent色） ---
  // 外周をぐるっと（低めのemission帯）
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor, emissive: accentColor, emissiveIntensity: 0.4,
  });
  const accentGeo = new THREE.BoxGeometry(stage.width * CELL, 0.05, 0.06);
  const topStrip = new THREE.Mesh(accentGeo, accentMat);
  topStrip.position.set(stage.width * CELL / 2, 0.12, 0.03);
  group.add(topStrip);
  const botStrip = new THREE.Mesh(accentGeo, accentMat);
  botStrip.position.set(stage.width * CELL / 2, 0.12, stage.height * CELL - 0.03);
  group.add(botStrip);

  // --- ゴール: 青いトイレドア ---
  const gx = stage.goal.x, gz = stage.goal.z;
  const goalWp = gridToWorld(gx, gz);
  // ドア本体（壁色を上書きするため、ゴールセル位置に新マテリアル箱を置く）
  const wcDoorMat = new THREE.MeshStandardMaterial({
    map: assets.signTex.wcdoor, color: VOXEL_MODE ? VOXEL.signBlue : 0xffffff, roughness: 0.5,
  });
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.8, 1.8, 0.15),
    wcDoorMat,
  );
  // ドアは ゴールセルの北側辺(gz-1セルとの境界)に置く（壁面に貼り付け）
  doorMesh.position.set(goalWp.x, 0.9, goalWp.z - CELL / 2 + 0.08);
  doorMesh.castShadow = true;
  group.add(doorMesh);
  if (VOXEL_MODE) {
    const frameMat = voxelMat(0xf5f2dc);
    const frameGeoV = new THREE.BoxGeometry(0.13, 1.95, 0.18);
    const frameGeoH = new THREE.BoxGeometry(CELL * 0.98, 0.13, 0.18);
    addBox(group, frameGeoV, frameMat, goalWp.x - CELL * 0.46, 0.98, goalWp.z - CELL / 2 + 0.1);
    addBox(group, frameGeoV, frameMat, goalWp.x + CELL * 0.46, 0.98, goalWp.z - CELL / 2 + 0.1);
    addBox(group, frameGeoH, frameMat, goalWp.x, 1.92, goalWp.z - CELL / 2 + 0.1);
    const glowGeo = new THREE.BoxGeometry(CELL * 0.72, 0.1, 0.2);
    addBox(group, glowGeo, voxelMat(VOXEL.glow, { emissive: VOXEL.glow, emissiveIntensity: 0.8 }), goalWp.x, 0.18, goalWp.z - CELL / 2 + 0.14);
  }
  // ドア上の Restroom 看板（壁より低くして、同じ通路に入るまで見えないようにする）
  const restroomSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.52),
    new THREE.MeshBasicMaterial({ map: assets.signTex.restroom, transparent: true }),
  );
  restroomSign.position.set(goalWp.x, 2.16, goalWp.z - CELL / 2 + 0.12);
  group.add(restroomSign);
  // ゴール照明（発見前は控えめ。発見時に updateGoalDiscovery が強める）
  const goalLight = new THREE.PointLight(0xfff0c8, 1.2, 3.4);
  goalLight.position.set(goalWp.x, 1.7, goalWp.z - 0.3);
  group.add(goalLight);
  // ゴール床マーカー（控えめ）
  const goalFloor = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0.28 }),
  );
  goalFloor.rotation.x = -Math.PI / 2;
  goalFloor.position.set(goalWp.x, 0.03, goalWp.z);
  group.add(goalFloor);
  group.userData.goalRefs = { light: goalLight, sign: restroomSign, floor: goalFloor };

  // --- 案内板（探索の手がかり） ---
  // 分岐セルの壁面に駅構内図を貼る。近づくとトイレの方角ヒントが出る。
  const boardCells = [];
  const cellDegree = (c) => DIRS.reduce((sum, dir) => sum + (isWall(stage, c.x + dir.dx, c.z + dir.dz) ? 0 : 1), 0);
  const startKeyForBoards = cellKey(stage.start.x, stage.start.z);
  const goalKeyForBoards = cellKey(stage.goal.x, stage.goal.z);
  const junctionCells = stage.open.filter((c) => {
    const key = cellKey(c.x, c.z);
    if (key === startKeyForBoards || key === goalKeyForBoards) return false;
    return cellDegree(c) >= 3 && stationMountForCell(stage, c, c.x + c.z);
  });
  const boardBudget = 5 + Math.floor(stage.index / 2);
  junctionCells
    .sort((a, b) => ((a.x * 13 + a.z * 7) % 17) - ((b.x * 13 + b.z * 7) % 17))
    .forEach((c) => {
      if (boardCells.length >= boardBudget) return;
      const tooClose = boardCells.some((b) => Math.abs(b.x - c.x) + Math.abs(b.z - c.z) < 6);
      if (tooClose) return;
      boardCells.push(c);
    });
  group.userData.hintBoards = boardCells.map((c) => ({ x: c.x, z: c.z }));
  boardCells.forEach((c, i) => {
    const mount = stationMountForCell(stage, c, c.x + c.z);
    if (!mount) return;
    addWallPlane(group, assets.signTex.stationMap, mount, 1.2, 0.72, 1.18, 0.05);
    const frame = addOrientedBox(
      group,
      new THREE.BoxGeometry(1.32, 0.08, 0.06),
      voxelMat(0x2fbf71, { emissive: 0x2fbf71, emissiveIntensity: 0.85 }),
      mount, 1.62, 0.04,
    );
    frame.castShadow = false;
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 20),
      new THREE.MeshBasicMaterial({ color: 0x2fbf71, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(c.x * CELL + CELL / 2, 0.028, c.z * CELL + CELL / 2);
    group.add(marker);
  });

  // --- スタート床マーカー（緑） ---
  const sp = gridToWorld(stage.start.x, stage.start.z);
  const startMark = new THREE.Mesh(
    assets.signTex.startMarker ? new THREE.PlaneGeometry(0.95, 0.95) : new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({
      map: assets.signTex.startMarker || null,
      color: assets.signTex.startMarker ? 0xffffff : 0x44dd80,
      transparent: true,
      opacity: assets.signTex.startMarker ? 0.86 : 0.6,
    }),
  );
  startMark.rotation.x = -Math.PI / 2;
  startMark.position.set(sp.x, 0.03, sp.z);
  group.add(startMark);

  // --- Exit 看板（ステージ上部の中央あたり、天井から吊り下げ） ---
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.7),
    new THREE.MeshBasicMaterial({ map: assets.signTex.exit, transparent: true }),
  );
  exitSign.position.set(stage.width * CELL / 2, WALL_H + 0.45, 1.2);
  group.add(exitSign);

  // --- Platform 看板（左側） ---
  const platSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.7),
    new THREE.MeshBasicMaterial({ map: assets.signTex.platform, transparent: true }),
  );
  platSign.position.set(2.5, WALL_H + 0.45, 0.7);
  group.add(platSign);

  // --- がまんポスター（壁の外周内側に1〜2枚） ---
  if (assets.signTex.gaman) {
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.4),
      new THREE.MeshBasicMaterial({ map: assets.signTex.gaman, transparent: true }),
    );
    poster.position.set(stage.width * CELL - 0.05, WALL_H - 0.1, stage.height * CELL / 2);
    poster.rotation.y = -Math.PI / 2;
    group.add(poster);
  }

  addStationDecor(group, stage, path, accentColor);
  addStationBackdrop(group, stage, accentColor);
  addZoneLandmarks(group, stage, accentColor);

  return group;
}

function addStationBackdrop(group, stage, accentColor) {
  const width = stage.width * CELL;
  const depth = stage.height * CELL;
  const centerX = width / 2;
  const centerZ = depth / 2;

  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x27313a,
    roughness: 0.86,
    metalness: 0.03,
  });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(width + CELL * 4, 0.05, depth + CELL * 4), apronMat);
  apron.position.set(centerX, -0.095, centerZ);
  apron.receiveShadow = true;
  group.add(apron);

  if (stage.zone === "platform") {
    const railBedMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.75, metalness: 0.12 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8793a0, roughness: 0.38, metalness: 0.65 });
    const railBed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, depth + CELL * 2), railBedMat);
    railBed.position.set(-CELL * 0.8, -0.015, centerZ);
    railBed.receiveShadow = true;
    group.add(railBed);
    [-0.38, 0.38].forEach((offset) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, depth + CELL * 2), railMat);
      rail.position.set(-CELL * 0.8 + offset, 0.035, centerZ);
      rail.receiveShadow = true;
      group.add(rail);
    });
  }

  const wallPanelMat = new THREE.MeshStandardMaterial({
    color: 0x30404c,
    roughness: 0.72,
    metalness: 0.08,
  });
  const wallBandMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.08),
    emissive: accentColor,
    emissiveIntensity: 0.24,
    roughness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8fb5c8,
    roughness: 0.28,
    metalness: 0.12,
    transparent: true,
    opacity: 0.36,
  });

  if (stage.zone !== "platform") {
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.95, depth + CELL * 1.2), wallPanelMat);
    westWall.position.set(-CELL * 1.6, 0.92, centerZ);
    westWall.receiveShadow = true;
    group.add(westWall);
  }
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(width + CELL * 3, 1.85, 0.16), wallPanelMat);
  northWall.position.set(centerX, 0.9, -CELL * 1.05);
  northWall.receiveShadow = true;
  group.add(northWall);
  if (stage.zone !== "platform") {
    const westBand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, depth + CELL), wallBandMat);
    westBand.position.set(-CELL * 1.5, 1.62, centerZ);
    group.add(westBand);
  }
  const northBand = new THREE.Mesh(new THREE.BoxGeometry(width + CELL * 2.6, 0.12, 0.18), wallBandMat);
  northBand.position.set(centerX, 1.55, -CELL * 0.95);
  group.add(northBand);

  if (stage.zone !== "platform") {
    const windowGeo = new THREE.BoxGeometry(0.035, 0.72, 2.4);
    for (let i = 0; i < Math.min(8, stage.height); i++) {
      const window = new THREE.Mesh(windowGeo, glassMat);
      window.position.set(-CELL * 1.49, 0.9, CELL * (1.5 + i * 2.4));
      group.add(window);
    }
  }

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x182838, roughness: 0.62, metalness: 0.18 });
  for (let z = 2; z < stage.height - 1; z += 5) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width + CELL, 0.08, 0.12), beamMat);
    beam.position.set(centerX, 4.28, z * CELL + CELL / 2);
    group.add(beam);
    const light = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.055, 0.18), lightMat);
    light.position.set(centerX, 4.15, z * CELL + CELL / 2);
    group.add(light);
  }

  const mapMount = { x: centerX - 2.2, z: -CELL * 0.92, rotationY: 0 };
  addWallPlane(group, assets.signTex.stationMap, mapMount, 1.35, 0.9, 0.92, 0.08);
  const trainMount = { x: centerX + 2.15, z: -CELL * 0.91, rotationY: 0 };
  addWallPlane(group, assets.signTex.nextTrain, trainMount, 1.65, 0.62, 1.12, 0.08);
}

function addZoneLandmarks(group, stage, accentColor) {
  const width = stage.width * CELL;
  const depth = stage.height * CELL;
  const steel = voxelMat(0x8b979e, { roughness: 0.4, metalness: 0.48 });
  const pale = voxelMat(0xe0e2dc, { roughness: 0.7 });
  const dark = voxelMat(0x182832, { roughness: 0.62, metalness: 0.12 });
  const glow = voxelMat(accentColor.getHex(), { emissive: accentColor.getHex(), emissiveIntensity: 0.42 });

  if (stage.zone === "platform") {
    addBox(group, new THREE.BoxGeometry(3.25, 3.1, depth + CELL), pale, -4.25, 1.56, depth / 2);
    addBox(group, new THREE.BoxGeometry(3.32, 0.24, depth + CELL * 1.1), steel, -4.25, 3.18, depth / 2);
    addBox(group, new THREE.BoxGeometry(0.08, 0.25, depth), voxelMat(0x176ba0), -2.58, 1.12, depth / 2);
    for (let z = 2.4; z < depth - 2; z += 7.6) {
      addBox(group, new THREE.BoxGeometry(0.06, 1.05, 2.2), dark, -2.54, 2.18, z);
      addBox(group, new THREE.BoxGeometry(0.07, 2.2, 1.45), steel, -2.51, 1.52, z + 2.55);
    }
    return;
  }

  if (stage.zone === "gates") {
    const boardMount = { x: width / 2, z: CELL * 1.1, rotationY: 0 };
    addBox(group, new THREE.BoxGeometry(7.2, 1.4, 0.18), dark, width / 2, 3.05, CELL * 1.02);
    addWallPlane(group, assets.signTex.nextTrain, boardMount, 6.7, 1.05, 3.05, 0.12, { renderOrder: 3 });
    [-4.2, 4.2].forEach((offset) => {
      addBox(group, new THREE.BoxGeometry(1.25, 1.95, 0.72), steel, width / 2 + offset, 0.98, depth - 3.2);
      addBox(group, new THREE.BoxGeometry(0.95, 1.35, 0.08), glow, width / 2 + offset, 1.13, depth - 2.82);
    });
    return;
  }

  if (stage.zone === "transfer") {
    const railMat = voxelMat(0x8aa1aa, { roughness: 0.34, metalness: 0.58 });
    [-3.1, 3.1].forEach((offset) => {
      for (let i = 0; i < 9; i += 1) {
        const y = 0.12 + i * 0.18;
        addBox(group, new THREE.BoxGeometry(2.6, 0.18, 0.62), pale, width / 2 + offset, y, 5.1 + i * 0.58);
      }
      addBox(group, new THREE.BoxGeometry(0.08, 1.35, 5.8), railMat, width / 2 + offset - 1.35, 0.85, 7.45);
      addBox(group, new THREE.BoxGeometry(0.08, 1.35, 5.8), railMat, width / 2 + offset + 1.35, 0.85, 7.45);
    });
    return;
  }

  if (stage.zone === "terminal") {
    addBox(group, new THREE.BoxGeometry(10.2, 1.7, 0.2), dark, width / 2, 3.2, 4.1);
    addBox(group, new THREE.BoxGeometry(9.7, 1.18, 0.06), glow, width / 2, 3.2, 4.22);
    for (let x = 7; x < width - 6; x += 7.5) {
      addBox(group, new THREE.BoxGeometry(3.6, 0.16, 0.68), voxelMat(0x765236), x, 0.55, depth - 4.2);
      [-1.45, 1.45].forEach((offset) => addBox(group, new THREE.BoxGeometry(0.12, 0.56, 0.5), steel, x + offset, 0.28, depth - 4.2));
    }
    return;
  }

  if (stage.zone === "restroom") {
    const cart = new THREE.Group();
    cart.position.set(width * 0.7, 0, depth * 0.62);
    group.add(cart);
    addBox(cart, new THREE.BoxGeometry(1.25, 0.85, 0.72), voxelMat(0x346b82), 0, 0.52, 0);
    addBox(cart, new THREE.BoxGeometry(0.08, 1.3, 0.08), steel, -0.45, 1.0, -0.2);
    addBox(cart, new THREE.BoxGeometry(0.78, 0.08, 0.08), glow, 0, 0.96, 0.39);
    [-0.42, 0.42].forEach((offset) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(offset, 0.16, 0.3);
      cart.add(wheel);
    });
    const signMount = { x: width / 2, z: CELL * 1.02, rotationY: 0 };
    addBox(group, new THREE.BoxGeometry(7.4, 1.55, 0.18), dark, width / 2, 3.1, CELL * 0.94);
    addWallPlane(group, assets.signTex.restroom, signMount, 6.9, 1.12, 3.1, 0.12, { renderOrder: 3 });
  }
}

function addVendingMachine(group, mount, texture) {
  const bodyMat = voxelMat(0x1f5f91, { roughness: 0.48, metalness: 0.12 });
  const sideMat = voxelMat(0x0c2234, { roughness: 0.55, metalness: 0.18 });
  const glowMat = voxelMat(0x86dfff, { emissive: 0x86dfff, emissiveIntensity: 0.55 });
  const bodyGeo = new THREE.BoxGeometry(0.64, 1.22, 0.24);
  const sideGeo = new THREE.BoxGeometry(0.08, 1.24, 0.28);
  const slotGeo = new THREE.BoxGeometry(0.36, 0.08, 0.035);
  addOrientedBox(group, bodyGeo, bodyMat, mount, 0.64, 0.16);
  addOrientedBox(group, sideGeo, sideMat, mount, 0.64, 0.18, -0.33);
  addOrientedBox(group, sideGeo, sideMat, mount, 0.64, 0.18, 0.33);
  addOrientedBox(group, slotGeo, glowMat, mount, 1.1, 0.31);
  addWallPlane(group, texture, mount, 0.52, 0.86, 0.66, 0.315, { renderOrder: 3 });
}

function addTicketGate(group, mount, accentColor) {
  const gateMat = voxelMat(0xc2cbd0, { roughness: 0.46, metalness: 0.28 });
  const darkMat = voxelMat(0x26323a, { roughness: 0.62, metalness: 0.2 });
  const lightMat = voxelMat(accentColor.getHex(), { emissive: accentColor.getHex(), emissiveIntensity: 0.42 });
  const pillarGeo = new THREE.BoxGeometry(0.18, 0.72, 0.32);
  const topGeo = new THREE.BoxGeometry(0.82, 0.11, 0.34);
  const readerGeo = new THREE.BoxGeometry(0.18, 0.035, 0.2);
  addOrientedBox(group, pillarGeo, gateMat, mount, 0.36, 0.22, -0.31);
  addOrientedBox(group, pillarGeo, gateMat, mount, 0.36, 0.22, 0.31);
  addOrientedBox(group, topGeo, darkMat, mount, 0.75, 0.22);
  addOrientedBox(group, readerGeo, lightMat, mount, 0.84, 0.42, -0.21);
  addOrientedBox(group, readerGeo, lightMat, mount, 0.84, 0.42, 0.21);
  addWallPlane(group, assets.signTex.gatePass, mount, 0.58, 0.32, 1.12, 0.055);
}

function addWallBench(group, mount) {
  const seatMat = voxelMat(0x5b3f2e, { roughness: 0.72 });
  const metalMat = voxelMat(0x9da8ad, { roughness: 0.42, metalness: 0.35 });
  const seatGeo = new THREE.BoxGeometry(1.05, 0.15, 0.32);
  const backGeo = new THREE.BoxGeometry(1.08, 0.44, 0.12);
  const legGeo = new THREE.BoxGeometry(0.12, 0.34, 0.12);
  addOrientedBox(group, backGeo, seatMat, mount, 0.58, 0.06);
  addOrientedBox(group, seatGeo, seatMat, mount, 0.36, 0.35);
  addOrientedBox(group, legGeo, metalMat, mount, 0.18, 0.32, -0.36);
  addOrientedBox(group, legGeo, metalMat, mount, 0.18, 0.32, 0.36);
}

function addStationDecor(group, stage, path, accentColor) {
  const pathKeys = new Set(path.map((c) => cellKey(c.x, c.z)));
  const startKey = cellKey(stage.start.x, stage.start.z);
  const goalKey = cellKey(stage.goal.x, stage.goal.z);
  const sideCells = stage.open.filter((c) => {
    const key = cellKey(c.x, c.z);
    if (pathKeys.has(key) || key === startKey || key === goalKey) return false;
    return (c.x * 19 + c.z * 13 + stage.index * 7) % 5 === 0;
  });

  const floorAccentMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.38),
    roughness: 0.72,
    emissive: accentColor,
    emissiveIntensity: 0.08,
  });
  const floorAccentGeo = new THREE.BoxGeometry(CELL * 0.72, 0.035, CELL * 0.72);
  sideCells.slice(0, 9 + stage.index).forEach((c) => {
    const marker = new THREE.Mesh(floorAccentGeo, floorAccentMat);
    marker.position.set(c.x * CELL + CELL / 2, 0.035, c.z * CELL + CELL / 2);
    marker.receiveShadow = true;
    group.add(marker);
  });

  if (VOXEL_MODE) {
    const decorated = sideCells
      .map((c, i) => ({ c, mount: stationMountForCell(stage, c, i), i }))
      .filter((item) => item.mount)
      .slice(0, 7 + stage.index);
    decorated.forEach(({ mount, i }) => {
      if (i % 4 === 0) {
        addVendingMachine(group, mount, [assets.signTex.vendingBlue, assets.signTex.vendingGreen, assets.signTex.vendingRed][i % 3]);
      } else if (i % 4 === 1) {
        // 駅構内図（stationMap）は案内板専用にしたので、装飾は発車標のみ
        addWallPlane(group, assets.signTex.nextTrain, mount, 1.05, 0.62, 0.82, 0.045);
      } else if (i % 4 === 2) {
        addTicketGate(group, mount, accentColor);
      } else {
        addWallBench(group, mount);
      }
    });
  }

  // 天井灯は経路と無関係のグリッド配置にする（最短経路のネタバレ防止）
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b4 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x1d2b39, roughness: 0.55, metalness: 0.25 });
  const lampGeo = new THREE.BoxGeometry(CELL * 0.9, 0.055, 0.16);
  const beamGeo = new THREE.BoxGeometry(CELL * 0.08, 0.08, CELL * 0.94);
  stage.open.forEach((c) => {
    if (c.x % 5 !== 2 || c.z % 4 !== 2) return;
    const alongZ = (c.x + c.z) % 2 === 0;
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(c.x * CELL + CELL / 2, 4.18, c.z * CELL + CELL / 2);
    if (alongZ) lamp.rotation.y = Math.PI / 2;
    group.add(lamp);

    const beam = new THREE.Mesh(beamGeo, railMat);
    beam.position.set(c.x * CELL + CELL / 2, 4.08, c.z * CELL + CELL / 2);
    if (!alongZ) beam.rotation.y = Math.PI / 2;
    group.add(beam);
  });

  const panelMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone().lerp(new THREE.Color(0x111821), 0.28),
    roughness: 0.6,
    metalness: 0.08,
  });
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xb9c2ca, roughness: 0.55, metalness: 0.18 });
  const panelGeo = new THREE.BoxGeometry(CELL * 0.72, 0.42, 0.055);
  const columnGeo = VOXEL_MODE
    ? new THREE.BoxGeometry(0.34, WALL_H + 0.35, 0.34)
    : new THREE.CylinderGeometry(0.12, 0.12, WALL_H + 0.35, 14);
  let panelCount = 0;
  for (let z = 1; z < stage.height - 1; z++) {
    for (let x = 1; x < stage.width - 1; x++) {
      if (stage.map[z][x] !== "#") continue;
      const openNorth = !isWall(stage, x, z - 1);
      const openSouth = !isWall(stage, x, z + 1);
      const openEast = !isWall(stage, x + 1, z);
      const openWest = !isWall(stage, x - 1, z);
      if ((x * 11 + z * 17 + stage.index) % 9 === 0 && (openNorth || openSouth || openEast || openWest)) {
        const col = new THREE.Mesh(columnGeo, columnMat);
        col.position.set(x * CELL + CELL / 2, (WALL_H + 0.35) / 2, z * CELL + CELL / 2);
        col.castShadow = true;
        group.add(col);
      }
      if (panelCount >= 8 + stage.index * 2) continue;
      if ((x * 7 + z * 5 + stage.index) % 8 !== 0) continue;
      const panel = new THREE.Mesh(panelGeo, panelMat);
      if (openNorth || openSouth) {
        panel.position.set(x * CELL + CELL / 2, 1.08, z * CELL + (openNorth ? 0.05 : CELL - 0.05));
      } else if (openEast || openWest) {
        panel.rotation.y = Math.PI / 2;
        panel.position.set(x * CELL + (openWest ? 0.05 : CELL - 0.05), 1.08, z * CELL + CELL / 2);
      } else {
        continue;
      }
      panel.castShadow = true;
      group.add(panel);
      panelCount += 1;
    }
  }
}

// ===== リグ付き3Dキャラクター =====
// スキンウェイト（支配ボーン）＋バインドポーズ座標から頂点カラーで「服」を塗る。
// 部位: skin(手) / head(顔・髪) / arms(袖) / torso(上着) / hips(腰) / thigh / calf / shoes
// torso 前面中央は shirt / tie（ワイシャツとネクタイ）に塗り分ける。
const RIGGED_CHARACTER_STYLES = {
  player: { // 主人公: 紺スーツのサラリーマン
    skin: 0xeab98b, hair: 0x23262a, torso: 0x2e4d7b, arms: 0x2e4d7b, hips: 0x27406b,
    thigh: 0x27406b, calf: 0x233a5f, shoes: 0x23262b, shirt: 0xf5f2e8, tie: 0xd2483c,
    prop: "briefcase", propColor: 0x513a28,
  },
  business: { // 通行人: チャコールスーツのサラリーマン
    skin: 0xe6b48a, hair: 0x574536, torso: 0x484f5b, arms: 0x484f5b, hips: 0x3e444e,
    thigh: 0x3e444e, calf: 0x3a4048, shoes: 0x22252a, shirt: 0xf1ece0, tie: 0x35608e,
    prop: "briefcase", propColor: 0x3a2c20,
  },
  ol: { // 通行人: OL（ブラウス＋ダークスカート）
    skin: 0xeec39a, hair: 0x59392b, torso: 0xf0e9dc, arms: 0xf0e9dc, hips: 0x39404e,
    thigh: 0x39404e, calf: 0xdcbd9a, shoes: 0x2e3138, shirt: 0xf0e9dc, tie: 0xc4574e,
    prop: "handbag", propColor: 0x9c5a3c,
  },
  student: { // 通行人: 学生（緑ブレザー）
    skin: 0xefc79e, hair: 0x2c2622, torso: 0x3c5a49, arms: 0x3c5a49, hips: 0x565e69,
    thigh: 0x565e69, calf: 0x565e69, shoes: 0x2c2f35, shirt: 0xf2f0e4, tie: 0xc03a38,
    prop: "handbag", propColor: 0x31465c,
  },
  traveler: { // 通行人: 帽子のおじさん（ベスト＋白髪交じり）
    skin: 0xdfae83, hair: 0x9a9184, torso: 0x8a7a5c, arms: 0xe9e2cf, hips: 0x51493c,
    thigh: 0x51493c, calf: 0x4c443a, shoes: 0x33302b, shirt: 0xe9e2cf, tie: 0x5e7a5a,
    prop: "hat", propColor: 0x5a4632,
  },
};

function partForBone(name) {
  const n = (name || "").toLowerCase();
  if (/hand|thumb|index|middle|ring|pinky/.test(n)) return "skin";
  if (n === "head" || n.includes("neck")) return "head";
  if (/clavicle|upperarm|lowerarm/.test(n)) return "arms";
  if (n.includes("spine_01") || n.includes("pelvis")) return "hips";
  if (n.includes("spine")) return "torso";
  if (n.includes("thigh")) return "thigh";
  if (n.includes("calf")) return "calf";
  if (/foot|ball/.test(n)) return "shoes";
  return "torso";
}

const riggedPaintMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff, vertexColors: true, roughness: 0.74, metalness: 0.02,
});
const paintedGeometryCache = new Map();

function paintedGeometryFor(object, type, style) {
  const key = `${type}:${object.name}`;
  if (paintedGeometryCache.has(key)) return paintedGeometryCache.get(key);
  const geo = object.geometry.clone();
  const pos = geo.attributes.position;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const bones = object.skeleton.bones;
  geo.computeBoundingBox();
  const minY = geo.boundingBox.min.y;
  const bodyHeight = Math.max(geo.boundingBox.max.y - minY, 0.0001);
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let boneIndex = 0;
    let bestWeight = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bestWeight) { bestWeight = w; boneIndex = skinIndex.getComponent(i, k); }
    }
    const part = partForBone(bones[boneIndex]?.name);
    const yRatio = (pos.getY(i) - minY) / bodyHeight;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let hex;
    if (part === "head") {
      // 頭頂と後頭部を髪にする（バインドポーズ前方= +Z 前提）
      if (yRatio > 0.945 || (yRatio > 0.885 && z < -0.012)) hex = style.hair;
      else hex = style.skin;
    } else if (part === "torso") {
      // 胸元中央にワイシャツのVゾーンとネクタイ
      if (z > 0.045 && yRatio > 0.60 && yRatio < 0.83 && Math.abs(x) < 0.085) {
        hex = Math.abs(x) < 0.03 ? style.tie : style.shirt;
      } else {
        hex = style.torso;
      }
    } else {
      hex = style[part] ?? style.torso;
    }
    color.setHex(hex);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  paintedGeometryCache.set(key, geo);
  return geo;
}

// ボーンに直付けする小物（歩行アニメに追従する）
function attachCharacterProps(model, type, style) {
  const propMat = new THREE.MeshStandardMaterial({ color: style.propColor, roughness: 0.62, metalness: 0.05 });
  const boneWorldScale = new THREE.Vector3();
  const addToBone = (boneName, build, offset) => {
    const bone = model.getObjectByName(boneName);
    if (!bone) return null;
    bone.getWorldScale(boneWorldScale);
    const inv = 1 / (boneWorldScale.y || 1);
    const prop = build();
    prop.scale.multiplyScalar(inv);
    prop.position.copy(offset).multiplyScalar(inv);
    bone.add(prop);
    return prop;
  };
  if (style.prop === "briefcase") {
    addToBone("hand_r", () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.075), propMat);
      g.add(body);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), propMat);
      handle.position.y = 0.145;
      g.add(handle);
      return g;
    }, new THREE.Vector3(0, 0.22, 0));
  } else if (style.prop === "handbag") {
    addToBone("hand_l", () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.09), propMat);
      g.add(body);
      return g;
    }, new THREE.Vector3(0, 0.18, 0));
  } else if (style.prop === "hat") {
    addToBone("Head", () => {
      const g = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.11, 16), propMat);
      g.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.022, 16), propMat);
      brim.position.y = -0.05;
      g.add(brim);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.122, 0.128, 0.035, 16),
        new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.7 }),
      );
      band.position.y = -0.03;
      g.add(band);
      return g;
    }, new THREE.Vector3(0, 0.155, 0));
  }
}

function createCharacter(type, targetHeight = PLAYER_H) {
  if (!assets.riggedCharacter || assets.animationClips.length === 0) {
    throw new Error("Rigged character asset has not been loaded");
  }
  const style = RIGGED_CHARACTER_STYLES[type] || RIGGED_CHARACTER_STYLES.business;
  const root = new THREE.Group();
  root.name = `RiggedChar_${type}`;
  const model = SkeletonUtils.clone(assets.riggedCharacter);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    if (object.isSkinnedMesh) {
      object.geometry = paintedGeometryFor(object, type, style);
      object.material = riggedPaintMaterial;
    }
  });
  model.scale.setScalar(targetHeight / 1.8);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  model.position.y -= bounds.min.y;
  root.add(model);

  attachCharacterProps(model, type, style);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(type === "player" ? 0.38 : 0.32, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);

  const mixer = new THREE.AnimationMixer(model);
  const clip = (name, fallback) => (
    assets.animationClips.find((item) => item.name === name)
    || assets.animationClips.find((item) => item.name === fallback)
    || assets.animationClips[0]
  );
  const actions = {
    idle: mixer.clipAction(clip("Idle_Loop", "Walk_Loop")),
    walk: mixer.clipAction(clip("Walk_Loop", "Jog_Fwd_Loop")),
    turn: mixer.clipAction(clip("Walk_Formal_Loop", "Walk_Loop")),
    run: mixer.clipAction(clip(type === "player" ? "Sprint_Loop" : "Jog_Fwd_Loop", "Walk_Loop")),
    dodge: mixer.clipAction(clip("Crouch_Fwd_Loop", "Jog_Fwd_Loop")),
    hit: mixer.clipAction(clip("Hit_Chest", "Idle_Loop")),
    limit: mixer.clipAction(clip("Crouch_Idle_Loop", "Idle_Loop")),
  };
  actions.idle.play();
  root.userData.model = model;
  root.userData.mixer = mixer;
  root.userData.actions = actions;
  root.userData.activeAction = actions.idle;
  root.userData.motion = "idle";
  root.userData.isRiggedCharacter = true;
  root.userData.characterType = type;
  root.userData.visualHeight = targetHeight;
  root.userData.shadow = shadow;
  state.characterMixers.push(mixer);
  return root;
}

function setCharacterMotion(character, motion, fade = 0.18) {
  const actions = character?.userData.actions;
  const next = actions?.[motion] || actions?.idle;
  if (!next || next === character.userData.activeAction) return;
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
  character.userData.activeAction?.fadeOut(fade);
  character.userData.activeAction = next;
  character.userData.motion = motion;
}

function addEnemyWarningRing(obj) {
  const warn = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.62, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff3b2f,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.035;
  warn.visible = false;
  obj.add(warn);
  obj.userData.warn = warn;
}

function addPlayerReadabilityRig(obj) {
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x69e4ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.61, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.045;
  ring.renderOrder = 12;
  obj.add(ring);

  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xfff04f,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false,
  });
  const marker = new THREE.Group();
  marker.position.set(0.34, PLAYER_H + 0.52, 0.04);
  marker.rotation.y = Math.PI / 4;
  marker.renderOrder = 13;
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), markerMat);
  beacon.renderOrder = 13;
  marker.add(beacon);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.24, 0.045),
    new THREE.MeshBasicMaterial({
      color: 0xe94335,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    }),
  );
  bar.position.y = -0.24;
  bar.renderOrder = 13;
  marker.add(bar);
  obj.add(marker);

  obj.userData.readabilityRing = ring;
  obj.userData.readabilityMarker = marker;
}

// ===== ゲームステート =====
const initialProgress = loadProgress();
const state = {
  mode: "title",
  stageIndex: 0,
  timeLeft: 0,
  dignity: 100,
  cleared: initialProgress.bestRecords.map(Boolean),
  progress: initialProgress,
  player: {
    x: 0, z: 0, angle: 0, targetAngle: 0,
    velocityX: 0, velocityZ: 0, speed: PLAYER_SPEED, moving: false,
  },
  enemies: [],
  stageObj: null,
  playerObj: null,
  enemyObjs: [],
  characterMixers: [],
  effects: [],
  cameraYaw: null,
  cameraPitch: CAMERA_PITCH,
  cameraDistance: CAMERA_DISTANCE,
  runStats: null,
  keys: { left: false, right: false, forward: false, back: false, dodge: false },
  hitTimer: 0,
  wallBumpCooldown: 0,
  dodgeTime: 0,
  dodgeDuration: 0,
  dodgeCooldown: 0,
  dodgeDir: 1,
  dodgeVectorX: 0,
  dodgeVectorZ: 0,
  dodgeId: 0,
  dodgeSuccessTimer: 0,
  messageTimer: 0,
  goalFound: false,
  hintCooldown: 0,
  paused: false,
  perfFrames: 0,
  perfElapsed: 0,
  measuredFps: 0,
  maxEnemyFacingError: 0,
};

// ===== UI =====
function isStageUnlocked(index) {
  return Number.isInteger(index) && index >= 0 && index <= state.progress.highestUnlocked;
}

function calculateRunRank(stage, stats, timeLeft) {
  const timeRatio = Math.max(0, Math.min(1, timeLeft / Math.max(stage.time, 1)));
  const score = 82 + timeRatio * 25
    - (stats?.hits || 0) * 10
    - (stats?.wallBumps || 0) * 1.2
    + Math.min(stats?.dodges || 0, 6) * 2;
  if (score >= 106) return "S";
  if (score >= 86) return "A";
  if (score >= 70) return "B";
  return "C";
}

function updateProgressAfterClear() {
  const index = state.stageIndex;
  const stage = STAGES[index];
  const rank = calculateRunRank(stage, state.runStats, state.timeLeft);
  const previous = state.progress.bestRecords[index];
  const previousRankIndex = previous ? RANK_ORDER.indexOf(previous.rank) : -1;
  const rankIndex = RANK_ORDER.indexOf(rank);
  state.progress.bestRecords[index] = {
    rank: rankIndex > previousRankIndex ? rank : (previous?.rank || rank),
    timeLeft: Math.max(previous?.timeLeft || 0, Math.round(Math.max(0, state.timeLeft) * 10) / 10),
  };
  state.progress.highestUnlocked = Math.max(
    state.progress.highestUnlocked,
    Math.min(STAGES.length - 1, index + 1),
  );
  state.cleared[index] = true;
  saveProgress(state.progress);
  return rank;
}

function buildStageList() {
  if (!stageList) return;
  stageList.innerHTML = "";
  STAGES.forEach((stage, idx) => {
    const li = document.createElement("li");
    const locked = !isStageUnlocked(idx);
    const best = state.progress.bestRecords[idx];
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = locked;
    button.dataset.stage = String(idx);
    button.setAttribute("aria-label", locked ? `STAGE ${idx + 1} 未解放` : `STAGE ${idx + 1} ${stage.name}を開始`);
    button.innerHTML = `
      <b class="stage-number">${String(idx + 1).padStart(2, "0")}</b>
      <span class="stage-list-copy"><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.note)} / ${escapeHtml(stage.behaviors[0])}</small></span>
      <span class="stage-record">
        <span>${locked ? "LOCKED" : (best ? `RANK ${best.rank}` : "READY")}</span>
        <span>${best ? `BEST ${best.timeLeft.toFixed(1)}s` : "NO RECORD"}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      if (state.mode === "title" || state.mode === "clear" || state.mode === "gameover") {
        startStage(idx);
      }
    });
    li.classList.toggle("locked", locked);
    li.classList.toggle("cleared", Boolean(best));
    li.appendChild(button);
    stageList.appendChild(li);
  });
  updateStageList();
}

function updateStageList() {
  if (!stageList) return;
  [...stageList.children].forEach((item, idx) => {
    item.classList.toggle("current", idx === state.stageIndex && state.mode !== "title");
    item.classList.toggle("cleared", state.cleared[idx]);
    item.classList.toggle("locked", !isStageUnlocked(idx));
  });
}

function resetInputState() {
  state.keys.left = false;
  state.keys.right = false;
  state.keys.forward = false;
  state.keys.back = false;
  state.keys.dodge = false;
  mobileInput.set(0, 0);
  if (stickKnob) stickKnob.style.transform = "translate(0, 0)";
  dodgeBtn?.classList.remove("is-held", "is-active", "is-cooldown");
}

function setPaused(paused) {
  const active = Boolean(paused && state.mode === "playing");
  state.paused = active;
  if (active) resetInputState();
  if (pauseLayer) {
    pauseLayer.hidden = !active;
    pauseLayer.setAttribute("aria-hidden", String(!active));
  }
  if (pauseButton) pauseButton.setAttribute("aria-label", active ? "ゲームを再開" : "一時停止");
}

function createEnemyRoute(stage, startCell, index) {
  const candidates = stage.open.filter((cell) => {
    const distance = Math.abs(cell.x - startCell.x) + Math.abs(cell.z - startCell.z);
    const goalDistance = Math.abs(cell.x - stage.goal.x) + Math.abs(cell.z - stage.goal.z);
    return distance >= 7 && goalDistance >= 2;
  });
  const fallback = stage.open.filter((cell) => (
    Math.abs(cell.x - startCell.x) + Math.abs(cell.z - startCell.z) >= 3
  ));
  const pool = candidates.length > 0 ? candidates : fallback;
  const destination = pool[(index * 11 + stage.index * 7 + 3) % Math.max(pool.length, 1)] || startCell;
  const cells = shortestPath(stage, startCell, destination);
  const route = (cells.length > 1 ? cells : [startCell]).map((cell) => ({
    x: cell.x + 0.5,
    z: cell.z + 0.5,
  }));
  if (route.length === 1) route.push({ x: route[0].x, z: route[0].z + 0.25 });
  return route;
}

// ===== ステージ開始 =====
function startStage(index) {
  const stage = STAGES[index];
  if (!stage) return;
  if (!isStageUnlocked(index)) {
    if (boardStatus) boardStatus.textContent = `STAGE ${index + 1} LOCKED`;
    return;
  }

  // ゴール位置を毎ラン抽選（迷路を探索してトイレを見つけるゲームにする）
  pickStageGoal(stage);
  state.goalFound = false;
  state.hintCooldown = 0;

  if (state.stageObj) scene.remove(state.stageObj);
  state.stageObj = buildStage(stage);
  scene.add(state.stageObj);

  if (state.playerObj) scene.remove(state.playerObj);
  state.enemyObjs.forEach((enemy) => scene.remove(enemy));
  state.characterMixers = [];

  // プレイヤー
  state.playerObj = createCharacter("player", PLAYER_H);
  addPlayerReadabilityRig(state.playerObj);
  scene.add(state.playerObj);

  // 敵
  state.effects.forEach((fx) => scene.remove(fx));
  state.effects = [];
  state.enemyObjs = [];
  state.enemies = [];
  const stageOpen = stage.open.filter((c) => {
    if (c.x === stage.start.x && c.z === stage.start.z) return false;
    const startDist = Math.abs(c.x - stage.start.x) + Math.abs(c.z - stage.start.z);
    return startDist >= 6;
  });
  const routeCells = guidancePath(stage).filter((c) => {
    const startDist = Math.abs(c.x - stage.start.x) + Math.abs(c.z - stage.start.z);
    const goalDist = Math.abs(c.x - stage.goal.x) + Math.abs(c.z - stage.goal.z);
    return startDist >= 6 && goalDist >= 2;
  });
  const usedEnemyCells = new Set();
  for (let i = 0; i < stage.enemyCount; i++) {
    const typeKey = stage.pool[i % stage.pool.length];
    const def = ENEMY_DEFS[typeKey];
    const preferRoute = routeCells.length > 0 && i < Math.ceil(stage.enemyCount * 0.55);
    const source = preferRoute ? routeCells : stageOpen;
    let cell = source[(i * 5 + stage.index * 3 + 4) % Math.max(source.length, 1)] || stage.open[0];
    for (let retry = 0; retry < source.length; retry++) {
      const candidate = source[(i * 5 + stage.index * 3 + 4 + retry * 3) % source.length];
      if (!usedEnemyCells.has(cellKey(candidate.x, candidate.z))) {
        cell = candidate;
        break;
      }
    }
    usedEnemyCells.add(cellKey(cell.x, cell.z));
    const behavior = stage.behaviors[i % stage.behaviors.length];
    const route = createEnemyRoute(stage, cell, i);
    const nextPoint = route[1] || route[0] || { x: cell.x + 0.5, z: cell.z + 1.5 };
    const initialDx = nextPoint.x - (cell.x + 0.5);
    const initialDz = nextPoint.z - (cell.z + 0.5);
    const initialYaw = Math.atan2(initialDx, initialDz);
    const enemy = {
      type: typeKey,
      x: cell.x + 0.5,
      z: cell.z + 0.5,
      dx: 0, dz: 0,
      yaw: initialYaw,
      targetYaw: initialYaw,
      speed: stage.enemySpeed * def.speedMul,
      def, behavior,
      route,
      routeIndex: route.length > 1 ? 1 : 0,
      routeDirection: 1,
      pauseTimer: behavior === "blocker" ? rand(0.3, 1.0) : 0,
    };
    state.enemies.push(enemy);
    const obj = createCharacter(typeKey, typeKey === "traveler" ? 1.7 : 1.66);
    addEnemyWarningRing(obj);
    const wp = gridToWorld(enemy.x - 0.5, enemy.z - 0.5);
    obj.position.copy(wp);
    obj.rotation.y = enemy.yaw;
    scene.add(obj);
    state.enemyObjs.push(obj);
  }

  // プレイヤー初期
  const sp = stage.start;
  const initDirIdx = startDirFor(stage);
  const initAngle = DIRS[initDirIdx].angle;
  Object.assign(state.player, {
    x: sp.x + 0.5, z: sp.z + 0.5,
    angle: initAngle,
    targetAngle: initAngle,
    velocityX: 0, velocityZ: 0,
    speed: PLAYER_SPEED,
    moving: false,
  });

  state.mode = "playing";
  state.stageIndex = index;
  state.timeLeft = stage.time;
  state.dignity = 100;
  state.hitTimer = 0;
  state.wallBumpCooldown = 0;
  state.dodgeTime = 0;
  state.dodgeDuration = 0;
  state.dodgeCooldown = 0;
  state.dodgeDir = 1;
  state.dodgeVectorX = 0;
  state.dodgeVectorZ = 0;
  state.dodgeId = 0;
  state.dodgeSuccessTimer = 0;
  state.messageTimer = 0;
  state.maxEnemyFacingError = 0;
  state.cameraYaw = initAngle + Math.PI;
  state.cameraPitch = CAMERA_PITCH;
  state.cameraDistance = CAMERA_DISTANCE;
  state.runStats = {
    stageIndex: index,
    stageName: stage.name,
    startedAt: performance.now(),
    steps: 0,
    turns: 0,
    hits: 0,
    dodges: 0,
    wallBumps: 0,
    lastHitPenalty: 0,
    lastCause: "",
  };
  setPaused(false);
  resetInputState();

  applyStageCamera(stage);
  hideOverlay();
  if (stageNo) stageNo.textContent = `STAGE ${index + 1}`;
  if (stageName) stageName.textContent = stage.name;
  if (boardStatus) boardStatus.textContent = `STAGE ${index + 1} 進行中`;
  let skinnedCount = 0;
  scene.traverse((object) => { if (object.isSkinnedMesh) skinnedCount += 1; });
  document.body.dataset.skinnedCount = String(skinnedCount);
  updateStageList();
}

// ===== 入力 =====
function setHeld(k, on) {
  if (k in state.keys) state.keys[k] = on;
}

function tryAction(action) {
  if (state.mode !== "playing" || state.paused) return;
  if (action === "dodge") startDodge();
}

function readMovementInput() {
  let forward = (state.keys.forward ? 1 : 0) - (state.keys.back ? 1 : 0) - mobileInput.y;
  let side = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0) + mobileInput.x;
  const testMove = localTestParams?.get("testMove");
  if (testMove === "forward") forward = 1;
  else if (testMove === "back") forward = -1;
  else if (testMove === "right") side = 1;
  else if (testMove === "left") side = -1;
  moveInput.set(side, forward);
  if (moveInput.lengthSq() > 1) moveInput.normalize();
  return moveInput;
}

function canOccupy(stage, x, z, radius = PLAYER_RADIUS) {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minZ = Math.floor(z - radius);
  const maxZ = Math.floor(z + radius);
  for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      if (!isWall(stage, cellX, cellZ)) continue;
      const nearestX = clamp(x, cellX, cellX + 1);
      const nearestZ = clamp(z, cellZ, cellZ + 1);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
  }
  return true;
}

function moveWithCollisions(stage, entity, dx, dz, radius) {
  let movedX = false;
  let movedZ = false;
  if (Math.abs(dx) > 0.000001 && canOccupy(stage, entity.x + dx, entity.z, radius)) {
    entity.x += dx;
    movedX = true;
  }
  if (Math.abs(dz) > 0.000001 && canOccupy(stage, entity.x, entity.z + dz, radius)) {
    entity.z += dz;
    movedZ = true;
  }
  return { movedX, movedZ, blocked: (Math.abs(dx) > 0.000001 && !movedX) || (Math.abs(dz) > 0.000001 && !movedZ) };
}

function startDodge() {
  if (state.dodgeCooldown > 0 || state.dodgeDuration > 0) {
    if (boardStatus && state.messageTimer <= 0) boardStatus.textContent = "回避はまだ使えない";
    state.messageTimer = Math.max(state.messageTimer, 0.35);
    return;
  }
  state.dodgeTime = 0;
  state.dodgeDuration = DODGE_DURATION;
  state.dodgeCooldown = DODGE_COOLDOWN;
  state.dodgeDir = chooseDodgeSide();
  const facingX = Math.sin(state.player.angle);
  const facingZ = Math.cos(state.player.angle);
  state.dodgeVectorX = -facingZ * state.dodgeDir;
  state.dodgeVectorZ = facingX * state.dodgeDir;
  state.dodgeId += 1;
  state.dodgeSuccessTimer = 0;
  state.messageTimer = 0.45;
  if (boardStatus) boardStatus.textContent = "回避！";
}

function chooseDodgeSide() {
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const facingX = Math.sin(p.angle);
  const facingZ = Math.cos(p.angle);
  const rightX = -facingZ;
  const rightZ = facingX;
  const rightOpen = canOccupy(stage, p.x + rightX * 0.7, p.z + rightZ * 0.7);
  const leftOpen = canOccupy(stage, p.x - rightX * 0.7, p.z - rightZ * 0.7);
  if (rightOpen && !leftOpen) return 1;
  if (leftOpen && !rightOpen) return -1;
  return state.dodgeDir === 1 ? -1 : 1;
}

function isDodgeWindowActive() {
  return state.dodgeDuration > 0 &&
    state.dodgeTime >= DODGE_STARTUP &&
    state.dodgeTime <= DODGE_STARTUP + DODGE_WINDOW;
}

function dodgeOffsetCells() {
  if (state.dodgeDuration <= 0) return { x: 0, z: 0, phase: 0 };
  const t = Math.min(state.dodgeTime / DODGE_DURATION, 1);
  const phase = Math.sin(t * Math.PI);
  return { x: 0, z: 0, phase };
}

// ===== ループ =====
let lastTs = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastTs) / 1000);
  lastTs = now;
  if (state.mode === "playing" && !state.paused) {
    updatePlayer(dt);
    updateEnemies(dt);
    state.characterMixers.forEach((mixer) => mixer.update(dt));
    updateCamera(dt);
    updateTimerAndDignity(dt);
    updateHUD();
    checkCollisions();
    updateGoalDiscovery(dt);
    checkGoal();
    updateEffects(dt);
    if (state.hitTimer > 0) state.hitTimer -= dt;
    if (state.wallBumpCooldown > 0) state.wallBumpCooldown -= dt;
    if (state.dodgeCooldown > 0) state.dodgeCooldown = Math.max(0, state.dodgeCooldown - dt);
    if (state.dodgeSuccessTimer > 0) state.dodgeSuccessTimer = Math.max(0, state.dodgeSuccessTimer - dt);
    if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);
    document.body.dataset.playerX = state.player.x.toFixed(4);
    document.body.dataset.playerZ = state.player.z.toFixed(4);
    document.body.dataset.playerYaw = state.player.angle.toFixed(4);
    document.body.dataset.cameraYaw = state.cameraYaw.toFixed(4);
    document.body.dataset.playerMotion = state.playerObj?.userData.motion || "idle";
    document.body.dataset.enemyCount = String(state.enemies.length);
    document.body.dataset.riggedCount = String(state.characterMixers.length);
    const facingErrors = state.enemies
      .filter((enemy) => Math.hypot(enemy.dx, enemy.dz) > 0.02)
      .map((enemy) => Math.abs(angleDelta(enemy.yaw, Math.atan2(enemy.dx, enemy.dz))));
    const frameFacingError = facingErrors.length ? Math.max(...facingErrors) : 0;
    state.maxEnemyFacingError = Math.max(state.maxEnemyFacingError, frameFacingError);
    document.body.dataset.enemyFacingError = frameFacingError.toFixed(4);
    document.body.dataset.maxEnemyFacingError = state.maxEnemyFacingError.toFixed(4);
  }
  state.perfFrames += 1;
  state.perfElapsed += dt;
  if (state.perfElapsed >= 1) {
    state.measuredFps = state.perfFrames / state.perfElapsed;
    document.body.dataset.fps = state.measuredFps.toFixed(1);
    state.perfFrames = 0;
    state.perfElapsed = 0;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function updatePlayer(dt) {
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const input = readMovementInput();
  const cameraForwardX = -Math.sin(state.cameraYaw);
  const cameraForwardZ = -Math.cos(state.cameraYaw);
  const cameraRightX = -cameraForwardZ;
  const cameraRightZ = cameraForwardX;
  let moveX = cameraForwardX * input.y + cameraRightX * input.x;
  let moveZ = cameraForwardZ * input.y + cameraRightZ * input.x;
  const inputLength = Math.hypot(moveX, moveZ);
  if (inputLength > 0.001) {
    moveX /= inputLength;
    moveZ /= inputLength;
    const nextAngle = Math.atan2(moveX, moveZ);
    if (Math.abs(angleDelta(p.targetAngle, nextAngle)) > 0.55 && state.runStats) state.runStats.turns += 1;
    p.targetAngle = nextAngle;
  } else {
    moveX = 0;
    moveZ = 0;
  }

  if (state.dodgeDuration > 0) {
    state.dodgeTime += dt;
    if (state.dodgeTime >= state.dodgeDuration) {
      state.dodgeDuration = 0;
      state.dodgeTime = 0;
    }
  }

  const dodge = dodgeOffsetCells();
  const dashX = state.dodgeDuration > 0 ? state.dodgeVectorX * DODGE_SPEED * dodge.phase : 0;
  const dashZ = state.dodgeDuration > 0 ? state.dodgeVectorZ * DODGE_SPEED * dodge.phase : 0;
  const desiredX = moveX * p.speed + dashX;
  const desiredZ = moveZ * p.speed + dashZ;
  const previousX = p.x;
  const previousZ = p.z;
  const collision = moveWithCollisions(stage, p, desiredX * dt, desiredZ * dt, PLAYER_RADIUS);
  const actualX = p.x - previousX;
  const actualZ = p.z - previousZ;
  const actualDistance = Math.hypot(actualX, actualZ);
  p.velocityX = dt > 0 ? actualX / dt : 0;
  p.velocityZ = dt > 0 ? actualZ / dt : 0;
  p.moving = actualDistance > 0.0001;
  if (state.runStats) state.runStats.steps += actualDistance * CELL;
  if (collision.blocked && state.wallBumpCooldown <= 0) {
    state.wallBumpCooldown = 0.3;
    if (state.runStats) state.runStats.wallBumps += 1;
    if (boardStatus) boardStatus.textContent = "進路を塞ぐ設備。別方向へ回れ";
  } else if (p.moving && state.messageTimer <= 0 && boardStatus) {
    boardStatus.textContent = `STAGE ${state.stageIndex + 1} 進行中`;
  }
  p.angle += angleDelta(p.angle, p.targetAngle) * Math.min(1, dt * PLAYER_TURN_SPEED);

  if (state.playerObj) {
    const wp = gridToWorld(p.x - 0.5, p.z - 0.5);
    state.playerObj.position.x = wp.x;
    state.playerObj.position.z = wp.z;
    state.playerObj.position.y = dodge.phase * 0.025;
    state.playerObj.rotation.y = p.angle;
    state.playerObj.rotation.z = -state.dodgeDir * dodge.phase * 0.1;
    if (state.hitTimer > 0) {
      state.playerObj.position.x += Math.sin(performance.now() / 25) * 0.05 * state.hitTimer;
    }
    if (state.dodgeDuration <= 0) state.playerObj.rotation.z = 0;
    const playerTurnError = Math.abs(angleDelta(p.angle, p.targetAngle));
    const motion = state.hitTimer > 0
      ? "hit"
      : state.dodgeDuration > 0
        ? "dodge"
        : p.moving
          ? "run"
          : playerTurnError > 0.06
            ? "turn"
            : state.dignity < 28 ? "limit" : "idle";
    setCharacterMotion(state.playerObj, motion);
    if (state.playerObj.userData.readabilityMarker) {
      const marker = state.playerObj.userData.readabilityMarker;
      const markerTop = state.playerObj.userData.visualHeight || PLAYER_H;
      marker.position.y = markerTop + 0.26 + Math.sin(performance.now() / 120) * 0.055;
      marker.rotation.y += dt * 2.6;
    }
    if (state.playerObj.userData.readabilityRing) {
      const ring = state.playerObj.userData.readabilityRing;
      ring.material.opacity = 0.42 + Math.sin(performance.now() / 110) * 0.08;
    }
  }
}

function enemyPursuitTarget(stage, enemy) {
  if (enemy.behavior !== "sprinter" && enemy.behavior !== "ambush") return null;
  if (enemy.behavior === "ambush" && !state.player.moving) return null;
  const dx = state.player.x - enemy.x;
  const dz = state.player.z - enemy.z;
  const distance = Math.hypot(dx, dz);
  const range = enemy.behavior === "sprinter" ? 6.5 : 5.2;
  if (distance < 1.1 || distance > range) return null;
  const samples = Math.ceil(distance / 0.24);
  for (let index = 1; index < samples; index += 1) {
    const t = index / samples;
    if (!canOccupy(stage, enemy.x + dx * t, enemy.z + dz * t, Math.min(enemy.def.radius, 0.28))) return null;
  }
  return { x: state.player.x, z: state.player.z };
}

function updateEnemies(dt) {
  const stage = STAGES[state.stageIndex];
  state.enemies.forEach((e, idx) => {
    const route = e.route;
    if (!route || route.length < 2) return;
    if (e.pauseTimer > 0) e.pauseTimer -= dt;
    const pursuitTarget = enemyPursuitTarget(stage, e);
    let target = pursuitTarget || route[e.routeIndex];
    let toTargetX = target.x - e.x;
    let toTargetZ = target.z - e.z;
    let distance = Math.hypot(toTargetX, toTargetZ);
    if (!pursuitTarget && distance < 0.045) {
      if ((e.routeDirection > 0 && e.routeIndex >= route.length - 1)
        || (e.routeDirection < 0 && e.routeIndex <= 0)) {
        e.routeDirection *= -1;
        if (e.behavior === "blocker") e.pauseTimer = rand(0.55, 1.15);
      }
      e.routeIndex = clamp(e.routeIndex + e.routeDirection, 0, route.length - 1);
      target = route[e.routeIndex];
      toTargetX = target.x - e.x;
      toTargetZ = target.z - e.z;
      distance = Math.hypot(toTargetX, toTargetZ);
    }
    if (distance > 0.0001) {
      toTargetX /= distance;
      toTargetZ /= distance;
      e.targetYaw = Math.atan2(toTargetX, toTargetZ);
    }
    const turnDelta = angleDelta(e.yaw, e.targetYaw);
    e.yaw += turnDelta * Math.min(1, dt * ENEMY_TURN_SPEED);
    const facingTarget = Math.abs(turnDelta) < 0.28;
    const speedMul = e.behavior === "blocker" ? 0.3 :
                     e.behavior === "sprinter" ? 1.35 :
                     e.behavior === "ambush" ? 1.16 : 1.0;
    const previousX = e.x;
    const previousZ = e.z;
    if (facingTarget && e.pauseTimer <= 0 && distance > 0.001) {
      const travel = Math.min(distance, e.speed * speedMul * dt);
      const result = moveWithCollisions(stage, e, toTargetX * travel, toTargetZ * travel, Math.min(e.def.radius, 0.32));
      if (result.blocked) e.routeDirection *= -1;
    }
    let actualDx = dt > 0 ? (e.x - previousX) / dt : 0;
    let actualDz = dt > 0 ? (e.z - previousZ) / dt : 0;
    if (Math.hypot(actualDx, actualDz) > 0.02) {
      const actualYaw = Math.atan2(actualDx, actualDz);
      if (Math.abs(angleDelta(e.yaw, actualYaw)) > 0.28) {
        e.x = previousX;
        e.z = previousZ;
        e.targetYaw = actualYaw;
        actualDx = 0;
        actualDz = 0;
      }
    }
    e.dx = actualDx;
    e.dz = actualDz;
    const moved = Math.hypot(e.dx, e.dz) > 0.02;

    const obj = state.enemyObjs[idx];
    if (obj) {
      const wp = gridToWorld(e.x - 0.5, e.z - 0.5);
      obj.position.x = wp.x;
      obj.position.z = wp.z;
      obj.position.y = 0;
      obj.rotation.y = e.yaw;
      if (obj.userData.warn) {
        const dxp = e.x - state.player.x;
        const dzp = e.z - state.player.z;
        const near = dxp * dxp + dzp * dzp < 3.2;
        obj.userData.warn.visible = near;
        obj.userData.warn.material.opacity = isDodgeWindowActive() ? 0.18 : 0.5 + Math.sin(performance.now() / 80) * 0.18;
      }
      const enemyTurnError = Math.abs(angleDelta(e.yaw, e.targetYaw));
      const enemyMotion = moved
        ? (e.behavior === "blocker" ? "walk" : "run")
        : enemyTurnError > 0.06 ? "turn" : "idle";
      setCharacterMotion(obj, enemyMotion);
    }
  });
}

function updateCamera(dt = 0, snap = false) {
  if (!state.playerObj || state.mode !== "playing") return;
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const pWorld = gridToWorld(p.x - 0.5, p.z - 0.5);
  const mapW = stage.width * CELL;
  const mapD = stage.height * CELL;
  const margin = state.cameraDistance + CELL;
  if (snap || state.cameraYaw === null || !Number.isFinite(state.cameraYaw)) state.cameraYaw = p.angle + Math.PI;
  else if (p.moving && !draggingCamera) {
    state.cameraYaw = lerpAngle(state.cameraYaw, p.angle + Math.PI, Math.min(1, dt * 0.16));
  }
  const horizontalDistance = Math.cos(state.cameraPitch) * state.cameraDistance;
  const ax = Math.sin(state.cameraYaw);
  const az = Math.cos(state.cameraYaw);

  cameraDesired.set(
    clamp(pWorld.x + ax * horizontalDistance, -margin, mapW + margin),
    CAMERA_LOOK_HEIGHT + Math.sin(state.cameraPitch) * state.cameraDistance,
    clamp(pWorld.z + az * horizontalDistance, -margin, mapD + margin),
  );
  cameraLookAt.set(
    pWorld.x,
    CAMERA_LOOK_HEIGHT,
    pWorld.z,
  );

  if (snap) camera.position.copy(cameraDesired);
  else camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * 7.5));
  camera.lookAt(cameraLookAt);
  updateWallVisibility(stage, pWorld);
}

function updateWallVisibility(stage, playerWorld) {
  const blocks = state.stageObj?.userData.wallBlocks;
  const zoneObstacles = state.stageObj?.userData.zoneObstacles;
  if (!blocks || !zoneObstacles) return;
  const cameraWorld = camera.position;
  for (const block of blocks) {
    const wx = block.x * CELL + CELL / 2;
    const wz = block.z * CELL + CELL / 2;
    const dPlayer = Math.hypot(wx - playerWorld.x, wz - playerWorld.z);
    const dCamera = Math.hypot(wx - cameraWorld.x, wz - cameraWorld.z);
    const dSight = pointSegmentDistance2D(wx, wz, cameraWorld.x, cameraWorld.z, playerWorld.x, playerWorld.z);
    const nearPlayer = dPlayer < WALL_FADE_NEAR_PLAYER;
    const nearCamera = dCamera < WALL_FADE_NEAR_CAMERA;
    const blocksSight = dSight < 1.15
      && dPlayer < state.cameraDistance + 1.3
      && dCamera < state.cameraDistance + 1.5;
    const opacity = nearPlayer || nearCamera || blocksSight ? WALL_FADE_OPACITY : 0.98;
    const visibleShadow = opacity > 0.6;
    block.meshes.forEach((mesh) => {
      mesh.material.opacity += (opacity - mesh.material.opacity) * 0.3;
      mesh.material.depthWrite = mesh.material.opacity > 0.65;
      mesh.castShadow = visibleShadow;
    });
  }
  for (const obstacle of zoneObstacles) {
    const wx = obstacle.x * CELL + CELL / 2;
    const wz = obstacle.z * CELL + CELL / 2;
    const dPlayer = Math.hypot(wx - playerWorld.x, wz - playerWorld.z);
    const dCamera = Math.hypot(wx - cameraWorld.x, wz - cameraWorld.z);
    const dSight = pointSegmentDistance2D(wx, wz, cameraWorld.x, cameraWorld.z, playerWorld.x, playerWorld.z);
    obstacle.group.visible = !(dSight < 0.82
      && dPlayer < state.cameraDistance + 1.2
      && dCamera < state.cameraDistance + 1.5);
  }
}

function pointSegmentDistance2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const denom = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / denom));
  const qx = ax + abx * t;
  const qz = az + abz * t;
  return Math.hypot(px - qx, pz - qz);
}

function updateTimerAndDignity(dt) {
  const stage = STAGES[state.stageIndex];
  state.timeLeft -= dt;
  state.dignity -= stage.drain * dt;
  if (state.timeLeft <= 0 || state.dignity <= 0) {
    const reason = state.timeLeft <= 0 ? "time" : (state.runStats?.lastCause || "dignity");
    state.timeLeft = Math.max(0, state.timeLeft);
    state.dignity = Math.max(0, state.dignity);
    gameOver(reason);
  }
}

function updateHUD() {
  if (timeValue) timeValue.textContent = state.timeLeft.toFixed(1);
  if (dignityFill) dignityFill.style.width = `${Math.max(0, Math.min(100, state.dignity))}%`;
  if (dignityValue) dignityValue.textContent = `${Math.round(Math.max(0, Math.min(100, state.dignity)))}%`;
  const stage = STAGES[state.stageIndex];
  if (hud) hud.classList.toggle("danger", state.timeLeft <= 10 || state.dignity <= 30);
  // トイレゲージは「扉を目視で発見」するまで機能しない（探索ゲーム性）
  if (!state.goalFound) {
    if (distanceFill) distanceFill.style.width = "0%";
    if (distanceValue) distanceValue.textContent = "トイレ ？？？（案内板を探せ）";
    routeHud?.classList.add("searching");
  } else {
    routeHud?.classList.remove("searching");
    const totalDist = Math.hypot(stage.goal.x - stage.start.x, stage.goal.z - stage.start.z);
    const curDist = Math.hypot(stage.goal.x - (state.player.x - 0.5), stage.goal.z - (state.player.z - 0.5));
    const pct = totalDist > 0 ? (1 - curDist / totalDist) * 100 : 0;
    const clampedPct = Math.max(0, Math.min(100, pct));
    if (distanceFill) distanceFill.style.width = `${clampedPct}%`;
    if (distanceValue) distanceValue.textContent = `トイレまで ${Math.max(0, Math.round(100 - clampedPct))}%`;
  }
  if (facePortrait) {
    let src = "./assets/sprites/face-normal.png";
    if (state.dignity < 30) src = "./assets/sprites/face-limit.png";
    else if (state.dignity < 60) src = "./assets/sprites/face-panic.png";
    if (!facePortrait.src.endsWith(src.split("/").pop())) facePortrait.src = src;
  }
  if (dodgeBtn) {
    const cooling = state.dodgeCooldown > 0 && state.dodgeDuration <= 0;
    const pct = cooling ? `${(1 - state.dodgeCooldown / DODGE_COOLDOWN) * 100}%` : "0%";
    dodgeBtn.style.setProperty("--cooldown", pct);
    dodgeBtn.classList.toggle("is-active", isDodgeWindowActive());
    dodgeBtn.classList.toggle("is-cooldown", cooling);
  }
}

function checkCollisions() {
  if (state.hitTimer > 0) return;
  const stage = STAGES[state.stageIndex];
  const offset = dodgeOffsetCells();
  const px = state.player.x + offset.x;
  const pz = state.player.z + offset.z;
  for (const e of state.enemies) {
    const d2 = (e.x - px) ** 2 + (e.z - pz) ** 2;
    const r = e.def.hitRadius + 0.18;
    if (isDodgeWindowActive() && d2 < DODGE_SUCCESS_RADIUS * DODGE_SUCCESS_RADIUS) {
      registerDodgeSuccess(e);
      continue;
    }
    if (d2 < r * r) {
      state.dignity -= stage.hitPenalty;
      if (state.runStats) {
        state.runStats.hits += 1;
        state.runStats.lastHitPenalty = stage.hitPenalty;
        state.runStats.lastCause = "hit";
      }
      state.hitTimer = 0.6;
      state.messageTimer = 0.6;
      if (boardStatus) boardStatus.textContent = `接触！ 我慢 -${stage.hitPenalty}`;
      triggerImpactFeedback(e, stage.hitPenalty);
      if (state.dignity <= 0) {
        state.dignity = 0;
        gameOver("hit");
      }
      break;
    }
  }
}

function triggerImpactFeedback(enemy, penalty) {
  if (impactTitle) impactTitle.textContent = "接触!";
  if (impactDetail) impactDetail.textContent = `我慢 -${penalty}`;
  restartCssAnimation(cabinet, "is-impact");
  restartCssAnimation(impactLayer, "is-impact");
  spawnImpactBurst(enemy);
}

function restartCssAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function spawnImpactBurst(enemy) {
  const px = state.playerObj?.position.x ?? 0;
  const pz = state.playerObj?.position.z ?? 0;
  const enemyWorld = gridToWorld(enemy.x - 0.5, enemy.z - 0.5);
  const group = new THREE.Group();
  group.userData.age = 0;
  group.userData.ttl = 0.62;
  group.position.set((px + enemyWorld.x) / 2, 0.08, (pz + enemyWorld.z) / 2);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff3b2f,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.62, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xfff04f,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8), shockMat);
  shock.position.y = 0.42;
  group.add(shock);

  scene.add(group);
  state.effects.push(group);
}

function updateEffects(dt) {
  if (state.effects.length === 0) return;
  state.effects = state.effects.filter((fx) => {
    fx.userData.age += dt;
    const t = Math.min(fx.userData.age / fx.userData.ttl, 1);
    if (fx.userData.kind === "hintArrow") {
      // プレイヤーの頭上に追従し、方角（ワールドyaw）は保ったまま浮遊・フェード
      const px = state.playerObj?.position.x ?? fx.position.x;
      const pz = state.playerObj?.position.z ?? fx.position.z;
      fx.position.set(px, PLAYER_H + 0.75 + Math.sin(fx.userData.age * 5.2) * 0.06, pz);
      const fade = t < 0.15 ? t / 0.15 : (t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1);
      fx.children.forEach((child) => {
        if (child.material?.opacity !== undefined) child.material.opacity = fade * 0.95;
      });
      if (t >= 1) {
        scene.remove(fx);
        fx.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        return false;
      }
      return true;
    }
    const e = easeOut(t);
    fx.scale.setScalar(1 + e * 2.15);
    fx.rotation.y += dt * 4;
    fx.children.forEach((child) => {
      if (child.material?.opacity !== undefined) child.material.opacity = Math.max(0, 1 - t);
    });
    if (t >= 1) {
      scene.remove(fx);
      fx.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      return false;
    }
    return true;
  });
}

function registerDodgeSuccess(enemy) {
  if (enemy.lastDodgedId === state.dodgeId) return;
  enemy.lastDodgedId = state.dodgeId;
  enemy.routeDirection *= -1;
  enemy.routeIndex = clamp(enemy.routeIndex + enemy.routeDirection, 0, enemy.route.length - 1);
  enemy.pauseTimer = Math.max(enemy.pauseTimer, 0.24);
  if (state.runStats) state.runStats.dodges += 1;
  state.dignity = Math.min(100, state.dignity + DODGE_REWARD);
  state.dodgeSuccessTimer = 0.7;
  state.messageTimer = 0.75;
  if (boardStatus) boardStatus.textContent = "回避成功！";
}

function checkGoal() {
  const stage = STAGES[state.stageIndex];
  const gx = stage.goal.x + 0.5;
  const gz = stage.goal.z + 0.5;
  const d2 = (state.player.x - gx) ** 2 + (state.player.z - gz) ** 2;
  if (d2 < 0.55 * 0.55) clearStage();
}

// グリッド座標系での視線判定（壁を挟まず見えるか）
function hasLineOfSight(stage, fromX, fromZ, toX, toZ, maxDist) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist > maxDist) return false;
  const steps = Math.max(2, Math.ceil(dist / 0.22));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(stage, Math.floor(fromX + dx * t), Math.floor(fromZ + dz * t))) return false;
  }
  return true;
}

// カメラ基準の方角ラベル（プレイヤーに actionable なヒントを返す）
function directionLabel(dx, dz) {
  const worldYaw = Math.atan2(dx, dz);
  const relative = angleDelta(state.cameraYaw + Math.PI, worldYaw);
  const octant = Math.round(relative / (Math.PI / 4));
  const names = ["前方", "右前", "右", "右後ろ", "後方", "左後ろ", "左", "左前"];
  return names[((octant % 8) + 8) % 8];
}

function spawnHintArrow(dx, dz) {
  const group = new THREE.Group();
  group.userData.age = 0;
  group.userData.ttl = 2.1;
  group.userData.kind = "hintArrow";
  const yaw = Math.atan2(dx, dz);
  const px = state.playerObj?.position.x ?? 0;
  const pz = state.playerObj?.position.z ?? 0;
  group.position.set(px, PLAYER_H + 0.75, pz);
  group.rotation.y = yaw;
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2fbf71, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
  });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.34;
  head.renderOrder = 14;
  group.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.4), mat);
  tail.position.z = 0.02;
  tail.renderOrder = 14;
  group.add(tail);
  scene.add(group);
  state.effects.push(group);
}

function updateGoalDiscovery(dt) {
  const stage = STAGES[state.stageIndex];
  if (state.hintCooldown > 0) state.hintCooldown = Math.max(0, state.hintCooldown - dt);

  // 案内板: 近づくとトイレの方角ヒント
  const boards = state.stageObj?.userData.hintBoards || [];
  if (state.hintCooldown <= 0 && !state.goalFound) {
    for (const board of boards) {
      const d2 = (state.player.x - (board.x + 0.5)) ** 2 + (state.player.z - (board.z + 0.5)) ** 2;
      if (d2 < 1.15 * 1.15) {
        state.hintCooldown = 3.2;
        const dx = stage.goal.x + 0.5 - state.player.x;
        const dz = stage.goal.z + 0.5 - state.player.z;
        state.messageTimer = 2.6;
        if (boardStatus) boardStatus.textContent = `案内板: トイレは${directionLabel(dx, dz)}`;
        spawnHintArrow(dx, dz);
        break;
      }
    }
  }

  // 扉の目視発見
  if (!state.goalFound && hasLineOfSight(
    stage, state.player.x, state.player.z, stage.goal.x + 0.5, stage.goal.z + 0.5, 5.4,
  )) {
    state.goalFound = true;
    state.messageTimer = 2.4;
    if (boardStatus) boardStatus.textContent = "トイレの扉を発見！ 駆け込め！";
    const refs = state.stageObj?.userData.goalRefs;
    if (refs) {
      refs.light.intensity = 3.2;
      refs.light.distance = 9;
      refs.floor.material.opacity = 0.55;
    }
    if (state.runStats) state.runStats.foundAt = Math.max(0, state.timeLeft);
  }
}

function clearStage() {
  state.mode = "clear";
  const rank = updateProgressAfterClear();
  setPaused(false);
  resetInputState();
  if (boardStatus) boardStatus.textContent = "クリア！";
  buildStageList();
  showOverlay("clear", { next: state.stageIndex + 1, rank });
}

function gameOver(reason = "dignity") {
  state.mode = "gameover";
  setPaused(false);
  if (state.runStats) state.runStats.lastCause = reason;
  resetInputState();
  if (boardStatus) boardStatus.textContent = "失敗…";
  showOverlay("gameover", { reason });
}

function showOverlay(type, opts = {}) {
  if (!screenLayer) return;
  if (pageBody) pageBody.dataset.mode = type;
  screenLayer.classList.add("active");
  screenLayer.dataset.screen = type;
  screenLayer.setAttribute("aria-hidden", "false");
  renderResultScene(type, opts);
  if (type === "title") {
    if (screenTitle) screenTitle.innerHTML = "TOILET<span>我慢ゲーム</span>";
    if (screenKicker) screenKicker.textContent = "DIGNITY ESCAPE MISSION";
    if (screenCopy) screenCopy.textContent = "トイレの場所は毎回変わる。案内板を読み、人波をかわし、限界までに扉を探し出せ。5つの駅迷宮を走り抜ける尊厳防衛アクション。";
    if (screenActions) screenActions.innerHTML = `<button class="primary" data-action="start">STAGE 01 を開始</button>`;
    buildStageList();
  } else if (type === "clear") {
    if (screenTitle) screenTitle.innerHTML = "SAFE<span>尊厳は守られた</span>";
    if (screenKicker) screenKicker.textContent = `MISSION COMPLETE / STAGE ${state.stageIndex + 1}`;
    if (screenCopy) screenCopy.textContent = resultLead("clear", opts);
    if (screenActions) {
      screenActions.innerHTML = opts.next < STAGES.length
        ? `<button class="primary" data-action="next">NEXT STAGE</button><button data-action="retry">RETRY</button><button data-action="title">STAGE SELECT</button>`
        : `<button class="primary" data-action="title">STAGE SELECT</button><button data-action="retry">RETRY</button>`;
    }
  } else if (type === "gameover") {
    if (screenTitle) screenTitle.innerHTML = "FAILED<span>限界に到達</span>";
    if (screenKicker) screenKicker.textContent = `MISSION FAILED / STAGE ${state.stageIndex + 1}`;
    if (screenCopy) screenCopy.textContent = resultLead("gameover", opts);
    if (screenActions) screenActions.innerHTML = `<button class="primary" data-action="retry">RETRY</button><button data-action="title">STAGE SELECT</button>`;
  } else if (type === "error") {
    if (screenTitle) screenTitle.innerHTML = "ERROR<span>読み込み失敗</span>";
    if (screenKicker) screenKicker.textContent = "ASSET LOAD FAILURE";
    if (screenCopy) screenCopy.textContent = opts.message
      ? `3Dアセットを読み込めませんでした: ${opts.message}`
      : "3Dアセットを読み込めませんでした。通信状態を確認して再読込してください。";
    if (screenActions) screenActions.innerHTML = `<button class="primary" data-action="reload">再読込</button>`;
  }
  if (!screenActions) return;
  screenActions.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "start" || a === "retry") startStage(state.stageIndex);
      else if (a === "next") startStage(Math.min(state.stageIndex + 1, STAGES.length - 1));
      else if (a === "title") showTitle();
      else if (a === "reload") window.location.reload();
    }, { once: true });
  });
}

function renderResultScene(type, opts = {}) {
  if (!resultScene) return;
  if (type === "title" || type === "error") {
    resultScene.hidden = true;
    resultScene.innerHTML = "";
    return;
  }
  const stage = STAGES[state.stageIndex];
  const stats = resultSnapshot(opts);
  const isClear = type === "clear";
  const rank = isClear ? (opts.rank || stats.rank) : "FAIL";
  resultScene.hidden = false;
  resultScene.innerHTML = `
    <div class="result-card ${isClear ? "is-clear" : "is-fail"}">
      <div class="result-record">
        <b class="result-rank">${escapeHtml(rank)}</b>
        <div>
          <span class="result-label">RUN EVALUATION</span>
        <strong>${escapeHtml(resultHeadline(type, opts))}</strong>
        </div>
      </div>
      <dl class="result-stats">
        <div><dt>TIME LEFT</dt><dd>${stats.timeLeft}</dd></div>
        <div><dt>IMPACT</dt><dd>${stats.hits}</dd></div>
        <div><dt>DODGE</dt><dd>${stats.dodges}</dd></div>
        <div><dt>PRESSURE</dt><dd>${stats.dignity}%</dd></div>
      </dl>
      <ol class="result-log">
        <li>${escapeHtml(resultNarrative(type, opts))}</li>
        ${resultLogItems(type, opts, stage, stats).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    </div>
  `;
}

function resultSnapshot(opts = {}) {
  const stage = STAGES[state.stageIndex];
  const stats = state.runStats || {};
  const totalDist = Math.hypot(stage.goal.x - stage.start.x, stage.goal.z - stage.start.z) || 1;
  const curDist = Math.hypot(stage.goal.x - (state.player.x - 0.5), stage.goal.z - (state.player.z - 0.5));
  const progress = Math.max(0, Math.min(100, Math.round((1 - curDist / totalDist) * 100)));
  return {
    timeLeft: `${Math.max(0, state.timeLeft).toFixed(1)}s`,
    timeLeftRaw: Math.max(0, state.timeLeft),
    dignity: Math.round(Math.max(0, state.dignity)),
    hits: stats.hits ?? 0,
    dodges: stats.dodges ?? 0,
    steps: stats.steps ?? 0,
    turns: stats.turns ?? 0,
    wallBumps: stats.wallBumps ?? 0,
    progress: opts.next !== undefined && state.mode === "clear"
      ? "100%"
      : (state.goalFound ? `${progress}%` : "扉未発見"),
    rank: opts.rank || calculateRunRank(stage, stats, state.timeLeft),
  };
}

function resultLead(type, opts = {}) {
  const stats = resultSnapshot(opts);
  if (type === "clear") {
    return opts.next < STAGES.length
      ? `残り${stats.timeLeft}。通行人の流れを抜け、次の駅区画が解放された。`
      : `残り${stats.timeLeft}。全ステージを抜け切り、尊厳は守られた。`;
  }
  const cause = opts.reason || state.runStats?.lastCause || "dignity";
  if (cause === "time") return "あと少しのところで時間切れ。表示板の先に、扉だけが遠く見えた。";
  if (cause === "hit") return "通行人との接触が重なり、我慢ゲージが尽きた。";
  return "限界値を超えた。駅構内で判断が遅れた。";
}

function resultHeadline(type, opts = {}) {
  if (type === "clear") return opts.next < STAGES.length ? "扉に到達。まだ終わりではない。" : "最終扉、到達。";
  const cause = opts.reason || state.runStats?.lastCause || "dignity";
  if (cause === "time") return "タイムアップ。駅は広すぎた。";
  if (cause === "hit") return "接触連鎖。人波に飲まれた。";
  return "限界突破。集中が切れた。";
}

function resultNarrative(type, opts = {}) {
  const stage = STAGES[state.stageIndex];
  const stats = resultSnapshot(opts);
  if (type === "clear") {
    const tone = stats.hits === 0 ? "誰にもぶつからず" : `${stats.hits}回接触しながらも`;
    return `${stage.name}を${tone}突破。案内板を読み解き、トイレドアへ滑り込んだ。`;
  }
  if ((opts.reason || state.runStats?.lastCause) === "time") {
    return state.goalFound
      ? `${stage.name}で足止め。扉は見えていたのに、残り時間が0になった。`
      : `${stage.name}で迷った。扉を見つけられないまま、残り時間が0になった。`;
  }
  return `${stage.name}で人波と交錯。我慢ゲージが0になり、リトライが必要になった。`;
}

function resultLogItems(type, opts, stage, stats) {
  if (type === "clear") {
    return [
      `接触 ${stats.hits}回 / 回避成功 ${stats.dodges}回 / 壁接触 ${stats.wallBumps}回。`,
      `最高記録 RANK ${state.progress.bestRecords[state.stageIndex]?.rank || stats.rank} / BEST ${(state.progress.bestRecords[state.stageIndex]?.timeLeft || stats.timeLeftRaw).toFixed(1)}s。`,
      opts.next < STAGES.length ? `次は STAGE ${opts.next + 1}: ${STAGES[opts.next].name}。` : "全ステージ制覇。タイトルへ戻れる。",
    ];
  }
  return [
    state.goalFound ? `到達率 ${stats.progress}。扉まではまだ距離が残っている。` : "扉は未発見のまま。緑の案内板が方角を教えてくれる。",
    `接触 ${stats.hits}回 / 回避成功 ${stats.dodges}回 / 壁接触 ${stats.wallBumps}回。`,
    "次は分岐で案内板に寄り、方角を確かめてから進む。",
  ];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hideOverlay() {
  if (!screenLayer) return;
  if (pageBody) pageBody.dataset.mode = "playing";
  screenLayer.classList.remove("active");
  screenLayer.setAttribute("aria-hidden", "true");
}

function showTitle() {
  setPaused(false);
  state.mode = "title";
  state.stageIndex = 0;
  showOverlay("title");
  if (boardStatus) boardStatus.textContent = "STAGE SELECT";
  buildStageList();
}

// ===== 入力イベント =====
const KEY_MAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "forward", ArrowDown: "back",
  KeyA: "left", KeyD: "right", KeyW: "forward", KeyS: "back",
  Space: "dodge", ShiftLeft: "dodge", ShiftRight: "dodge",
};
window.addEventListener("keydown", (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) {
    if (k === "dodge" && ev.repeat) {
      ev.preventDefault();
      return;
    }
    setHeld(k, true);
    if (k === "dodge") tryAction(k);
    ev.preventDefault();
  } else if ((ev.code === "KeyP" || ev.code === "Escape") && state.mode === "playing") {
    setPaused(!state.paused);
  } else if (ev.code === "KeyC" && state.mode === "playing") {
    state.cameraYaw = state.player.angle + Math.PI;
    state.cameraPitch = CAMERA_PITCH;
    state.cameraDistance = CAMERA_DISTANCE;
  } else if (ev.code === "KeyR" && state.mode !== "title") {
    startStage(state.stageIndex);
  }
});
window.addEventListener("keyup", (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) setHeld(k, false);
});
window.addEventListener("blur", resetInputState);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.mode === "playing") setPaused(true);
});

canvas.addEventListener("pointerdown", (event) => {
  if (state.mode !== "playing" || state.paused) return;
  if (event.pointerType === "touch" && event.clientX < window.innerWidth * 0.48) return;
  draggingCamera = true;
  cameraPointerId = event.pointerId;
  previousPointerX = event.clientX;
  previousPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!draggingCamera || event.pointerId !== cameraPointerId) return;
  const dx = event.clientX - previousPointerX;
  const dy = event.clientY - previousPointerY;
  previousPointerX = event.clientX;
  previousPointerY = event.clientY;
  state.cameraYaw -= dx * 0.006;
  state.cameraPitch = clamp(state.cameraPitch + dy * 0.004, 0.17, 0.68);
});
const stopCameraDrag = (event) => {
  if (event.pointerId !== cameraPointerId) return;
  draggingCamera = false;
  cameraPointerId = null;
};
canvas.addEventListener("pointerup", stopCameraDrag);
canvas.addEventListener("pointercancel", stopCameraDrag);
canvas.addEventListener("wheel", (event) => {
  if (state.mode !== "playing") return;
  event.preventDefault();
  state.cameraDistance = clamp(state.cameraDistance + event.deltaY * 0.008, 5.6, 11.5);
}, { passive: false });

if (mobileStick && stickKnob) {
  const updateStick = (event) => {
    const rect = mobileStick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const max = Math.max(28, rect.width * 0.3);
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / length);
    const x = dx * scale;
    const y = dy * scale;
    stickKnob.style.transform = `translate(${x}px, ${y}px)`;
    mobileInput.set(x / max, y / max);
  };
  mobileStick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    joystickPointerId = event.pointerId;
    mobileStick.setPointerCapture(event.pointerId);
    updateStick(event);
  });
  mobileStick.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystickPointerId) updateStick(event);
  });
  const releaseStick = (event) => {
    if (event.pointerId !== joystickPointerId) return;
    joystickPointerId = null;
    mobileInput.set(0, 0);
    stickKnob.style.transform = "translate(0, 0)";
  };
  mobileStick.addEventListener("pointerup", releaseStick);
  mobileStick.addEventListener("pointercancel", releaseStick);
}

if (dodgeBtn) {
  const releaseDodge = () => dodgeBtn.classList.remove("is-held");
  dodgeBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dodgeBtn.classList.add("is-held");
    tryAction("dodge");
  });
  dodgeBtn.addEventListener("pointerup", releaseDodge);
  dodgeBtn.addEventListener("pointercancel", releaseDodge);
}

if (pauseButton) {
  pauseButton.addEventListener("click", () => {
    if (state.mode === "playing") setPaused(!state.paused);
  });
}

if (pauseLayer) {
  pauseLayer.querySelectorAll("[data-pause-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.pauseAction;
      if (action === "resume") setPaused(false);
      else if (action === "retry") startStage(state.stageIndex);
      else if (action === "title") showTitle();
    });
  });
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerpAngle(from, to, amount) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * amount;
}
function angleDelta(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
function rand(a, b) { return a + Math.random() * (b - a); }

// ===== 起動 =====
async function bootstrap() {
  resizeRenderer();
  buildStageList();
  showTitle();
  if (screenCopy) screenCopy.textContent = "駅構内と3Dキャラクターを読み込み中…";
  if (screenActions) screenActions.innerHTML = "";
  try {
    await loadAllAssets();
  } catch (err) {
    console.error("Asset load failed:", err);
    showOverlay("error", { message: err instanceof Error ? err.message : String(err) });
    return;
  }
  const previewValue = localTestParams?.get("previewStage");
  const previewStage = previewValue === null || previewValue === undefined ? Number.NaN : Number(previewValue);
  if (Number.isInteger(previewStage) && previewStage >= 0 && previewStage < STAGES.length) {
    state.progress.highestUnlocked = Math.max(state.progress.highestUnlocked, previewStage);
    startStage(previewStage);
    const stage = STAGES[previewStage];
    if (localTestParams?.get("testGoal") === "1") {
      state.player.x = stage.goal.x + 0.5;
      state.player.z = stage.goal.z + 0.5;
    }
    if (localTestParams?.get("testNearGoal") === "1") {
      // ゴール扉の手前に立たせ、目視発見の演出を確認する
      state.player.x = stage.goal.x + 0.5;
      state.player.z = stage.goal.z + 1.4;
    }
    if (localTestParams?.get("testHit") === "1" && state.enemies[0]) {
      state.enemies[0].x = state.player.x;
      state.enemies[0].z = state.player.z;
    }
    if (localTestParams?.get("testFail") === "time") state.timeLeft = 0.08;
  } else {
    startStage(0);
    showTitle();
  }
  requestAnimationFrame(tick);
}

bootstrap();
