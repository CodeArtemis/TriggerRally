/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
(function(factory) {
  if ((typeof define === "function") && define.amd) {
    // AMD. Register as an anonymous module.
    return define(["exports", "backbone-full", "underscore"], factory);
  } else if (typeof exports === "object") {
    // CommonJS.
    return factory(exports, require("backbone"), require("underscore"));
  } else {
    throw new Error("Couldn't determine module type.");
  }
})(function(exports, Backbone, _) {

  // http://www.narrativescience.com/blog/automatically-creating-getterssetters-for-backbone-models/
  const buildProps = function(constructor, attribNames) {
    // constructor::attribNames = attribNames
    const buildGetter = name => function() { return this.get(name); };
    const buildSetter = name => function(value) { return this.set(name, value); };
    return Array.from(attribNames).map((prop) =>
      Object.defineProperty(constructor.prototype, prop, {
        get: buildGetter(prop),
        set: buildSetter(prop)
      }
      ));
  };

  const createAttributeMonitor = function() {
    const monitored = Object.create(null);

    return function(parentModel, attrib, newValue, options) {
      const onAll = function(event, model, value, options) {
        const split = event.split(':');
        if (split[1] == null) { split[1] = ""; }
        const newEvent = `${split[0]}:${attrib}.${split[1]}`;
        return parentModel.trigger(newEvent, model, value, options);
      };

      const attribValue = parentModel.get(attrib);

      if (monitored[attrib] != null) {
        if (attribValue === monitored[attrib]) { return; }
        // console.log "detaching #{parentModel.constructor.name}.#{attrib}"
        monitored[attrib].off('all', onAll);
      }

      if (attribValue instanceof Backbone.Model || attribValue instanceof Backbone.Collection) {
        // console.log "attaching #{parentModel.constructor.name}.#{attrib}"
        monitored[attrib] = attribValue;
        attribValue.on('all', onAll);
      }

      if (newValue != null) {
        const event = `change:${attrib}.`;
        return parentModel.trigger(event, newValue, options);
      }
    };
  };

  var Model = (Model = (function() {
    Model = class Model extends Backbone.Model {
      static initClass() {
        this.prototype.bubbleAttribs = null;
  
        this.prototype.useCache = true;
        this.prototype.cacheExpirySecs = 2;
      }

      static findOrCreate(id) {
        let model = this.prototype.all != null ? this.prototype.all.get(id) : undefined;
        // isNew = no
        if (!model) {
          // isNew = yes
          model = new (this)({ id });
          if (this.prototype.all != null) {
            this.prototype.all.add(model);
          }
        }
        // console.log "findOrCreate #{@::constructor.name}:#{id} isNew = #{isNew}"
        return model;
      }

      fetch(options) {
        if (options == null) { options = {}; }
        if (this.useCache && this.lastSync && !(options != null ? options.force : undefined)) {
          const timeSinceLast = Date.now() - this.lastSync;
          if (timeSinceLast < (this.cacheExpirySecs * 1000)) {
            if (typeof options.success === 'function') {
              options.success(this, null, options);
            }
            return null;
          }
        }
        let xhr = this.fetchXHR;
        if (xhr) {
          // Bind handlers to in-progress fetch.
          xhr.done((data, textStatus, jqXHR) => (typeof options.success === 'function' ? options.success(this, data, options) : undefined));
          xhr.fail((data, textStatus, errorThrown) => console.error(errorThrown)); // options.error? @, errorThrown, options
        } else {
          // Perform fetch. (Will also call success/error.)
          xhr = super.fetch(...arguments);
          if (xhr != null ? xhr.always : undefined) {
            this.fetchXHR = xhr;
            xhr.always(() => { return this.fetchXHR = null; });
          }
        }
        return xhr;
      }

      parse(response, options) {
        // TODO: per-attribute timers?
        this.lastSync = Date.now();
        return super.parse(...arguments);
      }

      initialize() {
        this.fetchXHR = null;
        const monitor = createAttributeMonitor();
        const bubbleAttribs = this.bubbleAttribs != null ? this.bubbleAttribs : [];
        bubbleAttribs.forEach(attrib => {
          // Bind to initial attributes.
          monitor(this, attrib);

          // Watch for changes to attributes and rebind as necessary.
          return this.on(`change:${attrib}`, (model, value, options) => {
            return monitor(this, attrib, value, options);
          });
        });
        return super.initialize(...arguments);
      }
    };
    Model.initClass();
    return Model;
  })());

  class Collection extends Backbone.Collection {}

  const basePath = window.BASE_PATH + '/v1/';

  class PathCollection extends Collection {
    static initClass() {
      this.prototype.url = basePath + this.path;
    }
  }
  PathCollection.initClass();

  class CarCollection extends PathCollection {
    static initClass() {
      this.prototype.path = 'cars';
    }
  }
  CarCollection.initClass();
  class EnvCollection extends PathCollection {
    static initClass() {
      this.prototype.path = 'envs';
    }
  }
  EnvCollection.initClass();
  class RunCollection extends PathCollection {
    static initClass() {
      this.prototype.path = 'runs';
    }
  }
  RunCollection.initClass();
  class TrackCollection extends PathCollection {
    static initClass() {
      this.prototype.path = 'tracks';
    }
  }
  TrackCollection.initClass();
  class UserCollection extends PathCollection {
    static initClass() {
      this.prototype.path = 'users';
    }
  }
  UserCollection.initClass();

  class TrackCollectionSortName extends TrackCollection {
    static initClass() {
      this.prototype.comparator = 'name';
    }
  }
  TrackCollectionSortName.initClass();

  class TrackCollectionSortModified extends TrackCollection {
    comparator(a, b) {
      if ((a.modified == null) || (b.modified == null) || (a.modified === b.modified)) {
        return a.cid - b.cid;
      } else if (a.modified < b.modified) { return 1; } else { return -1; }
    }
  }

  class Checkpoint extends Model {
    static initClass() {
      buildProps(this, [ 'disp', 'pos', 'surf' ]);
    }
  }
  Checkpoint.initClass();

  class CheckpointsCollection extends Collection {
    static initClass() {
      this.prototype.model = Checkpoint;
    }
  }
  CheckpointsCollection.initClass();

  class StartPos extends Model {
    static initClass() {
      buildProps(this, [ 'pos', 'rot' ]);
    }
  }
  StartPos.initClass();

  class Course extends Model {
    static initClass() {
      buildProps(this, [ 'checkpoints', 'startposition' ]);
      this.prototype.bubbleAttribs = [ 'checkpoints', 'startposition' ];
    }
    defaults() {
      return {
        startposition: new StartPos,
        checkpoints: new CheckpointsCollection
      };
    }
    parse(response, options) {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.startposition) {
        this.startposition.set(this.startposition.parse(data.startposition));
        data.startposition = this.startposition;
      }
      if (data.checkpoints) {
        const checkpoints = (() => {
          const result = [];
          for (let checkpoint of Array.from(data.checkpoints)) {
            const c = new Checkpoint;
            c.set(c.parse(checkpoint));
            result.push(c);
          }
          return result;
        })();
        this.checkpoints.reset(checkpoints);
        data.checkpoints = this.checkpoints;
      }
      return data;
    }
  }
  Course.initClass();

  class TrackConfig extends Model {
    static initClass() {
      buildProps(this, [ 'course', 'gameversion', 'scenery' ]);  // TODO: Remove gameversion.
      this.prototype.bubbleAttribs = [ 'course' ];
    }
    defaults() {
      return {course: new Course};
    }
    parse(response, options) {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.course) {
        const { course } = this;
        data.course = course.set(course.parse(data.course));
      }
      return data;
    }
  }
  TrackConfig.initClass();

  class Car extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [ 'config', 'name', 'user', 'product' ]);
      this.prototype.urlRoot = basePath + 'cars';
    }
    toJSON(options) {
      const data = super.toJSON(...arguments);
      delete data.created;
      if (data.user != null) { data.user = data.user.id; }
      // if data.product? and data.config?
      //   unless data.product in (options?.products ? [])
      //     delete data.config.sounds
      return data;
    }
  }
  Car.initClass();

  class Env extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [ 'desc', 'name', 'cars', 'gameversion', 'scenery', 'terrain' ]);
      this.prototype.urlRoot = basePath + 'envs';
    }
    defaults() {
      return {cars: new CarCollection};
    }
    toJSON(options) {
      const data = super.toJSON(...arguments);
      if (data.cars != null) { data.cars = (Array.from(data.cars.models).map((car) => car.id)); }
      // if options?.restricted
      //   delete data.cars
      //   delete data.scenery
      //   delete data.terrain
      return data;
    }
    parse(response, options) {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.cars) {
        const cars = (() => {
          const result = [];
          for (let car of Array.from(data.cars)) {
            if (typeof car === 'string') {
              result.push(Car.findOrCreate(car));
            } else {
              const c = Car.findOrCreate(car.id);
              result.push(c.set(c.parse(car)));
            }
          }
          return result;
        })();
        data.cars = this.cars.reset(cars);
      }
      return data;
    }
  }
  Env.initClass();

  class Run extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'car',
        'created',
        'created_ago',
        'rank',  // Attribute generated when fetched.
        'record_i',
        'record_p',
        'status',
        'time',
        'time_readable',
        'times',
        'track',
        'user'
      ]);
      this.prototype.urlRoot = basePath + 'runs';
    }
    parse() {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.car) { data.car = Car.findOrCreate(data.car); }
      if (data.track) { data.track = Track.findOrCreate(data.track); }
      if (data.user) { data.user = User.findOrCreate(data.user); }
      return data;
    }
    toJSON() {
      const data = super.toJSON(...arguments);
      if (data.car != null) { data.car = data.car.id; }
      if (data.track != null) { data.track = data.track.id; }
      if (data.user != null) { data.user = data.user.id; }
      return data;
    }
  }
  Run.initClass();

  class Track extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'config',
        'count_copy',
        'count_drive',
        'count_fav',
        'created',
        'demo',
        'env',
        'modified',
        'name',
        'next_track',
        'parent',
        'prevent_copy',
        'published',
        'user'
      ]);
      this.prototype.bubbleAttribs = [ 'config', 'env' ];
      this.prototype.urlRoot = basePath + 'tracks';
      // initialize: ->
      //   # @config = new TrackConfig
      //   super
      //   # @on 'all', (event) -> console.log 'Track: ' + event
      this.prototype.maxNameLength = 40;
    }
    validate() {
      if ((this.name != null ? this.name.length : undefined) < 3) { return "name too short"; }
      if ((this.name != null ? this.name.length : undefined) > this.maxNameLength) { return "name too long"; }
    }
    parse(response, options) {
      // Regression detection.
      let env;
      if (this.config && !(this.config instanceof TrackConfig)) {
        console.error("Raw track.config detected in Track.parse()");
      }

      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.config) {
        let { config } = this;
        if (!(config instanceof TrackConfig)) { config = new TrackConfig; }
        data.config = config.set(config.parse(data.config));
      }
      if (data.env) {
        data.env = (() => {
          if (typeof data.env === 'string') {
          return Env.findOrCreate(data.env);
        } else {
          env = Env.findOrCreate(data.env.id);
          return env.set(env.parse(data.env));
        }
        })();
      }
      if (data.parent) {
        const { parent } = data;
        const parentId = typeof parent === 'string' ? parent : parent.id;
        data.parent = Track.findOrCreate(parentId);
      }
      if (data.user) {
        const { user } = data;
        if (typeof user === 'string') {
          data.user = User.findOrCreate(user);
        } else {
          data.user = User.findOrCreate(user.id);
          data.user.set(data.user.parse(user));
        }
      }
      if (data.next_track) {
        const nextTrack = data.next_track;
        const nextTrackId = typeof nextTrack === 'string' ? nextTrack : nextTrack.id;
        data.next_track = Track.findOrCreate(nextTrackId);
      }
      if (data.created && !data.modified) { data.modified = data.created; }
      return data;
    }
    toJSON() {
      const data = super.toJSON(...arguments);
      if (data.env != null) { data.env = data.env.id; }
      if (data.parent != null) { data.parent = data.parent.id; }
      if (data.user != null) { data.user = data.user.id; }
      if (data.next_track != null) { data.next_track = data.next_track.id; }
      return data;
    }
  }
  Track.initClass();

  class TrackRuns extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'runs'
      ]);
    }
    url() { return basePath + `tracks/${this.id}/runs`; }
    defaults() {
      return {runs: new RunCollection};
    }
    parse() {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.runs) {
        const runs = (() => {
          const result = [];
          for (let run of Array.from(data.runs)) {
            if (typeof run === 'string') {
              result.push(Run.findOrCreate(run));
            } else {
              const r = Run.findOrCreate(run.id);
              result.push(r.set(r.parse(run)));
            }
          }
          return result;
        })();
        data.runs = this.runs.reset(runs);
      }
      return data;
    }
  }
  TrackRuns.initClass();

  class TrackSet extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'name',
        'tracks'
      ]);
      this.prototype.urlRoot = basePath + 'tracksets';
    }
    // cacheExpirySecs: 2
    defaults() {
      return {tracks: new TrackCollection};
    }
    parse() {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.tracks) {
        const tracks = (() => {
          const result = [];
          for (let track of Array.from(data.tracks)) {
            if (typeof track === 'string') {
              result.push(Track.findOrCreate(track));
            } else {
              const t = Track.findOrCreate(track.id);
              result.push(t.set(t.parse(track)));
            }
          }
          return result;
        })();
        data.tracks = this.tracks.reset(tracks);
      }
      return data;
    }
    toJSON(options) {
      const data = super.toJSON(...arguments);
      if (data.tracks != null) { data.tracks = (Array.from(data.tracks.models).map((track) => track.id)); }
      return data;
    }
  }
  TrackSet.initClass();

  class User extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'created',
        'credits',
        'favorite_tracks',
        'name',
        'pay_history',
        'picture',
        'products',
        'tracks'
      ]);
      this.prototype.bubbleAttribs = [ 'tracks' ];
      this.prototype.urlRoot = basePath + 'users';
    }
    defaults() {
      return {tracks: new TrackCollectionSortName};
    }
    validate() {
      if (this.name.length < 3) { return "name too short"; }
      if (this.name.length > 20) { return "name too long"; }
    }
      // unless 0 <= @picture <= 5 then return "invalid picture"
    parse(response, options) {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.tracks) {
        const tracks = (() => {
          const result = [];
          for (let track of Array.from(data.tracks)) {
            if (track == null) { continue; }
            if (typeof track === 'string') {
              result.push(Track.findOrCreate(track));
            } else {
              const t = Track.findOrCreate(track.id);
              result.push(t.set(t.parse(track)));
            }
          }
          return result;
        })();
        data.tracks = this.tracks.reset(tracks);
      }
      return data;
    }
    toJSON(options) {
      const authenticated = options != null ? options.authenticated : undefined;
      const data = super.toJSON(...arguments);
      // Stuff that may still be used in Mongoose layer.
      // TODO: Delete it from Mongoose layer.
      delete data.bio;
      delete data.email;
      delete data.gravatar_hash;
      delete data.location;
      delete data.prefs;
      delete data.website;

      if (!data.admin) { delete data.admin; }
      delete data.pay_history;
      if (!authenticated) {
        delete data.admin;
      }
      if (data.tracks != null) { data.tracks = Array.from(data.tracks.models).map((track) =>
        // continue unless track.env.id is 'alp' or authenticated
        track.id); }
      return data;
    }
    cars() {
      const products = this.products != null ? this.products : [];
      if (products == null) { return null; }
      const carIds = [ 'ArbusuG' ];
      if (Array.from(products).includes('packa')) {
        carIds.push('Icarus', 'Mayhem');
      } else {
        if (Array.from(products).includes('ignition')) { carIds.push('Icarus'); }
        if (Array.from(products).includes('mayhem')) { carIds.push('Mayhem'); }
      }
      return carIds;
    }
    isFavoriteTrack(track) {
      return this.favorite_tracks && Array.from(this.favorite_tracks).includes(track.id);
    }
    setFavoriteTrack(track, favorite) {
      if (this.favorite_tracks == null) { this.favorite_tracks = []; }
      const isFavorite = this.isFavoriteTrack(track);
      if (favorite && !isFavorite) {
        this.favorite_tracks = this.favorite_tracks.concat(track.id);
        track.count_fav += 1;
      } else if (isFavorite && !favorite) {
        this.favorite_tracks = _.without(this.favorite_tracks, track.id);
        track.count_fav -= 1;
      }
      return this;
    }
  }
  User.initClass();

  class UserPassport extends Model {
    static initClass() {
      buildProps(this, [
        'profile',
        'user'
      ]);
      this.prototype.bubbleAttribs = [ 'user' ];
    }
  }
  UserPassport.initClass();

  class Comment extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'created',
        'created_ago',
        'parent',  // May be a pseudo-id like 'track-xyz'
        'text',
        'user'
      ]);
      this.prototype.urlRoot = basePath + 'comments';
        // Cannot be fetched directly.
    }
    parse() {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.user) { data.user = User.findOrCreate(data.user); }
      return data;
    }
    toJSON() {
      const data = super.toJSON(...arguments);
      if (data.user != null) { data.user = data.user.id; }
      return data;
    }
  }
  Comment.initClass();

  class CommentCollection extends Collection {
    static initClass() {
      this.prototype.model = Comment;
    }
  }
  CommentCollection.initClass();

  class CommentSet extends Model {
    static initClass() {
      this.prototype.all = new (Backbone.Collection.extend({model: this}));
      buildProps(this, [
        'comments'
      ]);
      this.prototype.urlRoot = basePath + 'commentsets';
    }
    defaults() {
      return {comments: new CommentCollection};
    }
    parse() {
      const data = super.parse(...arguments);
      if (!data) { return data; }
      if (data.comments) {
        const comments = (() => {
          const result = [];
          for (let commentData of Array.from(data.comments)) {
            const comment = new Comment;
            comment.set(comment.parse(commentData));
            result.push(comment);
          }
          return result;
        })();
        data.comments = this.comments.reset(comments);
      }
      return data;
    }
    // toJSON: (options) ->
    //   data = super
    //   data.tracks = (track.id for track in data.tracks.models) if data.tracks?
    //   data
    addComment(user, text) {
      if (!text) { return; }
      const parent = this.id;
      const created_ago = 'just now';
      const comment = new Comment({ user, text, parent, created_ago });
      this.comments.add(comment, {at: 0});
      return comment.save();
    }
  }
  CommentSet.initClass();

  const models = {
    buildProps,
    BackboneCollection: Backbone.Collection,
    BackboneModel: Backbone.Model,
    Backbone,
    Collection,
    Model,

    Car,
    Checkpoint,
    Comment,
    CommentSet,
    Env,
    Run,
    RunCollection,
    StartPos,
    Track,
    TrackCollection,
    TrackCollectionSortModified,
    TrackConfig,
    TrackRuns,
    TrackSet,
    User,
    UserPassport
  };
  for (let k in models) { const v = models[k]; exports[k] = v; }
  return exports;
});
