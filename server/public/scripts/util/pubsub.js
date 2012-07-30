/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/util'
],
function(util) {
  var exports = {};

  exports.PubSub = function() {
    this.handlers = [];
  };

  exports.PubSub.prototype.subscribe = function(topic, fn) {
    var handler = this.handlers[topic] || (this.handlers[topic] = []);
    handler.push(fn);
  };

  exports.PubSub.prototype.publish = function(topic) {
    var handler = this.handlers[topic];
    var args = util.arraySlice(arguments, 1);
    if (handler) {
      handler.forEach(function(fn) {
        fn.apply(null, args);
      });
    }
  };

  return exports;
});
