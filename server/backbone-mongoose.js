/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This layer is not intended to be secure. It just syncs Backbone models to the DB.

const _ = require('underscore');
const mongoose = require('mongoose');
const mo = (() =>
  ({
    Car:     mongoose.model('Car'),
    Comment: mongoose.model('Comment'),
    Env:     mongoose.model('Environment'),
    Run:     mongoose.model('Run'),
    Track:   mongoose.model('Track'),
    User:    mongoose.model('User')
  })
)();

const favhot = require('./util/favhot');

const alpEnvId = new mongoose.Types.ObjectId('506754342668a4626133ccd7');
// alpEnvId = '506754342668a4626133ccd7'

const jsonClone = obj => JSON.parse(JSON.stringify(obj));

var parseMongoose = function(doc) {
  //if doc?.prefs then console.log doc.prefs
  if (doc instanceof mongoose.Document) {
    return parseMongoose(doc.toObject({getters: true}));
  } else if (doc instanceof mongoose.Types.ObjectId) {
    return "[bbm ObjectId]";
  } else if (_.isArray(doc)) {
    return (Array.from(doc).map((el) => parseMongoose(el)));
  } else if (doc instanceof Date) {
    return doc;
  } else if (_.isObject(doc)) {
    const result = {};
    for (let key in doc) {
      const value = doc[key];
      result[key] = parseMongoose(value);
    }
    if (doc.pub_id) { result.id = doc.pub_id; }
    delete result.pub_id;
    delete result._id;
    delete result["__v"];
    return result;
  } else {
    return doc;
  }
};

const makeSync = handlers =>
  function(method, model, options) {
    const success = (options != null ? options.success : undefined) || function() {};
    const error = (options != null ? options.error : undefined) || function() {};
    if (handlers[method]) {
      handlers[method](model, success, error, options);
    } else {
      const err = `Method '${method}' not implemented for ${model.constructor.name}.`;
      console.log(err);
      error(err);
    }
    // TODO: return a Promise object of some sort.
    return null;
  }
;

module.exports = function(bb) {
  bb.Car.prototype.sync = makeSync({
    read(model, success, error, options) {
      return mo.Car
        .findOne({pub_id: model.id})
        .populate('user', 'pub_id')
        .exec(function(err, car) {
          if (err) { return error(err); }
          if (!car) { return error(`Couldn't find env ${model.id}`); }
          const parsed = parseMongoose(car);
          if (parsed.user) { parsed.user = parsed.user.id; }
          return success(parsed);
      });
    }
  });

  bb.Comment.prototype.sync = makeSync({
    create(model, success, error, options) {
      if (!model.parent) { return error("Comment has no parent"); }
      if (!model.text) { return error("Empty comment"); }
      if (model.text.length > 80) { return error("Comment too long"); }
      const comment = new mo.Comment({
        parent: model.parent,
        text: model.text,
        user: options.user.id
      });
      return comment.save(function(err) {
        if (err) {
          console.log(`Error creating comment: ${err}`);
          return error(null);
        }
        const parsed = parseMongoose(comment);
        delete parsed.user;
        return success(parsed);
      });
    }
  });

  bb.CommentSet.prototype.sync = makeSync({
    read(model, success, error, options) {
      // [ type, objId ] = model.id
      return mo.Comment
        .find({parent: model.id})
        .sort({_id: -1})
        .limit(50)
        .populate('user', 'pub_id')
        .exec(function(err, comments) {
          if (err) { return error(err); }
          if (!comments) { return error(`Couldn't find comment set ${model.id}`); }
          const parsed = parseMongoose(comments);
          for (let comment of Array.from(parsed)) {
            if (comment.user) { comment.user = comment.user.id; }
          }
          return success({
            id: model.id,
            comments: parsed
          });
      });
    }
  });

  bb.Env.prototype.sync = makeSync({
    read(model, success, error, options) {
      return mo.Env
        .findOne({pub_id: model.id})
        .exec(function(err, env) {
          if (err) { return error(err); }
          if (!env) { return error(`Couldn't find env ${model.id}`); }
          return mo.Car
            .find({_id: { $in: env.cars }})
            .select('pub_id')
            .exec(function(err, cars) {
              if (err) { return error(err); }
              const parsed = parseMongoose(env);
              parsed.cars = (Array.from(cars).map((car) => car.pub_id));
              return success(parsed);
          });
      });
    }
  });

  bb.Run.prototype.sync = makeSync({
    read(model, success, error, options) {
      return mo.Run
        .findOne({pub_id: model.id})
        .populate('car', 'pub_id')
        .populate('track', 'pub_id')
        .populate('user', 'pub_id')
        .exec(function(err, run) {
          if (err) { return error(err); }
          if (!run) { return error(`Couldn't find run ${model.id}`); }
          const parsed = parseMongoose(run);
          if (parsed.car) { parsed.car = parsed.car.id; }
          if (parsed.track) { parsed.track = parsed.track.id; }
          if (parsed.user) { parsed.user = parsed.user.id; }
          return success(parsed);
      });
    }
  });

  bb.Track.prototype.sync = (function() {
    const parseTrack = function(track) {
      const parsed = parseMongoose(track);
      if (parsed.env) { parsed.env = parsed.env.id; }
      if (parsed.next_track) { parsed.next_track = parsed.next_track.id; }
      if (parsed.parent) { parsed.parent = parsed.parent.id; }
      if (parsed.user) { parsed.user = parsed.user.id; }
      return parsed;
    };

    return makeSync({
      create(model, success, error, options) {
        return mo.Track
          .findOne({pub_id: model.parent.id})
          .exec(function(err, parentTrack) {
            if (err) { return error(err); }
            if (!parentTrack) { return error(`Couldn't find track ${model.parent.id}`); }
            const data = jsonClone(model);
            const track = new mo.Track({
              parent: parentTrack.id,
              user: options.user.id,
              name: data.name,
              env: parentTrack.env,
              config: parentTrack.config,
              modified: new Date()
            });
            return track.save(function(err) {
              if (err) {
                console.log(`Error creating track: ${err}`);
                return error(null);
              }
              const parsed = parseTrack(track);
              // parsed.user = options.user.pub_id
              // parsed.env = parentTrack.env.pub_id
              // We don't actually need these values. The API layer has set them already.
              delete parsed.env;
              delete parsed.parent;
              delete parsed.user;
              return success(parsed);
            });
        });
      },
      read(model, success, error, options) {
        return mo.Track
          .findOne({pub_id: model.id})
          .populate('env', 'pub_id')
          .populate('next_track', 'pub_id')
          .populate('parent', 'pub_id')
          .populate('user', 'pub_id')
          .exec(function(err, track) {
            if (err) { return error(err); }
            if (!track) { return error(`Couldn't find track ${model.id}`); }
            return mo.User
              .count({'favorite_tracks': track._id}, function(err, count) {
                const parsed = parseTrack(track);
                parsed.count_fav = count;
                return success(parsed);
            });
        });
      },
      update(model, success, error, options) {
        if (model.config == null) {
          console.error("Saving track: NO CONFIG!");
          console.log(JSON.stringify(model));
          return error(null);
        }
        return mo.Track
          .findOne({pub_id: model.id})
          .exec(function(err, track) {
            if (err) { return error(err); }
            if (!track) { return error(`Couldn't find track ${model.id}`); }
            const data = jsonClone(model);
            // TODO: Check if it's safe to just copy everything from the model.
            _.extend(track, _.pick(data, [
              'config',
              'count_copy',
              'count_drive',
              'count_fav',
              'modified',
              'name',
              'prevent_copy',
              'published'
            ]));
            return track.save(function(err) {
              if (err) {
                console.log(`Error saving track: ${err}`);
                return error(null);
              }
              return success(null);
            });
        });
      },
      delete(model, success, error, options) {
        return mo.Track
          .findOne({pub_id: model.id})
          .exec((err, track) =>
            track.remove(function(err) {
              if (err) {
                console.log(`Error deleting track: ${err}`);
                return error(null);
              }
              return success(null);
            })
        );
      }
    });
  })();

  bb.TrackRuns.prototype.sync = makeSync({
    read(model, success, error, options) {
      return mo.Track
        .findOne({pub_id: model.id})
        .exec(function(err, track) {
          if (err) { return error(err); }
          if (!track) { return error(`Couldn't find track ${model.id}`); }
          // TODO: filter by car?
          return mo.Run
            .find({track: track._id})
            // .where('time', { $not: { $type: 10 } })  # Exclude null times. Sort index also excludes.
            .sort({time: 1})
            .limit(10)
            .select('pub_id car track user status time')
            .populate('car', 'pub_id')
            .populate('track', 'pub_id')
            .populate('user', 'pub_id')
            .exec(function(err, runs) {
              if (err) {
                console.log(`Error fetching runs: ${err}`);
                return error(null);
              }
              const parsed = parseMongoose(runs);
              let rank = 1;
              for (let p of Array.from(parsed)) {
                if (p.car) { p.car = p.car.id; }
                if (p.track) { p.track = p.track.id; }
                if (p.user) { p.user = p.user.id; }
                p.rank = rank++;
              }
              return success({
                id: model.id,
                runs: parsed
              });
          });
      });
    }
  });

  bb.TrackSet.prototype.sync = makeSync({
    read(model, success, error, options) {
      switch (model.id) {
        case 'favhot':
          var query = {
            env: alpEnvId,  // TODO: Remove this filter.
            published: true
          };
          return mo.Track
            .find(query)
            .select('count_fav modified pub_id')
            // .sort({modified: -1})
            // .limit(1000)
            .exec(function(err, tracks) {
              if (err) {
                console.log(`Error fetching tracks: ${err}`);
                return error(null);
              }
              tracks.sort((a, b) => favhot.trackScore(b) - favhot.trackScore(a));
              if (tracks.length > 30) { tracks.length = 30; }
              const response = {
                name: 'Most favorited recent published tracks',
                tracks: ((Array.from(tracks).map((track) => track.pub_id)))
              };
              return success(response);
          });
        case 'featured':
          var response = {
            name: 'Featured tracks',
            tracks: [
              'uUJTPz6M',
              'Alpina',
              'pRNGozkY',
              'Z7SkazUF',
              '8wuycma7',
              'KaXCxxFv'
            ]
          };
          return success(response);
        case 'recent':
          query = {
            env: alpEnvId,  // TODO: Remove this filter.
            published: true
          };
          return mo.Track
            .find(query)
            .sort({modified: -1})
            .limit(30)
            .exec(function(err, tracks) {
              if (err) {
                console.log(`Error fetching tracks: ${err}`);
                return error(null);
              }
              response = {
                name: 'Recent published tracks',
                tracks: ((Array.from(tracks).map((track) => track.pub_id)))
              };
              return success(response);
          });
        case 'all':
          query =
            {env: alpEnvId};  // TODO: Remove this filter.
          return mo.Track
            .find(query)
            .sort({modified: -1})
            .limit(30)
            .exec(function(err, tracks) {
              if (err) {
                console.log(`Error fetching tracks: ${err}`);
                return error(null);
              }
              response = {
                name: 'Recently modified tracks',
                tracks: ((Array.from(tracks).map((track) => track.pub_id)))
              };
              return success(response);
          });
        default:
          return error(null);
      }
    }
  });

  return bb.User.prototype.sync = makeSync({
    read(model, success, error, options) {
      return mo.User
        .findOne({pub_id: model.id})
        .populate('favorite_tracks', 'pub_id')
        .exec(function(err, user) {
          if (err) { return error(err); }
          if (!user) { return error(`Couldn't find user ${model.id}`); }
          return mo.Track
            .find({user: user.id})
            .select('pub_id env')
            .exec(function(err, tracks) {
              if (err) { return error(err); }
              const parsed = parseMongoose(user);
              parsed.favorite_tracks = (Array.from(user.favorite_tracks).map((fav) => fav.pub_id));
              parsed.tracks = ((() => {
                const result = [];
                for (let track of Array.from(tracks)) {                   if ((track.env != null ? track.env.equals(alpEnvId) : undefined)) {
                    result.push(track.pub_id);
                  }
                }
                return result;
              })());
              return success(parsed);
          });
      });
    },
    update(model, success, error, options) {
      let fav_tracks;
      let user = (fav_tracks = null);
      const done = _.after(2, function() {
        const data = jsonClone(model);
        _.extend(user, _.pick(data, [
          // 'favorite_tracks'  # Done below.
          'credits',
          'name',
          'pay_history',
          'picture',
          'products'
          // 'tracks'  # This is a generated attribute.
        ]));
        user.favorite_tracks = (Array.from(fav_tracks).map((ft) => ft._id));
        return user.save(function(err) {
          if (err) {
            console.log(`Error saving user: ${err}`);
            return error(null);
          }
          return success(null);
        });
      });
      mo.User
        .findOne({pub_id: model.id})
        .exec(function(err, doc) {
          if (err) { return error(err); }
          user = doc;
          if (!user) { return error(`Couldn't find user ${model.id}`); }
          return done();
      });
      return mo.Track
        .find({pub_id: { $in: model.favorite_tracks }})
        .select('_id')
        .exec(function(err, docs) {
          if (err) { return error(err); }
          fav_tracks = docs;
          return done();
      });
    }
  });
};
