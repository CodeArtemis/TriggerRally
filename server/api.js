/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const bb = require('./public/scripts/models');
const { Backbone } = bb;

// Disable all caching on the server.
bb.Model.prototype.useCache = false;

// Attach backbone models to MongoDB via Mongoose.
require('./backbone-mongoose')(bb);

const jsonClone = obj => JSON.parse(JSON.stringify(obj));

const findModel = function(Model, pub_id, done) {
  const model = Model.findOrCreate(pub_id);
  const result = model.fetch({
    success() { return done(model); },
    error(e1, e2) {
      return console.error('Error when loading model', pub_id);
    }
  });
  if (result === false) { return done(null); }
};

const findCar         = function() { return findModel(bb.Car,        ...arguments); };
const findCommentSet  = function() { return findModel(bb.CommentSet, ...arguments); };
const findEnv         = function() { return findModel(bb.Env,        ...arguments); };
const findRun         = function() { return findModel(bb.Run,        ...arguments); };
const findTrack       = function() { return findModel(bb.Track,      ...arguments); };
const findTrackRuns   = function() { return findModel(bb.TrackRuns,  ...arguments); };
const findTrackSet    = function() { return findModel(bb.TrackSet,   ...arguments); };
const findUser        = function() { return findModel(bb.User,       ...arguments); };

// This public-facing API is responsible for validating requests and data.

module.exports = {
  findUser,
  setup(app) {
    const base = '/v1';

    const jsonError = function(code, res, msg) {
      const text = {
        400: "Bad Request - client bug",
        401: "Unauthorized - log in required",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict"
      };
      const result = { error: text[code] };
      if (msg) { result.extended = msg; }
      return res.json(code, result);
    };

    const boolean = val => (val != null) && ['1', 't', 'y', 'true', 'yes'].includes(val);

    const loadUrl = (finder, param, attrib, req, res, next) =>
      finder(req.params[param], function(obj) {
        if (obj == null) { return jsonError(404, res); }
        if (!req.fromUrl) { req.fromUrl = {}; }
        req.fromUrl[attrib] = obj;
        return next();
      })
    ;

    const loadUrlCommentSet = (req, res, next) => loadUrl(findCommentSet, 'commentset_id', 'commentSet', req, res, next);
    const loadUrlRun = (req, res, next) => loadUrl(findRun, 'run_id', 'run', req, res, next);
    const loadUrlTrack = (req, res, next) => loadUrl(findTrack, 'track_id', 'track', req, res, next);
    const loadUrlTrackRuns = (req, res, next) => loadUrl(findTrackRuns, 'track_id', 'trackRuns', req, res, next);
    const loadUrlTrackSet = (req, res, next) => loadUrl(findTrackSet, 'trackset_id', 'trackSet', req, res, next);
    const loadUrlUser = (req, res, next) => loadUrl(findUser, 'user_id', 'user', req, res, next);

    const editUrlTrack = (req, res, next) =>
      loadUrlTrack(req, res, function() {
        const { track } = req.fromUrl;
        // Real security check.
        if (req.user == null) { return jsonError(401, res); }
        if (track.user.id !== req.user.user.pub_id) { return jsonError(403, res); }
        // Opt-in sanity checks to help protect against client bugs.
        if (req.body.id && (req.body.id !== track.id)) { return jsonError(400, res, 'id mismatch'); }
        const modifiedExpected = track.modified.toISOString();
        const modifiedActual = req.body.modified;
        if (modifiedActual && (modifiedActual !== modifiedExpected)) {
          return jsonError(409, res, `expired: expected ${modifiedExpected} but got ${modifiedActual}`);
        }
        return next();
      })
    ;

    const editUrlUser = (req, res, next) =>
      loadUrlUser(req, res, function() {
        const { user } = req.fromUrl;
        if (req.user == null) { return jsonError(401, res); }
        if (user.id !== req.user.user.pub_id) { return jsonError(403, res); }
        return next();
      })
    ;

    const filterAndSaveIfModified = function(model, allowedKeys, req, res) {
      const attribs = _.pick(req.body, allowedKeys);
      const prev = jsonClone(_.pick(model, allowedKeys));
      if (_.isEqual(prev, attribs)) {
        console.log(`${model.constructor.name} ${model.id}: no changes to save`);
        return res.json({});
      }
      if ('config' in attribs && !_.isEqual(prev.config, attribs.config)) {
        attribs.modified = new Date;
      }
      console.log(`${model.constructor.name} ${model.id}: saving changes`);
      return model.save(attribs, {
        success() { return res.json({ modified: attribs.modified }); },
        error() { return jsonError(500, res); }
      }
      );
    };

    app.get(`${base}/cars/:car_id`, (req, res) =>
      findCar(req.params['car_id'], function(car) {
        if (car == null) { return jsonError(404, res); }
        const products = req.user != null ? req.user.user.products : undefined;
        return res.json(car.toJSON({ products }));
    })
  );

    app.post(`${base}/comments`, function(req, res) {
      if (req.user == null) { return jsonError(401, res); }
      return findUser(req.user.user.pub_id, function(reqUser) {
        if (!reqUser) { return jsonError(500, res); }
        // TODO: Check that the comment parent/target actually exists.
        const comment = new bb.Comment({
          parent: req.body.parent,
          text: req.body.text
        });
        const result = comment.save(null, {
          user: req.user.user,
          success(comment) {
            return res.json(comment);
          },
          error(model, err) {
            console.log(`Error creating comment: ${err}`);
            return jsonError(500, res);
          }
        }
        );
        if (result === false) {
          console.log("Error creating comment: save failed");
          return jsonError(500, res);
        }
      });
    });

    app.get(`${base}/commentsets/:commentset_id`, loadUrlCommentSet, (req, res) => res.json(req.fromUrl.commentSet));

    app.get(`${base}/envs/:env_id`, (req, res) =>
      findEnv(req.params['env_id'], function(env) {
        if (env == null) { return jsonError(404, res); }
        // allowedEnvs = [ 'alp' ]
        // if req.user?
        //   allowedEnvs = allowedEnvs.concat req.user.user.packs
        // restricted = env.id not in allowedEnvs
        return res.json(env);
      })
    ); //.toJSON { restricted }

    app.get(`${base}/runs/:run_id`, (req, res) =>
      findRun(req.params['run_id'], function(run) {
        if (run == null) { return jsonError(404, res); }
        if (run.record_p) {
          return res.json(run);
        } else {
          return run.fetch({
            force: true,
            success() { return res.json(run); },
            error() { return jsonError(500, res); }
          });
        }
      })
    );

    app.post(`${base}/tracks`, function(req, res) {
      if (req.user == null) { return jsonError(401, res); }
      return findUser(req.user.user.pub_id, function(reqUser) {
        if (!reqUser) { return jsonError(500, res); }
        const parentTrackId = req.body.parent;
        return findTrack(parentTrackId, function(parentTrack) {
          if (parentTrack == null) { return jsonError(404, res); }
          if (parentTrack.env == null) { return jsonError(400, res); }
          if (parentTrack.env.id !== 'alp') { return jsonError(403, res); }
          if (parentTrack.prevent_copy) { return jsonError(403, res); }
          // TODO: Check this user is allowed to copy tracks from this env.
          const track = new bb.Track;
          let newName = parentTrack.name;
          const maxLength = bb.Track.prototype.maxNameLength - 5;
          if (newName.length > maxLength) { newName = newName.slice(0, maxLength - 3) + '...'; }
          newName += ' copy';
          track.set(track.parse({
            config: jsonClone(parentTrack.config),
            env: parentTrack.env.id,
            name: newName,
            parent: parentTrack.id,
            prevent_copy: parentTrack.prevent_copy,
            user: reqUser.id
          })
          );
          const result = track.save(null, {
            user: req.user.user,
            success(track) {
              res.json(track);
              reqUser.tracks.add(track);
              parentTrack.count_copy += 1;
              return parentTrack.save();
            },
            error(model, err) {
              console.log(`Error creating track: ${err}`);
              return jsonError(500, res);
            }
          }
          );
          if (result === false) {
            console.log("Error creating track: save failed");
            return jsonError(500, res);
          }
        });
      });
    });

    // TODO: Add a multi-ID track GET.
    app.get(`${base}/tracks/:track_id`, loadUrlTrack, (req, res) => res.json(req.fromUrl.track));

    // app.get "#{base}/tracks/:track_id/runs", loadUrlTrack, (req, res) ->
    //   trackRuns = new bb.TrackRuns null, track: req.fromUrl.track
    //   trackRuns.fetch
    //     success: (collection) ->
    //       res.json collection
    //     error: (collection, err) ->
    //       console.log "Error creating track: #{err}"
    //       jsonError 500, res

    app.get(`${base}/tracks/:track_id/runs`, loadUrlTrackRuns, (req, res) => res.json(req.fromUrl.trackRuns));

    // app.get "#{base}/tracks/:track_id/bestrun", loadUrlTrack, (req, res) ->
    //   req.fromUrl.track.getBestRun (run) ->
    //     return jsonError 404, res unless run?
    //     res.json { run }

    // app.get "#{base}/tracks/:track_id/personalbestrun", loadUrlTrackRuns, (req, res) ->
    //   res.json req.fromUrl.trackRuns

    app.put(`${base}/tracks/:track_id`, editUrlTrack, function(req, res) {
      const { track } = req.fromUrl;
      let allowedKeys = [ 'name', 'prevent_copying' ];
      if (!track.published) {
        allowedKeys = allowedKeys.concat([ 'config', 'published' ]);
      }
      return filterAndSaveIfModified(track, allowedKeys, req, res);
    });

    app.post(`${base}/tracks/:track_id/drive`, loadUrlTrack, (req, res) => res.send(200));
      // Now handled by drive socket.
      // track = req.fromUrl.track
      // track.save { count_drive: track.count_drive + 1 }

    app.delete(`${base}/tracks/:track_id`, editUrlTrack, function(req, res) {
      if (req.fromUrl.track.id === 'v3-base-1') { jsonError(403, res); }
      return req.fromUrl.track.destroy({
        success() { return res.json({}); },
        error() { return jsonError(500, res); }
      });
    });

    app.get(`${base}/tracksets/:trackset_id`, loadUrlTrackSet, (req, res) => res.json(req.fromUrl.trackSet));

    app.get(`${base}/users/:user_id`, loadUrlUser, function(req, res) {
      const { user } = req.fromUrl;
      const authenticated = user.id === (req.user != null ? req.user.user.pub_id : undefined);
      return res.json(user.toJSON({ authenticated }));
  });

    app.put(`${base}/users/:user_id`, editUrlUser, function(req, res) {
      const products = req.fromUrl.user.products != null ? req.fromUrl.user.products : [];
      const maySetPicture = Array.from(products).includes('ignition') || Array.from(products).includes('mayhem') || Array.from(products).includes('packa');
      if ('picture' in req.body && !maySetPicture) { return jsonError(403, res); }
      const allowedKeys = [
        'favorite_tracks',
        'name',
        'picture'
      ];
      return filterAndSaveIfModified(req.fromUrl.user, allowedKeys, req, res);
    });

    app.get(`${base}/auth/me`, function(req, res) {
      if ((req.user != null ? req.user.user : undefined)) {
        findUser(req.user.user.pub_id, function(user) {
          if (user == null) { return jsonError(404, res); }
          return res.json({user: user.toJSON({ authenticated: true })});
      });
      } else {
        res.json({user: null});
      }
    });

    // Give a JSON 404 response for any unknown path under /v1/.
    app.get(`${base}/*`, (req, res) => jsonError(404, res));

  }
};
