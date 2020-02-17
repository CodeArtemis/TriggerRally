/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'models/index',
  'views/view',
  'views/view_collection',
  'jade!templates/comments',
  'jade!templates/comment',
  'views/user'
], function(
  Backbone,
  models,
  View,
  ViewCollection,
  template,
  templateComment,
  UserView
) {
  let CommentsView;
  class CommentView extends View {
    static initClass() {
      this.prototype.template = templateComment;
      this.prototype.tagName = 'tr';
    }

    // initialize: ->
    //   @model.fetch()
    //   @root = @options.parent.options.root
    //   @listenTo @model, 'change', @render, @

    beforeRender() {
      return (this.userView != null ? this.userView.destroy() : undefined);
    }

    afterRender() {
      let updateUserView;
      const comment = this.model;

      const $commentuser = this.$('.commentuser');
      this.userView = null;
      (updateUserView = () => {
        if (this.userView != null) {
          this.userView.destroy();
        }
        this.userView = comment.user && new UserView({
          model: comment.user});
        $commentuser.empty();
        if (this.userView) { return $commentuser.append(this.userView.el); }
      })();
      return this.listenTo(comment, 'change:user', updateUserView);
    }

    destroy() {
      this.beforeRender();
      return super.destroy(...arguments);
    }
  }
  CommentView.initClass();

  class CommentListView extends ViewCollection {
    static initClass() {
      this.prototype.view = CommentView;
      this.prototype.childOffset = 1;
    }
  }
  CommentListView.initClass();  // Ignore header <tr>.

  return CommentsView = (function() {
    CommentsView = class CommentsView extends View {
      static initClass() {
        // className: 'overlay'
        this.prototype.className = 'div';
        this.prototype.template = template;
      }
      constructor(model, app) {
        super({ model }, app);
      }

      initialize(options, app) {
        this.app = app;
        this.model.fetch();
        return this.listenTo(this.app.root, 'change:user', this.render, this);
      }

      viewModel() {
        const data = super.viewModel(...arguments);
        data.loggedIn = (this.app.root.user != null);
        return data;
      }

      afterRender() {
        const { user } = this.app.root;
        if (user) {
          const userView = new UserView({
            model: user});
          const $loggedinuser = this.$('.loggedinuser');
          $loggedinuser.append(userView.el);
        }

        const commentListView = new CommentListView({
          collection: this.model.comments,
          el: this.$('table.commentlist'),
          root: this.app.root
        });
        commentListView.render();

        const $postText = this.$('input.comment-text');
        // $postButton = @$ 'button.comment-post'
        const $form = this.$('form.comment-form');
        return $form.submit(event => {
          this.model.addComment(this.app.root.user, $postText.val());
          $postText.val('');
          return event.preventDefault();
        });
      }
    };
    CommentsView.initClass();
    return CommentsView;
  })();
});
