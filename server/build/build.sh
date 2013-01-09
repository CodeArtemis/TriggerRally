#!/bin/bash

cd "$( dirname "$0" )"

mkdir -p ../public/build-v3
node ../node_modules/requirejs/bin/r.js -o drive.build.js
cp ../public/build-out/drive-main.js ../public/build-v3/
node ../node_modules/requirejs/bin/r.js -o editor.build.js
cp ../public/build-out/editor/editor-main.js ../public/build-v3/
rm -r ../public/build-out
