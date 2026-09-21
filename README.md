# yamaga101.github.io

`yt-dual` の配信先。**正典は private リポジトリ `yamaga101/yt-dual`** で、ここに入るのは
組み上がった画面 (`dist/`) だけ。ここを直接編集しない — 次の配信で消える。

配信は正典側の `scripts/publish-app.sh` が行う。

## なぜ住所のいちばん上なのか
Android アプリ (TWA) が「この住所は自分のものだ」と名乗るための身分証明書
`/.well-known/assetlinks.json` は、**ドメインのいちばん上にしか置けない**。
`yamaga101.github.io/なにか/` のような枝分かれの下では Android が読みに来ない。

`.nojekyll` があるのは、GitHub Pages の既定の組版機が**点で始まる名前を無視する**ため。
これが無いと身分証明書が配信されず、アプリの検証が黙って失敗する。
