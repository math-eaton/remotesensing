// Import modules
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import proj4 from 'proj4';
import hull from 'convex-hull';
import Delaunator from 'delaunator';
import { GeoJSON } from 'geojson';
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
  let cellServiceMesh = new THREE.Group();
  let analysisArea = new THREE.Group();
  cellServiceMesh.visible = false; // Set the mesh to be invisible initially

  // Define color scheme variables
  const colorScheme = {
    graticuleColor: '#2f2f2f0b', // Bright green
    ambientLightColor: '#404040', // Dark gray
    directionalLightColor: '#ffffff', // White
    backgroundColor: '#000000', // Black
    polygonColor: '#FF1493', // magenta
    pyramidColorFM: '#FF5F1F', // Yellow
    pyramidColorCellular: '#FFFF00', // neon orange
    // lowestElevationColor: "#0000ff", // Blue
    // middleElevationColor: "#00ff00", // Green
    // highestElevationColor: "#ff0000", // Red
    mstFmColor: '#FF5F1F', // yellow
    mstCellColor: '#FFFF00', // neon orange
    boundingBoxColor: '#303030',
    contoursLabelColor: '#00ff00',
    cellColor: '#FF1493', // magenta
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
    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.up.set(0, 0, 1); // Set Z as up-direction

    // Create the renderer first
    renderer = new THREE.WebGLRenderer({ antialias: false });

    // var lowResScale = .01; // Adjust this for more or less resolution (lower value = lower resolution)

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

    // camera.up.set(0, 0, 1); 


    // Set the minimum and maximum polar angles (in radians) to prevent the camera from going over the vertical
    controls.minPolarAngle = 0; // 0 radians (0 degrees) - directly above the target
    controls.maxPolarAngle = Math.PI / 6; // π/n radians (z degrees) - on the horizon
    // Set the maximum distance the camera can dolly out
    controls.maxDistance = 2.5; // max camera zoom
    controls.minDistance = 0.4; // min camera zoom
    // console.log(controls.angle)

    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    // const distanceToTarget = camera.position.distanceTo(controls.target);

    let ambientLight = new THREE.AmbientLight(colorScheme.ambientLightColor);
    scene.add(ambientLight);
    let directionalLight = new THREE.DirectionalLight(
      colorScheme.directionalLightColor,
      0.5,
    );
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    const fogNear = 2; // The starting distance of the fog (where it begins to appear)
    const fogFar = 9; // The ending distance of the fog (where it becomes fully opaque)

    // Adding fog to the scene
    scene.fog = new THREE.Fog(colorScheme.backgroundColor, fogNear, fogFar);

    // Adjust the camera's far plane
    camera.far = fogFar;
    camera.updateProjectionMatrix();

    renderer.setClearColor(colorScheme.backgroundColor);
    window.addEventListener('resize', onWindowResize, false);
    adjustCameraZoom();
  }

  ////////////////////
  /////////// DOM stuff event listener resolution display stuff bye bye
  ////////////////
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
    pixelationFactor = 0.5;

    // Calculate new dimensions based on the slider value
    var newWidth = Math.max(1, window.innerWidth * pixelationFactor);
    var newHeight = Math.max(1, window.innerHeight * pixelationFactor);


    if (renderer && camera) {
      renderer.setSize(newWidth, newHeight, false);
      renderer.setPixelRatio(1);

      // Update camera aspect ratio and projection matrix
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    }

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

  ////////////
  /////////// mouseover intersection raycasting stuff here
  ////////////////////////////////

  // Function to animate your scene
  function animate() {
    requestAnimationFrame(animate);
    // checkIntersection(); // Check for mouse-polygon intersection
    controls.update();
    // Rotate the camera if isCameraRotating is true
    // Check if camera and controls are initialized
    if (camera && controls) {
      if (isCameraRotating) {
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

        // Ensure the camera keeps looking at the target
        camera.lookAt(controls.target);
      }
    }
    // Log camera distance from xyz
    // logCameraDistance();

    updateDashSizeForZoom(); 

    adjustMeshVisibilityBasedOnCameraDistance();
    renderer.render(scene, camera);
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
      enableInteraction(); // Directly enable interaction without waiting for a button click
      // document.getElementById('progress-bar').style.display = 'none'; // Hide the progress bar
    });
  }

  function enableInteraction() {
    const threeContainer = document.getElementById('gfx');

    // Render the scene once before making it visible
    renderer.render(scene, camera);

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
    { threshold: 0.4, dashSize: dashSize / 2, gapSize: gapSize / 8 }, // Closest zoom
    { threshold: 0.5, dashSize: dashSize * .8, gapSize: gapSize * .4},
    { threshold: 1.5, dashSize: dashSize / 5, gapSize: gapSize / 4},
    // { threshold: 2, dashSize: dashSize, gapSize: gapSize }, // Farthest zoom
  ];
  
    let currentZoomLevelIndex = -1; // Index of the currently applied zoom level

    function updateDashSizeForZoom() {
      const distanceToTarget = camera.position.distanceTo(controls.target);
      // console.log(distanceToTarget)
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
        // Update all line loops with the new dash and gap sizes
        lineLoops.forEach((lineLoop) => {
          if (lineLoop.material instanceof THREE.LineDashedMaterial) {
            lineLoop.material.dashSize = selectedZoomLevel.dashSize;
            lineLoop.material.gapSize = selectedZoomLevel.gapSize;
            lineLoop.material.needsUpdate = true;
            lineLoop.computeLineDistances();
          }
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
  
    console.log(`Min Elevation: ${minElevation}, Max Elevation: ${maxElevation}, Mean Elevation: ${meanElevation}`);
  
    return meanElevation;
  }
  

  // Define a variable to store the minimum elevation
  // This should be determined from the addElevContourLines function
  let globalMinElevation = Infinity;
  let meanElevation = Infinity + 1;

  function addElevContourLines(geojson) {
    return new Promise((resolve, reject) => {
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
  
      geojson.features.forEach((feature, index) => {
        const contour = feature.properties.contour;
        const coordinates = feature.geometry.coordinates; // Array of [lon, lat] pairs
        const color = getColorForElevation(contour, minElevation, maxElevation);
  
        // Calculate logarithmic opacity scaling
        let minOpacity = 0.01;
        let maxOpacity = 0.4;
        let scaleExponent = 0.1; // Adjust this to control the rate of change

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


        // let material = new THREE.LineDashedMaterial({ 
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
    
  function addCellServiceMesh(geojson, stride = 3) {
    return new Promise((resolve, reject) => {
      try {
        // Reset/clear the group to avoid adding duplicate meshes
        cellServiceMesh.clear();

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
            color: colorScheme.cellColor, // Use your existing color scheme
            transparent: true,
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

          // Add the group to the cellServiceMesh group
          cellServiceMesh.add(group);
        });

        // Add the cellServiceMesh group to the scene
        scene.add(cellServiceMesh);

        // Set the initial visibility of the cell service mesh layer to false
        cellServiceMesh.visible = false;

        resolve(cellServiceMesh); // Optionally return the group for further manipulation
      } catch (error) {
        reject(`Error in addCellServiceMesh: ${error.message}`);
      }
    });
  }

  // original radiating triangle fill polys
  // function addFilledPolygons(geojson, stride = 10) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       for (let i = 0; i < geojson.features.length; i += stride) {
  //         const feature = geojson.features[i];

  //         // Create a new material for each polygon
  //         const material = new THREE.MeshBasicMaterial({
  //           color: colorScheme.polygonColor,
  //           transparent: true,
  //           wireframe: true,
  //           dithering: true,
  //           opacity: 0.8, // Start with lower opacity
  //           side: THREE.FrontSide,
  //         });

  //         try {
  //           const shapeCoords = feature.geometry.coordinates[0]; // Assuming no holes in the polygon for simplicity
  //           const vertices = [];
  //           let centroid = new THREE.Vector3(0, 0, 0);

  //           // Convert coordinates to vertices and calculate centroid
  //           shapeCoords.forEach((coord) => {
  //             const [x, y] = toStatePlane(coord[0], coord[1]);
  //             const z = meanElevation * zScale; // Set Z to the lowest contour elevation
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
  //           propagationPolygons.add(mesh);
  //         } catch (error) {
  //           console.error(`Error processing feature at index ${i}:`, error);
  //         }
  //       }
  //       // Add the propagationPolygons group to the scene
  //       scene.add(propagationPolygons);

  //       // Set the initial visibility of the fm propagation curves layer to false
  //       propagationPolygons.visible = false;

  //       resolve(); // Resolve the promise when done
  //     } catch (error) {
  //       reject(`Error in addPolygons: ${error.message}`);
  //     }
  //   });
  // }


  // function addPolygons(geojson, stride = 5) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       for (let i = 0; i < geojson.features.length; i += stride) {
  //         const feature = geojson.features[i];
  
  //         // Create a new material for the outline
  //         const material = new THREE.LineBasicMaterial({
  //           color: colorScheme.polygonColor, // Adjust the color as needed
  //           transparent: false,
  //           opacity: 0.8, // Adjust opacity as needed
  //         });
  
  //         try {
  //           const shapeCoords = feature.geometry.coordinates[0]; // Assuming no holes in the polygon for simplicity
  //           // console.log(shapeCoords)
  //           const vertices = [];
  
  //           // Convert coordinates to vertices
  //           shapeCoords.forEach((coord) => {
  //             const [x, y] = toStatePlane(coord[0], coord[1]);
  //             let meanElevation = calculateMeanContourElevation(geojson);
  //             let z = meanElevation * zScale; // Default Z value if not provided
  //             console.log(z)
              
  //             // If there's a third element (elevation), and it's not null, use it
  //             if (coord.length > 2 && coord[2] != null) {
  //                 z = coord[2];
  //             }
              
  //             vertices.push(new THREE.Vector3(x, y, z));
  //         });
            
  //           // Create a geometry and add vertices to it
  //           const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  
  //           // Create a line loop with the geometry and material
  //           const lineLoop = new THREE.LineLoop(geometry, material);
  //           lineLoop.name = 'polygon-' + i;
  //           scene.add(lineLoop);
  //           propagationPolygons.add(lineLoop);
  //         } catch (error) {
  //           // console.error(`Error processing feature at index ${i}:`, error);
  //         }
  //       }
  //       // Add the propagationPolygons group to the scene
  //       scene.add(propagationPolygons);
  //       // console.log(propagationPolygons)
  
  //       // Set the initial visibility of the fm propagation curves layer to false
  //       propagationPolygons.visible = false;
  
  //       resolve(); // Resolve the promise when done
  //     } catch (error) {
  //       // reject(`Error in addPolygons: ${error.message}`);
  //     }
  //   });
  // }
  

  let lineLoops = [];

  // this version is static rescaling of concentric lines based on input geojson + dynamic transparency based on concentric line
  function addFMpropagation3D(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        // Extract all indices from the keys to determine the range
        const indices = geojson.features.map(feature => {
          const keyParts = feature.properties.key.split('_');
          console.log(keyParts)
          return parseInt(keyParts[keyParts.length - 1], 5);
        });
        const maxIndex = Math.max(...indices);
        const maxOpacity = 1.00; 
        const minOpacity = 0.25; 
        const opacityRange = maxOpacity - minOpacity;
  
        // Iterate over each feature in the GeoJSON
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          
          // Filter by channel property (only process features with channel = 201) ... currently assuming channel is a string
          if (feature.properties.channel !== "201") {
            continue; // Skip this feature if its channel is not 201
          }
  
          const elevationData = feature.properties.elevation_data;
          
          // Ensure there is a matching number of elevation points to coordinate pairs
          if (!elevationData || elevationData.length !== feature.geometry.coordinates[0].length) {
            console.error(`Elevation data length does not match coordinates length for feature at index ${i}`);
            continue; // Skip this feature
          }
  
          // Default opacity to the median of the range if all indices are the same (maxIndex is 0)
          let opacity;
          if (maxIndex === 0) {
            opacity = minOpacity + (opacityRange / 2); // Midpoint of opacity range
          } else {
            const featureIndex = parseInt(feature.properties.key.split('_')[1], 10);
            // Scale opacity based on feature index
            // opacity = minOpacity + (opacityRange * (maxIndex - featureIndex) / maxIndex);
            opacity = maxOpacity - (opacityRange * featureIndex / maxIndex);
          }
  
          // dashed lines for fun
          const material = new THREE.LineDashedMaterial({
            color: colorScheme.polygonColor,
            transparent: true,
            alphaHash: true,
            opacity: opacity,
            dashSize: dashSize * .8,
            gapSize: gapSize * .4,          
          });
  
          const shapeCoords = feature.geometry.coordinates[0];
          const vertices = [];
  
          // Convert coordinates to 3D vertices, incorporating elevation data
          shapeCoords.forEach((coord, index) => {
            const [x, y] = toStatePlane(coord[0], coord[1]);
            const z = elevationData[index] * zScale; // Use the corresponding elevation data for Z value
            vertices.push(new THREE.Vector3(x, y, z));
          });
  
          // Create a geometry and add vertices to it
          const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  
          // Create a line loop with the geometry and material
          const lineLoop = new THREE.LineLoop(geometry, material);
          lineLoop.name = `propagation-${feature.properties.key}`;
          lineLoop.computeLineDistances();
          scene.add(lineLoop);
          
          // Add the line loop to the array for later access
          lineLoops.push(lineLoop); 
        }
  
        resolve(); // Resolve the promise when all features have been processed
      } catch (error) {
        reject(`Error in addFMpropagation3D: ${error.message}`);
      }
    });
  }
      

  // this version is dynamic rescaling of concentric lines
  // function addFMpropagation3D(geojson, stride = 1, scaleDecrement = 0.1, numberOfConcentricCopies = 5) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       // Iterate over each feature in the GeoJSON
  //       for (let i = 0; i < geojson.features.length; i += stride) {
  //         const feature = geojson.features[i];
  //         const elevationData = feature.properties.elevation_data;
          
  //         if (!elevationData || elevationData.length !== feature.geometry.coordinates[0].length) {
  //           console.error(`Elevation data length does not match coordinates length for feature at index ${i}`);
  //           continue;
  //         }
  
  //         const material = new THREE.LineBasicMaterial({
  //           color: colorScheme.polygonColor,
  //           transparent: true,
  //           alphaHash: true,
  //           opacity: 0.6,
  //         });
  
  //         const shapeCoords = feature.geometry.coordinates[0];
  //         const vertices = [];
  //         let centroid = new THREE.Vector3(0, 0, 0);
  
  //         shapeCoords.forEach((coord, index) => {
  //           const [x, y] = toStatePlane(coord[0], coord[1]);
  //           const z = elevationData[index] * zScale;
  //           const vertex = new THREE.Vector3(x, y, z);
  //           vertices.push(vertex);
  //           centroid.add(vertex);
  //         });
  
  //         centroid.divideScalar(shapeCoords.length); // Compute centroid
  
  //         // Create original geometry
  //         const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  //         const lineLoop = new THREE.LineLoop(geometry, material);
  //         lineLoop.name = `propagation-${feature.properties.key}`;
  //         scene.add(lineLoop);
  
  //         // Generate concentric copies
  //         for (let j = 1; j <= numberOfConcentricCopies; j++) {
  //           const scaledVertices = vertices.map(vertex => {
  //             const scaledVertex = vertex.clone().sub(centroid).multiplyScalar(1 - j * scaleDecrement).add(centroid);
  //             return scaledVertex;
  //           });
  
  //           const scaledGeometry = new THREE.BufferGeometry().setFromPoints(scaledVertices);
  //           const scaledLineLoop = new THREE.LineLoop(scaledGeometry, material);
  //           scaledLineLoop.name = `propagation-${feature.properties.key}-concentric-${j}`;
  //           scene.add(scaledLineLoop);
  //         }
  //       }
  
  //       resolve();
  //     } catch (error) {
  //       reject(`Error in addFMpropagation3D: ${error.message}`);
  //     }
  //   });
  // }
  
    

  function addFMTowerPts(geojson) {
    return new Promise((resolve, reject) => {
      try {
        // Define the base size and height for the pyramids
        const baseSize = 0.003; // Size of one side of the pyramid's base
        const pyramidHeight = 0.015; // Height of the pyramid from the base to the tip

        // Material for the wireframe pyramids
        let pyramidMaterialFM = new THREE.MeshBasicMaterial({
          color: colorScheme.pyramidColorFM,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
        });

        const points = []; // Array to store points for the convex hull

        // Parse the POINT data from the GeoJSON
        geojson.features.forEach((feature) => {
          if (feature.geometry.type === 'Point') {
            const [lon, lat] = feature.geometry.coordinates;
            const elevation = feature.properties.Z;

            try {
              // Convert the lon/lat to State Plane coordinates
              const [x, y] = toStatePlane(lon, lat);
              const z = elevation * zScale; // Apply the scaling factor to the elevation

              // Check for valid coordinates before proceeding
              if (x === null || y === null || isNaN(z)) {
                console.error('Invalid point coordinates:', x, y, z);
                return; // Skip this iteration
              }

              // Create a cone geometry for the pyramid
              const pyramidGeometry = new THREE.ConeGeometry(
                baseSize,
                pyramidHeight,
                5,
              );
              pyramidGeometry.rotateX(Math.PI / 2); // Rotate the pyramid to point up along the Z-axis

              const pyramid = new THREE.Mesh(
                pyramidGeometry,
                pyramidMaterialFM,
              );
              pyramid.position.set(x, y, z);
              fmTransmitterPoints.add(pyramid);

              // Check for coincident points and get a z-offset
              const label = `fm`;
              const zOffset = 8;
              //   const zOffset = getCoincidentPointOffset(lon, lat, 8, 0.00001);
              // const zOffset = getCoincidentPointOffset(lon, lat, label, 4, 0.0001)
              // Ensure Callsign or another property is correctly referenced
              // const label = feature.properties.Callsign || `Tower ${index}`;

              const textSprite = makeTextSprite(` ${label} `, {
                fontsize: 24,
                strokeColor: 'rgba(255, 255, 255, 0.9)',
                strokeWidth: 1,

                // borderColor: { r: 255, g: 0, b: 0, a: 1.0 },
                // backgroundColor: { r: 255, g: 100, b: 100, a: 0.8 }
              });

              // Position the sprite above the pyramid
              const pyramidHeightScaled = pyramidHeight * zScale;

              // Position the sprite above the pyramid, applying the offset for coincident points
              textSprite.position.set(
                x,
                y,
                z + pyramidHeightScaled + zOffset + 0.009,
              );
              textSprite.scale.set(0.05, 0.025, 1.0);

              fmTransmitterPoints.add(textSprite);
              // console.log(`creating label for ${label}`);

              // Add the position to the points array for convex hull calculation
              points.push(new THREE.Vector3(x, y, z));
            } catch (error) {
              console.error(`Error projecting point: ${error.message}`);
            }
          } else {
            console.error(
              `Unsupported geometry type for points: ${feature.geometry.type}`,
            );
          }
        });

        // Add the FM points to the scene
        scene.add(fmTransmitterPoints);
        fmTransmitterPoints.visible = false;

        // Create and add the convex hull to the scene
        if (points.length > 0) {
          // Additional checks and functionality as needed...

          // Construct the MST
          const fmMstEdges = primsAlgorithm(points);

          // Draw the MST
          drawMSTEdges(
            fmMstEdges,
            '#FFFFFF',
            colorScheme.mstFmColor,
            0.00025,
            0.00075,
            fmMSTLines,
          );
        }

        // Add the MST lines to the scene
        scene.add(fmMSTLines);
        fmMSTLines.visible = true;
        resolve(); // Resolve the promise when done
      } catch (error) {
        console.error('Error in addFMTowerPts:', error);
        reject(`Error in addFMTowerPts: ${error.message}`);
      }
    });
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
          opacity: 0.4,
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

              const textSprite = makeTextSprite(` ${label} `, {
                fontsize: 24,
                strokeColor: 'rgba(255, 255, 255, 0.9)',
                strokeWidth: 1,

                // borderColor: { r: 255, g: 0, b: 0, a: 1.0 },
                // backgroundColor: { r: 255, g: 100, b: 100, a: 0.8 }
              });

              // Position the sprite above the pyramid
              const pyramidHeightScaled = pyramidHeight * zScale;

              // Position the sprite above the pyramid, applying the offset for coincident points
              textSprite.position.set(
                x,
                y,
                z + pyramidHeightScaled + zOffset + 0.009,
              );
              textSprite.scale.set(0.05, 0.025, 1.0);

              cellTransmitterPoints.add(textSprite); // Add the label to the cellTransmitterPoints group
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
        resolve(); // Resolve the promise when done
      } catch (error) {
        reject(`Error in addCellTowerPts: ${error.message}`);
      }
    });
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
        const material = new THREE.LineBasicMaterial({
          color: colorScheme.boundingBoxColor,
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
                analysisArea.add(line);
              });
            });
          }
          // Add handling for other geometry types if necessary
        });

        scene.add(analysisArea);

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
      'src/assets/data/colloquium_ii_data/stanford_contours_simplified1000m_20231124.geojson',
      'src/assets/data/colloquium_ii_data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson',
      'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin_processed.geojson',
      'src/assets/data/colloquium_ii_data/FmTowers_FeaturesToJSON_AOI_20231204.geojson',
      'src/assets/data/colloquium_ii_data/study_area_admin0clip.geojson',
      'src/assets/data/colloquium_ii_data/cellServiceCentroids_2000m_20231210.geojson',
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
    return url.includes('stanford_contours') || url.includes('study');
  }

  let contourGeojsonData,
    cellTowerGeojsonData,
    fmContoursGeojsonData,
    fmTransmitterGeojsonData,
    boundingBoxGeojsonData,
    cellServiceGeojsonData;

  function handleGeoJSONData(url, data) {
    switch (url) {
      case 'src/assets/data/colloquium_ii_data/stanford_contours_simplified1000m_20231124.geojson':
        contourGeojsonData = data;
        const meanElevation = calculateMeanContourElevation(data);
        addElevContourLines(data);
        break;

      case 'src/assets/data/colloquium_ii_data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson':
        cellTowerGeojsonData = data;
        addCellTowerPts(data);
        break;

      case 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin_processed.geojson':
        fmContoursGeojsonData = data;
        addFMpropagation3D(data);
        break;

      // case 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon_scaled.geojson':
      //   fmContoursGeojsonData = data;
      //   addPolygons(data);
      //   break;

      case 'src/assets/data/colloquium_ii_data/FmTowers_FeaturesToJSON_AOI_20231204.geojson':
        fmTransmitterGeojsonData = data;
        addFMTowerPts(data);
        break;

      case 'src/assets/data/colloquium_ii_data/study_area_admin0clip.geojson':
        boundingBoxGeojsonData = data;
        visualizeBoundingBoxGeoJSON(data);
        break;

      case 'src/assets/data/colloquium_ii_data/NYS_cellTower_viewshed_20231130.jpg':
        viewshedJPG = data;
        // loadAndPositionRaster(data);
        break;

      case 'src/assets/data/colloquium_ii_data/cellServiceCentroids_2000m_20231210.geojson':
        cellServiceGeojsonData = data;
        // addCellServiceMesh(data);
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

    // Adjust camera Z to be closer
    const fov = camera.fov * (Math.PI / 100);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 0.15; // Decrease this factor to move the camera closer

    // Adjust tilt angle
    const tiltAngle = THREE.MathUtils.degToRad(40); // Example: 30 degree tilt
    const distance = cameraZ; // Use the calculated camera distance
    camera.position.set(
      center.x + distance * Math.sin(tiltAngle), // x position
      center.y, // y position
      center.z + distance * Math.cos(tiltAngle), // z position (height)
    );

    // Set controls target to the center of bounding box
    controls.target.set(center.x - 0.05, center.y - 0.02, 0);

    // Apply constraints to camera and update controls
    constrainCamera(controls, boundingBox);
    controls.update();
  }
}

// Export visualizationReady for access from main.js
export { visualizationReady };
