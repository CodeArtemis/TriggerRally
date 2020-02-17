/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'underscore',
  'views/view',
  'views/credits',
  'views/statusbar',
  'client/client',
  'jade!templates/unified',
  'util/popup'
], function(
  Backbone,
  _,
  View,
  CreditsView,
  StatusBarView,
  TriggerClient,
  template,
  popup
) {
  let UnifiedView;
  const { $ } = Backbone;

  return UnifiedView = (function() {
    let lastTime = undefined;
    UnifiedView = class UnifiedView extends View {
      static initClass() {
        this.prototype.el = '#unified-container';
        this.prototype.template = template;

        lastTime = null;
      }

      constructor(app) {
        super({}, app);
      }

      initialize(options, app) {
        this.update = this.update.bind(this);
        this.app = app;

        // We maintain 2 view references, one for 3D and one for DOM.
        // They may be the same or different.
        // This is fragile, requiring careful bookkeeping in setView* methods.
        // TODO: Find a better solution.
        this.currentView3D = null;     // Controls 3D rendering.
        this.currentViewChild = null;  // Controls DOM.
        this.currentDialog = null;
      }

      afterRender() {
        let layout;
        const statusBarView = new StatusBarView(this.app);
        statusBarView.render();

        const $window = $(window);
        const $document = $(document);
        const $view3d = this.$('#view3d');
        const $child = (this.$child = this.$('#unified-child'));
        const $statusMessage = this.$('#status-message');
        const $scaledUi = this.$('#scaled-ui');

        const client = (this.client = new TriggerClient($view3d[0], this.app.root));
        client.camera.rotation.order = 'ZYX';

        const creditsView = new CreditsView(this.app, client);
        creditsView.render();

        $document.on('keyup', event => {
          client.onKeyUp(event);
          return __guardMethod__(this.currentView3D, 'onKeyUp', o => o.onKeyUp(event));
        });
        $document.on('keydown', event => {
          client.onKeyDown(event);
          return __guardMethod__(this.currentView3D, 'onKeyDown', o => o.onKeyDown(event));
        });
        $view3d.on('mousedown', event => {
          return __guardMethod__(this.currentView3D, 'onMouseDown', o => o.onMouseDown(event));
        });
        $view3d.on('mousemove', event => {
          return __guardMethod__(this.currentView3D, 'onMouseMove', o => o.onMouseMove(event));
        });
        $view3d.on('mouseout', event => {
          return __guardMethod__(this.currentView3D, 'onMouseOut', o => o.onMouseOut(event));
        });
        $view3d.on('mouseup', event => {
          return __guardMethod__(this.currentView3D, 'onMouseUp', o => o.onMouseUp(event));
        });
        $view3d.on('mousewheel', event => {
          return __guardMethod__(this.currentView3D, 'onMouseWheel', o => o.onMouseWheel(event));
        });

        (layout = function() {
          const statusbarHeight = statusBarView.height();
          $view3d.css('top', statusbarHeight);
          $child.css('top', statusbarHeight);
          const width = $view3d.width();
          const height = $window.height() - statusbarHeight;
          $view3d.height(height);
          client.setSize(width, height);

          const cx = 32;
          const cy = 18;
          const targetAspect = cx / cy;
          const aspect = width / height;
          const fontSize = aspect >= targetAspect ? height / cy : width / cx;
          return $scaledUi.css("font-size", `${fontSize}px`);
        })();
        $window.on('resize', layout);

        $document.on('click', 'a.route', function(event) {
          // TODO: Find a way to handle 404s.
          Backbone.history.navigate(this.pathname, {trigger: true});
          return false;
        });

        $document.on('click', 'a.outgoing', function(event) {
          _gaq.push(['_trackEvent', 'Outgoing link', 'click', this.href]);
          ga('send', 'event', 'Outgoing link', 'click', this.href);
          _.delay((() => { return document.location.href = this.href; }), 100);
          return false;
        });

        const doLogin = () =>
          popup.create("/login?popup=1", "Login", () => Backbone.trigger('app:checklogin'))
        ;

        Backbone.on('app:dologin', doLogin);
        $document.on('click', 'a.login', event => !doLogin());

        $document.on('click', 'a.logout', function(event) {
          $.ajax('/v1/auth/logout')
          .done(data => Backbone.trigger('app:logout'));
          return false;
        });

        Backbone.on('app:status', function(msg) {
          $statusMessage.text(msg);
          $statusMessage.removeClass('fadeout');
          return _.defer(() => $statusMessage.addClass('fadeout'));
        });

        return requestAnimationFrame(this.update);
      }
      update(time) {
        if (!lastTime) { lastTime = time; }
        const deltaTime = Math.max(0, Math.min(0.1, (time - lastTime) * 0.001));
        lastTime = time;

        __guardMethod__(this.currentView3D, 'update', o => o.update(deltaTime, time));
        if (this.currentViewChild !== this.currentView3D) {
          __guardMethod__(this.currentViewChild, 'update', o1 => o1.update(deltaTime, time));
        }
        __guardMethod__(this.currentDialog, 'update', o2 => o2.update(deltaTime, time));

        this.client.update(deltaTime);

        this.client.render();

        return requestAnimationFrame(this.update);
      }

      getView3D() { return this.currentView3D; }
      getViewChild() { return this.currentViewChild; }
      getDialog() { return this.currentDialog; }

      setView3D(view) {
        if (this.currentView3D) {
          this.currentView3D.destroy();
        }
        if (this.currentView3D === this.currentViewChild) {
          this.currentViewChild = null;
          this.$child.empty();
        }
        this.currentView3D = view;
      }

      setViewChild(view) {
        if (this.currentViewChild) {
          this.currentViewChild.destroy();
          this.$child.empty();
          if (this.currentView3D === this.currentViewChild) { this.currentView3D = null; }
        }
        this.currentViewChild = view;
        if (view) { this.$child.append(view.el); }
      }

      setViewBoth(view) {
        if (this.currentViewChild) {
          this.currentViewChild.destroy();
          if (this.currentView3D === this.currentViewChild) { this.currentView3D = null; }
        }
        if (this.currentView3D) {
          this.currentView3D.destroy();
        }
        if (view) { this.$child.empty().append(view.el); }
        this.currentViewChild = (this.currentView3D = view);
      }

      setDialog(view) {
        if (this.currentDialog != null) {
          this.currentDialog.destroy();
        }
        this.currentDialog = view;
        if (view) { this.$child.append(view.el); }
      }
    };
    UnifiedView.initClass();
    return UnifiedView;
  })();
});

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}