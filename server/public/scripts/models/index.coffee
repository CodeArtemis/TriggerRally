((factory) ->
  if typeof define is "function" and define.amd
    # AMD. Register as an anonymous module.
    define ["exports", "backbone-full", "underscore"], factory
  else if typeof exports is "object"
    # CommonJS.
    factory exports, require("backbone"), require("underscore")
  else
    throw new Error "Couldn't determine module type."
) (exports, Backbone, _) ->

  # http://www.narrativescience.com/blog/automatically-creating-getterssetters-for-backbone-models/
  buildProps = (constructor, attribNames) ->
    # constructor::attribNames = attribNames
    buildGetter = (name) ->
      -> @get name
    buildSetter = (name) ->
      (value) -> @set name, value
    for prop in attribNames
      Object.defineProperty constructor::, prop,
        get: buildGetter prop
        set: buildSetter prop

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
      # isNew = no
      unless model
        # isNew = yes
        model = new @ { id }
        @::all?.add model
      # console.log "findOrCreate #{@::constructor.name}:#{id} isNew = #{isNew}"
      model

    useCache: yes
    cacheExpirySecs: 2

    fetch: (options = {}) ->
      if @useCache and @lastSync and not options?.force
        timeSinceLast = Date.now() - @lastSync
        if timeSinceLast < @cacheExpirySecs * 1000
          options.success? @, null, options
          return null
      xhr = @fetchXHR
      if xhr
        # Bind handlers to in-progress fetch.
        xhr.done (data, textStatus, jqXHR) => options.success? @, data, options
        xhr.fail (data, textStatus, errorThrown) => options.error? @, null, options
      else
        # Perform fetch. (Will also call success/error.)
        xhr = super
        if xhr?.always
          @fetchXHR = xhr
          xhr.always => @fetchXHR = null
      xhr

    parse: (response, options) ->
      # TODO: per-attribute timers?
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

  class CarCollection extends PathCollection
    path: 'cars'
  class EnvCollection extends PathCollection
    path: 'envs'
  class RunCollection extends PathCollection
    path: 'runs'
  class TrackCollection extends PathCollection
    path: 'tracks'
  class UserCollection extends PathCollection
    path: 'users'

  class TrackCollectionSortName extends TrackCollection
    comparator: 'name'

  class TrackCollectionSortModified extends TrackCollection
    comparator: (a, b) ->
      if not a.modified? or not b.modified? or a.modified is b.modified
        a.cid - b.cid
      else if a.modified < b.modified then 1 else -1

  class Checkpoint extends Model
    buildProps @, [ 'disp', 'pos', 'surf' ]

  class CheckpointsCollection extends Collection
    model: Checkpoint

  class StartPos extends Model
    buildProps @, [ 'pos', 'rot' ]

  class Course extends Model
    buildProps @, [ 'checkpoints', 'startposition' ]
    bubbleAttribs: [ 'checkpoints', 'startposition' ]
    defaults: ->
      startposition: new StartPos
      checkpoints: new CheckpointsCollection
    parse: (response, options) ->
      data = super
      return data unless data
      if data.startposition
        @startposition.set @startposition.parse data.startposition
        data.startposition = @startposition
      if data.checkpoints
        checkpoints = for checkpoint in data.checkpoints
          c = new Checkpoint
          c.set c.parse checkpoint
          c
        @checkpoints.reset checkpoints
        data.checkpoints = @checkpoints
      data

  class TrackConfig extends Model
    buildProps @, [ 'course', 'gameversion', 'scenery' ]  # TODO: Remove gameversion.
    bubbleAttribs: [ 'course' ]
    defaults: ->
      course: new Course
    parse: (response, options) ->
      data = super
      return data unless data
      if data.course
        course = @course
        data.course = course.set course.parse data.course
      data

  class Car extends Model
    all: new (Collection.extend model: @)
    buildProps @, [ 'config', 'name', 'user', 'product' ]
    urlRoot: '/v1/cars'
    toJSON: (options) ->
      data = super
      delete data.created
      data.user = data.user.id if data.user?
      # if data.product? and data.config?
      #   unless data.product in (options?.products ? [])
      #     delete data.config.sounds
      data

  class Env extends Model
    all: new (Collection.extend model: @)
    buildProps @, [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]
    urlRoot: '/v1/envs'
    defaults: ->
      cars: new CarCollection
    toJSON: (options) ->
      data = super
      data.cars = (car.id for car in data.cars.models) if data.cars?
      # if options?.restricted
      #   delete data.cars
      #   delete data.scenery
      #   delete data.terrain
      data
    parse: (response, options) ->
      data = super
      return data unless data
      if data.cars
        cars = for car in data.cars
          if typeof car is 'string'
            Car.findOrCreate car
          else
            c = Car.findOrCreate car.id
            c.set c.parse car
        data.cars = @cars.reset cars
      data

  class Run extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'car'
      'created'
      'created_ago'
      'rank'  # Attribute generated when fetched.
      'record_i'
      'record_p'
      'status'
      'time'
      'time_readable'
      'times'
      'track'
      'user'
    ]
    urlRoot: '/v1/runs'
    parse: ->
      data = super
      return data unless data
      data.car = Car.findOrCreate data.car if data.car
      data.track = Track.findOrCreate data.track if data.track
      data.user = User.findOrCreate data.user if data.user
      data
    toJSON: ->
      data = super
      data.car = data.car.id if data.car?
      data.track = data.track.id if data.track?
      data.user = data.user.id if data.user?
      data

  class Track extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'config'
      'count_copy'
      'count_drive'
      'count_fav'
      'created'
      'demo'
      'env'
      'modified'
      'name'
      'next_track'
      'parent'
      'prevent_copy'
      'published'
      'user'
    ]
    bubbleAttribs: [ 'config', 'env' ]
    urlRoot: '/v1/tracks'
    # initialize: ->
    #   # @config = new TrackConfig
    #   super
    #   # @on 'all', (event) -> console.log 'Track: ' + event
    maxNameLength: 40
    validate: ->
      if @name?.length < 3 then return "name too short"
      if @name?.length > @maxNameLength then return "name too long"
    parse: (response, options) ->
      # Regression detection.
      if @config and @config not instanceof TrackConfig
        console.error "Raw track.config detected in Track.parse()"

      data = super
      return data unless data
      if data.config
        config = @config
        config = new TrackConfig unless config instanceof TrackConfig
        data.config = config.set config.parse data.config
      if data.env
        data.env = if typeof data.env is 'string'
          Env.findOrCreate data.env
        else
          env = Env.findOrCreate data.env.id
          env.set env.parse data.env
      if data.parent
        parent = data.parent
        parentId = if typeof parent is 'string' then parent else parent.id
        data.parent = Track.findOrCreate parentId
      if data.user
        user = data.user
        if typeof user is 'string'
          data.user = User.findOrCreate user
        else
          data.user = User.findOrCreate user.id
          data.user.set data.user.parse user
      if data.next_track
        nextTrack = data.next_track
        nextTrackId = if typeof nextTrack is 'string' then nextTrack else nextTrack.id
        data.next_track = Track.findOrCreate nextTrackId
      data.modified = data.created if data.created and not data.modified
      data
    toJSON: ->
      data = super
      data.env = data.env.id if data.env?
      data.parent = data.parent.id if data.parent?
      data.user = data.user.id if data.user?
      data.next_track = data.next_track.id if data.next_track?
      data

  class TrackRuns extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'runs'
    ]
    url: -> "/v1/tracks/#{@id}/runs"
    defaults: ->
      runs: new RunCollection
    parse: ->
      data = super
      return data unless data
      if data.runs
        runs = for run in data.runs
          if typeof run is 'string'
            Run.findOrCreate run
          else
            r = Run.findOrCreate run.id
            r.set r.parse run
        data.runs = @runs.reset runs
      data

  class TrackSet extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'name'
      'tracks'
    ]
    urlRoot: '/v1/tracksets'
    # cacheExpirySecs: 2
    defaults: ->
      tracks: new TrackCollection
    parse: ->
      data = super
      return data unless data
      if data.tracks
        tracks = for track in data.tracks
          if typeof track is 'string'
            Track.findOrCreate track
          else
            t = Track.findOrCreate track.id
            t.set t.parse track
        data.tracks = @tracks.reset tracks
      data
    toJSON: (options) ->
      data = super
      data.tracks = (track.id for track in data.tracks.models) if data.tracks?
      data

  class User extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'created'
      'credits'
      'favorite_tracks'
      'name'
      'pay_history'
      'picture'
      'products'
      'tracks'
    ]
    bubbleAttribs: [ 'tracks' ]
    urlRoot: '/v1/users'
    defaults: ->
      tracks: new TrackCollectionSortName
    validate: ->
      if @name.length < 3 then return "name too short"
      if @name.length > 20 then return "name too long"
      # unless 0 <= @picture <= 5 then return "invalid picture"
    parse: (response, options) ->
      data = super
      return data unless data
      if data.tracks
        tracks = for track in data.tracks
          continue unless track?
          if typeof track is 'string'
            Track.findOrCreate track
          else
            t = Track.findOrCreate track.id
            t.set t.parse track
        data.tracks = @tracks.reset tracks
      data
    toJSON: (options) ->
      authenticated = options?.authenticated
      data = super
      # Stuff that may still be used in Mongoose layer.
      # TODO: Delete it from Mongoose layer.
      delete data.bio
      delete data.email
      delete data.gravatar_hash
      delete data.location
      delete data.prefs
      delete data.website

      delete data.admin unless data.admin
      delete data.pay_history
      unless authenticated
        delete data.admin
      if data.tracks? then data.tracks = for track in data.tracks.models
        # continue unless track.env.id is 'alp' or authenticated
        track.id
      data
    cars: ->
      products = @products ? []
      return null unless products?
      carIds = [ 'ArbusuG' ]
      if 'packa' in products
        carIds.push 'Icarus', 'Mayhem'
      else
        carIds.push 'Icarus' if 'ignition' in products
        carIds.push 'Mayhem' if 'mayhem' in products
      carIds
    isFavoriteTrack: (track) ->
      @favorite_tracks and track.id in @favorite_tracks
    setFavoriteTrack: (track, favorite) ->
      @favorite_tracks ?= []
      isFavorite = @isFavoriteTrack track
      if favorite and not isFavorite
        @favorite_tracks = @favorite_tracks.concat track.id
        track.count_fav += 1
      else if isFavorite and not favorite
        @favorite_tracks = _.without @favorite_tracks, track.id
        track.count_fav -= 1
      @

  class UserPassport extends Model
    buildProps @, [
      'profile'
      'user'
    ]
    bubbleAttribs: [ 'user' ]

  class Comment extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'created'
      'created_ago'
      'parent'  # May be a pseudo-id like 'track-xyz'
      'text'
      'user'
    ]
    urlRoot: '/v1/comments'  # Cannot be fetched directly.
    parse: ->
      data = super
      return data unless data
      data.user = User.findOrCreate data.user if data.user
      data
    toJSON: ->
      data = super
      data.user = data.user.id if data.user?
      data

  class CommentCollection extends Collection
    model: Comment

  class CommentSet extends Model
    all: new (Collection.extend model: @)
    buildProps @, [
      'comments'
    ]
    urlRoot: '/v1/commentsets'
    defaults: ->
      comments: new CommentCollection
    parse: ->
      data = super
      return data unless data
      if data.comments
        comments = for commentData in data.comments
          comment = new Comment
          comment.set comment.parse commentData
          comment
        data.comments = @comments.reset comments
      data
    # toJSON: (options) ->
    #   data = super
    #   data.tracks = (track.id for track in data.tracks.models) if data.tracks?
    #   data
    addComment: (user, text) ->
      return unless text
      parent = @id
      created_ago = 'just now'
      comment = new Comment { user, text, parent, created_ago }
      @comments.add comment, at: 0
      comment.save()

  models = {
    buildProps
    BackboneCollection: Backbone.Collection
    BackboneModel: Backbone.Model
    Backbone
    Collection
    Model

    Car
    Checkpoint
    Comment
    CommentSet
    Env
    Run
    RunCollection
    StartPos
    Track
    TrackCollection
    TrackCollectionSortModified
    TrackConfig
    TrackRuns
    TrackSet
    User
    UserPassport
  }
  exports[k] = v for k, v of models
  exports
