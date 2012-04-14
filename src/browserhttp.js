/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'browserhttp';

(function(exports) {
  exports.get = function(options, callback) {
    // ONLY USES options.path
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status == 200) {
        callback(null, xhr.responseText);
      } else {
        callback(xhr.status);
      }
    };
    xhr.onerror = function() {
      callback('Error');
    };
    xhr.open('GET', options.path, true);
    xhr.send();
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
