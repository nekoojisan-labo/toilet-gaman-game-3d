# Blender / Claude 引き継ぎメモ

このフォルダは、現行のブラウザ版 `toilet-gaman-game` を、Blenderで3Dアセット化し、ClaudeでBlender PythonやThree.js実装へ移すための整理資料です。

## 目的

現行版はHTML Canvas上の疑似3D描画と2Dスプライトで作っているため、以下の問題が出やすい。

- マップの壁・床・通路の奥行き表現が安定しない
- キャラクターが3D空間に自然に乗らない
- 回転時の見え方と座標の一致が分かりづらい
- スプライトの向き・奥行き・遮蔽表現に限界がある
- 駅構内の質感を出すにはCanvas描画だけでは工数が重い

次の方針では、Blenderで駅構内・迷路・キャラ・障害物の3D基盤を作り、ClaudeにはBlender Python生成スクリプト、アセット命名、Three.js側の読み込み実装を任せる。

## このフォルダの中身

- `stage-data.json`
  - 5ステージのグリッド、時間、敵タイプ、難易度値をJSON化したもの。
  - Blender Pythonで迷路生成する入力データとして使う。
- `asset-inventory.md`
  - 現行アセットの役割、Blenderで置き換えるべきもの、残してよいものの整理。
- `character-specs.md`
  - Blenderへ渡すキャラクターグラフィックの仕様。
- `character-graphics/`
  - 主人公、敵キャラ、群衆リアクションの設定画像。
- `claude-prompts.md`
  - Claudeへ渡すための作業プロンプト案。

## 現行ゲームの場所

- ローカル: `/Users/takayamanoboruhaku/Documents/gazoubiruda/toilet-gaman-game`
- GitHub: `https://github.com/nekoojisan-labo/toilet-gaman-game-3d`
- 公開URL: `https://nekoojisan-labo.github.io/toilet-gaman-game-3d/`

## 現行の座標ルール

- マップは `x,z` の2Dグリッド。
- `x` は左から右、`z` は上から下。
- 各セルの中心座標は `x + 0.5`, `z + 0.5`。
- `#` は壁、`.` は通路、`S` は開始地点、`G` はトイレ。
- 全ステージは横15セル、縦7セル。

Blenderへ移す場合は、まず `1セル = 2m` などに固定し、以下のように変換すると扱いやすい。

```text
Blender X = grid x * cellSize
Blender Y = -grid z * cellSize
Blender Z = 高さ
```

## Blender化の推奨方針

1. `stage-data.json` から床・壁・トイレ・開始地点を自動生成する。
2. 壁はセル単位のブロックではなく、連続壁をまとめてメッシュ化する。
3. 床は市松模様または駅タイルのマテリアルで敷く。
4. トイレは `G` セルの奥側にドア、WCマーク、案内灯を配置する。
5. 主人公と敵は最初は低ポリ3Dモデル、難しければBlenderレンダーの4方向スプライトでもよい。
6. Three.jsへ移す場合は、ステージごとに `stage-01.glb` から `stage-05.glb` を書き出す。

## 最初に作るべきBlender成果物

- `stage-01-blockout.blend`
- `stage-01-blockout.glb`
- `station-modular-kit.blend`
- `player-businessman.blend`
- `enemy-commuters.blend`

まずはStage 1だけで、カメラ追従・当たり判定・通路幅・キャラサイズの確認をする。
