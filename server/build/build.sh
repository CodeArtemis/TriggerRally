#!/bin/bash

cd "$( dirname "$0" )"

RJS=../node_modules/requirejs/bin/r.js

TMP=../public/build-out
FIN=../public/build-v3

mkdir -p $FIN
node $RJS -o drive.build.js && cp $TMP/drive-main.js $FIN/
node $RJS -o editor.build.js && cp $TMP/editor/editor-main.js $FIN/
rm -r $TMP
