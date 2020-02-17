/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'jquery',
  'backbone-full',
  'views/view',
  'jade!templates/purchase',
  'util/popup'
], function(
  $,
  Backbone,
  View,
  template,
  popup
) {
  let PurchaseView;
  return PurchaseView = (function() {
    let pricing = undefined;
    PurchaseView = class PurchaseView extends View {
      static initClass() {
        this.prototype.className = 'overlay';
        this.prototype.template = template;

        // TODO: Supply this data from the server in a centralized way.

        pricing = {
          80: ['0.99', '0.29'],
          200: ['1.99', '0.59'],
          550: ['4.99', '1.49'],
          1200: ['9.99', '2.99'],
          2000: ['14.99', '4.49']
        };
      }
      constructor(user, app, client) {
        super({ model: user }, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;
      }

        // 200: ['1.99', '0.59']
        // 400: ['', '1.15']
        // 750: ['', '1.95']
        // 1150: ['', '2.95']
        // 2000: ['14.99', '4.49']

      viewModel() {
        let credits;
        return {
          credits: this.model.credits,
          options: (((() => {
            const result = [];
            for (credits in pricing) {
              const price = pricing[credits];
              result.push({credits, price});
            }
            return result;
          })()))
        };
      }

      afterRender() {
        const { root } = this.app;

        this.$('.modal-blocker').on('click', event => {
          return this.destroy();
        });

        this.$('.purchasecredits input:radio[value=\"550\"]').prop('checked', true);

        // $displayAmount = @$('.display-amount')
        // $displayAmount.text 'default'
        // @$('.purchasecredits input:radio').on 'change', (event) ->
        //   opt = pricing[@value]
        //   $displayAmount.text '$' + opt

        const creditsVal = () => {
          return parseInt(this.$('input[name=credits]:checked').val());
        };

        const creditsPrice = credits => pricing[credits] != null ? pricing[credits][0] : undefined;

        const checkoutUrl = () => {
          return `/checkout?method=paypal&cur=USD&pack=credits${creditsVal()}&popup=1`;
        };

        this.$('.checkout').on('click', () => {
          ga('send', 'event', 'purchase', 'click', 'checkout', creditsVal());
          const result = popup.create(checkoutUrl(), "Checkout", autoclosed => {
            if (autoclosed) { this.destroy(); }
            return root.user.fetch({force: true});
          });
          if (!result) { alert('Popup window was blocked!'); }
          return false;
        });

        // Stripe

        const handler = StripeCheckout.configure({
          key: 'pk_test_Egw8Gsn2RhjFo6PXvPdXbdQ4',
          image: 'https://triggerrally.com/images/logo.jpg',
          token: function(token, args) {
            console.log(arguments);
            // Use the token to create the charge with a server-side script.
            // You can access the token ID with `token.id`
            const email = encodeURIComponent(token.email);
            return $.ajax({
              url: `/checkout?method=stripe&cur=USD&pack=credits${creditsVal()}&token=${token.id}&email=${email}`})
            .success((data, textStatus, jqXHR) => {
              this.destroy();
              return root.user.fetch({force: true});
            });
          }.bind(this)
        });

        this.$('button.checkout-stripe').on('click', e => {
          e.preventDefault();
          const cVal = creditsVal();
          const cPrice = creditsPrice(cVal);
          ga('send', 'event', 'purchase', 'click', 'checkoutStripe', cVal);
          handler.open({
            name: `Purchase ${cVal} credits`,
            // description: "#{cVal} credits ($#{cPrice})"
            amount: Math.round(cPrice * 100)
          });
          return false;
        });

        ga('send', 'pageview', {
          page: '/purchase-credits',
          title: 'Purchase Credits Dialog'
        }
        );
      }
    };
    PurchaseView.initClass();
    return PurchaseView;
  })();
});
