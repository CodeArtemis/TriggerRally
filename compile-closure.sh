#!/bin/sh

#LEVEL=SIMPLE_OPTIMIZATIONS
LEVEL=WHITESPACE_ONLY

# Stop script on any error.
set -e

# Compile CoffeeScript files.
WORK=intermediate
mkdir -p $WORK
coffee -c -o $WORK \
  server/shared/hash2d.coffee \
  src/array_geometry.coffee \
  src/render_scenery.coffee

# Concatenate and optimize JavaScript files.
java -jar $HOME/src/closure-compiler/compiler.jar \
  --compilation_level $LEVEL \
  --js=server/shared/LFIB4.js \
  --js=server/shared/util.js \
  --js=server/shared/pubsub.js \
  --js=server/shared/recorder.js \
  --js=server/shared/pterrain.js \
  --js=server/shared/psim.js \
  --js=server/shared/pvehicle.js \
  --js=server/shared/track.js \
  --js=server/shared/game.js \
  --js=src/util.js \
  --js=src/async.js \
  --js=src/browserhttp.js \
  --js=src/audio.js \
  --js=src/car.js \
  --js=$WORK/hash2d.js \
  --js=$WORK/array_geometry.js \
  --js=$WORK/render_scenery.js \
  --js=src/drive.js \
  --js_output_file=server/public/js/trigger.js
