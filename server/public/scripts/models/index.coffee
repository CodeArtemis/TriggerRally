###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###


define [
  'backbone-full'
], (Backbone) ->

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

  models = {}

  class models.Checkpoint extends Backbone.RelationalModel
    attributeNames: [ 'disp', 'pos', 'surf' ]
    buildProperties @

  class models.StartPos extends Backbone.RelationalModel
    attributeNames: [ 'pos', 'rot' ]
    buildProperties @

  class models.Course extends Backbone.RelationalModel
    attributeNames: [ 'checkpoints', 'startposition' ]
    relations: [
      type: Backbone.HasOne
      key: 'startposition'
      relatedModel: models.StartPos
    ,
      type: Backbone.HasMany
      key: 'checkpoints'
      relatedModel: models.Checkpoint
    ]
    buildProperties @

  class models.TrackConfig extends Backbone.RelationalModel
    attributeNames: [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    relations: [
      type: Backbone.HasOne
      key: 'course'
      relatedModel: models.Course
    ]
    buildProperties @

  class models.Env extends Backbone.RelationalModel
    attributeNames: [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    buildProperties @

  class models.Track extends Backbone.RelationalModel
    attributeNames: [ 'config', 'env', 'name', 'user' ]
    relations: [
      type: Backbone.HasOne
      key: 'config'
      relatedModel: models.TrackConfig
    ,
      type: Backbone.HasOne
      key: 'env'
      relatedModel: models.Env
    ]
    url: -> '/track/' + @id + '/json/save'
    buildProperties @

  model.setup() for model in models
  models
