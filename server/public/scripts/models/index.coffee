###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

((factory) ->
  if typeof define is "function" and define.amd
    # AMD. Register as an anonymous module.
    define ["exports", "backbone-full"], factory
  else if typeof exports is "object"
    # CommonJS.
    factory exports, require("backbone-relational")
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

    (parentModel, name) ->
      onAll = (event, model, value, options) ->
        return unless event[..6] is 'change:'
        options._triggered ?= {}
        return if options._triggered[parentModel.cid]
        options._triggered[parentModel.cid] = yes
        parentModel.trigger "change:#{name}.#{event[7..]}", model, value, options

      value = parentModel.get name

      if monitored[name]?
        return if value is monitored[name]
        monitored[name].off 'all', onAll

      if value instanceof Backbone.Model or value instanceof Backbone.Collection
        monitored[name] = value
        value.on 'all', onAll

  models.RelModel = class RelModel extends Backbone.RelationalModel
    fetch: (options) ->
      # TODO: Check @lastSync and only fetch if out of date.
      super

    parse: (response, options) ->
      @lastSync = Date.now()
      super

    initialize: ->
      super
      monitor = createAttributeMonitor()

      # Bind to initial attributes.
      monitor @, name for name of @attributes

      # Watch for changes to attributes and rebind as necessary.
      @on 'change', =>
        monitor @, name for name of @changed
        return

  RelModel.setup()

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

  Backbone.Relational.store.addModelScope models

  class models.Checkpoint extends RelModel
    buildProps @, [ 'disp', 'pos', 'surf' ]

  class models.StartPos extends RelModel
    buildProps @, [ 'pos', 'rot' ]

  class models.Course extends RelModel
    buildProps @, [ 'checkpoints', 'startposition' ]
    defaults:
      startposition: new models.StartPos
    relations: [
      type: Backbone.HasOne
      key: 'startposition'
      relatedModel: models.StartPos
      #reverseRelation:
      #  type: Backbone.HasOne
      #  key: 'course'
    ,
      type: Backbone.HasMany
      key: 'checkpoints'
      relatedModel: models.Checkpoint
    ]
    initialize: ->
      # childChange @, @startposition
      # childChange @, @checkpoints
      # @on 'change:startposition', childChange
      # @on 'change:checkpoints', childChange
      super

  class models.TrackConfig extends RelModel
    buildProps @, [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    defaults:
      course: new models.Course
    relations: [
      type: Backbone.HasOne
      key: 'course'
      relatedModel: models.Course
    ]
    initialize: ->
      # childChange @, @course
      # @on 'change:course', childChange
      super

  class models.Car extends RelModel
    buildProps @, [ 'config', 'name', 'user' ]
    urlRoot: '/v1/cars'
    relations: [
      type: Backbone.HasOne
      key: 'user'
      relatedModel: 'User'
      includeInJSON: 'id'
    ]
    toJSON: (options) ->
      json = super
      delete json.created
      json

  class models.Env extends RelModel
    buildProps @, [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    urlRoot: '/v1/envs'
    collection: models.EnvCollection
    relations: [
      type: Backbone.HasMany
      key: 'cars'
      relatedModel: models.Car
      includeInJSON: 'id'
    ]

  class models.Track extends RelModel
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
    urlRoot: '/v1/tracks'
    defaults:
      config: new models.TrackConfig
    relations: [
      type: Backbone.HasOne
      key: 'config'
      relatedModel: models.TrackConfig
    ,
      type: Backbone.HasOne
      key: 'env'
      relatedModel: models.Env
    ,
      type: Backbone.HasOne
      key: 'parent'
      relatedModel: 'Track'
      includeInJSON: 'id'
    ]
    initialize: ->
      # childChange @, @config
      # childChange @, @env
      # @on 'change:config', childChange
      # @on 'change:env', childChange
      super
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.modified
      json

  class models.User extends RelModel
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
    urlRoot: '/v1/users'
    relations: [
      type: Backbone.HasMany
      key: 'tracks'
      collectionType: models.TrackCollection
      relatedModel: models.Track
      includeInJSON: 'id'
      reverseRelation:
        key: 'user'
        includeInJSON: 'id'
    ]
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.email
      unless options?.authenticated
        delete json.admin
        delete json.prefs
      json

  class models.UserPassport extends RelModel
    buildProps @, [
      'profile'
      'user'
    ]
    relations: [
      type: Backbone.HasOne
      key: 'user'
      relatedModel: models.User
    ]

  model.setup?() for name, model of models

  models.buildProps = buildProps
  models.BackboneCollection = Backbone.Collection
  models.BackboneModel = Backbone.Model
  models.Collection = Collection
  #models.RelModel = RelModel

  models
