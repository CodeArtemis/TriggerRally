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

  Collection = Backbone.Collection

  class models.Checkpoint extends Model
    attributeNames: [ 'disp', 'pos', 'surf' ]
    buildProperties @

  class models.StartPos extends Model
    attributeNames: [ 'pos', 'rot' ]
    buildProperties @

  class models.Course extends Model
    attributeNames: [ 'checkpoints', 'startposition' ]
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
    buildProperties @
    initialize: ->
      childChange @, @startposition
      childChange @, @checkpoints
      @on 'change:startposition', childChange
      @on 'change:checkpoints', childChange
      super

  class models.TrackConfig extends Model
    attributeNames: [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    defaults:
      course: new models.Course
    relations: [
      type: Backbone.HasOne
      key: 'course'
      relatedModel: models.Course
    ]
    buildProperties @
    initialize: ->
      childChange @, @course
      @on 'change:course', childChange
      super

  class models.Env extends Model
    attributeNames: [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    buildProperties @

  class models.Track extends Model
    attributeNames: [
      'config'
      'count_copy'
      'count_drive'
      'count_fav'
      'env'
      'modified'
      'name'
      'published'
      'user'
    ]
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
    ]
    urlRoot: 'track'
    buildProperties @
    initialize: ->
      childChange @, @config
      childChange @, @env
      @on 'change:config', childChange
      @on 'change:env', childChange
      super

  class models.UserTracks extends Collection

  class models.User extends Model
    attributeNames: [
      'bio'
      'created'
      'email'
      'gravatar_hash'
      'location'
      'name'
      'tracks'  # NOTE: computed at runtime, not currently present in DB.
      'website'
    ]
    relations: [
      type: Backbone.HasMany
      key: 'tracks'
      collectionType: models.UserTracks
      relatedModel: models.Track
    ]
    buildProperties @

  class models.UserPassport extends Model
    attributeNames: [
      'profile'
      'user'
    ]
    relations: [
      type: Backbone.HasOne
      key: 'user'
      relatedModel: models.User
    ]
    buildProperties @

  model.setup?() for name, model of models
  models.Model = Model

  exports
