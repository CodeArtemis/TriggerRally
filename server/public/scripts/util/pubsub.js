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
    obj.subscribe = on;
    obj.trigger = trigger;
    obj.publish = trigger;
  };
  exports.PubSub.mixin(exports.PubSub.prototype);

  return exports;
});
