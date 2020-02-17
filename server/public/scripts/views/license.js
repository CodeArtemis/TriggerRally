/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'views/view',
  'jade!templates/license'
], function(
  Backbone,
  View,
  template
) {
  let AboutView;
  return AboutView = (function() {
    AboutView = class AboutView extends View {
      static initClass() {
        this.prototype.className = 'overlay';
        this.prototype.template = template;
      }

      constructor(app, client) {
        super({}, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;
      }
    };
    AboutView.initClass();
    return AboutView;
  })();
});
