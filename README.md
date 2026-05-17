# トイレ我慢ゲーム

満員電車を降りたサラリーマンが、限界寸前の状態で駅構内の迷路を走り、制限時間内にトイレへ到達するブラウザゲームです。

## 公開URL

https://nekoojisan-labo.github.io/toilet-gaman-game-3d/

## 実行

`index.html` の直開きで動きます。

```text
/Users/takayamanoboruhaku/Documents/gazoubiruda/toilet-gaman-game/index.html
```

簡易サーバーで確認する場合:

```sh
python3 -m http.server 8031
```

```text
http://localhost:8031/toilet-gaman-game/
```

## 操作

- PC: `W` / `ArrowUp` / `Space` で前に1マス進む、`S` / `ArrowDown` で後ろに1マス戻る、`A` / `ArrowLeft` と `D` / `ArrowRight` で90度旋回
- ダッシュ補助: `Shift` を押しながら前進
- スマホ: 画面右下の `↶` `↑` `↷` `↓` ボタンで、90度旋回と1マス移動を行う
- 一時停止: 画面右上ボタン、`P`、`Esc`

## 実装範囲

- TPS風の後方カメラ表示
- TPSカメラ用の後方余白を持たせた駅構内5ステージ
- 制限時間、我慢ゲージ、トイレまでの到達ゲージ
- 主人公の地図座標に連動した表示、前進、後退、90度旋回、壁前停止
- 残り時間と我慢ゲージに応じた表情変化
- 主人公の4方向スプライト枠と敵キャラの3フレーム以上の走行アニメーション
- 敵キャラのステージ別挙動
  - ステージ1: 素直な巡回
  - ステージ2: ジグザグ移動
  - ステージ3: キャリーケース系の幅広ブロック
  - ステージ4: 視界に入ると突っ込むビジネスマン
  - ステージ5: フェイント、追跡、ブロックの混合
- 敵接触時の減速、時間ロス、我慢ゲージ減少
- トイレドア接触によるステージクリア
- クリア表示: `尊厳は守られた`
- ゲームオーバー表示: `社会的な「死」`
- ゲームオーバー時の全面事故イラスト表示

## 素材

支給画像と生成画像は `assets/source/`、ゲームで使う透過PNGは `assets/sprites/` に保管しています。

Blender / Claude で3D版を作り直すための引き継ぎ資料は `docs/blender-claude-handoff/` にまとめています。

背景・ゲームオーバー演出では以下を使用します。

- `assets/station-concourse-v2.png`
- `assets/effects/gameover-accident.png`

主人公・敵キャラのスプライト再生成:

```sh
python3 toilet-gaman-game/tools/extract-assets.py
```

主人公の4方向走行スプライトは `assets/source/player-4dir-generated-sheet.png` を元に、`tools/generate_player_4dir_sprites.py` でアニメ調の透過PNGへ切り出します。
走行は前・後・左・右の4方向、それぞれ3フレーム構成です。

```sh
python3 toilet-gaman-game/tools/generate_player_4dir_sprites.py
```
