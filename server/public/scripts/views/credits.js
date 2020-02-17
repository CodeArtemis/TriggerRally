/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'underscore',
  'views/view',
  'jade!templates/credits'
], function(
  _,
  View,
  template
) {
  let CreditsView;
  return CreditsView = (function() {
    CreditsView = class CreditsView extends View {
      static initClass() {
        this.prototype.el = '#credits';
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

      afterRender() {
        let updateCredits;
        const $creditsBox = this.$('.credits-box');
        let $userCredits = this.$('.usercredits');

        let prevCredits = null;

        (updateCredits = () => {
          const credits = this.app.root.user != null ? this.app.root.user.credits : undefined;
          if (credits != null) {
            $userCredits.text(credits);
            if ((prevCredits != null) && (credits > prevCredits)) {
              this.client.playSound('kaching');
              $creditsBox.addClass('flash');
              _.defer(() => $creditsBox.removeClass('flash'));
            }
          }
          $creditsBox.toggleClass('hidden', (credits == null));
          return prevCredits = credits;
        })();
        this.listenTo(this.app.root, 'change:user.credits', updateCredits);

        $userCredits = this.$('.ca-credit.usercredits');
        this.listenTo(this.app.root, 'change:user.credits', () => {
          return $userCredits.text(this.app.root.user != null ? this.app.root.user.credits : undefined);
        });

        // $creditsBox.on 'click', (event) =>
        //   @app.showCreditPurchaseDialog()
        //   false

      }
    };
    CreditsView.initClass();
    return CreditsView;
  })();
});
