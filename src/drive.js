// Copyright (c) 2012 jareiko. All rights reserved.

var SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_ASPECT;

var SHADOW_MAP_WIDTH = 1024, SHADOW_MAP_HEIGHT = 1024;

var KEYCODE = util.KEYCODE;
var PULLTOWARD = util.PULLTOWARD;
var Vec2 = THREE.Vector2;
var Vec3 = THREE.Vector3;
var Vec3FromArray = util.Vec3FromArray;

var stats;

var sceneHUD, cameraHUD;
var revMeter;

var scene, camera;
var debugMesh;
var webglRenderer;
var sunLight, sunLightPos;
var cameraMode = 0, CAMERA_MODES = 3;
var trees = [];
var meshCheckpoint;
var meshArrow, meshArrowNext;
var containerEl = $$('frame3d')[0];
var checkpointsEl = $('checkpoints');
var countdownEl = $('countdown');
var runTimerEl = $('timer');
var twitterLinkEl = $('twitterlink');
var fullscreenLinkEl = $('fullscreenlink');
var saveReplayLinkEl = $('savereplaylink');
var replaysContainerEl = $('replays');

var keyDown = [];

var textureCube;
var game;
var car;
var followProgress;  // Progress for car we're interested in.
var updateTimer = true;
var lastRaceTime = 0;
// 1 for hi-res input, 2 for other state.
var carRecorder1, carRecorder2;
var replayPlayback1, replayPlayback2;

var aud;
var checkpointBuffer;
var sourcesTmp = [];

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', onDocumentMouseMove, false);
document.addEventListener('keydown', onDocumentKeyDown, false);
document.addEventListener('keyup', onDocumentKeyUp, false);

var lastTime = Date.now();

init();

function init() {
  if (!Detector.webgl) {
    Detector.addGetWebGLMessage({parent: containerEl});
    var loadingEl = document.getElementsByClassName('loading')[0];
    loadingEl.className += ' loaded';
    return false;
  }

  sceneHUD = new THREE.Scene();
  cameraHUD = new THREE.OrthographicCamera(
      -SCREEN_ASPECT, SCREEN_ASPECT, -1, 1, -1, 1);
  sceneHUD.add(cameraHUD);

  var revMeterGeom = new THREE.Geometry();
  revMeterGeom.vertices.push(new Vec3(1, 0, 0));
  revMeterGeom.vertices.push(new Vec3(-0.1, -0.02, 0));
  revMeterGeom.vertices.push(new Vec3(-0.1, 0.02, 0));
  revMeterGeom.faces.push(new THREE.Face3(0, 1, 2));
  revMeterGeom.computeCentroids();
  var revMeterMat = new THREE.MeshBasicMaterial();
  revMeter = new THREE.Mesh(revMeterGeom, revMeterMat);
  revMeter.position.x = -1.5;
  revMeter.scale.multiplyScalar(0.4);
  //sceneHUD.add(revMeter);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100000);
  camera.position.x = 2;
  camera.position.y = 2;
  camera.position.z = 2;

  scene.add(camera);

  var debugGeometry = new THREE.SphereGeometry( 0.2, 16, 8 );
  var debugMaterial = new THREE.MeshBasicMaterial();
  debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
  scene.add(debugMesh);

  // LIGHTS

  scene.fog = new THREE.FogExp2(0xdddddd, 0.001);

  var ambient = new THREE.AmbientLight( 0x446680 );
  scene.add(ambient);

  sunLightPos = new Vec3(0, 10, -15);
  sunLight = new THREE.DirectionalLight( 0xffe0bb );
  sunLight.intensity = 1.3;//0.1;//1.3;
  sunLight.position.copy(sunLightPos);

  sunLight.castShadow = true;
  
  sunLight.shadowCameraNear = -20;
  sunLight.shadowCameraFar = 60;
  sunLight.shadowCameraLeft = -24;
  sunLight.shadowCameraRight = 24;
  sunLight.shadowCameraTop = 24;
  sunLight.shadowCameraBottom = -24;

  //sunLight.shadowCameraVisible = true;
  
  //sunLight.shadowBias = -0.001;
  sunLight.shadowDarkness = 0.4;
  
  sunLight.shadowMapWidth = SHADOW_MAP_WIDTH;
  sunLight.shadowMapHeight = SHADOW_MAP_HEIGHT;

  scene.add(sunLight);

  // RENDERER
  webglRenderer = new THREE.WebGLRenderer({
    antialias: false
  });
  webglRenderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  webglRenderer.shadowMapEnabled = true;
  webglRenderer.shadowMapSoft = true;
  webglRenderer.shadowMapCullFrontFaces = false;
  webglRenderer.autoClear = false;
  onWindowResize();

  containerEl.appendChild(webglRenderer.domElement);

  fullscreenLinkEl.addEventListener('click', function(ev) {
    var el = containerEl;
    var reqFS = el.requestFullScreenWithKeys ||
                el.webkitRequestFullScreenWithKeys ||
                el.mozRequestFullScreenWithKeys ||
                el.requestFullScreen ||
                el.webkitRequestFullScreen ||
                el.mozRequestFullScreen;
    reqFS.bind(el)();
  });

  var onFullScreenChange = function(ev) {
    // Workaround to wait for Chrome's fullscreen animation to finish.
    _.delay(onWindowResize, 1000);
  };
  document.addEventListener('fullscreenchange', onFullScreenChange);
  document.addEventListener('mozfullscreenchange', onFullScreenChange);
  document.addEventListener('webkitfullscreenchange', onFullScreenChange);

  saveReplayLinkEl && saveReplayLinkEl.addEventListener('click', function(ev) {
    uploadRun();
  });

  // STATS

  if (typeof(Stats) != 'undefined') {
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.zIndex = 100;
    containerEl.appendChild( stats.domElement );
  }

  //

  var path = "/a/textures/Teide-1024/";
  var format = '.jpg';
  var urls = [
    path + 'posx' + format, path + 'negx' + format,
    path + 'posy' + format, path + 'negy' + format,
    path + 'posz' + format, path + 'negz' + format
  ];

  textureCube = THREE.ImageUtils.loadTextureCube(urls);
  drawCube();
  drawCheckpoint();
  drawArrow();

  aud = new audio.WebkitAudio();

  aud.loadBuffer('/a/sounds/checkpoint.wav', function(buffer) {
    checkpointBuffer = buffer;
  });

  var loader = new THREE.JSONLoader();
  var texturePath = '/a/textures';
  game = new game.Game(browserhttp);
  async.parallel({
    track: function(cb) {
      game.setTrackConfig(TRIGGER.TRACK.CONFIG, cb);
    },
    car: function(cb) {
      game.addCarConfig(TRIGGER.CAR.CONFIG, function(err, progress) {
        if (err) throw new Error(err);
        followProgress = progress;
        if (TRIGGER.RUN) {
          replayPlayback1 = new recorder.StatePlayback(
              progress.vehicle.controller.input, TRIGGER.RUN.INPUT);
          replayPlayback2 = new recorder.StatePlayback(
              progress, TRIGGER.RUN.PROGRESS);
          game.sim.pubsub.subscribe('step', function() {
            replayPlayback1.step();
            replayPlayback2.step();
          });
          replayPlayback1.pubsub.subscribe('complete', function() {
            checkpointsEl.innerHTML = 'Replay complete';
            updateTimer = false;
          });
        } else {
          var keys1 = {
            forward: 0,
            back: 0,
            left: 0,
            right: 0,
            handbrake: 0
          };
          var keys2 = {
            nextCpIndex: 0,
            vehicle: {
              body: {
                pos: {x:3,y:3,z:3},
                ori: {x:3,y:3,z:3,w:3},
                linVel: {x:3,y:3,z:3},
                angVel: {x:3,y:3,z:3}
              },
              wheels: [{
                spinVel: 1
              }],
              engineAngVel: 3
            }
          };
          carRecorder1 = new recorder.StateRecorder(
              progress.vehicle.controller.input, keys1, 2);
          carRecorder2 = new recorder.StateRecorder(
              progress, keys2, 40);
          game.sim.pubsub.subscribe('step', function() {
            carRecorder1.observe();
            carRecorder2.observe();
          });
        }
        car = new Car();
        car.aud = aud;
        car.loadWithVehicle(progress.vehicle, cb);
        progress.pubsub.subscribe('advance', advanceCheckpoint);
      });
    },
    geomTrunk: function(cb) {
      loader.load('/a/meshes/tree1a_lod2_tex_000.json', function(geometry) {
        cb(null, geometry);
      }, texturePath);
    },
    geomLeaves: function(cb) {
      loader.load('/a/meshes/tree1a_lod2_tex_001.json', function(geometry) {
        cb(null, geometry);
      }, texturePath);
    }
  }, function(err, data) {
    if (err) throw new Error(err);
    else {
      drawTrack(data.track.terrain.getTile(0, 0));
      drawTrees(data.geomTrunk, data.geomLeaves);

      var bodyMaterial = car.bodyGeometry.materials[0];
      bodyMaterial.envMap = textureCube;
      bodyMaterial.combine = THREE.MixOperation;
      bodyMaterial.reflectivity = 0.1;
      bodyMaterial.wrapAround = 0;
      bodyMaterial.ambient = bodyMaterial.color;

      var wheelMaterial = car.wheelGeometry.materials[0];
      wheelMaterial.ambient = wheelMaterial.color;

      car.bodyMesh.castShadow = true;
      car.bodyMesh.receiveShadow = true;
      for (var w = 0; w < car.wheels.length; ++w) {
        car.wheels[w].mesh.castShadow = true;
        car.wheels[w].mesh.receiveShadow = true;
      }

      scene.add(car.root);

      var loadingEl = document.getElementsByClassName('loading')[0];
      loadingEl.className += ' loaded';
      requestAnimationFrame(animate);
    }
  });

  return true;
};

function drawTrees(geomTrunk, geomLeaves) {
  var matTrunk = geomTrunk.materials[0];
  matTrunk.ambient = matTrunk.color;
  var matLeaves = geomLeaves.materials[0];
  matLeaves.ambient = matLeaves.color;
  matLeaves.depthWrite = false;
  //matLeaves.alphaTest = true;
  matLeaves.transparent = true;
  var i;
  for (i = 0; i < game.track.trees.length; ++i) {
    var tree = game.track.trees[i];
    var mesh = new THREE.Mesh(geomTrunk, matTrunk);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(tree.scl, tree.scl, tree.scl);
    mesh.position.copy(tree);
    mesh.rotation.y = tree.rot;
    scene.add(mesh);

    mesh = new THREE.Mesh(geomLeaves, matLeaves);
    mesh.castShadow = true;
    //mesh.receiveShadow = true;
    mesh.doubleSided = true;
    mesh.scale.set(tree.scl, tree.scl, tree.scl);
    mesh.position.copy(tree);
    mesh.rotation.y = tree.rot;
    scene.add(mesh);
  }
};

function drawCube() {
  var cubeShader = THREE.ShaderUtils.lib["cube"];
  cubeShader.uniforms["tCube"].texture = textureCube;
  var cubeMaterial = new THREE.ShaderMaterial({  
    fragmentShader: cubeShader.fragmentShader,
    vertexShader: cubeShader.vertexShader,
    uniforms: cubeShader.uniforms
  });
  //cubeMaterial.transparent = 1; // Force draw at end.
  var cubeMesh = new THREE.Mesh(new THREE.CubeGeometry(100000, 100000, 100000), cubeMaterial);
  cubeMesh.geometry.faces.splice(3, 1);
  cubeMesh.flipSided = true;
  cubeMesh.position.set(0, -1000, 0);
  scene.add(cubeMesh);
};

function drawCheckpoint() {
  var mat = new THREE.MeshBasicMaterial({
    color: 0x103010,
    blending: THREE.AdditiveBlending,
    transparent: 1,
    depthWrite: false
  });
  var geom = new THREE.Geometry();
  var ringGeom = new THREE.CylinderGeometry(6, 6, 0.2, 32, 1, true);
  var ringMesh = new THREE.Mesh(ringGeom, mat);
  ringMesh.rotation.z = 0.4;
  THREE.GeometryUtils.merge(geom, ringMesh);
  ringMesh.rotation.y = Math.PI * 2 / 3;
  THREE.GeometryUtils.merge(geom, ringMesh);
  ringMesh.rotation.y = Math.PI * 4 / 3;
  THREE.GeometryUtils.merge(geom, ringMesh);
  meshCheckpoint = new THREE.Mesh(geom, mat);
  meshCheckpoint.doubleSided = true;
  meshCheckpoint.castShadow = true;
  scene.add(meshCheckpoint);
};

function drawArrow() {
  var mat = new THREE.MeshBasicMaterial({
    color: 0x206020,
    blending: THREE.AdditiveBlending,
    transparent: 1,
    depthWrite: false
  });
  var mat2 = new THREE.MeshBasicMaterial({
    color: 0x051005,
    blending: THREE.AdditiveBlending,
    transparent: 1,
    depthWrite: false
  });
  var geom = new THREE.Geometry();
  geom.vertices.push(new Vec3(0, 0, 0.6));
  geom.vertices.push(new Vec3(0.1, 0, 0.3));
  geom.vertices.push(new Vec3(-0.1, 0, 0.3));
  geom.vertices.push(new Vec3(0.1, 0, -0.2));
  geom.vertices.push(new Vec3(-0.1, 0, -0.2));
  geom.faces.push(new THREE.Face3(0, 2, 1));
  geom.faces.push(new THREE.Face4(1, 2, 4, 3));
  meshArrow = new THREE.Mesh(geom, mat);
  meshArrow.position.set(0, 1, -2);
  meshArrowNext = new THREE.Mesh(geom, mat2);
  meshArrowNext.position.set(0, 0, 0.8);
  camera.add(meshArrow);
  meshArrow.add(meshArrowNext);
};

var drawTrack = function(terrainTile) {
  var terrain = terrainTile.terrain;
  var geometry = new THREE.PlaneGeometry(
      1, 1,
      terrainTile.size, terrainTile.size);
  var x, y, i = 0;
  for (y = 0; y <= terrainTile.size; ++y) {
    for (x = 0; x <= terrainTile.size; ++x) {
      geometry.vertices[i].x = x * terrain.scaleHz;
      geometry.vertices[i].y = y * terrain.scaleHz;
      geometry.vertices[i].z = terrainTile.heightMap[i];
      ++i;
    }
  }
  for (i = 0; i < geometry.faces.length; ++i) {
    x = geometry.faces[i].a;
    geometry.faces[i].a = geometry.faces[i].c;
    geometry.faces[i].c = x;
    x = geometry.faceVertexUvs[0][i][0];
    geometry.faceVertexUvs[0][i][0] = geometry.faceVertexUvs[0][i][2];
    geometry.faceVertexUvs[0][i][2] = x;
  }
  geometry.computeCentroids();
  geometry.computeFaceNormals();
  geometry.computeVertexNormals();

  var tarmac_d = THREE.ImageUtils.loadTexture("/a/textures/mayang-earth.jpg");
  tarmac_d.wrapS = tarmac_d.wrapT = THREE.RepeatWrapping;
  tarmac_d.repeat.set(100, 100);

  var xm = new THREE.MeshLambertMaterial({
    map: tarmac_d,
    wrapAround: false
  });
  xm.ambient = xm.color;
  
  var mesh = new THREE.Mesh(geometry, xm);
  mesh.position.set(0, 0, 0);
  // Grrr Y up.
  mesh.rotation.x = -Math.PI/2;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
};


function onDocumentMouseMove(event) {
  mouseX = ( event.clientX - windowHalfX ) * 0.01;
  mouseY = ( event.clientY - windowHalfY ) * 0.01;
};

function keyWeCareAbout(event) {
  return (!event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          event.keyCode >= 32 && event.keyCode <= 127);
}

function onDocumentKeyDown(event) {
  if (keyWeCareAbout(event)) {
    if (false && !(event.keyCode in keyDown)) {
      console.log('KeyDown: ' + event.keyCode);
    }
    keyDown[event.keyCode] = true;
    switch (event.keyCode) {
      case KEYCODE['C']:
        cameraMode = (cameraMode + 1) % CAMERA_MODES;
    }
    event.preventDefault();
    return false;
  }
};

function onDocumentKeyUp(event) {
  if (keyWeCareAbout(event)) {
    keyDown[event.keyCode] = false;
    event.preventDefault();
    return false;
  }
};

function onWindowResize() {
  SCREEN_WIDTH = containerEl.clientWidth;
  SCREEN_HEIGHT = containerEl.clientHeight;
  SCREEN_ASPECT = SCREEN_HEIGHT > 0 ? SCREEN_WIDTH / SCREEN_HEIGHT : 1;
  webglRenderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  camera.aspect = SCREEN_ASPECT;
  camera.updateProjectionMatrix();
};

var debouncedMuteAudio = _.debounce(function() {
  aud.setGain(0);
}, 500);

function muteAudioIfStopped() {
  aud.setGain(1);
  debouncedMuteAudio();
};

//

function animate() {
  var nowTime = Date.now();
  var delta = Math.min((nowTime - lastTime) * 0.001, 0.1);
  lastTime = nowTime;

  var nextCp = followProgress.nextCheckpoint(0);
  var nextCpNext = followProgress.nextCheckpoint(1);
  if (nextCp) {
    var cpPull = delta * 2;
    meshCheckpoint.position.x = PULLTOWARD(meshCheckpoint.position.x, nextCp.x, cpPull);
    meshCheckpoint.position.y = PULLTOWARD(meshCheckpoint.position.y, nextCp.y, cpPull);
    meshCheckpoint.position.z = PULLTOWARD(meshCheckpoint.position.z, nextCp.z, cpPull);
    meshCheckpoint.rotation.y += delta * 3;
  }

  if (updateTimer) {
    var raceTime = game.interpolatedRaceTime();
    if (raceTime >= 0) {
      if (lastRaceTime < 0) {
        countdownEl.innerHTML = 'Go!';
        countdownEl.className += ' fadeout';
        checkpointsEl.innerHTML = followProgress.nextCpIndex + ' / ' + game.track.checkpoints.length;
      }
      runTimerEl.innerHTML = formatRunTime(raceTime);
    } else {
      var num = Math.ceil(-raceTime);
      var lastNum = Math.ceil(-lastRaceTime);
      if (num != lastNum) {
        countdownEl.innerHTML = num;
      }
    }
    lastRaceTime = raceTime;
  }

  if (!TRIGGER.RUN) {
    var controls = car.vehic.controller.input;
    controls.forward = keyDown[KEYCODE['UP']] || keyDown[KEYCODE['W']] ? 1 : 0;
    controls.back = keyDown[KEYCODE['DOWN']] || keyDown[KEYCODE['S']] ? 1 : 0;
    controls.left = keyDown[KEYCODE['LEFT']] || keyDown[KEYCODE['A']] ? 1 : 0;
    controls.right = keyDown[KEYCODE['RIGHT']] || keyDown[KEYCODE['D']] ? 1 : 0;
    controls.handbrake = keyDown[KEYCODE['SPACE']] ? 1 : 0;
  }

  game.sim.tick(delta);

  // TODO: Move to an observer system for car updates.
  car.update();

  if (nextCp) {
    var cpVec = new Vec2(car.vehic.body.pos.x - nextCp.x, car.vehic.body.pos.z - nextCp.z);

    cpVec = new Vec2(car.vehic.body.pos.x - meshCheckpoint.position.x,
                     car.vehic.body.pos.z - meshCheckpoint.position.z);
    var cpVecCamSpace = new Vec2(
        cpVec.x * camera.matrixWorld.elements[2] - cpVec.y * camera.matrixWorld.elements[10],
        cpVec.x * camera.matrixWorld.elements[0] - cpVec.y * camera.matrixWorld.elements[8]);
    meshArrow.rotation.y = Math.atan2(-cpVecCamSpace.y, cpVecCamSpace.x);
  }
  if (nextCpNext) {
    cpVec = new Vec2(car.vehic.body.pos.x - nextCpNext.x, car.vehic.body.pos.z - nextCpNext.z);
    cpVecCamSpace = new Vec2(
        cpVec.x * camera.matrixWorld.elements[2] - cpVec.y * camera.matrixWorld.elements[10],
        cpVec.x * camera.matrixWorld.elements[0] - cpVec.y * camera.matrixWorld.elements[8]);
    meshArrowNext.rotation.y = Math.atan2(-cpVecCamSpace.y, cpVecCamSpace.x) - meshArrow.rotation.y;
  }

  var linVel = car.vehic.body.linVel;
  var pull = delta * 20;
  camera.quaternion.x = PULLTOWARD(camera.quaternion.x, -car.root.quaternion.z, pull);
  camera.quaternion.y = PULLTOWARD(camera.quaternion.y, car.root.quaternion.w, pull);
  camera.quaternion.z = PULLTOWARD(camera.quaternion.z, car.root.quaternion.x, pull);
  camera.quaternion.w = PULLTOWARD(camera.quaternion.w, -car.root.quaternion.y, pull);
  camera.quaternion.normalize();
  switch (cameraMode) {
  case 0:
    var targetPos = car.root.position.clone();
    targetPos.addSelf(linVel.clone().multiplyScalar(.17));
    if (1) {
      targetPos.addSelf(car.root.matrix.getColumnX().clone().multiplyScalar(0));
      targetPos.addSelf(car.root.matrix.getColumnY().clone().multiplyScalar(1.2));
      targetPos.addSelf(car.root.matrix.getColumnZ().clone().multiplyScalar(-2.9));
    } else {
      targetPos.addSelf(car.root.matrix.getColumnX().clone().multiplyScalar(2.0));
      targetPos.addSelf(car.root.matrix.getColumnY().clone().multiplyScalar(0.2));
      targetPos.addSelf(car.root.matrix.getColumnZ().clone().multiplyScalar(-0.5));
    }
    var camDelta = delta * 5;
    camera.position.x = PULLTOWARD(camera.position.x, targetPos.x, camDelta);
    camera.position.y = PULLTOWARD(camera.position.y, targetPos.y, camDelta);
    camera.position.z = PULLTOWARD(camera.position.z, targetPos.z, camDelta);
    //camera.fov = 75 / (1 + 0.02 * linVel.length());
    //camera.updateProjectionMatrix();

    camera.useQuaternion = false;
    var lookPos = car.root.position.clone();
    lookPos.addSelf(car.root.matrix.getColumnY().clone().multiplyScalar(0.7));
    camera.lookAt( lookPos );
    break;
  case 1:
    camera.useQuaternion = true;
    camera.updateMatrix();
    camera.position.x = car.root.position.x + camera.matrix.elements[1] * 0.7;
    camera.position.y = car.root.position.y + camera.matrix.elements[5] * 0.7;
    camera.position.z = car.root.position.z + camera.matrix.elements[9] * 0.7;
    camera.matrix.setPosition(camera.position);
    break;
  case 2:
    camera.useQuaternion = true;
    camera.updateMatrix();
    var camUp = new Vec3(camera.matrix.elements[4],
                         camera.matrix.elements[5],
                         camera.matrix.elements[6]);
    var camRight = new Vec3(camera.matrix.elements[0],
                            camera.matrix.elements[1],
                            camera.matrix.elements[2]);
    camera.position.add(car.root.position, camUp.multiplyScalar(0));
    camera.position.addSelf(camRight.multiplyScalar(1));
    camera.matrix.setPosition(camera.position);
    break;
  }

  var cameraClip = camera.position.clone();
  cameraClip.y -= 0.1;
  var ctc = game.sim.collide(cameraClip);
  for (var c = 0; c < ctc.length; ++c) {
    if (camera.position.y < ctc[c].surfacePos.y + 0.1) {
      camera.position.y = ctc[c].surfacePos.y + 0.1;
    }
  }

  sunLight.target.position.copy(car.root.position);
  sunLight.position.copy(car.root.position).addSelf(sunLightPos);
  sunLight.updateMatrixWorld();
  sunLight.target.updateMatrixWorld();

  revMeter.rotation.z = 2.5 + 4.5 *
      ((car.vehic.engineAngVelSmoothed - car.vehic.engineIdle) /
          (car.vehic.engineRedline - car.vehic.engineIdle));

  render();

  if (stats) {
    stats.update();
  }

  muteAudioIfStopped();

  requestAnimationFrame(animate);
}

function padZero(val, digits) {
  return(1e15 + val + '').slice(-digits);
};

function formatRunTime(time) {
  var mins = Math.floor(time / 60);
  time -= mins * 60;
  var secs = Math.floor(time);
  time -= secs;
  var cents = Math.floor(time * 100);
  return mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2);
};

function advanceCheckpoint() {
  /*
  ping({
    cp: nextCheckpoint,
    t: runTimer
  });
  */

  if (checkpointBuffer) {
    aud.playSound(checkpointBuffer, false, 1, 1);
  }

  checkpointsEl.innerHTML = followProgress.nextCpIndex + ' / ' + game.track.checkpoints.length;

  var nextCp = followProgress.nextCheckpoint(0);

  if (!nextCp) {
    updateTimer = false;
    runTimerEl.className = '';
    if (!TRIGGER.RUN) {
      if (TRIGGER.USER_LOGGED_IN) {
        _.delay(uploadRun, 1000);
      } else {
        // We can't save the run, but show a Twitter link.
        showTwitterLink();
      }
    }
  }
};

function uploadRun() {
  var formData = new FormData();
  formData.append('user', TRIGGER.USER_LOGGED_IN);
  formData.append('track', TRIGGER.TRACK.ID);
  formData.append('car', TRIGGER.CAR.ID);
  var time = followProgress.finishTime();
  if (time) {
    time -= game.startTime;
  }
  formData.append('time', JSON.stringify(time));
  formData.append('record_i', JSON.stringify(carRecorder1.serialize()));
  formData.append('record_p', JSON.stringify(carRecorder2.serialize()));
  var request = new XMLHttpRequest();
  var url = '/run/new';
  request.open('POST', url, true);
  request.onload = function() {
    var runId = JSON.parse(request.responseText).run;
    var linkEl = document.createElement('a');
    linkEl.innerHTML = 'View stats and replay';
    linkEl.href = '/run/' + runId;
    linkEl.className = 'highlight';
    replaysContainerEl.appendChild(linkEl);
    _.defer(function() {
      linkEl.className = '';
    });
  };
  request.send(formData);
}

function showTwitterLink() {
  var exclamations = [
    'Radial!',
    'Galvanized!',
    'Totally slipstream!',
    'Arboreal!',
    'Spintastic!'
  ];
  var exclamation = exclamations[Math.floor(Math.random() * exclamations.length)];
  twitterLinkEl.href = getTwitterLink(
      'Just finished ' + TRIGGER.TRACK.NAME +
      ' with the ' + TRIGGER.CAR.NAME +
      ' in ' + runTimerEl.innerHTML +
      '. ' + exclamation + ' @TriggerRally');
  twitterLinkEl.className = 'visible';
}

function getTwitterLink(text) {
  return 'http://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
}

function render() {
  webglRenderer.clear(true, true);
  webglRenderer.render(scene, camera);
  //webglRenderer.render(sceneHUD, cameraHUD);
};

/*
function ping(params) {
  var formData = new FormData();
  for (var k in params) {
    formData.append(k, params[k]);
  }
  var request = new XMLHttpRequest();
  var url = '/ping';
  request.open('POST', url, true);
  request.send(formData);
};
*/