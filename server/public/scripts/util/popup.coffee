define [
], (
) ->
  create: (url, name, done) ->
    width = 1000
    height = 700
    left = (window.screen.width - width) / 2
    top = (window.screen.height - height) / 2
    features = "width=#{width},height=#{height},left=#{left},top=#{top}"
    window._tr_popup_autoclosed = false
    popup = window.open url, name, features
    return false unless popup
    timer = setInterval ->
      if popup.closed
        clearInterval timer
        done window._tr_popup_autoclosed
    , 1000
    true
