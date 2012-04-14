/**
 * @author jareiko / http://www.jareiko.net/
 */

// Browser-only utils.

// Mimics node's require, but for use in browser.
var require = function(module) {
  return window[module];
};

var getUrlVars = function(hash) {
  var vars = {};
  var pieces = hash.substring(1).split('&');
  for (var i = 0; i < pieces.length; ++i ) {
    var splitPieces = pieces[i].split('=');
    if (splitPieces.length == 2) {
      vars[splitPieces[0]] = decodeURIComponent(splitPieces[1]);
    }
  }
  return vars;
};

function $(id) {
  return document.getElementById(id);
};
function $$(cls) {
  return document.getElementsByClassName(cls);
};
