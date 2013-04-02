#!/bin/bash

cd "$( dirname "$0" )"

RJS=../node_modules/requirejs/bin/r.js

TMP=../public/build-out
FIN=../public/build-v3

mkdir -p $FIN

# node $RJS -o drive.build.js && cp $TMP/drive-main.js $FIN/

node $RJS -o editor.build.js && \
  uglifyjs $TMP/editor/editor-main.js -o $FIN/editor-main.js -c -m -r require

rm -r $TMP
