// Copyright (c) 2012 jareiko. All rights reserved.

var fs = require('fs');

var files = [
  'Vector2',
  'Vector3',
  'Vector4',
  'Quaternion',
  'Matrix3',
  'Matrix4'
];

var THREE = exports;

files.forEach(function(file) {
  var filename = __dirname + '/core/' + file + '.js';
  var data = fs.readFileSync(filename, 'utf8');
  eval(data);
});
