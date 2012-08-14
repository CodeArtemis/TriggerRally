#!/bin/bash

node ../node_modules/requirejs/bin/r.js -o drive.build.js
mkdir -p ../public/build-v2
cp ../public/build-out/drive-main.js ../public/build-v2/
rm -r ../public/build-out
