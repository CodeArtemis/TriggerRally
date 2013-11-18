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

    # viewModel: ->
    #   data = super
    #   loading = '...'
    #   data.name ?= loading
    #   data.modified_ago ?= loading
    #   data.count_copy ?= loading
    #   data.count_drive ?= loading
    #   data.count_fav ?= loading
    #   data.user ?= null
    #   data

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

    viewModel: ->
      data = super
      data.loggedIn = @app.root.user?
      data

    afterRender: ->
      $loggedinuser = @$ '.loggedinuser'

      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        user = @app.root.user
        @userView = user and new UserView
          model: user
        $loggedinuser.empty()
        $loggedinuser.append @userView.el if @userView
      @listenTo @app.root, 'change:user', updateUserView

      commentListView = new CommentListView
        collection: @model.comments
        el: @$('table.commentlist')
        root: @app.root
      commentListView.render()

      $postText = @$ 'input.comment-text'
      $postButton = @$ 'button.comment-post'
      $postButton.click =>
        model.addComment @app.root.user, $postText.val()
