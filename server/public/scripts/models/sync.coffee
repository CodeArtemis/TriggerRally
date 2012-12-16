###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define ->
  syncSocket: (socket) ->
    (method, model, options) ->
      socket.emit 'sync',
        method: method
        url: _.result(model, 'url')  # remove?
        urlRoot: _.result(model, 'urlRoot')
        id: model.id
        model: model.toJSON()  # remove?
      , (err, response) ->
        if err
          options.error? model, err, options
        else
          options.success? response
        return
      return
