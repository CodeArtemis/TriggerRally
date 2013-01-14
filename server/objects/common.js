// Copyright (c) 2012 jareiko. All rights reserved.

var crypto = require('crypto');
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var LFIB4 = require('../shared/LFIB4').LFIB4;

var PUB_ID_CHARSET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var PUB_ID_LENGTH = 8;

/*
console.log(
    'objects/common.js pub_id generation: ' + PUB_ID_LENGTH +
    ' digits of base ' + PUB_ID_CHARSET.length +
    ' >= 2^' + Math.floor(Math.log(Math.pow(PUB_ID_CHARSET.length, PUB_ID_LENGTH)) / Math.LN2));
*/

var pub_id_random = LFIB4([+new Date(), 47529830, 45652389]);  // no new.

exports.makePubId = function(value, opt_length) {
  var length = opt_length || PUB_ID_LENGTH;
  var chars = [];
  for (var i = 0; i < length; ++i) {
    chars.push(PUB_ID_CHARSET[Math.floor(pub_id_random() * PUB_ID_CHARSET.length)]);
  }
  return chars.join('');
}

exports.makeHash = function(value, salt) {
  var digest = crypto.createHash('sha1').update(salt).update(value).digest('base64');
  // Make URL safe.
  digest = digest.replace(/\+/g, '-');
  digest = digest.replace(/\//g, '_');
  return digest;
};

exports.makeHashMD5 = function(value) {
  var digest = crypto.createHash('md5').update(value).digest('hex');
  return digest;
};

exports.makeSalt = function() {
  return Math.floor(new Date().valueOf() * Math.random()) + '';
};


exports.formatDateAgo = function(date) {
  // Internationalize this, I dare you!
  function pl(c) { return c == 1 ? '' : 's'; }
  var c = Date.now() - date.getTime();
  c = Math.floor(c / 1000);
  if (c < 60) return 'just now';
  c = Math.floor(c / 60);
  if (c < 60) return c + ' minute' + pl(c) + ' ago';
  c = Math.floor(c / 60);
  if (c < 24) return c + ' hour' + pl(c) + ' ago';
  c = Math.floor(c / 24);
  if (c < 7) return c + ' day' + pl(c) + ' ago';
  c = Math.floor(c / 7);
  return c + ' week' + pl(c) + ' ago';
}
