###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###


args = process.argv.slice(2)

if args.length isnt 6
  console.log 'Syntax: hgt [hgt/base/dir/] [lat from] [lat to] [long from] [long to] [out.tga]'
  process.exit()

[inDir, latFrom, latTo, longFrom, longTo, outFile] = args

fs = require 'fs'

tileCache = {}

tileAt = (lat, long) ->
  # TODO: Proper formatting.
  name = 'N' + lat + 'E00' + long
  if tileCache[name]? then return tileCache[name]
  try
    data = fs.readFileSync inDir + name + '.hgt'
    pixels = data.length / 2
  catch error
    console.log error
    data = null
    pixels = 0
  tileCache[name] =
    data: data
    pixels: pixels
    size: Math.sqrt pixels

tileSample = (tile, latSecsWithinTile, longSecsWithinTile) ->
  if tile.data?
    offset = ((3600 - latSecsWithinTile) * tile.size + longSecsWithinTile) * 2
    tile.data[offset + 0] * 256 + tile.data[offset + 1]
  else
    0

worldSample = (latSecs, longSecs) ->
  latTile = Math.floor latSecs / 3600
  latSecsWithinTile = latSecs - latTile * 3600
  longTile = Math.floor longSecs / 3600
  longSecsWithinTile = longSecs - longTile * 3600
  tile = tileAt latTile, longTile
  tileSample tile, latSecsWithinTile, longSecsWithinTile

tgaHeader = (width, height) ->
  outData = []
  outData.push 0      # identsize
  outData.push 0      # colourmaptype
  outData.push 2      # imagetype : 2=RGB, 3=grey
  outData.push 0, 0   # colourmapstart
  outData.push 0, 0   # colourmaplength
  outData.push 0      # colourmapbits
  outData.push 0, 0   # xstart
  outData.push 0, 0   # ystart
  outData.push width & 0x00FF, (width & 0xFF00) / 256    # width
  outData.push height & 0x00FF, (height & 0xFF00) / 256  # height
  outData.push 24     # bits per pixel
  outData.push 0      # descriptor
  outData

cubic = (x) -> 3 * x*x - 2 * x*x*x

latFromSecs = Math.floor latFrom * 3600
latToSecs = Math.floor latTo * 3600
longFromSecs = Math.floor longFrom * 3600
longToSecs = Math.floor longTo * 3600

heightSecs = latToSecs - latFromSecs
widthSecs = longToSecs - longFromSecs

outData = tgaHeader widthSecs, heightSecs

BORDER = 0.1

lastVal = undefined

writeVal = (val) ->
  outData.push 0
  outData.push Math.floor val / 256
  outData.push Math.floor val

for latSecs in [latFromSecs...latToSecs]
  for longSecs in [longFromSecs...longToSecs]
    latF = (latSecs - latFromSecs) / (latToSecs - latFromSecs)
    longF = (longSecs - longFromSecs) / (longToSecs - longFromSecs)

    val = 0
    weight = 0
    for latSample in [-1..1]
      latSampleF = latF + latSample
      latW = Math.max 0, 0.5 * Math.min 2, 1 + Math.min(latSampleF, 1 - latSampleF) / BORDER
      for longSample in [-1..1]
        longSampleF = longF + longSample
        longW = Math.max 0, 0.5 * Math.min 2, 1 + Math.min(longSampleF, 1 - longSampleF) / BORDER
        if latW > 0 and longW > 0
          w = cubic(latW) * cubic(longW)
          val += w * worldSample latSecs + widthSecs * latSample,
                                 longSecs + heightSecs * longSample
          weight += w

    if weight > 0 then val /= weight
    writeVal val

fs.writeFileSync outFile, new Buffer(outData)
