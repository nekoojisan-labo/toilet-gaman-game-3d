/**
 * トイレ我慢ゲーム 3D - TPS迷路版
 *
 * 設計方針:
 * - PerspectiveCamera の三人称後方視点
 * - ステージは Three.js Box/Plane で procedural 構築（GLB stage は不使用）
 * - 当たり判定と見た目を同じグリッドから生成し、位置ズレを防ぐ
 * - 壁は迷路感が出る高さにしつつ、カメラは壁衝突を避けて追従
 * - 黄色点字ブロック・青いトイレドア・案内サインで「駅」を記号化
 * - キャラのみ Hyper3D 生成 GLB を流用
 * - キャラに進行方向回転＋上下バウンス＋丸影で接地感を出す
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// ===== 定数 =====
const CELL = 2.0;
const WALL_H = 1.7;
const PLAYER_H = 1.30;
const MOVE_DURATION = 0.28;
const BACK_DURATION = 0.34;
const TURN_DURATION = 0.18;
const INPUT_REPEAT_DELAY = 0.08;
const INPUT_BLOCK_DELAY = 0.18;
const GLB_BASE = "./assets-3d/glb";
const TEX_BASE = "./assets-3d/textures";
const CAMERA_BACK = 5.6;
const CAMERA_MIN_BACK = 2.1;
const CAMERA_HEIGHT = 3.0;
const CAMERA_LOOK_HEIGHT = 0.95;
const CAMERA_LOOK_AHEAD = 4.0;
const CAMERA_LERP = 0.22;

// 4方向: dx, dz が +Z正面前提
const DIRS = [
  { dx: 1, dz: 0, angle: Math.PI / 2 },
  { dx: 0, dz: 1, angle: 0 },
  { dx: -1, dz: 0, angle: -Math.PI / 2 },
  { dx: 0, dz: -1, angle: Math.PI },
];

// ===== ステージデータ =====
const STAGES = [
  {
    name: "ホーム迷宮", note: "降車直後", time: 26, drain: 0.65, hitPenalty: 13,
    enemyCount: 7, enemySpeed: 0.95,
    behaviors: ["patrol", "patrol", "patrol"],
    pool: ["student", "ol", "business"],
    accent: 0xf4c430, wallColor: 0x3a5570,
    map: [
      "#################",
      "#.....#........G#",
      "#.##..#.######..#",
      "#..#..#......#..#",
      "##.#.#######.#.##",
      "#..#.....#...#..#",
      "#.######.#.###..#",
      "#...............#",
      "#.#####.S.#####.#",
      "#...............#",
      "#################",
    ],
  },
  {
    name: "改札前ジグザグ", note: "スマホ歩き", time: 27, drain: 0.72, hitPenalty: 14,
    enemyCount: 8, enemySpeed: 1.0,
    behaviors: ["zigzag", "patrol", "zigzag"],
    pool: ["ol", "student", "traveler"],
    accent: 0x52b476, wallColor: 0x3e5a48,
    map: [
      "#################",
      "#...#.....#....G#",
      "###.#.###.#.###.#",
      "#...#.#...#...#.#",
      "#.###.#.#####.#.#",
      "#.....#.....#.#.#",
      "#.#########.#.#.#",
      "#.#.........#...#",
      "#.#.###.S.#####.#",
      "#...............#",
      "#################",
    ],
  },
  {
    name: "階段横の狭路", note: "キャリーケース", time: 28, drain: 0.82, hitPenalty: 15,
    enemyCount: 9, enemySpeed: 0.96,
    behaviors: ["blocker", "patrol", "zigzag"],
    pool: ["traveler", "traveler", "student", "business"],
    accent: 0xd89535, wallColor: 0x6a503a,
    map: [
      "#################",
      "#.....#...#....G#",
      "#.###.#.#.#.###.#",
      "#...#...#...#...#",
      "###.#########.###",
      "#...#.......#...#",
      "#.###.#####.###.#",
      "#.....#...#.....#",
      "#.#####.S.#####.#",
      "#...............#",
      "#################",
    ],
  },
  {
    name: "巨大ターミナル", note: "急ぐビジネスマン", time: 29, drain: 0.92, hitPenalty: 16,
    enemyCount: 11, enemySpeed: 1.08,
    behaviors: ["sprinter", "patrol", "zigzag"],
    pool: ["business", "business", "ol", "traveler"],
    accent: 0xd45c8b, wallColor: 0x584360,
    map: [
      "#################",
      "#.#.......#....G#",
      "#.#.#####.#.###.#",
      "#...#...#.#...#.#",
      "#####.#.#.###.#.#",
      "#.....#.#.....#.#",
      "#.#####.#######.#",
      "#.#.............#",
      "#.#.###.S.#####.#",
      "#...............#",
      "#################",
    ],
  },
  {
    name: "トイレ前最終防衛線", note: "目前で追跡", time: 30, drain: 1.05, hitPenalty: 18,
    enemyCount: 13, enemySpeed: 1.15,
    behaviors: ["ambush", "sprinter", "zigzag", "blocker"],
    pool: ["business", "ol", "student", "traveler"],
    accent: 0xe1463f, wallColor: 0x603a3a,
    map: [
      "#################",
      "#.....#.....#..G#",
      "###.#.#.###.#.###",
      "#...#.#...#.#...#",
      "#.###.###.#.###.#",
      "#.#.....#.#.....#",
      "#.#.###.#.#####.#",
      "#...#.........#.#",
      "#.###.#.S.###.#.#",
      "#...............#",
      "#################",
    ],
  },
].map((s, i) => ({ ...s, ...parseMap(s.map), index: i }));

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202632);
scene.fog = new THREE.Fog(0x202632, 30, 60);

// === TPS Camera ===
// プレイヤーの背後から通路を見る。迷路の圧迫感を出しつつ、壁に入らないように追従する。
const camera = new THREE.PerspectiveCamera(62, canvas.width / canvas.height, 0.1, 100);
camera.position.set(0, CAMERA_HEIGHT, 0);

// 現在のステージサイズを記録（resize時の再計算用）
let currentStageMetrics = null;
const cameraDesired = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();

function applyStageCamera(stage) {
  currentStageMetrics = { stage };
  updateCamera(true);
}

function resizeRenderer() {
  const w = canvas.clientWidth || 760;
  const h = canvas.clientHeight || 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (currentStageMetrics) updateCamera(true);
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
  charGLBs: {},  // {player, business, ol, student, traveler}
  signTex: {},   // {exit, restroom, platform, gaman, wcdoor}
};

function loadTex(file, opts = {}) {
  return new Promise((resolve) => {
    texLoader.load(`${TEX_BASE}/${file}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
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
  // キャラGLB
  const charFiles = {
    player: "player-businessman.glb",
    business: "enemy-business.glb",
    ol: "enemy-ol.glb",
    student: "enemy-student.glb",
    traveler: "enemy-traveler.glb",
  };
  for (const [key, file] of Object.entries(charFiles)) {
    tasks.push(
      glbLoader.loadAsync(`${GLB_BASE}/${file}`).then((g) => {
        assets.charGLBs[key] = g.scene;
      }),
    );
  }
  // サインテクスチャ
  const sigFiles = {
    exit: "sign-exit.png",
    restroom: "sign-restroom.png",
    platform: "sign-platform.png",
    gaman: "poster-gaman.png",
    wcdoor: "wc-door.png",
  };
  for (const [key, file] of Object.entries(sigFiles)) {
    tasks.push(loadTex(file).then((t) => { assets.signTex[key] = t; }));
  }
  await Promise.all(tasks);
  console.log("Assets loaded:", Object.keys(assets.charGLBs), Object.keys(assets.signTex));
}

// ===== ステージビルダー（Three.jsプリミティブ） =====
function buildStage(stage) {
  const group = new THREE.Group();
  group.name = `Stage_${stage.index}`;

  const accentColor = new THREE.Color(stage.accent);
  const wallColor = new THREE.Color(stage.wallColor);

  // --- 床（市松タイル） ---
  // 全体の床: 大きな単一planeで効率化
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4d8, roughness: 0.85, metalness: 0.0,
  });
  const floorW = stage.width * CELL;
  const floorD = stage.height * CELL;
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorD),
    floorMat,
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(floorW / 2, 0, floorD / 2);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // 市松：通路セルごとに濃淡を分けるためsmallタイル追加
  const tileMatA = new THREE.MeshStandardMaterial({ color: 0xd4cfbf, roughness: 0.85 });
  const tileMatB = new THREE.MeshStandardMaterial({ color: 0xc4bfaa, roughness: 0.85 });
  const tileGeo = new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96);
  for (let z = 0; z < stage.height; z++) {
    for (let x = 0; x < stage.width; x++) {
      if (stage.map[z][x] === "#") continue;
      const t = new THREE.Mesh(tileGeo, (x + z) % 2 === 0 ? tileMatA : tileMatB);
      t.rotation.x = -Math.PI / 2;
      t.position.set(x * CELL + CELL / 2, 0.005, z * CELL + CELL / 2);
      t.receiveShadow = true;
      group.add(t);
    }
  }

  // --- 黄色点字ブロック ---
  // 最短経路にだけ敷く。迷路の緊張感は残しつつ、トイレ方向の手がかりにする。
  const tactileMat = new THREE.MeshStandardMaterial({
    color: 0xf2c61f, roughness: 0.6, emissive: 0xb09010, emissiveIntensity: 0.18,
  });
  const path = guidancePath(stage);
  const tactileGeo = new THREE.BoxGeometry(CELL * 0.58, 0.045, CELL * 0.18);
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const next = path[i + 1] || cur;
    const prev = path[i - 1] || cur;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const block = new THREE.Mesh(tactileGeo, tactileMat);
    block.position.set(cur.x * CELL + CELL / 2, 0.025, cur.z * CELL + CELL / 2);
    if (Math.abs(dz) > Math.abs(dx)) block.rotation.y = Math.PI / 2;
    block.receiveShadow = true;
    group.add(block);
  }

  // --- 壁（迷路感を出す高さ。カメラ側で壁侵入を避ける） ---
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor, roughness: 0.65, metalness: 0.05,
  });
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  for (let z = 0; z < stage.height; z++) {
    for (let x = 0; x < stage.width; x++) {
      if (stage.map[z][x] !== "#") continue;
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x * CELL + CELL / 2, WALL_H / 2, z * CELL + CELL / 2);
      w.castShadow = true;
      w.receiveShadow = true;
      group.add(w);
    }
  }

  // --- 壁の上に細い装飾ライン（accent色） ---
  // 外周をぐるっと（低めのemission帯）
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor, emissive: accentColor, emissiveIntensity: 0.4,
  });
  const accentGeo = new THREE.BoxGeometry(stage.width * CELL, 0.05, 0.06);
  const topStrip = new THREE.Mesh(accentGeo, accentMat);
  topStrip.position.set(stage.width * CELL / 2, WALL_H + 0.02, 0.03);
  group.add(topStrip);
  const botStrip = new THREE.Mesh(accentGeo, accentMat);
  botStrip.position.set(stage.width * CELL / 2, WALL_H + 0.02, stage.height * CELL - 0.03);
  group.add(botStrip);

  // --- ゴール: 青いトイレドア ---
  const gx = stage.goal.x, gz = stage.goal.z;
  const goalWp = gridToWorld(gx, gz);
  // ドア本体（壁色を上書きするため、ゴールセル位置に新マテリアル箱を置く）
  const wcDoorMat = new THREE.MeshStandardMaterial({
    map: assets.signTex.wcdoor, color: 0xffffff, roughness: 0.5,
  });
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.8, 1.8, 0.15),
    wcDoorMat,
  );
  // ドアは ゴールセルの北側辺(gz-1セルとの境界)に置く（壁面に貼り付け）
  doorMesh.position.set(goalWp.x, 0.9, goalWp.z - CELL / 2 + 0.08);
  doorMesh.castShadow = true;
  group.add(doorMesh);
  // ドア上の Restroom 看板
  const restroomSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.7),
    new THREE.MeshBasicMaterial({ map: assets.signTex.restroom, transparent: true }),
  );
  restroomSign.position.set(goalWp.x, WALL_H + 0.6, goalWp.z - CELL / 2 + 0.12);
  group.add(restroomSign);
  // ゴール強照明
  const goalLight = new THREE.PointLight(0xfff0c8, 2.0, 6);
  goalLight.position.set(goalWp.x, 1.7, goalWp.z - 0.3);
  group.add(goalLight);
  // ゴール床マーカー（緑光）
  const goalFloor = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0.5 }),
  );
  goalFloor.rotation.x = -Math.PI / 2;
  goalFloor.position.set(goalWp.x, 0.03, goalWp.z);
  group.add(goalFloor);

  // --- スタート床マーカー（緑） ---
  const sp = gridToWorld(stage.start.x, stage.start.z);
  const startMark = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x44dd80, transparent: true, opacity: 0.6 }),
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

  return group;
}

// ===== キャラ表示ヘルパー =====
function setupCharacter(glbScene, targetHeight = PLAYER_H) {
  // GLBは Y-up済 + _Root含むがバウンディングボックスから高さ正規化＋影設定
  const root = new THREE.Group();
  root.name = "CharRoot";
  const clone = glbScene.clone(true);
  // バウンディングボックスで高さ計測しスケール
  const box = new THREE.Box3().setFromObject(clone);
  const h = box.max.y - box.min.y;
  const scale = targetHeight / h;
  clone.scale.setScalar(scale);
  // 足元を y=0 に
  const newBox = new THREE.Box3().setFromObject(clone);
  clone.position.y -= newBox.min.y;
  clone.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  root.add(clone);
  // 丸影プレーン
  const shadowGeo = new THREE.CircleGeometry(0.3, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);
  root.userData.body = clone;
  root.userData.shadow = shadow;
  return root;
}

// ===== ゲームステート =====
const state = {
  mode: "title",
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
  stageObj: null,
  playerObj: null,
  enemyObjs: [],
  keys: { left: false, right: false, forward: false, back: false },
  inputCooldown: 0,
  queuedAction: null,
  hitTimer: 0,
  blockedTime: 0,
  blockedDuration: 0,
  blockedDx: 0,
  blockedDz: 0,
  paused: false,
};

// ===== UI =====
function buildStageList() {
  if (!stageList) return;
  stageList.innerHTML = "";
  STAGES.forEach((stage, idx) => {
    const li = document.createElement("li");
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

const ACTION_BUTTONS = {
  left: turnLeftBtn,
  right: turnRightBtn,
  forward: forwardBtn,
  back: backBtn,
};

function resetInputState() {
  state.keys.left = false;
  state.keys.right = false;
  state.keys.forward = false;
  state.keys.back = false;
  state.inputCooldown = 0;
  state.queuedAction = null;
  Object.values(ACTION_BUTTONS).forEach((btn) => btn?.classList.remove("is-held"));
}

// ===== ステージ開始 =====
function startStage(index) {
  const stage = STAGES[index];
  if (!stage) return;

  if (state.stageObj) scene.remove(state.stageObj);
  state.stageObj = buildStage(stage);
  scene.add(state.stageObj);

  // プレイヤー
  if (state.playerObj) scene.remove(state.playerObj);
  state.playerObj = setupCharacter(assets.charGLBs.player, PLAYER_H);
  scene.add(state.playerObj);

  // 敵
  state.enemyObjs.forEach((e) => scene.remove(e));
  state.enemyObjs = [];
  state.enemies = [];
  const stageOpen = stage.open.filter((c) => {
    if (c.x === stage.start.x && c.z === stage.start.z) return false;
    const startDist = Math.abs(c.x - stage.start.x) + Math.abs(c.z - stage.start.z);
    return startDist >= 4;
  });
  for (let i = 0; i < stage.enemyCount; i++) {
    const typeKey = stage.pool[i % stage.pool.length];
    const def = ENEMY_DEFS[typeKey];
    const cell = stageOpen[(i * 7 + 3) % Math.max(stageOpen.length, 1)] || stage.open[0];
    const behavior = stage.behaviors[i % stage.behaviors.length];
    const startDirs = DIRS.filter((d) => !isWall(stage, cell.x + d.dx, cell.z + d.dz));
    const startDir = startDirs.length > 0
      ? startDirs[Math.floor(Math.random() * startDirs.length)]
      : DIRS[0];
    const enemy = {
      type: typeKey,
      x: cell.x + 0.5,
      z: cell.z + 0.5,
      dx: startDir.dx, dz: startDir.dz,
      yaw: Math.atan2(startDir.dx, startDir.dz),
      speed: stage.enemySpeed * def.speedMul,
      def, behavior,
      turnTimer: rand(0.5, 1.5),
    };
    state.enemies.push(enemy);
    const obj = setupCharacter(assets.charGLBs[typeKey] || assets.charGLBs.business, 1.20);
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
    fromX: sp.x + 0.5, fromZ: sp.z + 0.5,
    targetX: sp.x + 0.5, targetZ: sp.z + 0.5,
    dirIndex: initDirIdx,
    angle: initAngle,
    fromAngle: initAngle, targetAngle: initAngle,
    moveTime: 0, moveDuration: 0,
    turnTime: 0, turnDuration: 0,
  });

  state.mode = "playing";
  state.stageIndex = index;
  state.timeLeft = stage.time;
  state.dignity = 100;
  state.hitTimer = 0;
  state.blockedTime = 0;
  state.blockedDuration = 0;
  state.blockedDx = 0;
  state.blockedDz = 0;
  state.paused = false;
  resetInputState();

  applyStageCamera(stage);
  hideOverlay();
  if (stageNo) stageNo.textContent = `STAGE ${index + 1}`;
  if (stageName) stageName.textContent = stage.name;
  if (boardStatus) boardStatus.textContent = `STAGE ${index + 1} 進行中`;
  updateStageList();
}

// ===== 入力 =====
function setHeld(k, on) {
  if (k in state.keys) state.keys[k] = on;
  ACTION_BUTTONS[k]?.classList.toggle("is-held", on);
}
function isPlayerBusy() { return state.player.moveDuration > 0 || state.player.turnDuration > 0; }

function tryAction(action, opts = {}) {
  if (state.mode !== "playing" || state.paused) return;
  if (opts.repeat && state.inputCooldown > 0) return;
  if (isPlayerBusy()) {
    if (!opts.repeat) state.queuedAction = action;
    return;
  }
  if (opts.repeat) state.inputCooldown = INPUT_REPEAT_DELAY;
  if (action === "left") startTurn(-1);
  else if (action === "right") startTurn(1);
  else if (action === "forward") startStep(1);
  else if (action === "back") startStep(-1);
}

function startTurn(dir) {
  const p = state.player;
  p.dirIndex = (p.dirIndex + dir + 4) % 4;
  p.fromAngle = p.angle;
  p.targetAngle = DIRS[p.dirIndex].angle;
  p.turnTime = 0;
  p.turnDuration = TURN_DURATION;
}

function startStep(forward) {
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const d = DIRS[p.dirIndex];
  const nx = Math.round(p.x - 0.5) + d.dx * forward;
  const nz = Math.round(p.z - 0.5) + d.dz * forward;
  if (isWall(stage, nx, nz)) {
    state.queuedAction = null;
    state.inputCooldown = INPUT_BLOCK_DELAY;
    state.hitTimer = Math.max(state.hitTimer, 0.16);
    state.blockedTime = 0;
    state.blockedDuration = 0.16;
    state.blockedDx = d.dx * forward;
    state.blockedDz = d.dz * forward;
    if (boardStatus) boardStatus.textContent = "壁。向きを変えて進め";
    return;
  }
  p.fromX = p.x; p.fromZ = p.z;
  p.targetX = nx + 0.5; p.targetZ = nz + 0.5;
  p.moveTime = 0;
  p.moveDuration = forward > 0 ? MOVE_DURATION : BACK_DURATION;
  if (boardStatus) boardStatus.textContent = `STAGE ${state.stageIndex + 1} 進行中`;
}

function consumeQueuedAction() {
  if (!state.queuedAction || isPlayerBusy() || state.mode !== "playing") return;
  const a = state.queuedAction;
  state.queuedAction = null;
  tryAction(a);
}

function updateHeldInput() {
  if (state.mode !== "playing" || isPlayerBusy() || state.queuedAction) return;
  const a = state.keys.forward ? "forward" :
            state.keys.back ? "back" : null;
  if (a) tryAction(a, { repeat: true });
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
  if (p.turnDuration > 0) {
    p.turnTime += dt;
    const t = Math.min(p.turnTime / p.turnDuration, 1);
    const e = easeInOut(t);
    let delta = p.targetAngle - p.fromAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    p.angle = p.fromAngle + delta * e;
    if (t >= 1) { p.angle = p.targetAngle; p.turnDuration = 0; }
  }
  if (p.moveDuration > 0) {
    p.moveTime += dt;
    const t = Math.min(p.moveTime / p.moveDuration, 1);
    const e = easeInOut(t);
    p.x = p.fromX + (p.targetX - p.fromX) * e;
    p.z = p.fromZ + (p.targetZ - p.fromZ) * e;
    if (t >= 1) { p.x = p.targetX; p.z = p.targetZ; p.moveDuration = 0; }
  }
  if (state.playerObj) {
    const wp = gridToWorld(p.x - 0.5, p.z - 0.5);
    let blockX = 0;
    let blockZ = 0;
    if (state.blockedDuration > 0) {
      state.blockedTime += dt;
      const t = Math.min(state.blockedTime / state.blockedDuration, 1);
      const bump = Math.sin(t * Math.PI) * 0.14 * CELL;
      blockX = state.blockedDx * bump;
      blockZ = state.blockedDz * bump;
      if (t >= 1) state.blockedDuration = 0;
    }
    state.playerObj.position.x = wp.x + blockX;
    state.playerObj.position.z = wp.z + blockZ;
    // 接地ベース + 走り中バウンス
    let bobY = 0;
    if (p.moveDuration > 0) {
      const t = p.moveTime / p.moveDuration;
      bobY = Math.abs(Math.sin(t * Math.PI * 2)) * 0.08;
    }
    state.playerObj.position.y = bobY;
    state.playerObj.rotation.y = p.angle;
    // hit中シェイク
    if (state.hitTimer > 0) {
      state.playerObj.position.x += Math.sin(performance.now() / 25) * 0.05 * state.hitTimer;
    }
  }
}

function updateEnemies(dt) {
  const stage = STAGES[state.stageIndex];
  state.enemies.forEach((e, idx) => {
    e.turnTimer -= dt;
    if (e.turnTimer <= 0) {
      const choices = [];
      for (const d of DIRS) {
        const nx = Math.round(e.x - 0.5) + d.dx;
        const nz = Math.round(e.z - 0.5) + d.dz;
        if (!isWall(stage, nx, nz)) choices.push(d);
      }
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
    const speedMul = e.behavior === "blocker" ? 0.3 :
                     e.behavior === "sprinter" ? 1.4 : 1.0;
    const speed = e.speed * speedMul;
    const nx = e.x + e.dx * speed * dt;
    const nz = e.z + e.dz * speed * dt;
    const cellX = Math.round(nx - 0.5);
    const cellZ = Math.round(nz - 0.5);
    if (!isWall(stage, cellX, cellZ)) {
      e.x = nx; e.z = nz;
    } else {
      e.dx = -e.dx; e.dz = -e.dz;
    }
    // 進行方向に滑らかに旋回
    const targetYaw = Math.atan2(e.dx, e.dz);
    let delta = targetYaw - e.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const maxStep = 10 * dt;
    e.yaw = Math.abs(delta) <= maxStep ? targetYaw : e.yaw + Math.sign(delta) * maxStep;

    const obj = state.enemyObjs[idx];
    if (obj) {
      const wp = gridToWorld(e.x - 0.5, e.z - 0.5);
      obj.position.x = wp.x;
      obj.position.z = wp.z;
      // バウンス
      const bob = e.behavior === "blocker" ? 0 :
                  Math.abs(Math.sin(performance.now() / 200 + idx)) * 0.05;
      obj.position.y = bob;
      obj.rotation.y = e.yaw;
    }
  });
}

function updateCamera(snap = false) {
  if (!state.playerObj || state.mode !== "playing") return;
  const stage = STAGES[state.stageIndex];
  const p = state.player;
  const pWorld = gridToWorld(p.x - 0.5, p.z - 0.5);
  const ax = Math.sin(p.angle);
  const az = Math.cos(p.angle);

  let back = CAMERA_BACK;
  while (back > CAMERA_MIN_BACK) {
    const cx = Math.floor((pWorld.x - ax * back) / CELL);
    const cz = Math.floor((pWorld.z - az * back) / CELL);
    const outside = cx < 0 || cz < 0 || cx >= stage.width || cz >= stage.height;
    if (outside) break;
    if (!isWall(stage, cx, cz)) break;
    back -= 0.25;
  }

  cameraDesired.set(
    pWorld.x - ax * back,
    CAMERA_HEIGHT,
    pWorld.z - az * back,
  );
  cameraLookAt.set(
    pWorld.x + ax * CAMERA_LOOK_AHEAD,
    CAMERA_LOOK_HEIGHT,
    pWorld.z + az * CAMERA_LOOK_AHEAD,
  );

  if (snap) camera.position.copy(cameraDesired);
  else camera.position.lerp(cameraDesired, CAMERA_LERP);
  camera.lookAt(cameraLookAt);
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
  const stage = STAGES[state.stageIndex];
  const totalDist = Math.hypot(stage.goal.x - stage.start.x, stage.goal.z - stage.start.z);
  const curDist = Math.hypot(stage.goal.x - (state.player.x - 0.5), stage.goal.z - (state.player.z - 0.5));
  const pct = totalDist > 0 ? (1 - curDist / totalDist) * 100 : 0;
  if (distanceFill) distanceFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
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
  const px = state.player.x, pz = state.player.z;
  for (const e of state.enemies) {
    const d2 = (e.x - px) ** 2 + (e.z - pz) ** 2;
    const r = e.def.hitRadius + 0.18;
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
  if (d2 < 0.55 * 0.55) clearStage();
}

function clearStage() {
  state.mode = "clear";
  resetInputState();
  state.cleared[state.stageIndex] = true;
  if (boardStatus) boardStatus.textContent = "クリア！";
  updateStageList();
  showOverlay("clear", { next: state.stageIndex + 1 });
}

function gameOver() {
  state.mode = "gameover";
  resetInputState();
  if (boardStatus) boardStatus.textContent = "失敗…";
  showOverlay("gameover");
}

function showOverlay(type, opts = {}) {
  if (!screenLayer) return;
  screenLayer.classList.add("active");
  screenLayer.dataset.screen = type;
  screenLayer.setAttribute("aria-hidden", "false");
  if (type === "title") {
    if (screenTitle) screenTitle.textContent = "トイレ我慢ゲーム";
    if (screenKicker) screenKicker.textContent = "満員電車後の尊厳防衛戦";
    if (screenCopy) screenCopy.textContent = "TPS視点で駅構内の迷路を走り、トイレドアへ触れろ。";
    screenActions.innerHTML = `<button class="primary" data-action="start">START</button>`;
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

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }

// ===== 起動 =====
async function bootstrap() {
  resizeRenderer();
  buildStageList();
  showTitle();
  if (screenCopy) screenCopy.textContent = "アセット読み込み中…";
  if (screenActions) screenActions.innerHTML = "";
  try {
    await loadAllAssets();
  } catch (err) {
    console.error("Asset load failed:", err);
    if (screenCopy) screenCopy.textContent = "アセット読み込み失敗。コンソール確認。";
    return;
  }
  showOverlay("title");
  requestAnimationFrame(tick);
}

bootstrap();
