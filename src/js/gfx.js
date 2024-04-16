// Import modules
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import proj4 from 'proj4';
import hull from 'convex-hull';
import Delaunator from 'delaunator';
import { GeoJSON } from 'geojson';
import { Earcut } from 'three/src/extras/Earcut.js'
import Stats from 'three/addons/libs/stats.module.js'
import * as Tone from 'tone';
// import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
// import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
// import { GeoJSON } from 'geojson';
// import Graph from 'graphology';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

let visualizationReady = false;


export function gfx() {

  // Define global geographic layer groups
  let fmTransmitterPoints = new THREE.Group();
  let fmMSTLines = new THREE.Group();
  let cellTransmitterPoints = new THREE.Group();
  let cellMSTLines = new THREE.Group();
  let elevContourLines = new THREE.Group();
  let propagationPolygons = new THREE.Group();
  let waterPolys = new THREE.Group();
  let cellServiceMesh = new THREE.Group();
  let accessibilityMesh = new THREE.Group();
  let accessibilityHex = new THREE.Group();
  let analysisArea = new THREE.Group();
  let coastline = new THREE.Group();
    

  // let raycasterReticule = new THREE.Group();

  // init visibility 
  fmTransmitterPoints.visible = true;
  propagationPolygons.visible = true;
  cellServiceMesh.visible = true;
  cellTransmitterPoints.visible = true;
  cellMSTLines.visible = true;
  elevContourLines.visible = true;
  accessibilityHex.visible = true;
  accessibilityMesh.visible = true;
  // rayLine.visible = true;

  // group the geometry subgroups
  let analogGroup = new THREE.Group();
  let accessGroup = new THREE.Group();
  let digitalGroup = new THREE.Group();

  /// establish visibility
  analogGroup.visible = false;
  accessGroup.visible = false;
  digitalGroup.visible = false;


  let scaleBar;
  // analog = fmtransmitter, propagationPolygons, 
  // digital = cellServiceMesh, cellTransmitterPoints, cellMSTLines

  // downsample framerate for performance
  let clock = new THREE.Clock();
  let delta = 0;
  // N fps
  let interval = 1 / 24;

  let sliderValue = 1;  //  default value
  const sliderLength = 100;
  
  const ws = null;
  let globalDeltaLeftPressed = 0;
  let globalDeltaRightPressed = 0;
  let globalDeltaLeft = 0;
  let globalDeltaRight = 0;
  let switchState1 = 0;
  let switchState2 = 0;

  let audioContext;

  // temp geometry for raycast testing
  const reticuleSize = 0.015;
  const reticuleGeometry = new THREE.RingGeometry( reticuleSize,reticuleSize, 8)
  const reticuleMaterial = new THREE.MeshBasicMaterial({ color: '#0000ff', wireframe: false, });
  const raycasterReticule = new THREE.LineSegments(reticuleGeometry, reticuleMaterial);
  
  // Define color scheme variables
  const colorScheme = {
    graticuleColor: '#2f2f2f0b', 
    // ambientLightColor: '#404040', 
    directionalLightColor: '#ffffff', 
    backgroundColor: '#000000', 
    polygonColor: '#FF1493',
    pyramidColorFM: '#FFFF00', 
    pyramidColorCellular: '#FFFF00', 
    // lowestElevationColor: "#0000ff", // Blue
    // middleElevationColor: "#00ff00", // Green
    // highestElevationColor: "#ff0000", // Red
    mstFmColor: '#FF5F1F', 
    boundingBoxColor: '#3d3d3d',
    coastlineColor: '#303030',
    // contoursLabelColor: '#00ff00',
    // cellColor: '#ffffff',
    mstCellColor: '#FFFF00', 
    matchingPyramidColor: '#FFFF00',
    nonMatchingPyramidColor: '#FF1493',
    waterColor: '#303030',
    accessibilityHexColor: '#310057',
    // cellServiceNo: '#00E661',
    cellServiceNo: '#ff00ff',
    cellServiceYes: '#161616'
  };


///////////////////////// MAP /////////////////////////////
////////////////////// PROJECTION /////////////////////////////////
  // Define the custom projection with its PROJ string
  const statePlaneProjString =
    '+proj=longlat +lat_0=40 +lon_0=-76.58333333333333 +k=0.9999375 +x_0=249999.9998983998 +y_0=0 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs';
  proj4.defs('EPSG:2261', statePlaneProjString);

  // Use this function to convert lon/lat to State Plane (actually NAD83) coordinates
  function toStatePlane(lon, lat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error(
        `Invalid coordinates: longitude (${lon}), latitude (${lat})`,
      );
    }
    const result = proj4('EPSG:2261').forward([lon, lat]);
    if (!Number.isFinite(result[0]) || !Number.isFinite(result[1])) {
      console.error(`Projection result is NaN for input: longitude (${lon}), latitude (${lat})`);
    }
    return result;
  }

  // set clipping extent
  const latMin = -5, latMax = 5; // Example bounds
  const lonMin = -5, lonMax = 5; // Example bounds
  const bottomLeft = toStatePlane(lonMin, latMin);
  const topRight = toStatePlane(lonMax, latMax);


  // Function to calculate distance between two points in State Plane coordinates
  function distanceBetweenPoints(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function remapValues(num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }
  

  // tone.js ////////////////////////////
  //////////////
  // const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
  const synth = new Tone.NoiseSynth().toDestination();


  function loadSynthPresets(data) {
    synthPresets = data;
    console.log("Synth presets loaded", synthPresets);
  }

    // Function to apply a preset to the synthesizer
  function applyPreset(preset) {
    synth.set(preset);
  }

  

  //////////////////////////////////////
  // loading screen! //////////////////

  // Three.js - Initialize the Scene
  let scene, camera, renderer, controls, stats, pixelationFactor;
  let isCameraRotating = true; // Flag to track camera rotation
  const rotationSpeed = 0.00001; // Define the speed of rotation

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Bright red color
  let lineGeometry = new THREE.BufferGeometry();
  let rayLine = new THREE.Line(lineGeometry, lineMaterial);


  function initThreeJS() {
    scene = new THREE.Scene();
  //   scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: "green",
  // wireframe: true, });


    // camera = new THREE.PerspectiveCamera(
    //   75,
    //   window.innerWidth / window.innerHeight,
    //   0.1,
    //   100,
    // );

    let size = 1;
    let near = 0.25;
    let far = 2.5;
    camera = new THREE.OrthographicCamera(
      -size, size, size, -size, near, far
    );

    camera.up.set(0, 0, 1); // Set Z as up-direction

    const fogNear = 2; // The starting distance of the fog (where it begins to appear)
    const fogFar = camera.far; // The ending distance of the fog (where it becomes fully opaque)

    // Adding fog to the scene
    scene.fog = new THREE.Fog(colorScheme.backgroundColor, fogNear, fogFar);

    renderer = new THREE.WebGLRenderer({ 
      canvas: document.querySelector('#canvas'),
      antialias: false,
      precision: "lowp",
      powerPreference: "high-performance"
   });

    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(1);

    document.getElementById('gfx').appendChild(renderer.domElement);



    stats = new Stats();
    stats.showPanel(2); 
    stats.domElement.style.cssText = 'position:absolute;bottom:0px;left:0px;';
    document.getElementById('stats').appendChild(stats.domElement);

    // scaleBar = createScaleBar(scene);  // Ensure this is called after scene is defined


    // Initialize MapControls
    controls = new MapControls(camera, renderer.domElement);

    // Set up the control parameters as needed for a mapping interface
    controls.screenSpacePanning = false;
    controls.enablePan = true; // Enable panning
    controls.enableRotate = true; // tilt up down
    controls.enableDamping = true; // an optional setting to give a smoother control feeling
    controls.dampingFactor = 0.05; // amount of damping (drag)


    // Set the minimum and maximum polar angles (in radians) to prevent the camera from going over the vertical
    controls.minPolarAngle = (53.1301024/2) * (Math.PI / 180); // π/n radians (z degrees) - on the horizon
    controls.maxPolarAngle = 35.264 * (Math.PI / 180); // π/n radians (z degrees) - on the horizon
    // Set the maximum distance the camera can dolly out
    controls.maxDistance = 1.5; // max camera zoom out (perspective cam)
    controls.minDistance = 0.5; // min camera zoom in (perspective cam)
    controls.minZoom = 0.5; // min camera zoom out (ortho cam)
    controls.maxZoom = 5; // max camera zoom in (ortho cam)


    // console.log(controls.angle)

    scene.add(rayLine);  // Add the line to the scene initially


    // const audioListener = new THREE.AudioListener();
    // camera.add(audioListener);

            
    camera.updateProjectionMatrix();



    renderer.setClearColor(colorScheme.backgroundColor);
    window.addEventListener('resize', onWindowResize, false);
    adjustCameraZoom();
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // CAMERA CONTROLS /////////////////////////////
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  function adjustCameraZoomSlidePot(value) {
    if (camera.isOrthographicCamera) {
      // controls.minZoom = 0.5; // min camera zoom out (ortho cam)
      // controls.maxZoom = 5; // max camera zoom in (ortho cam)  
      // Map the potentiometer value to the orthographic camera zoom range.
      // const zoomRange = (controls.maxZoom - controls.minZoom);
      let zoomValue = value / 100;
      camera.zoom = zoomValue;
      console.log(zoomValue)
    } else if (camera.isPerspectiveCamera) {
      // Map the potentiometer value to the perspective camera FOV range.
      const fovRange = controls.maxDistance - controls.minDistance; 
      const fovValue = controls.minDistance + (fovRange * ((value - 0) / (1023 - 0)));
      camera.fov = fovValue;
    }
    camera.updateProjectionMatrix();
  }
  

  // rotation logic on load //////////////////////
  function flipCamera() {
    // Calculate the distance to the target
    const distanceToTarget = camera.position.distanceTo(controls.target);

    function getRandom(min, max) {
      let randomMin = 0.5
      let randomMax = 1.5  
      return Math.random() * (randomMax - randomMin) + randomMin;
     }

    const angle =  (- Math.PI / 5) * getRandom(); // Define the angle for rotation

    // Calculate the new position
    const relativePosition = new THREE.Vector3().subVectors(
      camera.position,
      controls.target,
    );
    const axis = new THREE.Vector3(0, 0, 1); 
    const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    relativePosition.applyQuaternion(quaternion);

    // Apply the new position while maintaining the distance
    camera.position
      .copy(controls.target)
      .add(relativePosition.setLength(distanceToTarget));

    // Ensure the camera keeps looking at the target
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix()
    }
            
  
  //////////////////////////////////////
  // Resize function
  function onWindowResize() {
    // Get the dimensions of the container
    const container = document.getElementById('three-container');
    const width = 800;
    const height = 480;

    // Update camera aspect ratio and renderer size
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);

    // update this value to alter pixel ratio scaled with the screen
    pixelationFactor = 0.35;

    // Calculate new dimensions based on the value
    var newWidth = Math.max(1, window.innerWidth * pixelationFactor);
    var newHeight = Math.max(1, window.innerHeight * pixelationFactor);

    const scaleX = width / newWidth; 
    const scaleY = height / newHeight;
    // document.getElementById('canvas').style.transform = `scale(${scaleX}, ${scaleY})`;

    const canvas = document.getElementById('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';


    if (renderer && camera) {
      renderer.setSize(newWidth, newHeight, false);
      renderer.setPixelRatio(1);

      // Update camera aspect ratio and projection matrix
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    }

    updateLabelPosition();
    
    // Continue with your existing resize adjustments
    adjustCameraZoom();
  }

  function adjustCameraZoom() {
    if (camera) {
      // Example of dynamic FOV scaling:
      // - If the window width is 600px or less, use a FOV of 90
      // - If the window width is 1200px or more, use a FOV of 60
      // - Scale linearly between those values for window widths in between
      const minWidth = 600;
      const maxWidth = 1200;
      const minFov = 90; // perspective only
      const maxFov = 60;
      const minZoom = 0.5; // ortho only
      const maxZoom = 1.5;

      // Map the window width to the FOV range
      const scale = (window.innerWidth - minWidth) / (maxWidth - minWidth);

    if (camera.isPerspectiveCamera) {


      let fov = minFov + (maxFov - minFov) * Math.max(0, Math.min(1, scale));
      camera.fov = fov;

    }

    else if (camera.isOrthographicCamera) {


      let fov = minZoom + (maxZoom - minZoom) * Math.max(0, Math.min(1, scale));
      camera.fov = fov;


    }

      camera.updateProjectionMatrix();
    }
  }

  // Initial call to set up the zoom level
  adjustCameraZoom();


  // hardware xy panning - manual camera controls
  function applyPan(deltaX, deltaY) {
    // pan sensitivity
    const panScaleX = 0.005;
    const panScaleY = 0.005;
  
    // camera right vector (east-west direction)
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  
    // forward vector that's perpendicular to the right vector and the global up vector (Z-up)
    // aka recalculate a forward vector that's parallel to the XY plane
    let globalUp = new THREE.Vector3(0, 0, 1);
    let forward = new THREE.Vector3().crossVectors(globalUp, right).normalize();
  
    // adjust encoder deltaX and deltaY movements to the camera's present orientation
    let panVectorX = right.multiplyScalar(deltaX * panScaleX);
    let panVectorY = forward.multiplyScalar(deltaY * panScaleY);
  
    // Combine the adjusted vectors for complete pan direction
    let panVector = new THREE.Vector3().addVectors(panVectorX, panVectorY);
  
    // Apply the pan to the camera and the controls target
    camera.position.add(panVector);
    controls.target.add(panVector);
  
    controls.update();
  }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // RAYCASTER /////////////////////////////
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


  // Registry for storing raycasters
  const raycasterDict = {
    // 1: determine presence or absence of cell signal
    // method: nearest CELL SERVICE MESH vertex
    cellServiceMesh: { group: cellServiceMesh, enabled: false, onIntersect: raycastCellServiceMesh },
    // 2: reflect the degree of remoteness of a place
    // method: nearest ACCESSIBILITY MESH vertex
    // accessibilityHex: { group: accessibilityHex, enabled: false, onIntersect: raycastAccessVertex },
    accessibilityMesh: { group: accessibilityMesh, enabled: false, onIntersect: raycastAccessVertex },
    // 3: draw a line to the nearest cell tower at all times
    // method: nearest CELL TRANSMITTER vertex
    // cellTransmitterPoints: { group: cellTransmitterPoints, enabled: false, onIntersect: raycastCellTower },
    cellTransmitterPoints: { group: accessibilityMesh, enabled: false, onIntersect: raycastTerrainVertex },
    // 4: play a 'radio station' signal
    // method: distance from PROPAGATION POLYGON edge to centroid
    fmTransmitterPoints: { group: accessibilityMesh, enabled: false, onIntersect: raycastFMtowers },
    cameraCenter: { 
      group: null,  // no specific group 
      enabled: true,  // always enabled
      onIntersect: () => printCameraCenterCoordinates(camera)  // this function prints coords to a text div
}
  

};


  // document.addEventListener('pointermove', onPointerMove);

  function raycastTerrainVertex(intersection) {
    const intersectPoint = intersection.point;
    const vertices = intersection.object.userData.vertices;
    const gridCode = intersection.object.userData.gridCode || 'unknown';  // Default to 'unknown' if not provided
  
    // Find the nearest cell tower
    const nearestTower = findNearestCellTower(intersectPoint);
  
    console.log(`Intersection at Terrain - Point: ${JSON.stringify(intersectPoint)}, Grid Code: ${gridCode}`);
    if (nearestTower) {
      console.log(`Nearest Cell Tower is ${nearestTower.distance.toFixed(2)} units away, Grid Code: ${nearestTower.gridCode}`);
      drawRayLine(intersectPoint, nearestTower.position);
    } else {
      console.log('No cell towers found');
      if (rayLine.parent) {
        scene.remove(rayLine);  // Remove the line if no nearest tower is found
      }
    }
  }
  
  function drawRayLine(start, end) {
    // Remove old geometry
    if (rayLine.geometry) rayLine.geometry.dispose();
  
    // Create new geometry with the start and end points
    lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    rayLine.geometry = lineGeometry;
    
    // Ensure the line is added to the scene
    if (!rayLine.parent) {
      scene.add(rayLine);
    }
  }
    
  function findNearestCellTower(point) {
    let nearest = null;
    let minDistance = Infinity;
    
    cellTransmitterPoints.children.forEach(pyramid => {
      const towerPosition = pyramid.userData.position;
      const distance = point.distanceTo(towerPosition);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          distance: distance,
          gridCode: pyramid.userData.gridCode,
          position: towerPosition
        };
      }
    });
  
    return nearest;
  }
  
  function setupRayLine() {
      const rayMaterial = new THREE.LineBasicMaterial({
          color: 0xff0000, // Bright red for high visibility
      });
      const rayGeometry = new THREE.BufferGeometry();
      rayGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      rayLine = new THREE.Line(rayGeometry, rayMaterial);
      scene.add(rayLine); // Add the line to the scene
  }
  
  function updateRayLine(start, end) {
      const positions = new Float32Array([
          start.x, start.y, start.z, end.x, end.y, end.z
      ]);
      rayLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      rayLine.geometry.attributes.position.needsUpdate = true;
      rayLine.visible = true; // Make the line visible
  }
  

    
  function raycastFMtowers(){}

  let currentGridCode = null; // Keep track of the last gridCode encountered

  function raycastCellServiceMesh(intersection, gridCode) {
    // Check if the gridCode has changed
    if (gridCode !== currentGridCode) {
      // Update the currentGridCode
      currentGridCode = gridCode;
  
      // Access the preset for the new gridCode
      const preset = synthPresets.presets["cellService"][gridCode];
      if (preset) {
        // Apply the new preset
        applyPreset(preset);
  
        // Stop any currently playing notes
        synth.triggerRelease([Tone.now()]); // This stops all currently playing notes. Adjust if your synth setup is different.
  
        // Start a new note or drone. Adjust the note and duration as needed.
        synth.triggerAttack([Tone.now() + 0.1]); // Use triggerAttack for a continuous sound
      } else {
        console.log(`Intersected unspecified gridCode ${gridCode}`, intersection);
      }
    }
  }

  // calculate the nearest vertex distance
  // todo: add scaling factor of sound related to distance
  // + change effect only if gridcode changes
  function raycastAccessVertex(intersection) {
    const intersectPoint = intersection.point;
    const vertices = intersection.object.userData.vertices;
    const gridCode = intersection.object.userData.gridCode || 'unknown';  // Default to 'unknown' if not provided
  
    if (vertices) {
      const nearestVertex = vertices.reduce((nearest, vertex) => {
        const distance = Math.hypot(vertex.x - intersectPoint.x, vertex.y - intersectPoint.y, vertex.z - intersectPoint.z);
        return distance < nearest.distance ? { vertex, distance } : nearest;
      }, { vertex: null, distance: Infinity });
  
      console.log(`Nearest vertex distance: ${nearestVertex.distance}, Vertex: ${JSON.stringify(nearestVertex.vertex)}, Grid Code: ${gridCode}`);
    } else {
      console.log('No vertices data found in userData');
    }
  }
  
  
// overall raycaster handler for animation loop
function handleRaycasters(camera, scene) {
  Object.entries(raycasterDict).forEach(([key, { group, enabled, onIntersect }]) => {
      if (enabled && group) {
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera({ x: 0, y: 0 }, camera);
          const intersections = raycaster.intersectObjects(group.children, true);

          if (intersections.length > 0) {
              const firstIntersection = intersections[0];
              onIntersect(firstIntersection);
              const intersectPoint = firstIntersection.point;
              raycasterReticule.position.set(intersectPoint.x, intersectPoint.y, intersectPoint.z);
              if (!raycasterReticule.parent) {
                  scene.add(raycasterReticule);
                  // console.log(raycasterReticule.position);
              }
          } else {
              if (raycasterReticule.parent) {
                  scene.remove(raycasterReticule);
              }
              console.log("NO INTERSECTIONS");
          }
      }
  });
}


///////////////////////////////////////////////////
/// add scale bar + lat/long printout
///////////////////////////////////////////////////

function decimalToDMS(coord, isLongitude = false) {
  const absolute = Math.abs(coord);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

  // Ensuring two digits
  const degreesStr = degrees.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = parseFloat(seconds).toFixed(2).toString().padStart(5, '0'); // '5' because "00.00"

  // Determining cardinal directions
  let cardinal = '';
  if (isLongitude) {
      cardinal = coord >= 0 ? 'E' : 'W';  // East or West for longitude
  } else {
      cardinal = coord >= 0 ? 'N' : 'S';  // North or South for latitude
  }

  return `${degreesStr}° ${minutesStr}' ${secondsStr}" ${cardinal}`;
}

function printCameraCenterCoordinates(camera) {
  const vector = new THREE.Vector3(0, 0, -1); // Vector pointing out of the camera
  vector.unproject(camera); // Adjust the vector by the camera's projection
  const direction = vector.sub(camera.position).normalize(); // Create the direction vector

  const distance = -camera.position.z / direction.z; // Calculate the distance to the ground plane (assuming z = 0 is ground)
  const coord = camera.position.clone().add(direction.multiplyScalar(distance)); // Calculate the intersection with ground plane

  // Convert from State Plane coordinates back to Geographic coordinates
  try {
      const result = proj4('EPSG:2261').inverse([coord.x, coord.y]);
      const latitudeDMS = decimalToDMS(result[1], false);  // Passing false for latitude
      const longitudeDMS = decimalToDMS(result[0], true);  // Passing true for longitude
      const displayText = `${latitudeDMS}<br>${longitudeDMS}`;  // Using DMS format with cardinal directions
      document.getElementById('latLonDisplay').innerHTML = displayText;  // Use innerHTML to render the line break
  } catch (error) {
      console.error(`Error converting coordinates: ${error}`);
      document.getElementById('latLonDisplay').textContent = "Error in displaying coordinates.";
  }
}

function createScaleBar(scene) {
  const scaleBarLength = 100; // Adjust this based on your scale
  const divisionLength = scaleBarLength / 4;

  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const points = [];
  for (let i = 0; i <= 4; i++) {
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 0, 0));
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 5, 0));
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 0, 0));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineSegments(geometry, material);
  line.position.set(0, -100, 0);

  scene.add(line);
  return line;
}

function updateScaleBar(scaleBar, camera) {
  if (!scaleBar || !camera) {
      console.error('Scale bar or camera is undefined!');
      return;
  }

  // Adjust scale bar size based on camera zoom or scene scale
  const scale = camera.zoom;
  scaleBar.scale.set(1 / scale, 1 / scale, 1 / scale);

  // Position scale bar relative to camera
  scaleBar.position.copy(camera.position);
  scaleBar.position.x -= 50;  // Adjust this value based on your scene setup
  scaleBar.position.y = -50;  // Keeps the scale bar at the bottom of the camera's view
}


////////////////

  ////////////
  /////////// 
  ////////////////////////////////

  // Function to animate your scene
  function animate() {
    delta += clock.getDelta();

    if (delta  > interval) {

      controls.update();

      // Check if camera and controls are initialized
      if (camera && controls) {
        if (isCameraRotating) {
          // autorotate stuff first //////////////
          // Calculate the distance to the target
          const distanceToTarget = camera.position.distanceTo(controls.target);
          const angle = rotationSpeed; // Define the angle for rotation

          // Calculate the new position
          const relativePosition = new THREE.Vector3().subVectors(
            camera.position,
            controls.target,
          );
          const axis = new THREE.Vector3(0, 0, 1); // Z-axis for rotation
          const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
          relativePosition.applyQuaternion(quaternion);

          // Apply the new position while maintaining the distance
          camera.position
            .copy(controls.target)
            .add(relativePosition.setLength(distanceToTarget));

          ///// now hardware movement
          // encoder strafing + panning
          if (globalDeltaLeft !== 0 || globalDeltaRight !== 0) {
            // inverted values to align with etch a sketch style : )
            applyPan(-globalDeltaLeft, -globalDeltaRight);
      
            // Reset global deltas to prevent continuous panning
            globalDeltaLeft = 0;
            globalDeltaRight = 0;
          }
      
          // encoder rotation and tilt
          if (globalDeltaLeftPressed !== 0 || globalDeltaRightPressed !== 0) {
            const deltaXScale = 0.01;
            const deltaYScale = 0.01;
            camera.position.y += globalDeltaRightPressed * deltaYScale;
            camera.position.x += globalDeltaLeftPressed * deltaXScale;
    
            // Reset deltas after applying
            globalDeltaLeftPressed = 0;
            globalDeltaRightPressed = 0;
          }    

          // Ensure the camera keeps looking at the target
          camera.lookAt(controls.target);

          handleRaycasters(camera, scene);

          // findNearestVisibleCellTower();

          // console.log(`zoom is: ${distanceToTarget}`)
      


        }}

      // updateDashSizeForZoom(); 
      if (analogGroup.visible !== false) {
        updatefmContourGroups();

      }


      // console.log(`analog group state is ${analogGroup.visible}`)

      // adjustMeshVisibilityBasedOnCameraDistance();


      // console.log(`Camera X: ${camera.position.x}, Camera Y: ${camera.position.y}, Camera Z: ${camera.position.z}`);

      // updateScaleBar(scaleBar, camera); 

    
      // The draw or time dependent code are here
      renderer.render(scene, camera);

      stats.update();  

      delta = delta % interval;
    }
    requestAnimationFrame(animate);
  }

  // unlock AudioContext with websocket interaction
  function unlockAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('AudioContext unlocked!');
      });
    }
    else if (audioContext.state !== 'suspended') {
      console.log('idk?')
    }
console.log(audioContext.state)
  }

  

function initWebSocketConnection() {
  var ws = new WebSocket('ws://localhost:8080');

  ws.onopen = function() {
    console.log('Connected to WebSocket server');
    unlockAudioContext(); // Attempt to unlock AudioContext on WebSocket connection
  };

  ws.onmessage = function(event) {


    let threeContainer = document.getElementById('gfx');
    // hide mouse cursor if/when data is received
    document.body.style.cursor = 'none';
    setTimeout(() => threeContainer.classList.remove('background'), 1000);

    let serialData = JSON.parse(event.data);

    // console.log('ws data:', serialData); // This will correctly log the object structure


    if (serialData.LEDpotValue !== undefined && !isDragging) {
      const scaledValue = Math.round(remapValues(serialData.LEDpotValue, 201, 300, 300, 201));
      const slider = document.getElementById('fm-channel-slider');
      slider.value = scaledValue; // Programmatically update slider value
      updateLabelPosition(scaledValue); 
      updateDisplays(scaledValue);
    }

    if (serialData.zoomPotValue !== undefined && !isDragging) {
      const scaledValue = Math.round(remapValues(serialData.zoomPotValue, 201, 300, 300, 201));
      // todo zooming ctrls;
    }

    if (serialData.zoomPotValue !== undefined && !isDragging) {
      // scale between min zoom and max zoom values for ortho cam
      const scaledValue = Math.round(remapValues(serialData.zoomPotValue, 0, 1023, 50, 150));
      adjustCameraZoomSlidePot(scaledValue);
    }
  

    if (serialData.deltaLeft !== undefined && serialData.deltaRight !== undefined) {
      globalDeltaLeft = serialData.deltaLeft;
      globalDeltaRight = serialData.deltaRight;
    }

    if (serialData.deltaLeftPressed !== undefined && serialData.deltaRightPressed !== undefined) {
      globalDeltaLeftPressed = serialData.deltaLeftPressed;
      globalDeltaRightPressed = serialData.deltaRightPressed;
    }

    // Check for switchState1 in the data and toggle group visibility accordingly
    if (serialData.switchState1 !== undefined) {
      toggleMapScene(serialData.switchState1, 'switch1');
    }
  
    if (serialData.switchState2 !== undefined) {
      toggleMapScene(serialData.switchState2, 'switch2');
    }
  }


  ws.onerror = function(event) {
    console.error('WebSocket error:', event);
  };

}

// keyboard commands, mirror spdt switch functionality
function onDocumentKeyDown(event) {
  switch (event.key) {
    case '1':
      toggleMapScene(1, 'switch1');
      break;
    case '2':
      toggleMapScene(2, 'switch1');
      break;
    case '3':
      toggleMapScene(1, 'switch2');
      break;
    case '4':
      toggleMapScene(2, 'switch2');
      break;
    default:
      break;
  }
}

// scene layer toggles
function toggleMapScene(switchState, source) {

  const canvas = document.getElementById('gfx'); // Get the canvas element by its ID

  // console.log(`switch stuff: ${switchState}, ${source}`);

  if (source === 'switch1') {
    analogGroup.visible = false;
    digitalGroup.visible = false;

    raycasterDict.cellServiceMesh.enabled = false;
    // raycasterDict.cellTransmitterPoints.enabled = false;
    raycasterDict.fmTransmitterPoints.enabled = false;

    switch (switchState) {
      case 1:
        analogGroup.visible = true;
        digitalGroup.visible = false;

        // show FM towers when analog is selected
        fmTransmitterPoints.visible = true;

        // enable relevant raycaster(s)
        raycasterDict.fmTransmitterPoints.enabled = true;

        // Redraw FM contours using the last used channel filter when switching back to analog
        if (lastChannelFilter !== null) {
          addFMpropagation3D(fmContoursGeojsonData, lastChannelFilter, propagationPolygons);
        }

        // reset css filter
        canvas.style.filter = '';

        break;
      case 2:
        lastChannelFilter = channelFilter;

        digitalGroup.visible = true;
        analogGroup.visible = false;

        raycasterDict.cellServiceMesh.enabled = true;
        raycasterDict.cellTransmitterPoints.enabled = true;
        
    
        // Hide FM towers when digital is selected
        fmTransmitterPoints.visible = false;

        // Set all FM propagation groups to decay immediately or hide them
        Object.keys(fmContourGroups).forEach(groupId => {
          fmContourGroups[groupId].isDecaying = true;
          fmContourGroups[groupId].decayRate = 1.0; // Set decay rate for immediate effect
          updatefmContourGroups(); // Call update function to process changes
        });

        // apply css filter
        // canvas.style.filter = 'hue-rotate(270deg) grayscale(1) contrast(1.5)';
        // canvas.style.filter = 'hue-rotate(200deg)';



        break;
    }
  } else if (source === 'switch2') {
    elevContourLines.visible = false;
    accessGroup.visible = false;

    raycasterDict.accessibilityMesh.enabled = false;

    switch (switchState) {
      case 1:
        elevContourLines.visible = true;
        // raycasterDict.accessibilityHex.enabled = true;
        break;
      case 2:
        accessGroup.visible = true;
        raycasterDict.accessibilityMesh.enabled = true;
        break;
    }
  }

}

  
  // Function to initialize the scene and other components
  async function initialize() {
    initThreeJS(); // Initialize Three.js

    // Initialize pixelationFactor
    pixelationFactor = null;

    onWindowResize(); // Update the resolution

    // Load GeoJSON data and then enable interaction
    loadGeoJSONData(() => {
      postLoadOperations(); // Setup the scene after critical datasets are loaded

      // // Ensure the sliderValue is up-to-date
      // sliderValue = (parseFloat(document.getElementById('fm-channel-slider').value) / sliderLength);
      const resolutionSlider = document.getElementById('fm-channel-slider');
      updateSliderDisplay(sliderValue, resolutionSlider);
  

      initWebSocketConnection();
      enableInteraction(); // Directly enable interaction without waiting for a button click
      flipCamera();
      // document.getElementById('progress-bar').style.display = 'none'; // Hide the progress bar
    });



  }


  function enableInteraction() {
    const threeContainer = document.getElementById('gfx');


    // Render the scene once before making it visible
    renderer.render(scene, camera);


    camera.updateProjectionMatrix();

    // Use requestAnimationFrame to ensure the rendering is done
    requestAnimationFrame(() => {
      // Reveal the container and info button simultaneously
      threeContainer.style.visibility = 'visible';
      threeContainer.style.opacity = '1';
      threeContainer.style.pointerEvents = 'auto';


      // Start the animation loop
      animate();
      document.addEventListener('keydown', onDocumentKeyDown, false); // Attach the keydown event handler

    });

    visualizationReady = true;
  }

  document.addEventListener('DOMContentLoaded', (event) => {
    initialize();
  });

  document.addEventListener('mousemove', function() {
    document.body.style.cursor = ''; // reset to default cursor if we got a mouse going
  });
  
  ///////////////////////////////////////////////////
  // MOUSEOVER TRANSITIONS /////////////////////////

  /////////////////////////////////////////////////////
  // CAMERA SETTINGS AND CONTROLS ////////////////////

  // Define pan speed
  //   const panSpeed = 0.05;

  //   document.addEventListener('keydown', onDocumentKeyDown, false);

  // Function to adjust the mesh visibility based on the camera distance aka SCALE DEPENDENCY!
  function adjustMeshVisibilityBasedOnCameraDistance() {
    if (camera && controls && controls.target) {
      const distanceToTarget = camera.position.distanceTo(controls.target);
      const threshold = 5;

      cellServiceMesh.visible = distanceToTarget <= threshold;
    } else {
      console.log('Camera or controls not defined.');
    }
  }

  // update line feature dashes based on zoom level

  const dashSize = .002;
  const gapSize = .015;

  const zoomLevels = [
    { threshold: 0.666, dashSize: dashSize / 2, gapSize: gapSize / 8 }, // Closest zoom
    { threshold: 0.75, dashSize: dashSize, gapSize: gapSize / 6},
    { threshold: 1.5, dashSize: dashSize * 4, gapSize: gapSize / 3},
    // { threshold: 2, dashSize: dashSize, gapSize: gapSize }, // Farthest zoom
  ];
  
    let currentZoomLevelIndex = -1; // Index of the currently applied zoom level

    function updateDashSizeForZoom() {
      const distanceToTarget = camera.position.distanceTo(controls.target);
      // Find the closest zoom level without going over
      let selectedZoomLevel = zoomLevels[0];
      for (let i = zoomLevels.length - 1; i >= 0; i--) {
          if (distanceToTarget >= zoomLevels[i].threshold) {
              selectedZoomLevel = zoomLevels[i];
              break;
          }
      }
  
      // Check if we need to update the dash and gap sizes
      if (currentZoomLevelIndex !== selectedZoomLevel.threshold) {
          currentZoomLevelIndex = selectedZoomLevel.threshold;
          
          // Iterate over each group in fmContourGroups
          Object.values(fmContourGroups).forEach(group => {
              // Update all line loops within the group
              group.meshes.forEach(mesh => {
                  if (mesh.material instanceof THREE.LineBasicMaterial) {
                      mesh.material.dashSize = selectedZoomLevel.dashSize;
                      mesh.material.gapSize = selectedZoomLevel.gapSize;
                      mesh.material.needsUpdate = true;
                      mesh.computeLineDistances();
                  }
              });
          });
      }
  }
      
  function getBoundingBoxOfGeoJSON(geojson) {
    if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        console.error('GeoJSON data is invalid or not a FeatureCollection:', geojson);
        throw new Error('GeoJSON data is invalid or not a FeatureCollection');
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    geojson.features.forEach((feature) => {
        const geometry = feature.geometry;
        const coordinates = geometry.coordinates;

        switch (geometry.type) {
            case 'Polygon':
                coordinates.forEach(polygon => {
                    polygon.forEach(coord => {
                        const [x, y] = toStatePlane(coord[0], coord[1]);
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    });
                });
                break;
            case 'MultiPolygon':
                coordinates.forEach(polygons => {
                    polygons.forEach(polygon => {
                        polygon.forEach(coord => {
                            const [x, y] = toStatePlane(coord[0], coord[1]);
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                        });
                    });
                });
                break;
        }
    });


    return {
        min: new THREE.Vector3(minX, minY, -Infinity),
        max: new THREE.Vector3(maxX, maxY, Infinity),
    };
}

  function constrainCamera(controls, boundingBox) {
    controls.addEventListener('change', () => {
      // Recalculate the distance to the target
      const distance = camera.position.distanceTo(controls.target);

      // Apply bounding box constraints
      camera.position.clamp(boundingBox.min, boundingBox.max);
      controls.target.clamp(boundingBox.min, boundingBox.max);

      // Reapply the distance to maintain zoom level
      const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      camera.position
        .copy(controls.target)
        .add(direction.multiplyScalar(distance));
    });
  }

  // Function to get the center of the bounding box
  function getCenterOfBoundingBox(boundingBox) {
    return new THREE.Vector3(
      (boundingBox.min.x + boundingBox.max.x) / 2,
      (boundingBox.min.y + boundingBox.max.y) / 2,
      0, // Assuming Z is not important for centering in this case
    );
  }

  // Ensure that you get the size correctly
  function getSizeOfBoundingBox(boundingBox) {
    return new THREE.Vector3(
      boundingBox.max.x - boundingBox.min.x,
      boundingBox.max.y - boundingBox.min.y,
      boundingBox.max.z - boundingBox.min.z,
    );
  }


  /////////////////////////////////////////////////////
  // GEOGRAPHIC DATA VIS /////////////////////////////

  // Define a scaling factor for the Z values (elevation)
  // const zScale = 0.00025; // smaller value better for perspective cam
  const zScale = 0.0004; // larger value better for ortho cam

  // Function to get color based on elevation
  function getColorForElevation(elevation, minElevation, maxElevation) {
    const gradient = [
      { stop: 0.0, color: new THREE.Color('#0000ff') }, // Blue at the lowest
      { stop: 0.2, color: new THREE.Color('#007fff') }, // Lighter blue
      { stop: 0.4, color: new THREE.Color('#00ff95') }, // Cyan-ish blue
      { stop: 0.5, color: new THREE.Color('#00ff00') }, // Green at the middle
      { stop: 0.6, color: new THREE.Color('#bfff00') }, // Yellow-green
      { stop: 0.8, color: new THREE.Color('#ffbf00') }, // Orange
      { stop: 1.0, color: new THREE.Color('#ff0000') }, // Red at the highest
    ];

    const t = (elevation - minElevation) / (maxElevation - minElevation);

    let lowerStop = gradient[0],
      upperStop = gradient[gradient.length - 1];
    for (let i = 0; i < gradient.length - 1; i++) {
      if (t >= gradient[i].stop && t <= gradient[i + 1].stop) {
        lowerStop = gradient[i];
        upperStop = gradient[i + 1];
        break;
      }
    }

    const color = lowerStop.color
      .clone()
      .lerp(
        upperStop.color,
        (t - lowerStop.stop) / (upperStop.stop - lowerStop.stop),
      );
    return color;
  }

  // calculate elevation properties from contours geojson
  function calculateMeanContourElevation(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.error('Invalid or empty GeoJSON data');
      return 0; // Return a default or error value
    }
  
    // Extract elevation values from the GeoJSON properties
    const elevations = geojson.features.map(feature => feature.properties.contour);
  
    // Calculate the total elevation to find the mean
    const totalElevation = elevations.reduce((acc, elevation) => acc + elevation, 0);
    const meanElevation = totalElevation / elevations.length;
  
    // Optionally, calculate min and max elevations for additional insights
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
  
    // console.log(`Min Elevation: ${minElevation}, Max Elevation: ${maxElevation}, Mean Elevation: ${meanElevation}`);
  
    return meanElevation;
  }

  
  // Define a variable to store the minimum elevation
  // This should be determined from the addElevContourLines function
  let globalMinElevation = Infinity;
  let meanElevation = Infinity + 1;

  function addElevContourLines(geojson, contourInterval = 100) { // Only process contours at specified intervals
    return new Promise((resolve, reject) => {
      console.log('adding elevation');
      if (!geojson || !geojson.features) {
        reject('Invalid GeoJSON data');
        return;
      }
  
      const elevations = geojson.features.map(f => f.properties.contour);
      const minElevation = Math.min(...elevations);
      const maxElevation = Math.max(...elevations);
  
      // To avoid negative or zero values in logarithm calculation, ensure a positive offset
      const minElevationPositive = Math.abs(minElevation) + 1;
      const maxElevationLog = Math.log(maxElevation + minElevationPositive);
      const minElevationLog = Math.log(minElevationPositive);
  
      // console.log('terrain features: ', geojson.features.length / 2);
      geojson.features.forEach((feature, index) => {
        const contour = feature.properties.contour;
  
        // Skip contours not at the specified interval
        if (contour % contourInterval !== 0) {
          return;
        }
  
        const coordinates = feature.geometry.coordinates; // Array of [lon, lat] pairs
        const color = getColorForElevation(contour, minElevation, maxElevation);
  
        // Calculate logarithmic opacity scaling
        let minOpacity = 0.2;
        let maxOpacity = 0.75;
        let scaleExponent = 0.75; // Adjust this to control the rate of change

        // Normalize contour value between 0 and 1 based on elevation range
        const normalizedElevation = (contour - minElevation) / (maxElevation - minElevation);
      
      
        const contourPositive = contour + minElevationPositive;
        const contourLog = Math.log(contourPositive);

        // apply logarithmic scaling
        // const opacity = minOpacity + (maxOpacity * (contourLog - minElevationLog) / (maxElevationLog - minElevationLog));

        // Apply exponential scaling
        const opacity = minOpacity + (maxOpacity - minOpacity) * Math.pow(normalizedElevation, scaleExponent);

  
        let material = new THREE.LineBasicMaterial({
          color: color,
          transparent: true,
          alphaHash: false,
          opacity: opacity,
        });
  
        // Function to process a single line
        const processLine = (lineCoords, contourValue) => {
          let vertices = [];
          lineCoords.forEach((pair) => {
            if (!Array.isArray(pair) || pair.length !== 2 || pair.some(c => isNaN(c))) {
              console.error(`Feature ${index} has invalid coordinates`, pair);
              return;
            }
            const [lon, lat] = pair;
            try {
              const [x, y] = toStatePlane(lon, lat);
              const z = contourValue * zScale; // Scale the elevation for visibility
              vertices.push(x, y, z);
            } catch (error) {
              console.error(`Feature ${index} error in toStatePlane:`, error.message);
            }
          });
  
          if (vertices.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances(); 
            elevContourLines.add(line);
          }
        };
  
        // Check geometry type and process accordingly
        if (feature.geometry.type === 'LineString') {
          processLine(coordinates, contour);
        } else if (feature.geometry.type === 'MultiLineString') {
          coordinates.forEach(lineCoords => processLine(lineCoords, contour));
        } else {
          console.error(`Unsupported geometry type: ${feature.geometry.type}`);
        }
      });
  
      try {
        scene.add(elevContourLines); 
        resolve(); // Resolve the promise when done
      } catch (error) {
        reject(`Error in addElevContourLines: ${error.message}`);
      }
    });
  }

  //   // radiating triangle fill polys - needs closed geom
  // function addWaterPoly(geojson, stride = 1) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       for (let i = 0; i < geojson.features.length; i += stride) {
  //         const feature = geojson.features[i];

  //         // Create a new material for each polygon
  //         const material = new THREE.MeshBasicMaterial({
  //           color: colorScheme.waterColor,
  //           transparent: true,
  //           wireframe: true,
  //           dithering: true,
  //           opacity: 0.8, // Start with lower opacity
  //           side: THREE.FrontSide,
  //         });

  //         try {
  //           const shapeCoords = feature.geometry.coordinates[0];
  //           const vertices = [];
  //           let centroid = new THREE.Vector3(0, 0, 0);

  //           // Convert coordinates to vertices and calculate centroid
  //           shapeCoords.forEach((coord) => {
  //             const [x, y] = toStatePlane(coord[0], coord[1]);
  //             const z = meanElevation * zScale; // Set Z to a hardcoded contour elevation
  //             vertices.push(new THREE.Vector3(x, y, z));
  //             centroid.add(new THREE.Vector3(x, y, z));
  //           });

  //           centroid.divideScalar(shapeCoords.length); // Average to find centroid
  //           vertices.unshift(centroid); // Add centroid as the first vertex

  //           const shapeGeometry = new THREE.BufferGeometry();
  //           const positions = [];

  //           // The centroid is the first vertex, and it's connected to every other vertex
  //           for (let j = 1; j <= shapeCoords.length; j++) {
  //             // Add centroid
  //             positions.push(centroid.x, centroid.y, centroid.z);

  //             // Add current vertex
  //             positions.push(
  //               vertices[j % shapeCoords.length].x,
  //               vertices[j % shapeCoords.length].y,
  //               vertices[j % shapeCoords.length].z,
  //             );

  //             // Add next vertex
  //             positions.push(
  //               vertices[(j + 1) % shapeCoords.length].x,
  //               vertices[(j + 1) % shapeCoords.length].y,
  //               vertices[(j + 1) % shapeCoords.length].z,
  //             );
  //           }

  //           shapeGeometry.setAttribute(
  //             'position',
  //             new THREE.Float32BufferAttribute(positions, 3),
  //           );
  //           shapeGeometry.computeVertexNormals();

  //           const mesh = new THREE.Mesh(shapeGeometry, material);
  //           mesh.name = 'polygon-' + i;
  //           scene.add(mesh);
  //           waterPolys.add(mesh);
  //         } catch (error) {
  //           console.error(`Error processing feature at index ${i}:`, error);
  //         }
  //       }
  //       // Add the water poly group to the scene
  //       scene.add(waterPolys);

  //       // Set the initial visibility of the fm propagation curves layer to false
  //       waterPolys.visible = false;

  //       resolve(); // Resolve the promise when done
  //     } catch (error) {
  //       reject(`Error in addPolygons: ${error.message}`);
  //     }
  //   });
  // }

  function addCellServiceMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        // Reset/clear the group to avoid adding duplicate meshes
        cellServiceMesh.clear();

        // Downsample and group points by 'group_ID'
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const gridCode = feature.properties.grid_code;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat);
          const z = feature.properties.Z * (zScale*1.025); // slightly higher z-scale bc z-fighting w other meshes
  
          if (!groups[gridCode]) {
            groups[gridCode] = [];
          }
          groups[gridCode].push(new THREE.Vector3(x, y, z));
        }

        // create points group for raycasting / sound triggers only
        Object.keys(groups).forEach(gridCode => {
          const pointsForDelaunay = groups[gridCode];
          const pointsMaterial = new THREE.PointsMaterial({
            // size: 5,
            // color: accessibilityColorRamp(parseInt(gridCode)),
            // opacity: accessibilityOpacityRamp(parseInt(gridCode)),
            transparent: false,
            visible: false,
          });
          const pointsGeometry = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
          const points = new THREE.Points(pointsGeometry, pointsMaterial);

          points.userData = { gridCode, vertices: pointsForDelaunay };

          var group = new THREE.Group();
          group.add(points);  // Add points directly to the group

          cellServiceMesh.add(group);
        });

  
        // Process each grid_code group separately
        Object.keys(groups).forEach((gridCode) => {
          const pointsForDelaunay = groups[gridCode];
  
          var delaunay = Delaunator.from(
            pointsForDelaunay.map((p) => [p.x, p.y]),
          );
          var meshIndex = [];
          // set triangulation distance threshold to avoid connecting distant pts
          const thresholdDistance = 0.075; 

          for (let i = 0; i < delaunay.triangles.length; i += 3) {
            const p1 = pointsForDelaunay[delaunay.triangles[i]];
            const p2 = pointsForDelaunay[delaunay.triangles[i + 1]];
            const p3 = pointsForDelaunay[delaunay.triangles[i + 2]];

            // Check distances between each pair of points in a triangle
            if (
              distanceBetweenPoints(p1, p2) <= thresholdDistance &&
              distanceBetweenPoints(p2, p3) <= thresholdDistance &&
              distanceBetweenPoints(p3, p1) <= thresholdDistance
            ) {
              meshIndex.push(
                delaunay.triangles[i],
                delaunay.triangles[i + 1],
                delaunay.triangles[i + 2],
              );
            }
          }

          var geom = new THREE.BufferGeometry().setFromPoints(
            pointsForDelaunay,
          );
          geom.setIndex(meshIndex);
          geom.computeVertexNormals();
          

          // unique symbols based on grid_code
          let wireframeMaterial, fillMaterial;
          switch (gridCode) {

            case `0`:

                // Wireframe material
                wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: colorScheme.cellServiceNo,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.5,
                  wireframe: true,
                  side: THREE.DoubleSide,
                });

                // Solid fill material (black fill)
                fillMaterial = new THREE.MeshBasicMaterial({
                  color: 0x000000, // Black color for the fill
                  transparent: true,    
                  opacity: 0.85, 
                  alphaHash: true,
                  side: THREE.DoubleSide, //
                  wireframe: false,
                  visible: true,
                });

            break;

              case `1`:

                // Wireframe material
                wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: colorScheme.cellServiceYes,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.4,
                  wireframe: true,
                  side: THREE.DoubleSide,
                  visible: false,
                });

                // Solid fill material (black fill)
                fillMaterial = new THREE.MeshBasicMaterial({
                  color: 0x000000, // Black color for the fill
                  transparent: true,    
                  opacity: 1, 
                  alphaHash: true,
                  side: THREE.DoubleSide, //
                  wireframe: false,
                  visible: false,
                });

            break;

              default:

                // wireframeMaterial = new THREE.MeshBasicMaterial({
                //   color: 0xffffff,
                //   transparent: true,
                //   alphaHash: true,
                //   opacity: 0.3,
                //   wireframe: true,
                //   side: THREE.DoubleSide,
                //   visible: false,
                // });


                // Solid fill material (black fill)
                // fillMaterial = new THREE.MeshBasicMaterial({
                //   color: 0x000000, // Black color for the fill
                //   transparent: true,    
                //   opacity: 1, 
                //   alphaHash: true,
                //   side: THREE.DoubleSide, //
                //   wireframe: false,
                // });


            }


          // Create mesh with the fill material
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          fillMesh.name = 'fillMesh-' + gridCode;

          // Create mesh with the wireframe material
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
          wireframeMesh.name = 'wireframeMesh-' + gridCode;

          // add metadata to the meshes for raycaster triggers
          fillMesh.userData.gridCode = gridCode;
          wireframeMesh.userData.gridCode = gridCode;

          // Group to hold both meshes
          var group = new THREE.Group();
          group.add(wireframeMesh);
          // group.add(fillMesh);

          // Add the group to the cellServiceMesh group
          cellServiceMesh.add(group);
        });

        // Add the cellServiceMesh group to the scene
        scene.add(cellServiceMesh);
        console.log(`access mesh length: ${geojson.features.length}`)


        resolve(cellServiceMesh); // Optionally return the group for further manipulation
      } catch (error) {
        reject(`Error in addCellServiceMesh: ${error.message}`);
      }
    });
  }

  // function to create color ramps programatically
  function interpolateColor(color1, color2, factor) {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
      result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return result;
  }
  
  function hexToRgb(hex) {
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    return [r, g, b];
  }
  
  function rgbToHex(r, g, b) {
    return (r << 16) | (g << 8) | b;
  }
  
  // calculate color ramp for accessibility mesh
  function accessibilityColorRamp(gridCode) {
    // '#230075'
    const startColor = hexToRgb(0x230075); 
    const endColor = hexToRgb(0x00ff00); 
    // const startColor = hexToRgb(0x4b2c92); 
    // const endColor = hexToRgb(0x00b545); 
    const factor = gridCode / 8;
    const interpolatedColor = interpolateColor(startColor, endColor, factor);
    return rgbToHex(...interpolatedColor);
  }
  

  // calculate opacity ramp for accessibility mesh
  function accessibilityOpacityRamp(gridCode) {
    const minOpacity = 0.1;
    const maxOpacity = 0.9;
    const scaleExponent = 0.15; // Adjust this to control the rate of change
    
    // Normalize gridCode value between 0 and 1
    const normalizedGridCode = 1 - (gridCode / 8); // Assuming grid codes range from 0 to 8

    
    // Apply exponential scaling to opacity
    const opacity = minOpacity + (maxOpacity - minOpacity) * Math.pow(normalizedGridCode, scaleExponent);
    
    return 0.1 + (0.8 * gridCode / 8); // Evenly spread from 0.1 to 0.9
  }
  

  function addAccessibilityMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        accessibilityMesh.clear(); // Clear existing meshes to avoid duplicates.
  
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const gridCode = feature.properties.grid_code;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat);
          const z = feature.properties.Z * zScale;
  
          if (!groups[gridCode]) {
            groups[gridCode] = [];
          }
          groups[gridCode].push(new THREE.Vector3(x, y, z));
        }

      // create points group for raycasting / sound triggers only
      Object.keys(groups).forEach(gridCode => {
        const pointsForDelaunay = groups[gridCode];
        const pointsMaterial = new THREE.PointsMaterial({
          // size: 5,
          // color: accessibilityColorRamp(parseInt(gridCode)),
          // opacity: accessibilityOpacityRamp(parseInt(gridCode)),
          transparent: false,
          visible: false,
        });
        const pointsGeometry = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
        const points = new THREE.Points(pointsGeometry, pointsMaterial);

        points.userData = { gridCode, vertices: pointsForDelaunay };

        var group = new THREE.Group();
        group.add(points);  // Add points directly to the group

        accessibilityMesh.add(group);
      });
  
  
        Object.keys(groups).forEach(gridCode => {
          const pointsForDelaunay = groups[gridCode];
          var delaunay = Delaunator.from(pointsForDelaunay.map(p => [p.x, p.y]));
          var meshIndex = [];
          const thresholdDistance = 0.15; // Threshold distance for triangulation.
  
          for (let i = 0; i < delaunay.triangles.length; i += 3) {
            const p1 = pointsForDelaunay[delaunay.triangles[i]];
            const p2 = pointsForDelaunay[delaunay.triangles[i + 1]];
            const p3 = pointsForDelaunay[delaunay.triangles[i + 2]];
  
            if (distanceBetweenPoints(p1, p2) <= thresholdDistance &&
                distanceBetweenPoints(p2, p3) <= thresholdDistance &&
                distanceBetweenPoints(p3, p1) <= thresholdDistance) {
              meshIndex.push(delaunay.triangles[i], delaunay.triangles[i + 1], delaunay.triangles[i + 2]);
            }
          }
  
          var geom = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
          geom.setIndex(meshIndex);
          geom.computeVertexNormals();
  
          const gridCodeColor = accessibilityColorRamp(parseInt(gridCode));
          const accessibilityOpacity = accessibilityOpacityRamp(parseInt(gridCode));
  
          let fillMaterial = new THREE.MeshBasicMaterial({
            color: gridCodeColor,
            opacity: accessibilityOpacity / 2,
            transparent: true,
            alphaHash: false,
            side: THREE.DoubleSide,
            visible: true
          });
  
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: gridCodeColor,
            opacity: accessibilityOpacity * 1.5,
            wireframe: true,
            transparent: true,
            alphaHash: true,
            side: THREE.DoubleSide,
            visible: true
          });
  
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
  
          fillMesh.userData = { gridCode, vertices: pointsForDelaunay };
          wireframeMesh.userData = { gridCode, vertices: pointsForDelaunay };
  
          var group = new THREE.Group();
          group.add(fillMesh);
          group.add(wireframeMesh);
  
          accessibilityMesh.add(group);
        });
  
        scene.add(accessibilityMesh);
        console.log(`Accessibility mesh added with ${geojson.features.length / stride} features`);
  
        resolve(accessibilityMesh);
      } catch (error) {
        console.error(`Error in adding accessibility mesh: ${error.message}`);
        reject(error);
      }
    });
  }
  

// Define an array to track all line loops and their decay status
let fmContourGroups = {}; // Object to store line loop groups
let lineLoops = {};

function updatefmContourGroups() {
  Object.keys(fmContourGroups).forEach(groupId => {
    const group = fmContourGroups[groupId];
    if (group.isDecaying) {
      group.opacity -= group.decayRate;
      group.opacity = Math.max(group.opacity, 0);

      group.meshes.forEach(mesh => {
        mesh.material.opacity = group.opacity;
        mesh.visible = group.opacity > 0;
      });

      if (group.opacity <= 0) {
        group.meshes.forEach(mesh => {
          scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        });
        delete fmContourGroups[groupId];
      }
    } else {
      group.meshes.forEach(mesh => {
        mesh.visible = analogGroup.visible && !group.isDecaying;
      });
    }
  });
}

// Function to add FM propagation 3D line loops
function addFMpropagation3D(geojson, channelFilter, propagationPolygons, stride = 1) {
  return new Promise((resolve, reject) => {
      propagationPolygons.children.forEach(child => {
        propagationPolygons.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });


        // Existing groups not matching the current channelFilter are marked for decay
        Object.keys(fmContourGroups).forEach(groupId => {
            if (groupId !== channelFilter.toString() || analogGroup.visible === false) {
                fmContourGroups[groupId].isDecaying = true;
                fmContourGroups[groupId].decayRate = 0.1; // Adjust decay rate as needed
            }
        });

        // Extract all indices
        const indices = geojson.features.map(feature => {
          const keyParts = feature.properties.key.split('_');
          return parseInt(keyParts[keyParts.length - 1], 10); 
      });

      // Determine the new range for dynamic opacity
      const opacityReductionThreshold = 1; // Start reducing opacity from this index
      const minIndexForOpacity = Math.min(...indices);
      const maxOpacity = .9;
      const minOpacity = 0.1;

      // Separate indices into negative and non-negative
        const negativeIndices = geojson.features.map(feature => {
        const keyParts = feature.properties.key.split('_');
        const index = parseInt(keyParts[keyParts.length - 1], 10); 
        return index < 0 ? index : null; // Only consider negative indices
        }).filter(index => index !== null);

        const maxNegativeIndex = Math.max(...negativeIndices); // Closer to 0
        const minNegativeIndex = Math.min(...negativeIndices); // Further from 0
        const opacityRange = maxOpacity - minOpacity; // Defined range for negatives

        console.log(geojson.features.length)

        geojson.features.forEach((feature, idx) => {
            if (idx % stride !== 0) return;
            const channel = parseInt(feature.properties.channel, 10);
            if (channel !== channelFilter) return;

            const elevationData = feature.properties.elevation_data;
            // if (!elevationData || elevationData.length !== feature.geometry.coordinates[0].length) {
            //     console.error(`Elevation data length does not match coordinates length for feature at index ${idx}`);
            //     return; // Skip this feature
            // }

            // Calculate feature opacity based on its index
            let featureIndex = parseInt(feature.properties.key.split('_').pop(), 10);
            let opacity = maxOpacity;

            // Apply dynamic opacity for indices < N through the minimum negative index
            if (featureIndex < opacityReductionThreshold) {
              opacity = minOpacity + (opacityRange * (featureIndex - minIndexForOpacity) / (opacityReductionThreshold - 1 - minIndexForOpacity));
            }

            const material = new THREE.LineBasicMaterial({
              color: colorScheme.polygonColor,
              transparent: true,
              alphaHash: true,
              opacity: opacity,   
              visible: analogGroup.visible // Set visibility based on analogGroup  
          });
      
          const vertices = feature.geometry.coordinates[0].map(coord => {
              const [x, y] = toStatePlane(coord[0], coord[1]);
              const z = elevationData[Math.abs(featureIndex)] * zScale;
              return new THREE.Vector3(x, y, z);
          });
      
          const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
          const lineLoop = new THREE.Line(geometry, material);
          lineLoop.computeLineDistances();
      
          // Triangulate for filled mesh
          const flatVertices = [];
          vertices.forEach(vertex => {
              flatVertices.push(vertex.x, vertex.y); // Flatten for earcut
          });
          const triangles = Earcut.triangulate(flatVertices, null, 2); // Second argument for holes, third for dimensions

      
          const meshGeometry = new THREE.BufferGeometry();
          const positionArray = new Float32Array(triangles.length * 3); // 3 vertices per triangle
          triangles.forEach((index, i) => {
              positionArray[i * 3] = vertices[index].x;
              positionArray[i * 3 + 1] = vertices[index].y;
              positionArray[i * 3 + 2] = vertices[index].z; // Apply elevation
          });
          meshGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
      
          const meshMaterial = new THREE.MeshBasicMaterial({
              color: colorScheme.polygonColor,
              side: THREE.DoubleSide,
              wireframe: true,
              transparent: true,
              opacity: opacity,
              visible: false,
          });
          const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
      
          // Add to group and scene
          const groupId = feature.properties.key.split('_')[0];
          if (!fmContourGroups[groupId] || analogGroup.visible === false) {
              fmContourGroups[groupId] = {
                  meshes: [],
                  opacity: 1.0,
                  isDecaying: false,
                  decayRate: 0.1
              };
          }
          fmContourGroups[groupId].meshes.push(lineLoop, mesh);
          propagationPolygons.add(lineLoop);
          propagationPolygons.add(mesh);
      });


      scene.add(propagationPolygons)

      resolve();
  });
}

async function addFMTowerPts(geojson, channelFilter, group) {
  try {
    // Define the base size, height, and characteristics for the pyramids
    const baseSizeMatching = 0.008;
    const pyramidHeightMatching = 0.035;
    const baseSizeNonMatching = baseSizeMatching * 0.7;
    const pyramidHeightNonMatching = pyramidHeightMatching * 0.7;

    // Define colors and opacities
    const matchingColor = new THREE.Color(colorScheme.matchingPyramidColor);
    const nonMatchingColor = new THREE.Color(colorScheme.nonMatchingPyramidColor);
    const matchingOpacity = 0.8;
    const nonMatchingOpacity = 0.6;

    // Prepare instanced mesh materials
    const materialMatching = new THREE.MeshBasicMaterial({ 
      color: matchingColor, 
      transparent: true, 
      alphaHash: true,
      opacity: matchingOpacity 
    });
    const materialNonMatching = new THREE.MeshBasicMaterial({ 
      color: nonMatchingColor, 
      transparent: true, 
      alphaHash: true,
      opacity: nonMatchingOpacity 
    });

    // Create pyramid geometries
    const pyramidGeometryMatching = new THREE.ConeGeometry(baseSizeMatching, pyramidHeightMatching, 4);
    pyramidGeometryMatching.rotateX(Math.PI / 2);
    const pyramidGeometryNonMatching = new THREE.ConeGeometry(baseSizeNonMatching, pyramidHeightNonMatching, 4);
    pyramidGeometryNonMatching.rotateX(Math.PI / 2);

    // Estimate total counts for instanced meshes
    const totalCount = geojson.features.length;

    // Initialize or clear previous instanced meshes
    if (window.instancedPyramidMatching) fmTransmitterPoints.remove(window.instancedPyramidMatching);
    if (window.instancedPyramidNonMatching) fmTransmitterPoints.remove(window.instancedPyramidNonMatching);

    window.instancedPyramidMatching = new THREE.InstancedMesh(pyramidGeometryMatching, materialMatching, totalCount);
    window.instancedPyramidNonMatching = new THREE.InstancedMesh(pyramidGeometryNonMatching, materialNonMatching, totalCount);

    let dummy = new THREE.Object3D();

    geojson.features.forEach((feature, index) => {
      const [lon, lat] = feature.geometry.coordinates;
      const elevation = feature.properties.elevation;
      const [x, y] = toStatePlane(lon, lat);
      const z = elevation * zScale;
      
      if (x === null || y === null || isNaN(z)) return;
      
      const isMatching = parseInt(feature.properties.channel, 10) === channelFilter;
      
      dummy.position.set(x, y, z);
      dummy.scale.set(1, 1, 1); // Default scale

      // Use the same index for both matching and non-matching instances
      dummy.updateMatrix();
      if (isMatching) {
        window.instancedPyramidMatching.setMatrixAt(index, dummy.matrix);
        // Scale non-matching instances to normal size; they remain visible regardless
        window.instancedPyramidNonMatching.setMatrixAt(index, dummy.matrix);
      } else {
        // Hide matching instances by scaling to zero
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        window.instancedPyramidMatching.setMatrixAt(index, dummy.matrix);
        // Non-matching instances are not hidden, so we reset their scale to ensure visibility
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        window.instancedPyramidNonMatching.setMatrixAt(index, dummy.matrix);
      }
    });

    // Mark matrices as needing update
    window.instancedPyramidMatching.instanceMatrix.needsUpdate = true;
    window.instancedPyramidNonMatching.instanceMatrix.needsUpdate = true;

    // Add the instanced meshes to the fmTransmitterPoints group
    fmTransmitterPoints.add(window.instancedPyramidMatching);
    fmTransmitterPoints.add(window.instancedPyramidNonMatching);
    scene.add(fmTransmitterPoints);
  } catch (error) {
    console.error('Error in addFMTowerPts:', error);
    throw error; // Rethrow or handle as needed
  }
}

  
// Function to add wireframe pyramids and text labels for POINT data from GeoJSON
function addCellTowerPts(geojson) {
  return new Promise((resolve, reject) => {
    try {
      // Define the base size and height for the pyramids
      const baseSize = 0.005;
      const pyramidHeight = 0.03;

      // Material for the wireframe pyramids
      let pyramidMaterialCellular = new THREE.MeshBasicMaterial({
        color: colorScheme.pyramidColorCellular,
        wireframe: true,
        transparent: true,
        alphaHash: true,
        opacity: 0.25,
      });


      const points = []; // Array to store points for the convex hull

      // Parse the POINT data from the GeoJSON
      geojson.features.forEach((feature, index) => {
        if (feature.geometry.type === 'Point') {
          // Directly use the coordinates array
          const [lon, lat] = feature.geometry.coordinates;
          const elevation = feature.properties.Z || 0;  // Default to 0 if Z is not provided

          try {
            // Convert the lon/lat to State Plane coordinates
            const [x, y] = toStatePlane(lon, lat);
            const z = elevation * zScale; // Apply the scaling factor to the elevation

            // Create a cone geometry for the pyramid with the defined base size and height
            const pyramidGeometry = new THREE.ConeGeometry(
              baseSize,
              pyramidHeight,
              4,
            );
            pyramidGeometry.rotateX(Math.PI / 2); // Rotate the pyramid to point up along the Z-axis

            const pyramid = new THREE.Mesh(
              pyramidGeometry,
              pyramidMaterialCellular,
            );
            pyramid.position.set(x, y, z);

            pyramid.userData = {
              position: new THREE.Vector3(x, y, z),
              gridCode: feature.properties.gridCode || 'unknown' // todo: attach a sound preset key json ..
                                                                      // ..prop where 'gridcode' is here
            };
  
            // Add the pyramid to the cellTransmitterPoints group
            cellTransmitterPoints.add(pyramid);

            // Check for coincident points and get a z-offset
            const label = `cell`;
            //   const zOffset = getCoincidentPointOffset(lon, lat, 8, 0.00001);

            // Ensure Callsign or another property is correctly referenced
            // const label = feature.properties.Callsign || `Tower ${index}`;

            // const textSprite = makeTextSprite(` ${label} `, {
            //   fontsize: 24,
            //   strokeColor: 'rgba(255, 255, 255, 0.9)',
            //   strokeWidth: 1,

              // borderColor: { r: 255, g: 0, b: 0, a: 1.0 },
              // backgroundColor: { r: 255, g: 100, b: 100, a: 0.8 }
            // });

            // Position the sprite above the pyramid
            const pyramidHeightScaled = pyramidHeight * zScale;

            // Position the sprite above the pyramid, applying the offset for coincident points
            // textSprite.position.set(
            //   x,
            //   y,
            //   z + pyramidHeightScaled + zOffset + 0.009,
            // );
            // textSprite.scale.set(0.05, 0.025, 1.0);

            // cellTransmitterPoints.add(textSprite); // Add the label to the cellTransmitterPoints group
            // console.log(`creating label for ${label}`);

            // const gridCode = firstIntersection.object.userData.gridCode;

            // Add the position to the points array for convex hull calculation
            points.push(new THREE.Vector3(x, y, z));
          } catch (error) {
            console.error(`Error projecting point:`, error.message);
          }
        } else {
          console.error(
            `Unsupported geometry type for points: ${feature.geometry.type}`,
          );
        }
      });

      // Create and add the convex hull to the scene
      if (points.length > 0) {
        // createConvexHullLines(points);
        // console.log("creating convex hull with " + points)

        const cellMstEdges = primsAlgorithm(points);
        drawMSTEdges(
          cellMstEdges,
          '#FFFFFF',
          colorScheme.mstCellColor,
          0.00075,
          0.003,
          cellMSTLines,
        );
      }
      // add groups to scene
      scene.add(cellTransmitterPoints);
      scene.add(cellMSTLines);

      resolve(); // Resolve the promise when done
    } catch (error) {
      reject(`Error in addCellTowerPts: ${error.message}`);
    }
  });
}

  //////////////////////
  ///////// slider stuff


  let lastChannelValue = null; // For tracking significant channel value changes
  let lastChannelFilter = null; // For reinitializing after switching map scenes
  let debounceTimer = null; // For debouncing updates to the display
  let channelFilter = null;

  function updateSliderDisplay(value, resolutionSlider) {
    let sliderDisplay = '[';
    for (let i = 0; i < sliderLength; i++) {
      sliderDisplay += i < value ? '#' : '-';
    }
    sliderDisplay += ']';
    resolutionSlider.textContent = sliderDisplay;
  }
  
  function updateLabelPosition(sliderValue) {
    const slider = document.getElementById('fm-channel-slider');
    const label = document.getElementById('fm-frequency-display');
  
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
  
    // Calculate thumb position percentage
    const percent = ((sliderValue - min) / (max - min)) * 100;
  
    // Adjust label position based on thumb position
    const sliderWidth = slider.offsetWidth;
    const labelWidth = label.offsetWidth;
    label.style.maxWidth = `${sliderWidth / 4}px`;
    const leftPosition = (percent / 100) * sliderWidth - (labelWidth / 2) + (slider.getBoundingClientRect().left - label.offsetParent.getBoundingClientRect().left);
  
    // Update the label's position
    label.style.left = `${leftPosition}px`;
  }
  
  // Initialize the position update
  updateLabelPosition(parseInt(document.getElementById('fm-channel-slider').value, 10));
  
  // Update label position on slider input
  document.getElementById('fm-channel-slider').addEventListener('input', function() {
    updateLabelPosition(parseInt(this.value, 10));
  });
  
  let isDragging = false;
  document.getElementById('fm-channel-slider').addEventListener('mousedown', function() {
    isDragging = true;
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
  });

  
  let channelFrequencies = {}; // Ensure this is accessible globally
  
  function updateDisplays(channelValue) {
    // Debounce logic to only update if the channel value changes significantly
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (lastChannelValue === null || Math.abs(lastChannelValue - channelValue) >= 2) {
        channelFilter = channelValue; // for global channelFilter vals
        const display = document.getElementById('fm-channel-display');
        const frequencyLabel = document.getElementById('fm-frequency-display');
        const frequencyText = channelFrequencies[Math.round(channelValue).toString()] || "Frequency not found";
  
        display.textContent = `FM channel: ${Math.round(channelValue)}`;
        frequencyLabel.textContent = frequencyText;

        if ( fmContoursGeojsonData && fmTransmitterGeojsonData) {
          updateVisualizationWithChannelFilter(fmContoursGeojsonData, fmTransmitterGeojsonData, channelValue);
          lastChannelValue = channelValue; // Update lastChannelValue
        }
      }
    }, 20); // Delay for debouncing
  }
  
  function initFMsliderAndContours(frequencyData) {
    channelFrequencies = frequencyData;
  
    const slider = document.getElementById('fm-channel-slider');
    slider.addEventListener('input', function() {
      const channelValue = Math.round(parseInt(this.value, 10));
      updateDisplays(channelValue);
    });
    
    // Initial update based on the slider's default value
    const initialChannelValue = Math.round(parseInt(slider.value, 10));
    updateDisplays(initialChannelValue);
  }
  

  function updateVisualizationWithChannelFilter(fmContoursGeojsonData, towerGeojsonData, channelFilter) {
    // Ensure data availability
    if (!fmContoursGeojsonData || !towerGeojsonData) {
      console.warn("GeoJSON data not available.");
      return;
    }


    addFMpropagation3D(fmContoursGeojsonData, channelFilter, propagationPolygons)
      // .then(() => console.log("FM propagation updated"))
      .catch(error => console.error("Failed to update contour channel:", error));

    addFMTowerPts(towerGeojsonData, channelFilter, fmTransmitterPoints)
      // .then(() => console.log("FM towers updated"))
      .catch(error => console.error("Failed to update tower channel:", error));



  }
  //////////////////////

  // graticule and convex hull functions here
  /////////////////////////////////////////

  /////////

  function primsAlgorithm(points) {
    const numPoints = points.length;
    const edges = new Array(numPoints);
    const visited = new Array(numPoints).fill(false);
    const minEdge = new Array(numPoints).fill(Infinity);

    // Arbitrary starting point
    minEdge[0] = 0;
    const parent = new Array(numPoints).fill(-1);

    for (let i = 0; i < numPoints - 1; i++) {
      let u = -1;

      for (let j = 0; j < numPoints; j++) {
        if (!visited[j] && (u === -1 || minEdge[j] < minEdge[u])) {
          u = j;
        }
      }

      visited[u] = true;

      for (let v = 0; v < numPoints; v++) {
        const dist = points[u].distanceTo(points[v]);

        if (!visited[v] && dist < minEdge[v]) {
          parent[v] = u;
          minEdge[v] = dist;
        }
      }
    }

    for (let i = 1; i < numPoints; i++) {
      edges[i - 1] = { from: points[parent[i]], to: points[i] };
    }

    return edges;
  }

  // Function to create and add MST lines with glow effect
  function drawMSTEdges(
    mstEdges,
    coreColor,
    glowColor,
    coreRadius,
    glowRadius,
    targetGroup,
  ) {
    mstEdges.forEach((edge) => {
      // Create a path for the edge
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(edge.from, edge.to));

      // Core tube
      const coreGeometry = new THREE.TubeGeometry(
        path,
        1,
        coreRadius,
        8,
        false,
      );
      const coreMaterial = new THREE.MeshBasicMaterial({ color: coreColor });
      const coreTube = new THREE.Mesh(coreGeometry, coreMaterial);
      targetGroup.add(coreTube);

      // Glow tube
      const glowGeometry = new THREE.TubeGeometry(
        path,
        1,
        glowRadius,
        8,
        false,
      );
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        alphaHash: true,
        opacity: 0.5,
      });
      const glowTube = new THREE.Mesh(glowGeometry, glowMaterial);
      targetGroup.add(glowTube);
    });
  }

  // ACCESSIBILITY POLYGONS
  // function drawAccessibilityHex(geojson) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       geojson.features.forEach((feature) => {
  //         const color = getColorFromContour(feature.properties.ContourMax);
  //         const material = new THREE.MeshBasicMaterial({
  //           color: colorScheme.accessibilityHexColor,
  //           side: THREE.FrontSide,
  //           transparent: true,
  //           wireframe: true,
  //           opacity: 0.3,
  //           alphaHash: true,
  //           visible: true,
  //         });
  
  //         const processPolygon = (polygon) => {
  //           polygon.forEach((ring) => {
  //             const vertices = [];
  //             ring.forEach((coord) => {
  //               if (!Array.isArray(coord)) {
  //                 throw new Error("Coordinate is not an array");
  //               }
  
  //               const [lon, lat] = coord;
  //               const [x, y] = toStatePlane(lon, lat);
  //               vertices.push(x, y);
  //             });
  
  //             if (vertices.length > 0) {
  //               const geometry = new THREE.BufferGeometry();
  //               const verticesArray = new Float32Array(vertices);
  //               const indices = Earcut.triangulate(vertices, null, 2);
  //               const positionArray = new Float32Array(indices.length * 3);
  
  //               indices.forEach((index, i) => {
  //                 positionArray[i * 3] = vertices[index * 2];
  //                 positionArray[i * 3 + 1] = vertices[index * 2 + 1];
  //                 positionArray[i * 3 + 2] = 0; // Z coordinate
  //               });
  
  //               geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  //               const mesh = new THREE.Mesh(geometry, material);

  //               vertices.forEach((value, index) => {
  //                 // Assuming vertices are stored as x0, y0, x1, y1, ..., xn, yn
  //                 // Save every vertex's position in userData for easy access later
  //                 if(index % 2 === 0) { // Even indices are x coordinates
  //                   mesh.userData.vertices = mesh.userData.vertices || [];
  //                   mesh.userData.vertices.push({x: value, y: vertices[index + 1]});
  //                 }
  //                 // console.log(mesh.userData.vertices)
  //               });        
        
  //               accessibilityHex.add(mesh);
  //             }
  //           });
  //         };
  
  //         if (feature.geometry.type === 'Polygon') {
  //           processPolygon(feature.geometry.coordinates);
  //         } else if (feature.geometry.type === 'MultiPolygon') {
  //           feature.geometry.coordinates.forEach(processPolygon);
  //         }
          
  //       });

  
  //       scene.add(accessibilityHex);
  //       resolve();
  //     } catch (error) {
  //       reject(`Error in drawAccessibility: ${error.message}`);
  //     }
  //   });
  // }
    
  // Utility function to determine color based on access composite property ContourMax
  // function getColorFromContour(contourMax) {
  //   // Example gradient: blue (low) to red (high)
  //   const lowValueColor = 0x0000FF; // Blue
  //   const highValueColor = 0xFF0000; // Red
  //   const minValue = 0;
  //   const maxValue = 14; 
  
  //   // Normalize ContourMax value between 0 and 1
  //   const normalizedValue = (contourMax - minValue) / (maxValue - minValue);
  
  //   // Calculate intermediate color
  //   const color = interpolateColors(lowValueColor, highValueColor, normalizedValue);
  //   return color;
  // }
  
  // // Interpolate between two colors based on a factor (0 to 1)
  // function interpolateColors(color1, color2, factor) {
  //   const r1 = (color1 >> 16) & 0xFF;
  //   const g1 = (color1 >> 8) & 0xFF;
  //   const b1 = color1 & 0xFF;
    
  //   const r2 = (color2 >> 16) & 0xFF;
  //   const g2 = (color2 >> 8) & 0xFF;
  //   const b2 = color2 & 0xFF;
    
  //   const r = Math.round(r1 + (r2 - r1) * factor);
  //   const g = Math.round(g1 + (g2 - g1) * factor);
  //   const b = Math.round(b1 + (b2 - b1) * factor);
    
  //   return (r << 16) | (g << 8) | b;
  // }
    

  // Function to visualize bounding box from GeoJSON
  function visualizeBoundingBoxGeoJSON(geojson) {
    return new Promise((resolve, reject) => {
      try {
        const material = new THREE.MeshBasicMaterial({
          color: colorScheme.boundingBoxColor, // Use the existing color scheme
          wireframe: false,
          transparent: true,
          opacity: 0.1,
          side: THREE.FrontSide // Render both sides of the polygon
        }); // bounding box color

        geojson.features.forEach((feature) => {
          // Handle MultiLineString
          if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates.forEach((lineString) => {
              const geometry = new THREE.BufferGeometry();
              const vertices = [];

              lineString.forEach((coord) => {
                const [lon, lat] = coord;
                const [x, y] = toStatePlane(lon, lat);
                const z = zScale * 20;
                vertices.push(new THREE.Vector3(x, y, z));
              });

              geometry.setFromPoints(vertices);
              const line = new THREE.Line(geometry, material);
              scene.add(line);
              analysisArea.add(line);
            });
          }
          // Handle MultiPolygon
          else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon.forEach((linearRing) => {
                const geometry = new THREE.BufferGeometry();
                const vertices = [];
                console.log("here?")

                linearRing.forEach((coord) => {
                  const [lon, lat] = coord;
                  const [x, y] = toStatePlane(lon, lat);
                  const z = zScale * 20;
                  vertices.push(new THREE.Vector3(x, y, z));
                });

                // Close the loop for each linear ring
                if (linearRing.length > 2) {
                  const [lon, lat] = linearRing[0];
                  const [x, y] = toStatePlane(lon, lat);
                  const z = zScale * 20;
                  vertices.push(new THREE.Vector3(x, y, z));
                }

                geometry.setFromPoints(vertices);
                const line = new THREE.Mesh(geometry, material);
                scene.add(line);
                analysisArea.add(line);
              });
            });
          }
          if (feature.geometry.type === 'Polygon') {
            // Create a flat array of vertex coordinates for Earcut
            const vertices = [];
            const holes = []; //useful for polygons with holes
            feature.geometry.coordinates[0].forEach(coord => {
              const [lon, lat] = coord;
              const [x, y] = toStatePlane(lon, lat); // Assuming this function returns planar coordinates suitable for your application
              vertices.push(x, y); // Earcut expects a flat array of coordinates
            });

            // Use Earcut to triangulate the vertices. No holes in this case, so the second argument is null.
            const indices = Earcut.triangulate(vertices, null, 2);

            const positionAttribute = new THREE.Float32BufferAttribute(vertices, 2);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', positionAttribute);

            // Set the indices returned by Earcut as the element index array for the geometry
            geometry.setIndex(indices);

            // earcut is 2d only, so modify the vertex positions
            // to add a z-coordinate (which is 0 in this case)
            geometry.attributes.position.array = new Float32Array(geometry.attributes.position.array.map((value, index) => index % 3 === 2 ? 0 : value));

            const mesh = new THREE.Mesh(geometry, material);

            scene.add(mesh);
            analysisArea.add(mesh);
            }    
          });
            scene.add(analysisArea);
            resolve(); // Resolve the promise when done
          } catch (error) {
            reject(`Error in visualizeBoundingBoxGeoJSON: ${error.message}`);
          }
        });
      }
      
  // Function to visualize bounding box from GeoJSON
  function addCoastline(geojson) {
    return new Promise((resolve, reject) => {
      try {
        const material = new THREE.LineBasicMaterial({
          color: colorScheme.coastlineColor,
        }); // bounding box color

        geojson.features.forEach((feature) => {
          // Handle MultiLineString
          if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates.forEach((lineString) => {
              const geometry = new THREE.BufferGeometry();
              const vertices = [];

              lineString.forEach((coord) => {
                const [lon, lat] = coord;
                const [x, y] = toStatePlane(lon, lat);
                const z = zScale * 20;
                vertices.push(new THREE.Vector3(x, y, z));
              });

              geometry.setFromPoints(vertices);
              const line = new THREE.Line(geometry, material);
              scene.add(line);
              coastline.add(line);
            });
          }
          // Handle MultiPolygon
          else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon.forEach((linearRing) => {
                const geometry = new THREE.BufferGeometry();
                const vertices = [];

                linearRing.forEach((coord) => {
                  const [lon, lat] = coord;
                  const [x, y] = toStatePlane(lon, lat);
                  const z = zScale * 20;
                  vertices.push(new THREE.Vector3(x, y, z));
                });

                // Close the loop for each linear ring
                if (linearRing.length > 2) {
                  const [lon, lat] = linearRing[0];
                  const [x, y] = toStatePlane(lon, lat);
                  const z = zScale * 20;
                  vertices.push(new THREE.Vector3(x, y, z));
                }

                geometry.setFromPoints(vertices);
                const line = new THREE.Line(geometry, material);
                scene.add(line);
                coastline.add(line);
              });
            });
          }
          // Add handling for other geometry types if necessary
        });

        scene.add(coastline);

        resolve(); // Resolve the promise when done
      } catch (error) {
        reject(`Error in visualizeBoundingBoxGeoJSON: ${error.message}`);
      }
    });
  }


  /////////////////////////////////////////////////////
  // CHECK FOR COINCIDENT POINTS IN GEOJSON //////////

  /////////////////////////////////////////////////////
  // TEXT VISUALIZATION //////////////////////////////

  /////////////////////////////////////////////////////
  // FETCH EXTERNAL DATA /////////////////////////////

  // Fetching the contour lines GeoJSON and adding to the scene
  async function loadGeoJSONData(onCriticalDataLoaded) {
    // console.log("loading...")
    const urls = [
      'src/assets/data/elevation_contours_shaved.geojson',
      'src/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson',
      // 'src/assets/data/FmTowers_FeaturesToJSON_AOI_20231204.geojson',
      'src/assets/data/ne_50m_coastline_aoiClip.geojson',
      'src/assets/data/cellServiceCentroids_2000m_20231210.geojson',
      'src/assets/data/fm_freq_dict.json',
      'src/assets/data/FM_transmitter_sites.geojson',
      'src/assets/data/fm_contours_shaved.geojson',
      'src/assets/data/ne_50m_ocean_aoiClip.geojson',
      'src/assets/data/compositeSurface_polygon_surface.geojson',
      'src/assets/data/NYS_fullElevDEM_boundingBox.geojson',
      'src/assets/data/cellService_contours_5KM_pts_20240407.geojson',
      'src/assets/data/cellService_contours_5KM_explode_mini.geojson',
      'src/assets/data/accessService_contours_5KM_pts_20240407.geojson',
      'src/assets/data/AccessHexTesselation_lvl5_nodata.geojson',
      'src/assets/sounds/presets.json',
    ];

    let criticalDatasetsLoaded = 0;
    const criticalDatasetsCount = 3; // Set this to the number of datasets critical for initial rendering

    urls.forEach((url) => {
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          handleGeoJSONData(url, data);
          if (isCriticalDataset(url)) {
            criticalDatasetsLoaded++;
            if (criticalDatasetsLoaded === criticalDatasetsCount) {
              onCriticalDataLoaded();
            }
          }
        })
        .catch((error) => {
          console.error(`Error loading ${url}:`, error);
        });
    });
  }

  function isCriticalDataset(url) {
    // Define logic to determine if a dataset is critical for initial rendering
    // todo: this breaks if the contours aren't required up front but they take longest to load
    return url.includes('elevation') || url.includes('contour') || url.includes('presets')
  }
  

  let contourGeojsonData,
    cellTowerGeojsonData,
    fmContoursGeojsonData,
    fmTransmitterGeojsonData,
    boundingBoxGeojsonData,
    coastlineGeojsonData,
    waterPolyGeojsonData,
    cellServiceGeojsonData,
    accessibilityHexGeojsonData,
    accessibilityMeshGeojsonData,
    fmFreqDictionaryJson;

  let synthPresets = {};


  function handleGeoJSONData(url, data) {
    switch (url) {

      ////////////////// lines

      case 'src/assets/data/elevation_contours_shaved.geojson':
        contourGeojsonData = data;
        const meanElevation = calculateMeanContourElevation(data);
        // console.log(`mean elevation: ${meanElevation}`)
        addElevContourLines(data);
        break;

      case 'src/assets/data/fm_contours_shaved.geojson':
        fmContoursGeojsonData = data;
        // run on pageload with default channel 201 as filter
        addFMpropagation3D(data, 201, propagationPolygons)
        analogGroup.add(propagationPolygons)
        break;
  

      case 'src/assets/data/NYS_fullElevDEM_boundingBox.geojson':
        boundingBoxGeojsonData = data;
        getBoundingBoxOfGeoJSON(data);
        break;

      case 'src/assets/data/ne_50m_coastline_aoiClip.geojson':
        coastlineGeojsonData = data;
        addCoastline(data);
        break;

      case 'src/assets/data/cellService_contours_5KM_pts_20240407.geojson':
        cellServiceGeojsonData = data;
        addCellServiceMesh(data);
        digitalGroup.add(cellServiceMesh);
        break;

      case 'src/assets/data/accessService_contours_5KM_pts_20240407.geojson':
        accessibilityMeshGeojsonData = data;
        addAccessibilityMesh(data);
        accessGroup.add(accessibilityMesh);
        break;


      ////////////////////// polygons

      // case 'src/assets/data/AccessHexTesselation_lvl5_nodata.geojson':
      //   accessibilityHexGeojsonData = data;
      //   drawAccessibilityHex(data);
      //   accessGroup.add(accessibilityHex);
      //   break;

      //////////////////////// points

      case 'src/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson':
        cellTowerGeojsonData = data;
        addCellTowerPts(data);
        digitalGroup.add(cellTransmitterPoints);
        digitalGroup.add(cellMSTLines);
        break;


      // updated points using fm contour origins
      case 'src/assets/data/FM_transmitter_sites.geojson':
        fmTransmitterGeojsonData = data;
        addFMTowerPts(data, 201, fmTransmitterPoints)
        analogGroup.add(fmTransmitterPoints);
        break;

  
      /////////////////// raster

      case 'src/assets/data/NYS_cellTower_viewshed_20231130.jpg':
        accessibilityRaster = data;
        // loadAndPositionRaster(data);
        break;

      /////////////////////// sound

      case 'src/assets/sounds/presets.json':
        synthPresets = data;
        loadSynthPresets(data);
        break;
  
      //////////////////// ancillary

      case 'src/assets/data/ne_50m_ocean_aoiClip.geojson':
        waterPolyGeojsonData = data;
        // addWaterPoly(data);
        break;
  
      case 'src/assets/data/fm_freq_dict.json':
        fmFreqDictionaryJson = data;
        break;
  
      default:
        console.warn('Unrecognized URL:', url);
        break;
    }
  }

  function postLoadOperations() {
    const boundingBox = getBoundingBoxOfGeoJSON(boundingBoxGeojsonData);


    // Calculate center and size of bounding box
    const center = getCenterOfBoundingBox(boundingBox);
    const size = getSizeOfBoundingBox(boundingBox);

    const maxDim = Math.max(size.x, size.y);

    const geoCameraPositionLonLat = [-74.68057752571633, 42.79146513478376];

    const cameraPositionStatePlane = toStatePlane(...geoCameraPositionLonLat);

    // Adjust camera Z to be closer
    const fov = camera.fov * (Math.PI / 90);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 0.4; // reduce coefficient to move the camera closer

    camera.position.set(
      cameraPositionStatePlane[0], // x position
      cameraPositionStatePlane[1], // y position
      cameraZ
    );

    // console.log(`bounding box: ${boundingBox}`)

    // Set controls target to the center of bounding box
    controls.target.set(camera.position.x, camera.position.y, 0);

    // Ensure the camera keeps looking straight down at the target after rotation
    camera.lookAt(controls.target);

    // Apply constraints to camera and update controls
    constrainCamera(controls, boundingBox);

    initFMsliderAndContours(fmFreqDictionaryJson); // Setup slider and initial visualization

    // add grouped sub-groups
    scene.add(analogGroup, digitalGroup, accessGroup, elevContourLines);

    // console.log(`analog group: ${analogGroup}`)

    toggleMapScene(1, 'switch1'); // init fm on pageload
    toggleMapScene(1, 'switch2'); // init elev contours

    controls.update();
}
}

// Export visualizationReady for access from main.js
export { visualizationReady };
