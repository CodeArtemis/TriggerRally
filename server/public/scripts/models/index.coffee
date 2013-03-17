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

    (parentModel, attrib) ->
      onAll = (event, model, value, options) ->
        # if attrib is 'startposition'
        #   console.log "startposition: #{event}"
        #   debugger
        return unless event[..5] is 'change'
        newEvent = "change:#{attrib}.#{event[7..]}"
        parentModel.trigger newEvent, model, value, options

      value = parentModel.get attrib

      if monitored[attrib]?
        return if value is monitored[attrib]
        monitored[attrib].off 'all', onAll

      if value instanceof Backbone.Model # or value instanceof Backbone.Collection
        monitored[attrib] = value
        value.on 'all', onAll

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
        xhr.always => @fetchXHR = null
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
      monitor @, attrib for attrib in @bubbleAttribs

      # Watch for changes to attributes and rebind as necessary.
      @on 'change', =>
        monitor @, attrib for attrib in @bubbleAttribs
        return

  class Collection extends Backbone.Collection
    url: "/v1/#{@path}"

  class models.EnvCollection extends Collection
    path: 'envs'
  class models.TrackCollection extends Collection
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
  class models.UserCollection extends Collection
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
    defaults:
      startposition: new models.StartPos
      checkpoints: new Collection(model: models.Checkpoint)
    parse: (response, options) ->
      if response.startposition
        @startposition.set @startposition.parse response.startposition
        delete response.startposition
      if response.checkpoints
        checkpoints = for checkpoint in response.checkpoints
          c = new models.Checkpoint
          c.set c.parse checkpoint
          c
        @checkpoints.update checkpoints
        delete response.checkpoints
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
    defaults:
      course: new models.Course
    initialize: ->
      super
      @on 'all', (event) -> console.log 'TrackConfig: ' + event
    parse: (response, options) ->
      if response.course
        @course.set @course.parse response.course
        delete response.course
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
    collection: models.EnvCollection
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
    defaults:
      config: new models.TrackConfig
    initialize: ->
      super
      @on 'all', (event) -> console.log 'Track: ' + event
    parse: (response, options) ->
      if response.config
        @config.set @config.parse response.config
        delete response.config
      if response.env
        @env ?= new models.Env
        @env.set @env.parse response.env
        delete response.env
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
    defaults:
      tracks: new models.TrackCollection
    urlRoot: '/v1/users'
    parse: (response, options) ->
      if response.tracks
        tracks = for track in response.tracks
          t = new models.Track
          t.set t.parse track
          t
        @tracks.update tracks
        delete response.tracks
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
