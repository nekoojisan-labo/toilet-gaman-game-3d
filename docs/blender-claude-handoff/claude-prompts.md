# Claude向けプロンプト案

## 1. ステージ生成用

```text
あなたはBlender Pythonでゲーム用3Dアセットを作るテクニカルアーティストです。

添付の stage-data.json を読み込み、Blender Pythonスクリプトを作成してください。

要件:
- 1セル=2mで、15x7の駅構内迷路を生成する
- # は壁、. は床、S は開始地点、G はトイレゴール
- Blender座標は X=gridX*2, Y=-gridZ*2, Z=高さ とする
- 床は駅タイルの市松模様にする
- 壁は高さ2.4m、厚さ0.18m程度
- 壁はセルブロックの塊ではなく、通路に面する壁面として作る
- Gセルにはトイレドア、WC看板、強めの照明を置く
- Sセルには開始位置マーカーを置く
- 天井ライト、案内看板、柱、改札風の小物を少量配置する
- stage-01 から stage-05 まで個別collectionに分ける
- 各stageをGLBとして書き出せる関数を用意する

出力:
- 実行可能なBlender Pythonスクリプト
- オブジェクト命名規則
- Three.js側で読み込む時の注意点
```

## 2. 主人公モデル用

```text
あなたはBlenderでデフォルメゲームキャラクターを作る3Dアーティストです。

トイレ我慢ゲームの主人公を作るためのBlender Pythonまたは制作指示を作成してください。
参照画像は character-graphics/player-businessman-turnaround.png です。

キャラクター:
- 日本のサラリーマン
- 紺色のスーツ、白シャツ、青いネクタイ
- 髪は黒、表情は焦っている
- 汗を大きめに見せる
- コミカルだが汚くしすぎない
- TPS視点で背中を見る時間が長いので、背面シルエットを読みやすくする

必要アニメーション:
- idle: 我慢して小刻みに震える
- run: 前傾姿勢で全力疾走
- hit: 障害物にぶつかってよろける
- limit: 限界寸前で焦りが強い
- gameover: 直接的すぎない敗北ポーズ

制約:
- ゲーム用なので低ポリ、軽量
- 足元原点は床面中央
- 身長は1.34から1.6m程度
- GLB出力を前提
- Mixamo的なリアル体型ではなく、ややチビ寄りのデフォルメ
```

## 3. Three.js移植用

```text
あなたはThree.jsでWebゲームを実装するエンジニアです。

現在の toilet-gaman-game はCanvas疑似3Dですが、Blenderで生成したGLBステージに置き換えます。
stage-data.json のグリッドを当たり判定の正とし、GLBは見た目用として読み込みます。

実装要件:
- Three.jsで stage-01.glb から stage-05.glb を読み込む
- プレイヤーはグリッド単位で前進、後退、90度旋回
- カメラはTPS後方追従
- 当たり判定は stage-data.json の # セルで行う
- 敵は既存の patrol / zigzag / blocker / sprinter / ambush を維持
- UI、制限時間、我慢ゲージ、クリア/ゲームオーバー文言は既存を維持
- GLBの座標系とグリッド座標の変換関数を明示する

出力:
- ファイル構成案
- 主要クラス設計
- 移行手順
- 最初にStage 1だけ動かすための最小実装
```

## 3.5. 敵キャラモデル用

```text
あなたはBlenderでゲーム用NPCモデルを作る3Dアーティストです。

参照画像 character-graphics/enemy-commuters-reference.png と character-graphics/crowd-reaction-expressions.png を使い、駅構内の敵キャラと群衆NPCの制作仕様を作成してください。

必要モデル:
- enemy-business.glb: 急ぐビジネスマン、ブリーフケース持ち
- enemy-office-woman.glb: スマホ歩きの女性、肩掛けバッグ
- enemy-student.glb: 学生、リュック
- enemy-traveler.glb: 旅行者、帽子、キャリーケース
- npc-station-staff.glb: 駅員
- npc-crowd-variants.glb: 群衆リアクション

要件:
- 共通ボーンを使い回しやすいチビアニメ体型
- バッグ、スマホ、キャリーケース、帽子は別メッシュ
- 遠目でも区別できるシルエット
- 表情差分は笑い、哀れみ、驚き、困惑を用意
- ゲーム中の当たり判定は stage-data.json の enemyTypes を優先する

出力:
- 各モデルの形状仕様
- マテリアル仕様
- 必要アニメーション
- GLB書き出し時の命名規則
```

## 4. 品質確認用

```text
Blender/Three.js版の表示品質を確認するチェックリストを作ってください。

観点:
- キャラの足元が床に接地しているか
- 1マス移動と見た目の距離が一致しているか
- 90度回転時に壁が消えないか
- カメラが壁に埋まらないか
- トイレの方向がプレイヤーに伝わるか
- Stage 1からStage 5まで難易度差が見た目にも分かるか
- スマホ縦画面でUIと3Dビューが重ならないか
```
