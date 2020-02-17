/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */


const args = process.argv.slice(2);

if (args.length !== 6) {
  console.log('Syntax: hgt [hgt/base/dir/] [lat from] [lat to] [long from] [long to] [out.tga]');
  process.exit();
}

const [inDir, latFrom, latTo, longFrom, longTo, outFile] = Array.from(args);

const fs = require('fs');

const tileCache = {};

const tileAt = function(lat, long) {
  // TODO: Proper formatting.
  let data, pixels;
  const name = `N${lat}E00${long}`;
  if (tileCache[name] != null) { return tileCache[name]; }
  try {
    data = fs.readFileSync(inDir + name + '.hgt');
    pixels = data.length / 2;
  } catch (error) {
    console.log(error);
    data = null;
    pixels = 0;
  }
  return tileCache[name] = {
    data,
    pixels,
    size: Math.sqrt(pixels)
  };
};

const tileSample = function(tile, latSecsWithinTile, longSecsWithinTile) {
  if (tile.data != null) {
    const offset = (((3600 - latSecsWithinTile) * tile.size) + longSecsWithinTile) * 2;
    return (tile.data[offset + 0] * 256) + tile.data[offset + 1];
  } else {
    return 0;
  }
};

const worldSample = function(latSecs, longSecs) {
  const latTile = Math.floor(latSecs / 3600);
  const latSecsWithinTile = latSecs - (latTile * 3600);
  const longTile = Math.floor(longSecs / 3600);
  const longSecsWithinTile = longSecs - (longTile * 3600);
  const tile = tileAt(latTile, longTile);
  return tileSample(tile, latSecsWithinTile, longSecsWithinTile);
};

const tgaHeader = function(width, height) {
  const outData = [];
  outData.push(0);      // identsize
  outData.push(0);      // colourmaptype
  outData.push(2);      // imagetype : 2=RGB, 3=grey
  outData.push(0, 0);   // colourmapstart
  outData.push(0, 0);   // colourmaplength
  outData.push(0);      // colourmapbits
  outData.push(0, 0);   // xstart
  outData.push(0, 0);   // ystart
  outData.push(width & 0x00FF, (width & 0xFF00) / 256);    // width
  outData.push(height & 0x00FF, (height & 0xFF00) / 256);  // height
  outData.push(24);     // bits per pixel
  outData.push(0);      // descriptor
  return outData;
};

const cubic = x => (3 * x*x) - (2 * x*x*x);

const latFromSecs = Math.floor(latFrom * 3600);
const latToSecs = Math.floor(latTo * 3600);
const longFromSecs = Math.floor(longFrom * 3600);
const longToSecs = Math.floor(longTo * 3600);

const heightSecs = latToSecs - latFromSecs;
const widthSecs = longToSecs - longFromSecs;

const outData = tgaHeader(widthSecs, heightSecs);

const BORDER = 0.1;

const lastVal = undefined;

const writeVal = function(val) {
  outData.push(0);
  outData.push(Math.floor(val / 256));
  return outData.push(Math.floor(val));
};

for (let latSecs = latFromSecs, end = latToSecs, asc = latFromSecs <= end; asc ? latSecs < end : latSecs > end; asc ? latSecs++ : latSecs--) {
  for (let longSecs = longFromSecs, end1 = longToSecs, asc1 = longFromSecs <= end1; asc1 ? longSecs < end1 : longSecs > end1; asc1 ? longSecs++ : longSecs--) {
    const latF = (latSecs - latFromSecs) / (latToSecs - latFromSecs);
    const longF = (longSecs - longFromSecs) / (longToSecs - longFromSecs);

    let val = 0;
    let weight = 0;
    for (let latSample = -1, asc2 = -1 <= 1; asc2 ? latSample <= 1 : latSample >= 1; asc2 ? latSample++ : latSample--) {
      const latSampleF = latF + latSample;
      const latW = Math.max(0, 0.5 * Math.min(2, 1 + (Math.min(latSampleF, 1 - latSampleF) / BORDER)));
      for (let longSample = -1, asc3 = -1 <= 1; asc3 ? longSample <= 1 : longSample >= 1; asc3 ? longSample++ : longSample--) {
        const longSampleF = longF + longSample;
        const longW = Math.max(0, 0.5 * Math.min(2, 1 + (Math.min(longSampleF, 1 - longSampleF) / BORDER)));
        if ((latW > 0) && (longW > 0)) {
          const w = cubic(latW) * cubic(longW);
          val += w * worldSample(latSecs + (widthSecs * latSample),
                                 longSecs + (heightSecs * longSample));
          weight += w;
        }
      }
    }

    if (weight > 0) { val /= weight; }
    writeVal(val);
  }
}

fs.writeFileSync(outFile, new Buffer(outData));
