###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

((factory) ->
  if typeof exports is "object"
    # CommonJS.
    factory exports, require("backbone-relational")
  else if typeof define is "function" and define.amd
    # AMD. Register as an anonymous module.
    define ["exports", "backbone-full"], factory
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
    return unless mdl?
    mdl.on 'change', ->
      parent.trigger 'childchange', []
    mdl.on 'childchange', (stack) ->
      parent.trigger 'childchange', stack.concat mdl

  # We use a generator so that we can create multiple layers
  # of backbone models within the app.
  exports.genModels = ->
    BaseModel = Backbone.RelationalModel.extend {}
    #  initialize: ->
    #    @on 'all', -> console.log arguments

    models = {}

    class models.Checkpoint extends BaseModel
      attributeNames: [ 'disp', 'pos', 'surf' ]
      buildProperties @

    class models.StartPos extends BaseModel
      attributeNames: [ 'pos', 'rot' ]
      buildProperties @

    class models.Course extends BaseModel
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

    class models.TrackConfig extends BaseModel
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

    class models.Env extends BaseModel
      attributeNames: [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
      buildProperties @

    class models.Track extends BaseModel
      attributeNames: [ 'config', 'env', 'name', 'user', 'published' ]
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

    model.setup() for name, model of models
    models.BaseModel = BaseModel
    models

  exports
