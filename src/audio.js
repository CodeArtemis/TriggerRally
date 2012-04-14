/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'audio';

(function(exports) {
  var CallbackQueue = util.CallbackQueue;

  exports.WebkitAudio = function() {
    if (true && 'webkitAudioContext' in window) {
      this.audio = new webkitAudioContext();
    }

    // Map from url to buffer.
    this.buffers = {};
  };

  // Return buffer iff already loaded.
  exports.WebkitAudio.prototype.getBuffer = function(url) {
    var buffer = this.buffers[url];
    return (buffer instanceof CallbackQueue) ? null : buffer || null;
  };

  exports.WebkitAudio.prototype.loadBuffer = function(url, callback) {
    if (url in this.buffers) {
      var buffer = this.buffers[url];
      if (buffer instanceof CallbackQueue) {
        buffer.add(callback);
      } else {
        callback(this.buffers[url]);
      }
      return;
    }
    if (!this.audio) return;
    var cbq = new CallbackQueue(callback);
    this.buffers[url] = cbq;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
      var buffer = this.audio.createBuffer(request.response, true);
      this.buffers[url] = buffer;
      cbq.fire(buffer);
    }.bind(this);
    request.send();
  };

  exports.WebkitAudio.prototype.playSound = function(buffer, loop, gain, rate) {
    var source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audio.destination);
    source.loop = loop;
    source.gain.value = gain;
    source.playbackRate.value = (rate === undefined) ? 1 : rate;
    source.noteOn(0);
    return source;
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
