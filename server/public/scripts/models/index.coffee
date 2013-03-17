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
    throw "Couldn't determine module type."
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

  models = exports

  createAttributeMonitor = ->
    monitored = Object.create null

    (parentModel, attrib, newValue, options) ->
      console.log "monitoring #{parentModel.constructor.name}.#{attrib}"
      onAll = (event, model, value, options) ->
        split = event.split ':'
        split[1] ?= ""
        newEvent = "#{split[0]}:#{attrib}.#{split[1]}"
        parentModel.trigger newEvent, model, value, options

      attribValue = parentModel.get attrib

      if monitored[attrib]?
        return if attribValue is monitored[attrib]
        monitored[attrib].off 'all', onAll

      if attribValue instanceof Backbone.Model or attribValue instanceof Backbone.Collection
        monitored[attrib] = attribValue
        attribValue.on 'all', onAll

      if newValue?
        event = "change:#{attrib}."
        parentModel.trigger event, newValue, options

  models.Model = class Model extends Backbone.Model
    bubbleAttribs: null

    @findOrCreate: (id) ->
      model = @all?.get pub_id
      unless model
        model = new @ { id }
        @all?.add model
      model

    fetch: (options) ->
      # TODO: Check @lastSync and only fetch if out of date.
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
      super
      @fetchXHR = null
      return unless @bubbleAttribs

      monitor = createAttributeMonitor()

      # Bind to initial attributes.
      for attrib in @bubbleAttribs
        monitor @, attrib
        @on "change:#{attrib}", (model, value, options) =>
          monitor @, attrib, value, options

      # Watch for changes to attributes and rebind as necessary.
      # @on 'change', =>
      #   monitor @, attrib for attrib in @bubbleAttribs
      #   changed = @changedAttributes()
      #   debugger
      #   return

  class Collection extends Backbone.Collection

  class PathCollection extends Collection
    url: "/v1/#{@path}"

  class models.EnvCollection extends PathCollection
    path: 'envs'
  class models.TrackCollection extends PathCollection
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
  class models.UserCollection extends PathCollection
    path: 'users'

  class models.Checkpoint extends Model
    buildProps @, [ 'disp', 'pos', 'surf' ]

  class models.StartPos extends Model
    buildProps @, [ 'pos', 'rot' ]
    set: ->
      super

  class models.Course extends Model
    buildProps @, [ 'checkpoints', 'startposition' ]
    bubbleAttribs: [ 'startposition' ]
    initialize: ->
      @startposition = new models.StartPos
      @checkpoints = new Collection model: models.Checkpoint
      super
    parse: (response, options) ->
      if response.startposition
        @startposition.set @startposition.parse response.startposition
        response.startposition = @startposition
      if response.checkpoints
        checkpoints = for checkpoint in response.checkpoints
          c = new models.Checkpoint
          c.set c.parse checkpoint
          c
        response.checkpoints = @checkpoints.update checkpoints
      response
    # relations: [
    #   type: Backbone.HasOne
    #   key: 'startposition'
    #   relatedModel: models.StartPos
    # ,
    #   type: Backbone.HasMany
    #   key: 'checkpoints'
    #   relatedModel: models.Checkpoint
    # ]

  class models.TrackConfig extends Model
    buildProps @, [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    bubbleAttribs: [ 'course', 'scenery' ]
    initialize: ->
      @course = new models.Course
      super
    #   @on 'all', (event) -> console.log 'TrackConfig: ' + event
    parse: (response, options) ->
      if response.course
        course = @course
        response.course = course.set course.parse response.course
      response
    # relations: [
    #   type: Backbone.HasOne
    #   key: 'course'
    #   relatedModel: models.Course
    # ]

  class models.Car extends Model
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
      json

  class models.Env extends Model
    all: Collection.extend(model: @)
    buildProps @, [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    urlRoot: '/v1/envs'
    #collection: models.EnvCollection
    # defaults:
    #   scenery: new models.TrackConfig
    # relations: [
    #   type: Backbone.HasMany
    #   key: 'cars'
    #   relatedModel: models.Car
    #   includeInJSON: 'id'
    # ]

  class models.Track extends Model
    all: Collection.extend(model: @)
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
      @config = new models.TrackConfig
      super
      # @on 'all', (event) -> console.log 'Track: ' + event
    parse: (response, options) ->
      if response.config
        config = @config  # or new models.TrackConfig
        response.config = config.set config.parse response.config
      if response.env
        env = @env or new models.Env
        response.env = env.set env.parse response.env
      response
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.modified
      json

  class models.User extends Model
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
    initialize: ->
      @tracks = new models.TrackCollection
      super
    urlRoot: '/v1/users'
    parse: (response, options) ->
      if response.tracks
        tracks = for track in response.tracks
          t = new models.Track
          t.set t.parse track
          t
        response.tracks = @tracks.update tracks
      response
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.email
      unless options?.authenticated
        delete json.admin
        delete json.prefs
      json

  class models.UserPassport extends Model
    buildProps @, [
      'profile'
      'user'
    ]
    bubbleAttribs: [ 'user' ]
    # relations: [
    #   type: Backbone.HasOne
    #   key: 'user'
    #   relatedModel: models.User
    # ]

  models.buildProps = buildProps
  models.BackboneCollection = Backbone.Collection
  models.BackboneModel = Backbone.Model
  models.Collection = Collection
  models.Backbone = Backbone

  models
