Mongoose = require('mongoose')
mongoose = new Mongoose.Mongoose()
mongoose[key] = value for key, value of Mongoose when not mongoose[key]? and Mongoose.hasOwnProperty(key)

Schema = mongoose.Schema

SessionSchema = new Schema({
  sid: { type: String, required: true, unique: true }
  data: { type: Schema.Types.Mixed, required: true }
  expires: { type: Date, index: true }
})

defaultCallback = (err) ->

module.exports = (connect) ->
  class SessionStore extends connect.session.Store
    constructor: (@options = {}) ->
      @options.url ?= "mongodb://localhost/sessions"
      @options.interval ?= 60000
      
      if @options.connection
        connection = @options.connection
      else
        if mongoose.connection.readyState is 0
          connection = mongoose.connect @options.url
        else
          connection = mongoose.connection

      try
        @model = connection.model('Session')
      catch err
        @model = connection.model('Session', SessionSchema)
      
      setInterval =>
        @model.remove
          expires:
            '$lte': new Date()
        , defaultCallback
      , @options.interval

    get: (sid, cb = defaultCallback) ->
      @model.findOne { sid: sid }, (err, session) ->
        if err or not session
          cb err
        else
          data = session.data
          try
            data = JSON.parse data if typeof data is 'string'
            cb null, data
          catch err
            cb err

    set: (sid, data, cb = defaultCallback) ->
      if not data
        @destroy sid, cb
      else
        try
          if cookie = data.cookie
            if cookie.expires
              expires = cookie.expires
            else if cookie.maxAge
              expires = new Date(Date.now() + cookie.maxAge)
          expires ?= null # undefined is not equivalent to null in Mongoose 3.x
          session =
            sid: sid
            data: data
            expires: expires
          @model.update { sid: sid }, session, { upsert: true }, cb
        catch err
          cb err

    destroy: (sid, cb = defaultCallback) ->
      @model.remove { sid: sid }, cb

    all: (cb = defaultCallback) ->
      @model.find {}, 'sid expires', (err, sessions) ->
        if err or not sessions
          cb err
        else
          now = Date.now()
          sessions = sessions.filter (session) ->
            true if not session.expires or session.expires.getTime() > now
          cb null, (session.sid for session in sessions)

    clear: (cb = defaultCallback) ->
      @model.collection.drop cb

    length: (cb = defaultCallback) ->
      @model.count {}, cb
