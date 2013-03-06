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
  buildProperties = (func) ->
    buildGetter = (name) ->
      -> @get name
    buildSetter = (name) ->
      (value) -> @set name, value
    for attr in func.prototype.attributeNames
      Object.defineProperty func.prototype, attr,
        get: buildGetter attr
        set: buildSetter attr

  childChange = (parent, mdl) ->
    return unless mdl? and mdl.on?
    mdl.on 'change', ->
      parent.trigger 'childchange', []
    mdl.on 'childchange', (stack) ->
      parent.trigger 'childchange', stack.concat mdl

  models = exports

  Model = Backbone.RelationalModel.extend {}
  #  initialize: ->
  #    @on 'all', -> console.log arguments

  class Collection extends Backbone.Collection
    url: "/v1/#{@type}"

  class models.EnvCollection extends Collection
    type: 'envs'
  class models.TrackCollection extends Collection
    type: 'tracks'
    # url: (models) ->
    #   if models?
    #     ids = _.pluck(models, 'id').join('+')
    #     "/v1/tracks/#{ids}"
    #   else
    #     "/v1/tracks"
    # parse: (response, options) ->
    #   response
  class models.UserCollection extends Collection
    type: 'users'

  Backbone.Relational.store.addModelScope models

  class models.Checkpoint extends Model
    attributeNames: [ 'disp', 'pos', 'surf' ]
    buildProperties @

  class models.StartPos extends Model
    attributeNames: [ 'pos', 'rot' ]
    buildProperties @

  class models.Course extends Model
    attributeNames: [ 'checkpoints', 'startposition' ]
    buildProperties @
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
      childChange @, @startposition
      childChange @, @checkpoints
      @on 'change:startposition', childChange
      @on 'change:checkpoints', childChange
      super

  class models.TrackConfig extends Model
    attributeNames: [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    buildProperties @
    defaults:
      course: new models.Course
    relations: [
      type: Backbone.HasOne
      key: 'course'
      relatedModel: models.Course
    ]
    initialize: ->
      childChange @, @course
      @on 'change:course', childChange
      super

  class models.Car extends Model
    #attributeNames: [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    #buildProperties @
    urlRoot: '/v1/cars'

  class models.Env extends Model
    attributeNames: [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    buildProperties @
    urlRoot: '/v1/envs'
    collection: models.EnvCollection
    relations: [
      type: Backbone.HasMany
      key: 'cars'
      relatedModel: models.Car
      includeInJSON: 'id'
    ]

  class models.Track extends Model
    attributeNames: [
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
    buildProperties @
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
      childChange @, @config
      childChange @, @env
      @on 'change:config', childChange
      @on 'change:env', childChange
      super
    toJSON: (options) ->
      json = super
      delete json.created
      delete json.modified
      json

  class models.User extends Model
    attributeNames: [
      'bio'
      'created'
      'email'
      'gravatar_hash'
      'location'
      'name'
      'tracks'  # NOTE: computed attribute, not currently present in DB.
      'website'
    ]
    buildProperties @
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

  class models.UserPassport extends Model
    attributeNames: [
      'profile'
      'user'
    ]
    buildProperties @
    relations: [
      type: Backbone.HasOne
      key: 'user'
      relatedModel: models.User
    ]

  model.setup?() for name, model of models
  models.BackboneCollection = Backbone.Collection
  models.BackboneModel = Backbone.Model
  models.Collection = Collection
  models.Model = Model
  models
