// Import modules
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import proj4 from 'proj4';
import hull from 'convex-hull';
import Delaunator from 'delaunator';
import { GeoJSON } from 'geojson';
import { Earcut } from 'three/src/extras/Earcut.js'
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
  let cellNoServiceMesh = new THREE.Group();
  let cellYesServiceMesh = new THREE.Group();
  let analysisArea = new THREE.Group();
  let coastline = new THREE.Group();
  cellNoServiceMesh.visible = false; // Set the mesh to be invisible initially
  cellYesServiceMesh.visible = true; // Set the mesh to be invisible initially

  // downsample framerate for performance
  let clock = new THREE.Clock();
  let delta = 0;
  // N fps
  let interval = 1 / 24;


  let sliderValue = 1;  //  default value
  const sliderLength = 100;  // Assuming 10 is the maximum value of the slider
  let lastSliderValue = null;
  let globalDeltaLeftPressed = 0;
  let globalDeltaRightPressed = 0;
  let globalDeltaLeft = 0;
  let globalDeltaRight = 0;



  // Define color scheme variables
  const colorScheme = {
    graticuleColor: '#2f2f2f0b', // Bright green
    // ambientLightColor: '#404040', // Dark gray
    directionalLightColor: '#ffffff', // White
    backgroundColor: '#000000', // Black
    polygonColor: '#FF1493', // magenta
    pyramidColorFM: '#FFFF00', // magenta
    pyramidColorCellular: '#FFFF00', // neon orange
    // lowestElevationColor: "#0000ff", // Blue
    // middleElevationColor: "#00ff00", // Green
    // highestElevationColor: "#ff0000", // Red
    mstFmColor: '#FF5F1F', // yellow
    mstCellColor: '#FFFF00', // neon orange
    boundingBoxColor: '#0b0b0b',
    coastlineColor: '#303030',
    contoursLabelColor: '#00ff00',
    // cellColor: '#FFFF00', // magenta
    cellYesColor: '#FFFF00',
    cellNoColor: '#e50000',
    matchingPyramidColor: '#FFFF00',
    nonMatchingPyramidColor: '#FF1493',
    waterColor: '#303030',
  };

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
  
  // Function to calculate distance between two points in State Plane coordinates
  function distanceBetweenPoints(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function remapValues(num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }
  

  //////////////////////////////////////
  // loading screen! //////////////////

  // Three.js - Initialize the Scene
  let scene, camera, renderer, controls, pixelationFactor;
  //   let raycaster = new THREE.Raycaster();
  //   let mouse = new THREE.Vector2();
  //   let polygons = [];
  let isCameraRotating = true; // Flag to track camera rotation
  const rotationSpeed = 0.00001; // Define the speed of rotation

  // Create a material for the ray line
  const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red color for visibility
  // Create a geometry for the ray line
  const rayGeometry = new THREE.BufferGeometry();
  const rayLine = new THREE.Line(rayGeometry, rayMaterial);

  function initThreeJS() {
    scene = new THREE.Scene();
    // scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: "green" });
    // camera = new THREE.PerspectiveCamera(
    //   75,
    //   window.innerWidth / window.innerHeight,
    //   0.1,
    //   1000,
    // );
    camera = new THREE.OrthographicCamera(
    );
    camera.up.set(0, 0, 1); // Set Z as up-direction

    renderer = new THREE.WebGLRenderer({ 
      canvas: document.querySelector('#canvas'),
      antialias: false,
      precision: "lowp",
      powerPreference: "high-performance"
   });

    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(1);

    document.getElementById('gfx').appendChild(renderer.domElement);
    

    // Set initial positions - We'll update these later
    rayGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );

    // Create the line and add it to the scene
    scene.add(rayLine);
    rayLine.scale.set(1, 1, 1); // Make sure the scale is appropriate
    rayLine.material.linewidth = 2; // Increase the line width for visibility

    // Initialize MapControls
    controls = new MapControls(camera, renderer.domElement);

    // Set up the control parameters as needed for a mapping interface
    controls.screenSpacePanning = false;
    controls.enablePan = true; // Enable panning
    controls.enableRotate = true; // tilt up down
    controls.enableDamping = true; // an optional setting to give a smoother control feeling
    controls.dampingFactor = 0.05; // amount of damping (drag)


    // Set the minimum and maximum polar angles (in radians) to prevent the camera from going over the vertical
    controls.minPolarAngle = 0; // 0 radians (0 degrees) - directly above the target
    controls.maxPolarAngle = Math.PI / 6; // π/n radians (z degrees) - on the horizon
    // Set the maximum distance the camera can dolly out
    controls.maxDistance = 2; // max camera zoom out (perspective cam)
    controls.minDistance = 0.5; // min camera zoom in (perspective cam)
    controls.maxZoom = 1.7; // max camera zoom out (ortho cam)
    controls.minZoom = 0.5; // min camera zoom in (ortho cam)

    // console.log(controls.angle)

    // const audioListener = new THREE.AudioListener();
    // camera.add(audioListener);

    // const distanceToTarget = camera.position.distanceTo(controls.target);

    // let ambientLight = new THREE.AmbientLight(colorScheme.ambientLightColor);
    // scene.add(ambientLight);
    // let directionalLight = new THREE.DirectionalLight(
    //   colorScheme.directionalLightColor,
    //   0.5,
    // );
    // directionalLight.position.set(0, 1, 0);
    // scene.add(directionalLight);

    const fogNear = 2; // The starting distance of the fog (where it begins to appear)
    const fogFar = 3.5; // The ending distance of the fog (where it becomes fully opaque)

    // Adding fog to the scene
    scene.fog = new THREE.Fog(colorScheme.backgroundColor, fogNear, fogFar);

    // Adjust the camera's far plane
    camera.far = fogFar;
            
    camera.updateProjectionMatrix();



    renderer.setClearColor(colorScheme.backgroundColor);
    window.addEventListener('resize', onWindowResize, false);
    adjustCameraZoom();
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // CAMERA CONTROLS /////////////////////////////
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Update camera aspect ratio and renderer size
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    // update this value to alter pixel ratio scaled with the screen
    pixelationFactor = 0.3;

    // Calculate new dimensions based on the value
    var newWidth = Math.max(1, window.innerWidth * pixelationFactor);
    var newHeight = Math.max(1, window.innerHeight * pixelationFactor);


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
      const minFov = 90;
      const maxFov = 60;

      // Map the window width to the FOV range
      const scale = (window.innerWidth - minWidth) / (maxWidth - minWidth);
      const fov = minFov + (maxFov - minFov) * Math.max(0, Math.min(1, scale));

      camera.fov = fov;
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
    
  
  ////////////
  /////////// mouseover intersection raycasting stuff here
  ////////////////////////////////

  // Function to animate your scene
  function animate() {
    delta += clock.getDelta();

    if (delta  > interval) {
      // checkIntersection(); // Check for mouse-polygon intersection
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
        }
      }
      // Log camera distance from xyz
      // logCameraDistance();

      // updateDashSizeForZoom(); 
      updatefmContourGroups();

      adjustMeshVisibilityBasedOnCameraDistance();


      // console.log(`Camera X: ${camera.position.x}, Camera Y: ${camera.position.y}, Camera Z: ${camera.position.z}`);

    
      // The draw or time dependent code are here
      renderer.render(scene, camera);

      delta = delta % interval;
    }
    requestAnimationFrame(animate);
  }

  function initWebSocketConnection() {
    const ws = new WebSocket('ws://localhost:8080');
  
    ws.onopen = function() {
      console.log('Connected to WebSocket server');
    };
  
    ws.onmessage = function(event) {

      // hide mouse cursor if/when data is received
      document.body.style.cursor = 'none';

      const data = JSON.parse(event.data);
      // console.log('Data received from server:', data);
  
      if (data.potValue !== undefined && !isDragging) {
        const scaledValue = Math.round(remapValues(data.potValue, 201, 300, 300, 201));
        const slider = document.getElementById('fm-channel-slider');
        slider.value = scaledValue; // Programmatically update slider value
        updateLabelPosition(scaledValue); 
        updateDisplays(scaledValue);
      }

      if (data.deltaLeft !== undefined && data.deltaRight !== undefined) {
        globalDeltaLeft = data.deltaLeft;
        globalDeltaRight = data.deltaRight;
      }


      if (data.deltaLeftPressed !== undefined && data.deltaRightPressed !== undefined) {
        globalDeltaLeftPressed = data.deltaLeftPressed;
        globalDeltaRightPressed = data.deltaRightPressed;
      }

    };
  
    ws.onerror = function(event) {
      console.error('WebSocket error:', event);
    };
  
    // other handlers if necessary
  }
  


  // Function to initialize the scene and other components
  async function initialize() {
    initThreeJS(); // Initialize Three.js

    // Initialize pixelationFactor
    pixelationFactor = 1;

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

      cellNoServiceMesh.visible = distanceToTarget <= threshold;
      cellYesServiceMesh.visible = distanceToTarget <= threshold;
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
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Function to process each coordinate pair
    const processCoordinates = (coords) => {
      coords.forEach((coord) => {
        // If it's a MultiLineString, coord will be an array of coordinate pairs
        if (Array.isArray(coord[0])) {
          processCoordinates(coord); // Recursive call for arrays of coordinates
        } else {
          // Assuming coord is [longitude, latitude]
          const [lon, lat] = coord;

          // Transform the coordinates
          const [x, y] = toStatePlane(lon, lat);

          // Update the min and max values
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      });
    };

    // Iterate over each feature
    geojson.features.forEach((feature) => {
      processCoordinates(feature.geometry.coordinates);
    });

    // Return bounding box with min and max as THREE.Vector3 objects
    return {
      min: new THREE.Vector3(minX - 2, minY - 2, -Infinity),
      max: new THREE.Vector3(maxX + 2, maxY + 2, Infinity),
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
  const zScale = 0.00025; // Change this value to scale the elevation up or down
  // const zScale = 0.0005; // Change this value to scale the elevation up or down

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
        let minOpacity = 0.333;
        let maxOpacity = .666;
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
          alphaHash: true,
          opacity: opacity,
        });


        // let material = new THREE.LineBasicMaterial({ 
        //   color: color,
        //   transparent: true,
        //   opacity: opacity,
        //   dashSize: .5,
        //   gapSize: .25,
        // });
  
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
        scene.add(elevContourLines); // Add the group to the scene
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

    
  function addCellNoServiceMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        // Reset/clear the group to avoid adding duplicate meshes
        cellNoServiceMesh.clear();

        // Downsample and group points by 'group_ID'
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const groupId = feature.properties.Group_ID;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat); // Project to State Plane
          const z = feature.properties.Z * zScale; // Apply Z scaling

          if (!groups[groupId]) {
            groups[groupId] = [];
          }
          groups[groupId].push(new THREE.Vector3(x, y, z));
        }

        // Process each group separately and create meshes
        Object.keys(groups).forEach((groupId) => {
          const pointsForDelaunay = groups[groupId];

          var delaunay = Delaunator.from(
            pointsForDelaunay.map((p) => [p.x, p.y]),
          );
          var meshIndex = [];
          const thresholdDistance = 0.125; // Set your distance threshold here

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

          // Solid fill material (black fill)
          const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000, // Black color for the fill
            transparent: false,
            // opacity: 0.75, // Adjust opacity as needed
            // alphaHash: true,
            side: THREE.DoubleSide, //
          });

          // Wireframe material
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: colorScheme.cellNoColor, // Use your existing color scheme
            transparent: true,
            alphaHash: true,
            opacity: 0.6,
            wireframe: true,
            side: THREE.FrontSide,
          });

          // Create mesh with the fill material
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          fillMesh.name = 'fillMesh-' + groupId;

          // Create mesh with the wireframe material
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
          wireframeMesh.name = 'wireframeMesh-' + groupId;

          // Group to hold both meshes
          var group = new THREE.Group();
          // group.add(fillMesh);
          group.add(wireframeMesh);

          // Add the group to the cellNoServiceMesh group
          cellNoServiceMesh.add(group);
        });

        // Add the cellNoServiceMesh group to the scene
        scene.add(cellNoServiceMesh);

        // Set the initial visibility of the cell service mesh layer to false
        cellNoServiceMesh.visible = false;

        resolve(cellNoServiceMesh); // Optionally return the group for further manipulation
      } catch (error) {
        reject(`Error in addCellNoServiceMesh: ${error.message}`);
      }
    });
  }

   
  function addCellYesServiceMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        // Reset/clear the group to avoid adding duplicate meshes
        cellYesServiceMesh.clear();

        // Downsample and group points by 'group_ID'
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const groupId = feature.properties.Group_ID;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat); // Project to State Plane
          const z = feature.properties.Z * zScale; // Apply Z scaling

          if (!groups[groupId]) {
            groups[groupId] = [];
          }
          groups[groupId].push(new THREE.Vector3(x, y, z));
        }

        // Process each group separately and create meshes
        Object.keys(groups).forEach((groupId) => {
          const pointsForDelaunay = groups[groupId];

          var delaunay = Delaunator.from(
            pointsForDelaunay.map((p) => [p.x, p.y]),
          );
          var meshIndex = [];
          const thresholdDistance = 0.125; // Set your distance threshold here

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

          // Solid fill material (black fill)
          const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000, // Black color for the fill
            transparent: false,
            // opacity: 0.75, // Adjust opacity as needed
            // alphaHash: true,
            side: THREE.DoubleSide, //
          });

          // Wireframe material
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: colorScheme.cellYesColor, // Use your existing color scheme
            transparent: true,
            alphaHash: true,
            opacity: 0.6,
            wireframe: true,
            side: THREE.FrontSide,
          });

          // Create mesh with the fill material
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          fillMesh.name = 'fillMesh-' + groupId;

          // Create mesh with the wireframe material
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
          wireframeMesh.name = 'wireframeMesh-' + groupId;

          // Group to hold both meshes
          var group = new THREE.Group();
          // group.add(fillMesh);
          group.add(wireframeMesh);

          // Add the group to the cellYesServiceMesh group
          cellYesServiceMesh.add(group);
        });

        // Add the cellYesServiceMesh group to the scene
        scene.add(cellYesServiceMesh);

        // Set the initial visibility of the cell service mesh layer to false
        cellYesServiceMesh.visible = false;

        resolve(cellYesServiceMesh); // Optionally return the group for further manipulation
      } catch (error) {
        reject(`Error in addCellYesServiceMesh: ${error.message}`);
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
            group.opacity = Math.max(group.opacity, 0); // Ensure opacity doesn't drop below 0
            group.meshes.forEach(mesh => {
                mesh.material.opacity = group.opacity;
                mesh.visible = group.opacity > 0; // Only visible if opacity is above 0
            });

            if (group.opacity <= 0) {
                group.meshes.forEach(mesh => scene.remove(mesh));
                delete fmContourGroups[groupId]; // Fully remove the group once it's invisible
            }
          } else {
            group.meshes.forEach(mesh => {
                mesh.visible = true; // Make sure the mesh is visible if not decaying
                // mesh.material.opacity = 1; // Reset opacity for visibility
            });
        }
    });
}

// Function to add FM propagation 3D line loops
function addFMpropagation3D(geojson, channelFilter, stride = 1) {
    return new Promise((resolve, reject) => {
        // Existing groups not matching the current channelFilter are marked for decay
        Object.keys(fmContourGroups).forEach(groupId => {
            if (groupId !== channelFilter.toString()) {
                fmContourGroups[groupId].isDecaying = true;
                fmContourGroups[groupId].decayRate = 0.2; // Adjust decay rate as needed
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
                // dashSize: zoomLevels[1].dashSize,
                // gapSize: zoomLevels[1].gapSize,          
            });

            const vertices = feature.geometry.coordinates[0].map(coord => {
                const [x, y] = toStatePlane(coord[0], coord[1]);
                // const z = elevationData[featureIndex] * zScale
                const z = elevationData[Math.abs(featureIndex)] * zScale;
                return new THREE.Vector3(x, y, z);
            });

            const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
            const lineLoop = new THREE.Line(geometry, material);
            lineLoop.computeLineDistances();

            // Determine the group ID from the key
            const groupId = feature.properties.key.split('_')[0];
            if (!fmContourGroups[groupId]) {
                fmContourGroups[groupId] = {
                    meshes: [],
                    opacity: 1.0, // Initial opacity
                    isDecaying: false, // No decay initially
                    decayRate: 0.2 // Decay rate when applicable
                };
            }
            fmContourGroups[groupId].meshes.push(lineLoop);
            scene.add(lineLoop);
        });

        resolve();
    });
}

async function addFMTowerPts(geojson, channelFilter) {
  try {
    // Define the base size, height, and characteristics for the pyramids
    const baseSizeMatching = 0.008;
    const pyramidHeightMatching = 0.03;
    const baseSizeNonMatching = baseSizeMatching * 0.5;
    const pyramidHeightNonMatching = pyramidHeightMatching * 0.5;

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
    fmTransmitterPoints.visible = true;
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
        const baseSize = 0.003; // This would be the size of one side of the pyramid's base
        const pyramidHeight = 0.015; // This would be the height of the pyramid from the base to the tip

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
            const elevation = feature.properties.Z;

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

              // Add the pyramid to the cellTransmitterPoints group
              cellTransmitterPoints.add(pyramid);
              cellTransmitterPoints.visible = false;

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
            0.00025,
            0.00075,
            cellMSTLines,
          );
        }
        // add groups to scene
        scene.add(cellTransmitterPoints);
        scene.add(cellMSTLines);
        cellMSTLines.visible = false;

        resolve(); // Resolve the promise when done
      } catch (error) {
        reject(`Error in addCellTowerPts: ${error.message}`);
      }
    });
  }


  //////////////////////
  ///////// slider stuff


  let lastChannelValue = null; // For tracking significant channel value changes
  let debounceTimer = null; // For debouncing updates to the display
  
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
        const display = document.getElementById('fm-channel-display');
        const frequencyLabel = document.getElementById('fm-frequency-display');
        const frequencyText = channelFrequencies[Math.round(channelValue).toString()] || "Frequency not found";
  
        display.textContent = `FM channel: ${Math.round(channelValue)}`;
        frequencyLabel.textContent = frequencyText;
        if (fmContoursGeojsonData && fmTransmitterGeojsonData) {
          updateVisualizationWithChannelFilter(fmContoursGeojsonData, fmTransmitterGeojsonData, channelValue);
          lastChannelValue = channelValue; // Update lastChannelValue
        }
      }
    }, 20); // Delay for debouncing
  }
  
  function initFMsliderAndContours(frequencyData) {
    channelFrequencies = frequencyData;
  
    const slider = document.getElementById('fm-channel-slider');
    // No need to setup another debouncing here as `updateDisplays` is already debounced
    slider.addEventListener('input', function() {
      const channelValue = Math.round(parseInt(this.value, 10));
      updateDisplays(channelValue);
    });
    
    // Initial update based on the slider's default value
    const initialChannelValue = Math.round(parseInt(slider.value, 10));
    updateDisplays(initialChannelValue);
  }
  
  function updateVisualizationWithChannelFilter(fmContoursGeojsonData, towerGeojsonData, channelFilter) {
    if (!fmContoursGeojsonData || !towerGeojsonData) {
      console.warn("GeoJSON data not available.");
      return;
    }
  
    addFMpropagation3D(fmContoursGeojsonData, channelFilter)
      .catch(error => console.error("Failed to update contour channel:", error));
  
    addFMTowerPts(towerGeojsonData, channelFilter)
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

  // Function to visualize bounding box from GeoJSON
  function visualizeBoundingBoxGeoJSON(geojson) {
    return new Promise((resolve, reject) => {
      try {
        const material = new THREE.MeshBasicMaterial({
          color: colorScheme.boundingBoxColor, // Use the existing color scheme
          wireframe: true,
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
            const holes = []; // This will remain empty in this example but is useful for polygons with holes
            feature.geometry.coordinates[0].forEach(coord => {
              const [lon, lat] = coord;
              const [x, y] = toStatePlane(lon, lat); // Assuming this function returns planar coordinates suitable for your application
              vertices.push(x, y); // Earcut expects a flat array of coordinates
            });

            // Use Earcut to triangulate the vertices. No holes in this case, so the second argument is null.
            const indices = Earcut.triangulate(vertices, null, 2);

            // Convert vertices array to a THREE.BufferAttribute for positions
            const positionAttribute = new THREE.Float32BufferAttribute(vertices, 2);

            // Create a BufferGeometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', positionAttribute);

            // Set the indices returned by Earcut as the element index array for the geometry
            geometry.setIndex(indices);

            // Since we're working in 2D (x, y) and Earcut works with 2D data, we need to modify the vertex positions
            // to add a z-coordinate (which is 0 in this case)
            geometry.attributes.position.array = new Float32Array(geometry.attributes.position.array.map((value, index) => index % 3 === 2 ? 0 : value));

            // Create the mesh with the material
            const mesh = new THREE.Mesh(geometry, material);

            // Add the mesh to your scene or analysis area
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
      'src/assets/data/CellYesService_points_2000m_20240403.geojson',
      'src/assets/data/ne_50m_ocean_aoiClip.geojson',
      'src/assets/data/NYS_fullElevDEM_boundingBox.geojson'
    ];

    let criticalDatasetsLoaded = 0;
    const criticalDatasetsCount = 2; // Set this to the number of datasets critical for initial rendering

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
    return url.includes('elevation') || url.includes('contour');
  }
  

  let contourGeojsonData,
    cellTowerGeojsonData,
    fmContoursGeojsonData,
    fmTransmitterGeojsonData,
    boundingBoxGeojsonData,
    coastlineGeojsonData,
    waterPolyGeojsonData,
    cellNoServiceGeojsonData,
    cellYesServiceGeojsonData,
    fmFreqDictionaryJson;

  function handleGeoJSONData(url, data) {
    switch (url) {
      case 'src/assets/data/elevation_contours_shaved.geojson':
        contourGeojsonData = data;
        const meanElevation = calculateMeanContourElevation(data);
        // console.log(`mean elevation: ${meanElevation}`)
        addElevContourLines(data);
        break;

      case 'src/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson':
        cellTowerGeojsonData = data;
        addCellTowerPts(data);
        break;

      case 'src/assets/data/fm_contours_shaved.geojson':
        fmContoursGeojsonData = data;
        // addFMpropagation3D(data); don't need this here i guess?
        break;

      case 'src/assets/data/FmTowers_FeaturesToJSON_AOI_20231204.geojson':
        fmTransmitterGeojsonData = data;
        addFMTowerPts(data);
        break;

      // updated points using fm contour origins
      case 'src/assets/data/FM_transmitter_sites.geojson':
        fmTransmitterGeojsonData = data;
        addFMTowerPts(data);
        break;

      case 'src/assets/data/NYS_fullElevDEM_boundingBox.geojson':
        boundingBoxGeojsonData = data;
        visualizeBoundingBoxGeoJSON(data);
        break;

      case 'src/assets/data/ne_50m_coastline_aoiClip.geojson':
        coastlineGeojsonData = data;
        addCoastline(data);
        break;

      case 'src/assets/data/NYS_cellTower_viewshed_20231130.jpg':
        viewshedJPG = data;
        // loadAndPositionRaster(data);
        break;

      case 'src/assets/data/cellServiceCentroids_2000m_20231210.geojson':
        cellNoServiceGeojsonData = data;
        // addCellNoServiceMesh(data);
        break;

      case 'src/assets/data/CellYesService_points_2000m_20240403.geojson':
        cellYesServiceGeojsonData = data;
        // addCellYesServiceMesh(data);
        break;  

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
    const boundingBox = getBoundingBoxOfGeoJSON(contourGeojsonData);

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

    // Set controls target to the center of bounding box
    controls.target.set(camera.position.x, camera.position.y, 0);

    // Ensure the camera keeps looking straight down at the target after rotation
    camera.lookAt(controls.target);

    // Apply constraints to camera and update controls
    constrainCamera(controls, boundingBox);

    initFMsliderAndContours(fmFreqDictionaryJson); // Setup slider and initial visualization

    controls.update();
}
}

// Export visualizationReady for access from main.js
export { visualizationReady };
