

define [
], () ->
  run: ->

    # cs! shadows the global $, so this is a hack to grab it back.
    $ = new Function('return $;')()

    toolbox = $('#editor-toolbox')
    toolbox.dialog
      closeOnEscape: false
      dialogClass: 'no-close'
      #minWidth: 300
      #minHeight: 400
      position: 'left'
      resizable: false

    toolbox.children().accordion
      collapsible: true
      clearStyle: true
    return
