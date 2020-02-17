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
  'views/view',
  'jade!templates/home',
  'util/popup'
], function(
  View,
  template,
  popup
) {
  let HomeView;
  return HomeView = (function() {
    HomeView = class HomeView extends View {
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
        return this.listenTo(this.app.root, 'change:user', () => this.render());
      }

      viewModel() {
        return {
          loggedIn: (this.app.root.user != null),
          credits: (this.app.root.user != null ? this.app.root.user.credits : undefined)
        };
      }
        // xpTwitterPromo: @app.root.xp.dimension2

      afterRender() {
        let updateDriveButton, updatePromo;
        (updateDriveButton = () => {
          const trackId = this.app.root.track != null ? this.app.root.track.id : undefined;
          if (trackId) { return this.$('.drivebutton').attr('href', `/track/${trackId}/drive`); }
        })();
        this.listenTo(this.app.root, 'change:track.', updateDriveButton);

        const $userCredits = this.$('.ca-credit.usercredits');
        this.listenTo(this.app.root, 'change:user.credits', () => {
          // TODO: Animate credit gains.
          return $userCredits.text(this.app.root.user != null ? this.app.root.user.credits : undefined);
        });

        (updatePromo = () => {
          const products = (this.app.root.user != null ? this.app.root.user.products : undefined) != null ? (this.app.root.user != null ? this.app.root.user.products : undefined) : [];
          const packa = Array.from(products).includes('packa');
          this.$('.ignition-promo').toggleClass('hidden', packa || Array.from(products).includes('ignition'));
          return this.$('.mayhem-promo').toggleClass('hidden', packa || Array.from(products).includes('mayhem'));
        })();

        this.listenTo(this.app.root, 'change:user.products', updatePromo);

        // @$('.purchasebutton a').on 'click', (event) =>
        //   @app.showCreditPurchaseDialog()
        //   false

        // donateUrl = "https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WT7DH7FMW7DQ6"

        // @$('.donate-button').on 'click', =>
        //   ga 'send', 'event', 'donate', 'click'
        //   result = popup.create donateUrl, "Donate", (autoclosed) =>
        //     @destroy() if autoclosed
        //   alert 'Popup window was blocked!' unless result
        //   return false

        // @$('.promo-discount').on 'click', (event) =>
        //   @app.showCreditPurchaseDialog()
        //   false

      }
    };
    HomeView.initClass();
    return HomeView;
  })();
});
