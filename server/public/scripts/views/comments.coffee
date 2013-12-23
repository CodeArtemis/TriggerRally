define [
  'backbone-full'
  'cs!models/index'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/comments'
  'jade!templates/comment'
  'cs!views/user'
], (
  Backbone
  models
  View
  ViewCollection
  template
  templateComment
  UserView
) ->
  class CommentView extends View
    template: templateComment
    tagName: 'tr'

    # initialize: ->
    #   @model.fetch()
    #   @root = @options.parent.options.root
    #   @listenTo @model, 'change', @render, @

    beforeRender: ->
      @userView?.destroy()

    afterRender: ->
      comment = @model

      $commentuser = @$ '.commentuser'
      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        @userView = comment.user and new UserView
          model: comment.user
        $commentuser.empty()
        $commentuser.append @userView.el if @userView
      @listenTo comment, 'change:user', updateUserView

    destroy: ->
      @beforeRender()
      super

  class CommentListView extends ViewCollection
    view: CommentView
    childOffset: 1  # Ignore header <tr>.

  class CommentsView extends View
    # className: 'overlay'
    className: 'div'
    template: template
    constructor: (model, @app) -> super { model }

    initialize: ->
      @model.fetch()
      @listenTo @app.root, 'change:user', @render, @

    viewModel: ->
      data = super
      data.loggedIn = @app.root.user?
      data

    afterRender: ->
      user = @app.root.user
      if user
        userView = new UserView
          model: user
        $loggedinuser = @$ '.loggedinuser'
        $loggedinuser.append userView.el

      commentListView = new CommentListView
        collection: @model.comments
        el: @$('table.commentlist')
        root: @app.root
      commentListView.render()

      $postText = @$ 'input.comment-text'
      # $postButton = @$ 'button.comment-post'
      $form = @$ 'form.comment-form'
      $form.submit (event) =>
        @model.addComment @app.root.user, $postText.val()
        $postText.val ''
        event.preventDefault()
