# トイレ我慢ゲーム Unity WebGL版

満員電車を降りた会社員が、我慢ゲージが尽きる前に駅構内の迷路を抜けてトイレを目指す3Dゲームです。

## プレイ

https://nekoojisan-labo.github.io/toilet-gaman-game-3d/

- 移動: WASD / スティック
- 視点: マウスドラッグ / スワイプ
- 緊急突破: Space / 突破ボタン

全5ステージ。通行人は直進・横断・スマホ歩き・乗換ダッシュの経路行動を行い、プレイヤーを追跡しません。

## 技術構成

- Unity 6000.5.3f1
- Universal Render Pipeline
- WebGL（gzip + decompression fallback）
- PC / スマホ横向き対応

使用素材とライセンスは [CREDITS.md](./CREDITS.md) を参照してください。
