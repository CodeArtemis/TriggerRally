/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/util'
],
function(util) {
  var exports = {};
  var CallbackQueue = util.CallbackQueue;

  exports.WebkitAudio = function() {
    if (true && 'webkitAudioContext' in window) {
      this.audio = new webkitAudioContext();
      this.master = this.audio.createGainNode();
      this.master.connect(this.audio.destination);
    }

    // Map from url to buffer.
    this.buffers = {};
    // Two gain values allow independent volume control and muting.
    this.gain = 1;
    this.muteGain = 1;
    // TODO: Find a way to save CPU when set to zero gain.
  };

  var prot = exports.WebkitAudio.prototype;

  prot._updateGain = function() {
    if (!this.audio) return;
    this.master.gain.value = this.gain * this.muteGain;
  };

  prot.mute = function() {
    this.muteGain = 0;
    this._updateGain();
  };

  prot.unmute = function() {
    this.muteGain = 1;
    this._updateGain();
  };

  prot.setGain = function(gain) {
    this.gain = gain;
    this._updateGain();
  };

  // Return buffer iff already loaded.
  prot.getBuffer = function(url) {
    var buffer = this.buffers[url];
    return (buffer instanceof CallbackQueue) ? null : buffer || null;
  };

  prot.loadBuffer = function(url, callback) {
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

  prot.playSound = function(buffer, loop, gain, rate) {
    var source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.loop = loop;
    source.gain.value = gain;
    source.playbackRate.value = (rate === undefined) ? 1 : rate;
    source.start(0);
    return source;
  };

  prot.playRange = function(buffer, offset, duration, gain, rate) {
    var source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.loop = false;
    source.gain.value = gain;
    source.playbackRate.value = (rate === undefined) ? 1 : rate;
    source.start(0, offset, duration);
    return source;
  };

  return exports;
});
