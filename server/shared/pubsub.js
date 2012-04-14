/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'pubsub';

(function(exports) {
  var util = this.util || require('./util');

  exports.PubSub = function() {
    this.handlers = [];
  };

  exports.PubSub.prototype.subscribe = function(topic, fn) {
    var handler = this.handlers[topic] || (this.handlers[topic] = []);
    handler.push(fn);
  };

  exports.PubSub.prototype.publish = function(topic) {
    var handler = this.handlers[topic];
    if (handler) {
      handler.forEach(function(fn) {
        fn.apply(null, util.arraySlice(arguments, 1));
      });
    }
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
