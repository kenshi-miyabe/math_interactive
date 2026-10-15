# さわる数学

図を動かし、数値を変え、ゲームに挑戦しながら数学の「なぜ？」を学ぶインタラクティブ教材集です。

## 高校生向け

- [割線から接線へ](https://kenshi-miyabe.github.io/math_interactive/derivative_visualizer.html) — 2点を近づけ、点の周りを拡大しながら微分係数を考えます。
- [論理式をゲームとして読む](https://kenshi-miyabe.github.io/math_interactive/logic_game.html) — 数を選ぶゲームで、「ある」「すべて」の意味と順番を考えます。
- [いちごたっぷりパフェを選ぼう](https://kenshi-miyabe.github.io/math_interactive/secretary_problem_challenge.html) — パフェ選びを通して、決断のタイミングと37%ルールを探ります。

## 大学生向け

### 微積分

- [ε–δチャレンジ](https://kenshi-miyabe.github.io/math_interactive/epsilon_delta_challenge.html) — εに対してδを選び、連続性の定義を確かめます。
- [テイラー展開ビジュアライザ](https://kenshi-miyabe.github.io/math_interactive/taylor_series_visualizer.html) — 次数と中心を動かし、多項式による関数の近似を見ます。
- [リーマン積分をつくる](https://kenshi-miyabe.github.io/math_interactive/riemann_integral.html) — 分割と代表点を変え、リーマン和と積分の定義を確かめます。

### 確率・統計

- [中心極限定理をさわる](https://kenshi-miyabe.github.io/math_interactive/central_limit_theorem.html) — 標本数を増やし、標準化した標本平均の密度ヒストグラムが標準正規分布に近づく様子を観察します。

- [大数の法則をさわる](https://kenshi-miyabe.github.io/math_interactive/law_of_large_numbers.html) — 分布とパラメータを選び、複数の標本平均が期待値へ近づく様子を観察します。

- [分散の推定をくらべる](https://kenshi-miyabe.github.io/math_interactive/variance_estimators.html) — 標本を繰り返し取り、標本分散と不偏分散を比較します。
- [2次元正規分布をさわる](https://kenshi-miyabe.github.io/math_interactive/bivariate_normal_3d.html) — 平均・分散・相関を動かし、確率密度の3D曲面を見ます。

対象は目安です。高校生向けの教材にも、大学生向けの理論や発展問題を含みます。

## 使い方

教材のリンクを開くか、このリポジトリをダウンロードしてHTMLファイルをブラウザで開いてください。インストールやビルドは不要です。 数式の表示にはKaTeXを使います（CDNからの読み込みにインターネット接続が必要です）。HTMLを移動する際は、共通の表示処理を含む `assets/` フォルダも一緒に移動してください。

## 今後の予定

極限・微分・積分・複素関数論などの教材を順次追加します。

## 教材づくりの方針

- 自分で操作し、予想して確かめる。
- 図・言葉・数式を結びつけ、理由まで理解する。
- 成功例だけでなく、反例や条件も扱う。

## 数式の書き方

すべての教材でKaTeX 0.19.0を使用します。静的な数式は `data-tex` にTeXを書き、独立した数式には `data-display` を付けます。

```html
<span data-tex="\mu">μ</span>
<div data-tex="\bar{X}_n=\frac{1}{n}\sum_{i=1}^{n}X_i" data-display></div>
```

共通処理は `assets/math-typeset.js` と `assets/math-typeset.css` です。操作で更新された数式も再描画します。既存の計算・ゲーム処理が作るUnicode表記は表示時にTeXへ変換し、Canvas上の数式ラベルはKaTeXのHTMLを重ねて表示します。入力欄やネイティブの選択肢はプレーンテキストを保ち、数式は対応する解説・表示欄で組版します。
