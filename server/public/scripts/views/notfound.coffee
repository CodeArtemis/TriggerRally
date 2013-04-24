define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/notfound'
], (
  Backbone
  View
  template
) ->
  class NotFoundView extends View
    className: 'overlay'
    template: template
    afterRender: ->
      Backbone.trigger 'app:settitle', 'Not Found'
