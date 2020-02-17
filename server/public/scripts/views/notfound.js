/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'views/view',
  'jade!templates/notfound'
], function(
  Backbone,
  View,
  template
) {
  let NotFoundView;
  return NotFoundView = (function() {
    NotFoundView = class NotFoundView extends View {
      static initClass() {
        this.prototype.className = 'overlay';
        this.prototype.template = template;
      }
      afterRender() {
        return Backbone.trigger('app:settitle', 'Not Found');
      }
    };
    NotFoundView.initClass();
    return NotFoundView;
  })();
});
