/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'views/view',
  'jade!templates/mayhem',
  'util/popup'
], function(
  Backbone,
  View,
  template,
  popup
) {
  let MayhemView;
  const productId = 'mayhem';
  const carId = 'Mayhem';

  return MayhemView = (function() {
    MayhemView = class MayhemView extends View {
      static initClass() {
        // className: 'overlay'
        this.prototype.template = template;
      }

      constructor(app, client) {
        super({}, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;
        this.app.root.prefs.car = carId;
        this.listenTo(this.app.root, 'change:user', () => this.render());
        return this.listenTo(this.app.root, 'change:user.products', () => this.render());
      }

      viewModel() {
        const products = (this.app.root.user != null ? this.app.root.user.products : undefined) != null ? (this.app.root.user != null ? this.app.root.user.products : undefined) : [];
        return {
          purchased: Array.from(products).includes('packa') || Array.from(products).includes(productId),
          user: this.app.root.user
        };
      }

      afterRender() {
        const { app } = this;
        const $buybutton = this.$('a.buybutton');
        // TODO: Disable buy button on click.
        return $buybutton.on('click', function() {
          if (app.root.user.credits >= 400) {
            $.ajax({
              url: this.href})
            .done(() =>
              app.root.user.fetch({
                force: true})
            );
          } else {
            app.showCreditPurchaseDialog();
          }
          return false;
        });
      }
    };
    MayhemView.initClass();
    return MayhemView;
  })();
});
