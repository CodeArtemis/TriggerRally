/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/util'
],
function(util) {
  var exports = {};

  var on = function(topic, fn) {
    var handlers = this._handlers || (this._handlers = {});
    var handler = handlers[topic] || (handlers[topic] = []);
    handler.push(fn);
  };

  var off = function(topic, fn) {
    var handlers = this._handlers;
    if (!handlers) return;
    var handler = handlers[topic];
    if (!handler) return;
    var idx;
    while ((idx = handler.indexOf(fn)) != -1) {
      handler.splice(idx, 1);
    };
  };

  var trigger = function(topic) {
    var handlers = this._handlers;
    if (!handlers) return;
    var handler = handlers[topic];
    if (!handler) return;
    var args = util.arraySlice(arguments, 1);
    handler.forEach(function(fn) {
      fn.apply(null, args);
    });
  };

  exports.PubSub = function() {};
  exports.PubSub.mixin = function(obj) {
    obj.on = on;
    obj.off = off;
    obj.trigger = trigger;

    // Deprecated methods.
    obj.subscribe = on;
    obj.publish = trigger;
  };
  exports.PubSub.mixin(exports.PubSub.prototype);

  return exports;
});
