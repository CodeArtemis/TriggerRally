/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'underscore',
  'views/view',
  'jade!templates/packa',
  'util/popup'
], function(
  Backbone,
  _,
  View,
  template,
  popup
) {
  let MayhemView;
  const productId = 'packa';

  const priceMessages =
    {a: 'For <b>5.99 USD</b> you get:'};
    // b: 'For just <b>5.99 USD</b> you get:'

  const defaultPrice = '5';

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
        this.listenTo(this.app.root, 'change:user', () => this.render());
        return this.listenTo(this.app.root, 'change:user.products', () => this.render());
      }

      viewModel() {
        const pmkeys = ((() => {
          const result = [];
          for (let key in priceMessages) {
            result.push(key);
          }
          return result;
        })());
        const pmkey = (this.pmkey = pmkeys[Math.floor(Math.random() * pmkeys.length)]);
        const products = (this.app.root.user != null ? this.app.root.user.products : undefined) != null ? (this.app.root.user != null ? this.app.root.user.products : undefined) : [];
        return {
          purchased: Array.from(products).includes(productId),
          user: this.app.root.user,
          pmkey,
          priceHtml: priceMessages[pmkey],
          checkedPrice: defaultPrice
        };
      }

      nullUrl() {
        return "javascript:;";
      }
      checkoutUrl(amt) {
        return `/checkout?pmkey=${this.pmkey}&method=paypal&cur=USD&amt=${amt}&pack=full`;
      }

      afterRender() {
        const { root } = this.app;

        const $customprice    = this.$('.checkout-box .customprice');
        const $messageminimum = this.$('.checkout-box .message.minimum');
        const $messagepaypal  = this.$('.checkout-box .message.paypal');
        const $checkout       = this.$('.checkout-box a.checkout');

        const $customPriceRadio = this.$('.checkout-box input:radio[value=\"custom\"]');

        const clearMessages = function() {
          $messageminimum.addClass('zeroalpha');
          return $messagepaypal.addClass('zeroalpha');
        };

        let price = defaultPrice;
        const checkoutUrl = () => {
          return `/checkout?pmkey=${this.pmkey}&method=paypal&cur=USD&amt=${price}&pack=full`;
        };

        this.$(`.checkout-box input:radio[value=\"${defaultPrice}\"]`).prop('checked', true);

        const updateCustomPrice = function(event) {
          $customPriceRadio.prop('checked', true);
          let inp = $customprice.val();
          while ([ '$', '-' ].includes(inp[0])) { inp = inp.slice(1); }
          inp = inp.replace(',', '.');
          inp = parseFloat(inp);
          clearMessages();
          if (Number.isNaN(inp)) {
            $messageminimum.removeClass('zeroalpha');
            return price = null;
          } else {
            let val = inp.toFixed(2);
            $customprice.val(`$${val}`);
            if (inp <= 0.31) {
              $messagepaypal.removeClass('zeroalpha');
            }
            if (inp < 0.01) {
              $messageminimum.removeClass('zeroalpha');
              return price = null;
            } else {
              val = inp.toFixed(2);
              return price = val;
            }
          }
        };

        this.$('.checkout-box input:radio').on('change', function(event) {
          if (this.value === 'custom') {
            $customprice.removeClass('zeroalpha');
            return updateCustomPrice();
          } else {
            return price = this.value;
          }
        });

        $customprice.on('change', updateCustomPrice);

        this.$('.checkout').on('click', function() {
          if (!price) { return false; }
          const result = popup.create(checkoutUrl(), "Checkout", () =>
            root.user.fetch({
              force: true})
          );
          if (!result) { alert('Popup window was blocked!'); }
          return false;
        });

      }
    };
    MayhemView.initClass();
    return MayhemView;
  })();
});
