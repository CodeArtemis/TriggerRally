###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

((factory) ->
  if typeof define is "function" and define.amd
    # AMD. Register as an anonymous module.
    define ["exports", "backbone-full"], factory
  else if typeof exports is "object"
    # CommonJS.
    factory exports, require("backbone")
  else
    throw new Error "Couldn't determine module type."
) (exports, Backbone) ->

  # http://www.narrativescience.com/blog/automatically-creating-getterssetters-for-backbone-models/
  buildProps = (constructor, propNames) ->
    buildGetter = (name) ->
      -> @get name
    buildSetter = (name) ->
      (value) -> @set name, value
    for prop in propNames
      Object.defineProperty constructor::, prop,
        get: buildGetter prop
        set: buildSetter prop

  # childChange = (parent, mdl) ->
  #   return unless mdl? and mdl.on?
  #   mdl.on 'change', ->
  #     parent.trigger 'childchange', []
  #   mdl.on 'childchange', (stack) ->
  #     parent.trigger 'childchange', stack.concat mdl

  createAttributeMonitor = ->
    monitored = Object.create null

    (parentModel, attrib, newValue, options) ->
      onAll = (event, model, value, options) ->
        split = event.split ':'
        split[1] ?= ""
        newEvent = "#{split[0]}:#{attrib}.#{split[1]}"
        parentModel.trigger newEvent, model, value, options

      attribValue = parentModel.get attrib

      if monitored[attrib]?
        return if attribValue is monitored[attrib]
        # console.log "detaching #{parentModel.constructor.name}.#{attrib}"
        monitored[attrib].off 'all', onAll

      if attribValue instanceof Backbone.Model or attribValue instanceof Backbone.Collection
        # console.log "attaching #{parentModel.constructor.name}.#{attrib}"
        monitored[attrib] = attribValue
        attribValue.on 'all', onAll

      if newValue?
        event = "change:#{attrib}."
        parentModel.trigger event, newValue, options

  Model = class Model extends Backbone.Model
    bubbleAttribs: null

    @findOrCreate: (id) ->
      model = @::all?.get id
      unless model
        model = new @ { id }
        @::all?.add model
      model

    fetch: (options) ->
      return options.success? @, null, options if @lastSync and not options?.force
      xhr = @fetchXHR
      if xhr
        # Bind handlers to in-progress fetch.
        xhr
        .done (data, textStatus, jqXHR) => options.success? @, data, options
        .fail (data, textStatus, errorThrown) => options.error? @, xhr, options
      else
        xhr = @fetchXHR = super
        xhr?.always => @fetchXHR = null
      xhr

    parse: (response, options) ->
      @lastSync = Date.now()
      super

    initialize: ->
      @fetchXHR = null
      monitor = createAttributeMonitor()
      bubbleAttribs = @bubbleAttribs ? []
      bubbleAttribs.forEach (attrib) =>
        # Bind to initial attributes.
        monitor @, attrib

        # Watch for changes to attributes and rebind as necessary.
        @on "change:#{attrib}", (model, value, options) =>
          monitor @, attrib, value, options
      super

  class Collection extends Backbone.Collection

  class PathCollection extends Collection
    url: "/v1/#{@path}"

  class EnvCollection extends PathCollection
    path: 'envs'
  class TrackCollection extends PathCollection
    path: 'tracks'
    comparator: 'name'
    # url: (models) ->
    #   if models?
    #     ids = _.pluck(models, 'id').join('+')
    #     "/v1/tracks/#{ids}"
    #   else
    #     "/v1/tracks"
    # parse: (response, options) ->
    #   response
  class UserCollection extends PathCollection
    path: 'users'

  class Checkpoint extends Model
    buildProps @, [ 'disp', 'pos', 'surf' ]

  class CheckpointsCollection extends Collection
    model: Checkpoint

  class StartPos extends Model
    buildProps @, [ 'pos', 'rot' ]

  class Course extends Model
    buildProps @, [ 'checkpoints', 'startposition' ]
    bubbleAttribs: [ 'checkpoints', 'startposition' ]
    initialize: ->
      @startposition = new StartPos
      @checkpoints = new CheckpointsCollection
      super
    parse: (response, options) ->
      if response.startposition
        @startposition.set @startposition.parse response.startposition
        response.startposition = @startposition
      if response.checkpoints
        checkpoints = for checkpoint in response.checkpoints
          c = new Checkpoint
          c.set c.parse checkpoint
          c
        @checkpoints.update checkpoints
        response.checkpoints = @checkpoints
      response

  class TrackConfig extends Model
    buildProps @, [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    bubbleAttribs: [ 'course' ]
    initialize: ->
      @course = new Course
      super
    #   @on 'all', (event) -> console.log 'TrackConfig: ' + event
    parse: (response, options) ->
      data = super
      if data.course
        course = @course
        data.course = course.set course.parse data.course
      data

  class Car extends Model
    all: new (Collection.extend model: @)
    buildProps @, [ 'config', 'name', 'user' ]
    urlRoot: '/v1/cars'
    # relations: [
    #   type: Backbone.HasOne
    #   key: 'user'
    #   relatedModel: 'User'
    #   includeInJSON: 'id'
    # ]
    toJSON: (options) ->
      json = super
      delete json.created
      json.user = json.user.id if json.user?
      json

  class Env extends Model
    all: new (Collection.extend model: @)
    buildProps @, [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    urlRoot: '/v1/envs'
    #collection: EnvCollection
    # defaults:
    #   scenery: new TrackConfig
    # relations: [
    #   type: Backbone.HasMany
    #   key: 'cars'
    #   relatedModel: Car
    #   includeInJSON: 'id'
    # ]
    toJSON: (options) ->
      json = super
      json.cars = (car.id for car in json.cars) if json.cars?
      json

  class Track extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'config'
      'count_copy'
      'count_drive'
      'count_fav'
      'env'
      'modified'
      'name'
      'parent'
      'published'
      'user'
    ]
    bubbleAttribs: [ 'config', 'env' ]
    urlRoot: '/v1/tracks'
    initialize: ->
      @config = new TrackConfig
      super
      # @on 'all', (event) -> console.log 'Track: ' + event
    parse: (response, options) ->
      data = super
      if data?.config
        config = @config  # or new TrackConfig
        data.config = config.set config.parse data.config
      if data?.env
        data.env = if typeof data.env is 'string'
          Env.findOrCreate data.env
        else
          env = Env.findOrCreate data.env.id
          env.set env.parse data.env
      data
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.modified
      json.env = json.env.id if json.env?
      json.user = json.user.id if json.user?
      json

  class User extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'bio'
      'created'
      'email'
      'gravatar_hash'
      'location'
      'name'
      'tracks'  # NOTE: computed attribute, not currently present in DB.
      'website'
    ]
    bubbleAttribs: [ 'tracks' ]
    initialize: ->
      @tracks = new TrackCollection
      super
    urlRoot: '/v1/users'
    parse: (response, options) ->
      data = super
      if data.tracks
        tracks = for track in data.tracks
          if typeof track is 'string'
            new Track id: track
          else
            t = new Track
            t.set t.parse track
        data.tracks = @tracks.update tracks
      data
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.email
      unless options?.authenticated
        delete json.admin
        delete json.prefs
      json.tracks = (track.id for track in json.tracks.models) if json.tracks?
      json

  class UserPassport extends Model
    buildProps @, [
      'profile'
      'user'
    ]
    bubbleAttribs: [ 'user' ]
    # relations: [
    #   type: Backbone.HasOne
    #   key: 'user'
    #   relatedModel: User
    # ]

  models = {
    buildProps
    BackboneCollection: Backbone.Collection
    BackboneModel: Backbone.Model
    Backbone
    Collection
    Model

    Car
    Checkpoint
    Env
    StartPos
    Track
    TrackConfig
    User
    UserPassport
  }
  exports[k] = v for k, v of models
  exports
