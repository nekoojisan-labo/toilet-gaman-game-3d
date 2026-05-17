# アセット整理

## 残してよいもの

現行ゲームのUI、ゲームオーバー演出、顔アイコンは、Blender化後も仮素材として使える。

| パス | 役割 | 方針 |
| --- | --- | --- |
| `assets/effects/gameover-accident.png` | ゲームオーバー1枚絵 | 当面残す |
| `assets/effects/brown-stain.png` | ゲームオーバー演出用シミ | 当面残す |
| `assets/effects/crowd-reaction.svg` | 周囲の反応演出 | 当面残す |
| `assets/sprites/face-normal.png` | HUD通常顔 | 当面残す |
| `assets/sprites/face-panic.png` | HUD焦り顔 | 当面残す |
| `assets/sprites/face-limit.png` | HUD限界顔 | 当面残す |

## Blenderで置き換えたいもの

| 現行パス | 現状 | 置き換え案 |
| --- | --- | --- |
| `assets/station-concourse-v2.png` | 背景1枚画像 | 駅構内3Dモデル、またはステージGLB |
| `assets/station-restroom.png` | トイレ入口画像 | GLB内のトイレドア、WC看板 |
| `assets/sprites/player-*.png` | 4方向2Dスプライト | 低ポリ3Dモデル、またはBlenderレンダー4方向スプライト |
| `assets/sprites/enemy-*.png` | 敵2Dスプライト | 乗客モデル、キャリーケースモデル |

## Blenderへ渡す新規キャラクター設定画

| パス | 内容 |
| --- | --- |
| `docs/blender-claude-handoff/character-graphics/player-businessman-turnaround.png` | 主人公サラリーマンの前・横・後ろ・走りポーズ |
| `docs/blender-claude-handoff/character-graphics/enemy-commuters-reference.png` | 敵キャラ4種の参考設定 |
| `docs/blender-claude-handoff/character-graphics/crowd-reaction-expressions.png` | 群衆リアクションと駅員表情 |
| `docs/blender-claude-handoff/character-graphics/manifest.json` | 画像の役割とモデリングメモ |

## 現行の主人公素材

| パス | 内容 |
| --- | --- |
| `assets/source/player-4dir-generated-sheet.png` | 元画像系の4方向 x 3フレームシート |
| `assets/sprites/player-front-run-1.png` から `player-front-run-3.png` | 正面走行 |
| `assets/sprites/player-back-run-1.png` から `player-back-run-3.png` | 背面走行 |
| `assets/sprites/player-left-run-1.png` から `player-left-run-3.png` | 左向き走行 |
| `assets/sprites/player-right-run-1.png` から `player-right-run-3.png` | 右向き走行 |

Blenderでキャラを作る場合は、最初から完全な人型リグを目指さず、以下の順が現実的。

1. 低ポリのサラリーマンモデルを作る。
2. ネクタイ、汗、焦り顔を大きめにデフォルメする。
3. 走り、待機、衝突、限界の4アニメーションだけ作る。
4. ゲーム側はGLBアニメーション再生、またはBlenderレンダーのスプライト差し替えにする。

## Blender向けモジュール案

| モジュール | 内容 |
| --- | --- |
| `floor_tile` | 駅タイル床。1セル分 |
| `wall_straight` | 通路壁。高さ2.4m程度 |
| `corner_wall` | 曲がり角用壁 |
| `ceiling_light` | 蛍光灯 |
| `wc_door` | ゴール用トイレドア |
| `wc_sign` | WC案内看板 |
| `ticket_gate_prop` | 改札前ステージ用 |
| `stairs_prop` | 階段横ステージ用 |
| `crowd_marker` | 敵配置確認用の仮モデル |

## 出力ファイル案

```text
assets-3d/
  blender/
    station-modular-kit.blend
    player-businessman.blend
    commuters.blend
  glb/
    stage-01.glb
    stage-02.glb
    stage-03.glb
    stage-04.glb
    stage-05.glb
    player-businessman.glb
    enemy-business.glb
    enemy-ol.glb
    enemy-student.glb
    enemy-traveler.glb
  textures/
    station-floor.png
    station-wall.png
    wc-sign.png
```

## 注意点

- 現行のCanvas描画ではなく、Blender/Three.js前提にするなら当たり判定はグリッドJSONを正とする。
- 見た目用GLBと、移動判定用グリッドは分離する。
- Blender側の壁モデルとゲーム側の `#` セルは必ず同じ座標変換にする。
- キャラの足元原点は必ず床面中央に置く。
