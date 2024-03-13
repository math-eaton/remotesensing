import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import proj4 from 'proj4';
// import { createNoise2D } from 'simplex-noise';

export async function dataContoursThree(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found');
    return;
  }

  // Define scene
  const scene = new THREE.Scene();

  const WGS84 = 'EPSG:4326'; // WGS84 projection string

  const NAD83 =
    '+proj=longlat +lat_0=40 +lon_0=-76.58333333333333 +k=0.9999375 +x_0=249999.9998983998 +y_0=0 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs';

  // Orthographic camera setup
  const camera = new THREE.OrthographicCamera(
    container.offsetWidth / -2,
    container.offsetWidth / 2,
    container.offsetHeight / 2,
    container.offsetHeight / -2,
    0.00001,
    5000,
  );

  camera.position.set(500000, 5000, 500000); // Example positions, adjust based on your data's scale and location
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  camera.position.z = 2000; // Adjust as necessary

  // Define a pixelation factor
  let pixelationFactor = 0.35; // Lower values result in more pixelation, adjust as necessary

  // Renderer with pixelated dimensions and scaling
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  const pixelatedWidth = container.offsetWidth * pixelationFactor;
  const pixelatedHeight = container.offsetHeight * pixelationFactor;
  renderer.setSize(pixelatedWidth, pixelatedHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scale = 1 / pixelationFactor;
  renderer.domElement.style.transformOrigin = 'center';
  renderer.domElement.style.transform = `scale(${scale})`;
  container.style.overflow = 'hidden'; // Prevent scrollbars from appearing

  // Controls setup
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  function wgs84ToNAD83Threejs(lon, lat, elevation) {
    const [x, y] = proj4(WGS84, NAD83, [lon, lat]);
    const z = elevation; // Assuming elevation is in meters

    return new THREE.Vector3(x, y, z);
  }

  // Function to initialize the scene with GeoJSON data
  async function initSceneWithGeoJSON(filePath, scene) {
    const geoData = await loadGeoJSON(filePath);
    if (!geoData) {
      console.error('Unable to load or parse the GeoJSON data.');
      return;
    }

    geoData.features.forEach((feature) => {
      const contourLine = createContourFromFeature(feature);
      scene.add(contourLine);
    });
  }
  // Define the asynchronous function to load and parse GeoJSON data
  async function loadGeoJSON(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const geoJsonData = await response.json();
      console.log('GeoJSON data loaded successfully:', geoJsonData);
      return geoJsonData;
    } catch (error) {
      console.error('Failed to load GeoJSON data:', error);
      return null; // Return null in case of failure to indicate the error
    }
  }

  // Function to create a contour line from a GeoJSON feature
  function createContourFromFeature(feature) {
    const geometry = feature.geometry;
    if (geometry.type !== 'Polygon') {
      console.error('Unsupported geometry type:', geometry.type);
      return;
    }

    // Assuming the first linear ring is the exterior boundary
    const exteriorCoords = geometry.coordinates[0];
    const elevationData = feature.properties.elevation_data;

    const vertices = exteriorCoords.map((coord, index) => {
      // Use elevation for each coordinate or default to 0 if not available
      const elevation =
        elevationData && elevationData.length > index
          ? elevationData[index]
          : 0;
      return wgs84ToNAD83Threejs(coord[0], coord[1], elevation);
    });

    // Create a BufferGeometry instance from the vertices
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(lineGeometry, material);

    return line;
  }

  (async () => {
    try {
      const filePath =
        'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed_trunc.geojson';

      await initSceneWithGeoJSON(filePath, scene);
      animate();
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  })();

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
  }

  // Resize event listener to adjust camera and renderer on window resize
  window.addEventListener('resize', () => {
    const aspect = container.offsetWidth / container.offsetHeight;
    camera.left = -container.offsetWidth / 2;
    camera.right = container.offsetWidth / 2;
    camera.top = container.offsetWidth / (2 * aspect);
    camera.bottom = -container.offsetWidth / (2 * aspect);
    camera.updateProjectionMatrix();

    // Update renderer size and scale
    const pixelatedWidth = container.offsetWidth * pixelationFactor;
    const pixelatedHeight = container.offsetHeight * pixelationFactor;
    renderer.setSize(pixelatedWidth, pixelatedHeight);
    renderer.domElement.style.transform = `scale(${scale})`;
  });
}
