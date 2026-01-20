/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'views/view',
  'jade!templates/user',
  'jade!templates/userstatus'
], function(
  View,
  templateBasic,
  templateWithStatus
) {
  let UserView;
  return UserView = (function() {
    UserView = class UserView extends View {
      static initClass() {
        this.prototype.tagName = 'span';
      }

      initialize() {
        super.initialize(...arguments);
        this.render();
        if (this.model) { this.listenTo(this.model, 'change', () => this.render()); }
        return (this.model != null ? this.model.fetch() : undefined);
      }

      template(viewModel) {
        const template = this.options.showStatus ? templateWithStatus : templateBasic;
        return template(viewModel);
      }

      viewModel() {
        const attrs = this.model ? this.model.toJSON() : {};
        //const img_src = `${window.BASE_PATH}/images/profile/${attrs.picture || 'blank'}.jpg`;
        const img_src = `${window.BASE_PATH}/images/profile/blank.jpg`;
      
        return {
          user: attrs,
          img_src
        };
      }
    };
    UserView.initClass();
    return UserView;
  })();
});
