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
  'jquery',
  'backbone-full',
  'views/view',
  'jade!templates/profile',
  'util/popup'
], function(
  $,
  Backbone,
  View,
  template,
  popup
) {
  let ProfileView;
  return ProfileView = (function() {
    let loadingText = undefined;
    let pictureSrc = undefined;
    let issueDate = undefined;
    ProfileView = class ProfileView extends View {
      static initClass() {
        // className: 'overlay'
        this.prototype.template = template;
  
        loadingText = '...';
        pictureSrc = function(picture) {
          if (picture == null) { picture = 'blank'; }
          return `${window.BASE_PATH}/images/profile/${picture}.jpg`;
        };
        issueDate = function(created) {
          const isoDate = function(d) {
            d = new Date(d);
            const z = n => (n < 10 ? "0" : "") + n;
            // Note that this will use local time.
            return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
          };
          if (created != null) { return isoDate(created); } else { return loadingText; }
        };
      }

      constructor(model, app, client) {
        super({ model }, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;
        Backbone.trigger('app:settitle', this.model.name);
        this.listenTo(this.model, 'change:name', () => Backbone.trigger('app:settitle', this.model.name));
        this.listenTo(this.model, 'change:id', () => this.render());
        this.listenTo(this.model, 'change:products', () => this.render());
        this.listenTo(this.app.root, 'change:user', () => this.render());
        return this.model.fetch({
          error() {
            console.error('profile loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      editable() { return this.model.id === (this.app.root.user != null ? this.app.root.user.id : undefined); }
      purchased() {
        const products = this.model.products != null ? this.model.products : [];
        return Array.from(products).includes('paid') || Array.from(products).includes('packa') || Array.from(products).includes('ignition') || Array.from(products).includes('mayhem');
      }

      viewModel() {
        const data = super.viewModel(...arguments);
        data.loaded = (data.name != null);
        data.issueDate = issueDate(data.created);
        if (data.name == null) { data.name = loadingText; }
        data.noPicture = (data.picture == null);
        // data.pic_src = pictureSrc data.picture
        data.editable = this.editable();
        data.purchased = this.purchased();
        data.title = data.purchased ? 'Rally License' : 'Provisional License';
        data.badges = [];
        const products = data.products != null ? data.products : [];
        if (Array.from(products).includes('ignition')) {
          data.badges.push({
            // href: '/ignition'
            href: '/purchase',
            img_src: '/images/packs/ignition.svg',
            img_title: 'Ignition Icarus'
          });
        }
        if (Array.from(products).includes('mayhem')) {
          data.badges.push({
            // href: '/mayhem'
            href: '/purchase',
            img_src: '/images/packs/mayhem.png',
            img_title: 'Mayhem Monster Truck'
          });
        }
        return data;
      }

      afterRender() {
        const $created = this.$('.issuedate');
        const $name = this.$('.user-name');
        const $pic = this.$('.picture');
        const $nameError = this.$('div.user-name-error');

        $pic.css('background-image', `url(${pictureSrc(this.model.picture)})`);

        this.listenTo(this.model, 'change:name', (model, value) => {
          return $name.text(value);
        });

        this.listenTo(this.model, 'change:picture', (model, value) => {
          return $pic.css('background-image', `url(${pictureSrc(this.model.picture)})`);
        });

        this.listenTo(this.model, 'change:created', (model, value) => {
          return $created.text(issueDate(value));
        });

        if (!this.editable()) { return; }

        $name.click(event => {
          const name = $name.text();
          const $input = $(`<input class=\"user-name\" type=\"text\", value=\"${name}\", maxlength=20></input>`);

          this.model.on('invalid', (model, error, options) => {
            $input.addClass('invalid');
            return $nameError.text(error);
          });
          $input.on('input', () => {
            this.model.set({ name: $input.val() });
            const invalid = this.model.validate();
            if (invalid) {
              $input.addClass('invalid');
              return $nameError.text(invalid);
            } else {
              $input.removeClass('invalid');
              return $nameError.text('');
            }
          });
          $input.keydown(event => {
            switch (event.keyCode) {
              case 13:
                if (!this.model.isValid()) { return; }
                return this.model.save(null, {
                  success: () => $input.remove(),
                  error: () => $nameError.text('Failed to save')
                }
                );
              case 27:
                return $input.remove();
            }
          });
          $input.blur(() => $input.remove());
          $name.parent().append($input);
          return $input.focus();
        });

        if (this.purchased()) {
          return $pic.click(event => {
            const picture = parseInt(this.model.picture != null ? this.model.picture : -1, 10);
            return this.model.save({ picture: (picture + 1) % 6 });
        });
        }
      }
    };
    ProfileView.initClass();
    return ProfileView;
  })();
});
