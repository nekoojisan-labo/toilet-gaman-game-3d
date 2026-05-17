# assets-3d (v2: チビアニメ調＋本格駅シーン)

リファレンス画像（チビアニメキャラ＋現代日本駅構内）を元に再生成・改修した3Dアセット一式。

## ディレクトリ構成

```
assets-3d/
├── blender/
│   ├── station-modular-kit.blend       # 全シーン (27MB - PBRテクスチャ込)
│   └── station-modular-kit.blend1      # v1バックアップ (425KB)
├── glb/
│   ├── stage-01.glb 〜 stage-05.glb    # 各約7MB (PBR込)
│   ├── player-businessman.glb          # 2MB (Hyper3D生成)
│   ├── enemy-business.glb              # 1.7MB
│   ├── enemy-ol.glb                    # 1.7MB
│   ├── enemy-student.glb               # 1.9MB
│   └── enemy-traveler.glb              # 1.9MB
├── textures/                            # 空（GLBに埋め込み）
├── preview-stage-01.png 〜 05.png       # 各ステージ上空ビュー
├── preview-chibi-characters.png         # 5キャラ並び
└── README.md
```

## キャラクター（v2: Hyper3D生成）

全キャラ Hyper3D Rodin で生成したチビアニメ調モデル。マテリアル/テクスチャ込みで自発光対応。

| キャラ | 身長 (m) | 半径 (m) | 説明 |
|---|---|---|---|
| Player Businessman | 1.34 | 0.24 | 紺スーツ・青ネクタイ・スパイキー黒髪・ブリーフケース・焦り顔 |
| Enemy Business | 1.44 | 0.27 | ダークスーツ・赤ネクタイ・ブリーフケース・険しい顔 |
| Enemy OL | 1.38 | 0.25 | ベージュ上下・ピンクスマホ・茶髪ロング |
| Enemy Student | 1.38 | 0.25 | 学ラン・紺リュック・スパイキー茶髪 |
| Enemy Traveler | 1.42 | 0.40 | ストローハット・デニムジャケット・ダークブルーキャリーケース |

オブジェクト構造: `Chibi[Name]_Root` (空オブジェクト) → `Chibi[Name]` (メッシュ)

足元原点はRoot位置 = 床面中央 (Z=0)。Three.jsで操作時は `scene.getObjectByName('ChibiPlayer_Root')` を取得して位置・回転を制御。

## ステージ（v2: PBR駅シーン）

各ステージに以下を追加・置換:

### 追加要素
- **PBR床タイル** (PolyHaven `interior_tiles`) - 既存theme色は背景に
- **黄色点字ブロック** - 通路の各行に沿って自動配置（連続3セル以上の通路）
- **天井蛍光灯** (Emission Strength 18.0) - 高輝度
- **オーバーヘッドサイン** - ゴール前(Restroom青)、開始地点側(Exit黄+Platform青)
- **「がまん!」赤ポスター** - 壁に2枚配置（ステージごと）
- **青いトイレドア** - ゴールセル

### 命名規則 (v2追加)
| プレフィックス | 役割 |
|---|---|
| `stage-NN_tactile_h_Z_X` | 横向き黄色点字ブロックライン |
| `stage-NN_overhead_sign_restroom` | ゴール手前の青看板 |
| `stage-NN_overhead_sign_exit` | 開始側の黄色Exit看板 |
| `stage-NN_overhead_sign_platform` | Platform青看板 |
| `stage-NN_poster_gaman_N` | 壁の「がまん!」ポスター |

### ステージ別オブジェクト数
| Stage | オブジェクト数 |
|---|---|
| 01 ホーム迷宮 | 129 |
| 02 改札前ジグザグ | 131 |
| 03 階段横の狭路 | 129 |
| 04 巨大ターミナル | 129 |
| 05 トイレ前最終防衛線 | 133 |

## 座標系（v1から変更なし）

- Blender Z-up → GLB出力時 Y-up変換 (export_yup=True)
- 1セル = 2m
- グリッド (gridX, gridZ) のセル中心 = GLB内 (gridX*2+1, 0, gridZ*2+1) [Y-up変換後]
- 当たり判定は `stage-data.json` の `#` セルで行う（GLBは見た目専用）

## Three.js 統合

```javascript
// 例: Stage 1とプレイヤーをロード
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// ステージ
loader.load('assets-3d/glb/stage-01.glb', (gltf) => {
  scene.add(gltf.scene);
});

// プレイヤー
loader.load('assets-3d/glb/player-businessman.glb', (gltf) => {
  const player = gltf.scene;
  // Root取得
  const playerRoot = player.getObjectByName('ChibiPlayer_Root');
  // 開始地点に配置 (stage-01 start: gridX=2, gridZ=4 → Three.js (5, 0, 9))
  playerRoot.position.set(5, 0, 9);
  scene.add(player);
});

// 敵 (例: business)
loader.load('assets-3d/glb/enemy-business.glb', (gltf) => {
  const enemy = gltf.scene;
  const enemyRoot = enemy.getObjectByName('ChibiBusiness_Root');
  // パトロール位置に配置
  enemyRoot.position.set(15, 0, 5);
  scene.add(enemy);
});
```

注意点:
- emissionマテリアル付き（蛍光灯/看板/ポスター/トイレドア/点字ブロック）は自発光する
- GLBにライト含まれるが、Three.jsでは追加で AmbientLight + DirectionalLight 推奨
- Hyper3D生成キャラは Z-up native のためGLB出力で Y-up変換すれば そのまま立つ
- OLのみ生成時に「寝姿勢」になったため90°回転で立たせている（首が少し傾く許容範囲）

## 再生成方法

1. Blenderで `station-modular-kit.blend` を開く
2. MCP経由でClaudeから対話的に生成（現状の方法）
3. または手動: Pythonコンソールで該当関数を実行

## 未対応 (次フェーズ)

- [ ] キャラのアニメーション (idle/run/hit/limit/gameover) - 現状は静的T-poseのみ
- [ ] アーマチュア（スケルタル）追加
- [ ] ステージごとの個性的な小物 (改札・階段・自販機)
- [ ] HDRI環境光（駅構内屋内HDRI推奨）
- [ ] OLの首の傾き修正 (再生成 or 手動メッシュ編集)
- [ ] 看板に実際のテキスト/シンボル貼り付け（現状は色のみ）

## 制作履歴

- v1 (5/17 14:23): 低ポリプロシージャル / ブロックキャラ
- v2 (5/17 16:53): Hyper3Dチビキャラ + PBR駅シーン + 黄色点字ブロック + サイン
