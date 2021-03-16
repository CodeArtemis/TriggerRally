/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/util'
],
function(util) {
  var exports = {};
  var CallbackQueue = util.CallbackQueue;

  exports.Audio = function() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.audio = new AudioContext();
      this.master = this.audio.createGain();
      this.master.connect(this.audio.destination);
    }

    // Map from url to buffer.
    this.buffers = {};
    // Two gain values allow independent volume control and muting.
    this.gain = 1;
    this.muteGain = 1;
    // TODO: Find a way to save CPU when set to zero gain.
  };

  var prot = exports.Audio.prototype;

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
    url = window.BASE_PATH + url
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
      this.audio.decodeAudioData(request.response, function(buffer) {
        this.buffers[url] = buffer;
        cbq.fire(buffer);
      }.bind(this), function() {
        throw new Error("Error decoding audio.");
      });
    }.bind(this);
    request.send();
  };

  // TODO: Merge duplicate code in these two methods.
  prot.playSound = function(buffer, loop, gain, rate) {
    var source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = (rate === undefined) ? 1 : rate;
    if (source.gain) {
      source.connect(this.master);
    } else {
      var gainNode = this.audio.createGain();
      source.gain = gainNode.gain;
      gainNode.connect(this.master);
      source.connect(gainNode);
    }
    source.gain.value = gain;
    source.start(0);
    return source;
  };

  prot.playRange = function(buffer, offset, duration, gain, rate) {
    var source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.playbackRate.value = (rate === undefined) ? 1 : rate;
    if (source.gain) {
      source.connect(this.master);
    } else {
      var gainNode = this.audio.createGain();
      source.gain = gainNode.gain;
      gainNode.connect(this.master);
      source.connect(gainNode);
    }
    source.gain.value = gain;
    source.start(0, offset, duration);
    return source;
  };

  return exports;
});
