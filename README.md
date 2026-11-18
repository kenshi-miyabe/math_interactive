# さわる数学

図を動かし，数値を変え，ゲームに挑戦しながら数学の「なぜ？」を学ぶインタラクティブ教材集です．

各教材は，操作や観察を通じて，扱う数学の概念への理解を深めることを目的としています．定義や証明をじっくり読んだり，問題演習を重ねたりすることも含め，数学の学習のすべての側面をカバーするものではありません．

## 高校生向け

- [割線から接線へ](https://kenshi-miyabe.github.io/math_interactive/derivative_visualizer.html) ［A］ — 2点を近づけ，点の周りを拡大しながら微分係数を考えます．
- [論理式をゲームとして読む](https://kenshi-miyabe.github.io/math_interactive/logic_game.html) ［A］ — 数を選ぶゲームで，「ある」「すべて」の意味と順番を考えます．
- [いちごたっぷりパフェを選ぼう](https://kenshi-miyabe.github.io/math_interactive/secretary_problem_challenge.html) ［A］ — パフェ選びを通して，決断のタイミングと37%ルールを探ります．

## 大学生向け

### 微積分

- [ε–δチャレンジ](https://kenshi-miyabe.github.io/math_interactive/epsilon_delta_challenge.html) ［A］ — εに対してδを選び，連続性の定義を確かめます．
- [テイラー展開ビジュアライザ](https://kenshi-miyabe.github.io/math_interactive/taylor_series_visualizer.html) ［A］ — 次数と中心を動かし，多項式による関数の近似を見ます．
- [リーマン積分をつくる](https://kenshi-miyabe.github.io/math_interactive/riemann_integral.html) ［A］ — 分割と代表点を変え，リーマン和と積分の定義を確かめます．

### 確率・統計

- [Fisher情報量とクラメール–ラオの不等式をさわる](https://kenshi-miyabe.github.io/math_interactive/fisher_information.html) ［A］ — 推定量を工夫して分散を小さくし，確率分布族ごとのFisher情報量を観察しながら，推定精度の限界を理解します．

- [中心極限定理をさわる](https://kenshi-miyabe.github.io/math_interactive/central_limit_theorem.html) ［A］ — 標本数を増やし，標準化した標本平均の密度ヒストグラムが標準正規分布に近づく様子を観察します．

- [大数の法則をさわる](https://kenshi-miyabe.github.io/math_interactive/law_of_large_numbers.html) ［A］ — 分布とパラメータを選び，複数の標本平均が期待値へ近づく様子を観察します．

- [大数の法則を密度で見る](https://kenshi-miyabe.github.io/math_interactive/law_of_large_numbers_density.html) ［A］ — 標本平均の密度が一点に集中し，μ±ε の外側の面積（確率）が 0 に近づく様子を観察します．

- [分散の推定をくらべる](https://kenshi-miyabe.github.io/math_interactive/variance_estimators.html) ［A］ — 標本を繰り返し取り，標本分散と不偏分散を比較します．
- [2次元正規分布をさわる](https://kenshi-miyabe.github.io/math_interactive/bivariate_normal_3d.html) ［A］ — 平均・分散・相関を動かし，確率密度の3D曲面を見ます．

### 計算理論

- [チューリングマシンを動かす](https://kenshi-miyabe.github.io/math_interactive/turing_machine.html) ［A］ — 両側に無限の1本のテープで，1から0への書き換え・足し算・掛け算を実行し，テープ・ヘッド・状態遷移図を1ステップずつ追います．
- [レジスタマシンを動かす](https://kenshi-miyabe.github.io/math_interactive/register_machine.html) ［A］ — I・D・Jの3種類の命令で足し算や掛け算を実行し，レジスタの値・命令のスキップ・相対ジャンプと正常な停止を1ステップずつ追います．自分のプログラムも試せます．
- [ラムダ計算を動かす](https://kenshi-miyabe.github.io/math_interactive/lambda_calculus.html) ［A］ — λ式のβ簡約・α変換・定義展開を1ステップずつ追います．Church numeralの計算，真偽値，組，停止しない式や簡約順序の違いも試せます．
- [再帰関数をつくる](https://kenshi-miyabe.github.io/math_interactive/recursive_functions.html) ［B］ — 基本関数・合成・原始再帰・最小化を構成木で組み立て，名前を付けて保存・再利用します．段階的な評価，演習，JSONの入出力に対応しています．

「高校生向け」「大学生向け」や分野の区分は，教材を選ぶ際の目安です．高校生向けの教材にも，大学生向けの理論や発展問題を含みます．

## 使い方

授業の副教材として紹介したり，学習者が予習・復習の一環として使ったりすることを想定しています．

教材のリンクを開くか，このリポジトリをダウンロードしてHTMLファイルをブラウザで開いてください．数式表示や画面のスタイルに必要なファイルは `assets/` に同梱しています．ダウンロードした教材はインストールやビルドなしでオフラインでも使えます．HTMLを移動する際は，`assets/` との相対位置を保ってください．

動作確認は Mac の Google Chrome で行っています．表示の崩れや操作上の不具合がありましたら，[連絡先](#作成更新連絡先)までお知らせください．

### 共通の利用上の注意

- 教材は教育目的で公開しています．解説や計算結果に誤りや不適切な表現が含まれることがあります．学習に使う際は，教科書や授業資料など信頼できる情報源，教員の説明と照らし合わせてください．
- 氏名，学校名，連絡先など個人を特定できる情報や，成績，健康状態，相談内容は，教材に入力したり，教材を通じて送信したりしないでください．
- 不適切な表示や不具合に気づいたら，利用を中止し，授業中は担当教員に，個人での利用時は[下記の連絡先](#作成更新連絡先)にお知らせください．
- 授業で使う場合，担当教員は事前に，実際に使う端末・ブラウザ・ネットワークで教材を開き，動作と表示内容を確認してください．

### 外部サービスへの通信

- **GitHub Pages（`kenshi-miyabe.github.io`）** — 公開ページを開くと，教材の HTML や関連ファイルを取得します．GitHub は，セキュリティのために閲覧者の IP アドレスを記録・保存します．[GitHub Pages のデータ収集について](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

公開ページのファイルを取得する際は，接続先に IP アドレスやブラウザ情報が伝わります．参照元の情報はブラウザの設定などに応じて送られることがあります．数式表示と画面のスタイルには同梱したファイルを使います．教材の入力内容・解答・作成したデータを外部へ送信する機能や，教材独自のアクセス解析はありません．教材一覧や参考文献の外部リンクを開いた場合は，リンク先のサービスに接続します．

### データの取扱い

教材一覧の［A］・［B］は，次の区分を示します．

- **A** — 教材は，氏名など個人を特定できる情報を入力・保存・送信しません．
- **B** — 教材に入力した情報や作成したデータは利用者の端末内だけで扱い，外部への送信や保存は行いません．
- **C** — 入力内容の外部送信，クラウド保存，ログイン，アクセス解析などを行います．教材のファイルを配信するだけで，入力内容や作品を外部に送信・保存しない場合は，ガイドラインの例外に当たります．

## 作成・更新・連絡先

明治大学数学科准教授の宮部賢志とゼミの学生が制作を担当しています．

全教材の制作に，主に ChatGPT や Claude などの生成AIを利用しています．生成された内容は人が確認してから公開しています．数学的な内容は一通り確認していますが，細部まで十分な検証が済んでいるわけではありません．現在，教材の実行時には生成AIを使用していません．

各教材の最終更新日は，GitHub 上で該当するファイルの変更履歴（History）から確認できます．

内容に関するご指摘や不具合のご報告は，宮部賢志（<miyabe@meiji.ac.jp>）までお寄せください．

## 今後の予定

極限・微分・積分・複素関数論などの教材を順次追加します．

## 教材づくりの方針

- 自分で操作し，予想して確かめる．
- 図・言葉・数式を結びつけ，理由まで理解する．
- 成功例だけでなく，反例や条件も扱う．

## 数式の書き方

すべての教材でKaTeX 0.19.0を使用します．静的な数式は `data-tex` にTeXを書き，独立した数式には `data-display` を付けます．

```html
<span data-tex="\mu">μ</span>
<div data-tex="\bar{X}_n=\frac{1}{n}\sum_{i=1}^{n}X_i" data-display></div>
```

共通処理は `assets/math-typeset.js` と `assets/math-typeset.css` です．操作で更新された数式も再描画します．既存の計算・ゲーム処理が作るUnicode表記は表示時にTeXへ変換し，Canvas上の数式ラベルはKaTeXのHTMLを重ねて表示します．入力欄やネイティブの選択肢はプレーンテキストを保ち，数式は対応する解説・表示欄で組版します．

## 教材の利用条件

本教材集のうち，作成者が権利を有する解説文と図は，[クリエイティブ・コモンズ 表示–非営利 4.0 国際（CC BY-NC 4.0）](https://creativecommons.org/licenses/by-nc/4.0/deed.ja)で提供します．非営利の範囲で，個人学習や授業での利用，改変，再配布ができます．再配布する際は，出典・作成者・ライセンスを表示し，変更があればその旨を示してください．

作成者が権利を有する JavaScript も，非営利の範囲で自由に利用・改変・再配布できます．再配布する際は，出典と作成者を明記し，変更があればその旨を示してください．

教材の販売や自作コードの有料サービスへの組み込みなど，営利目的で利用したい場合は，事前に[作成者の連絡先](#作成更新連絡先)までご相談ください．第三者の素材や同梱ライブラリには，それぞれの利用条件が適用されます．

## 同梱ライブラリ

- KaTeX 0.19.0 の JavaScript と CSS は [MIT License](assets/vendor/katex-0.19.0/LICENSE)，同梱のフォントは [SIL Open Font License 1.1](assets/vendor/katex-0.19.0/fonts/OFL.txt) です．[KaTeX 0.19.0 の配布元](https://github.com/KaTeX/KaTeX/releases/tag/v0.19.0)
- 円周角の定理の CSS は Tailwind CSS 3.4.17（[MIT License](assets/vendor/tailwindcss-3.4.17/LICENSE)）で生成しています．クラスを追加・変更した場合は，3.4.17 の CLI で再生成してください．[Tailwind CSS 3.4.17 の配布元](https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17)

```sh
tailwindcss --content review/inscribed_angle_theorem.html --minify --output assets/vendor/tailwindcss-3.4.17/inscribed-angle.min.css
```
