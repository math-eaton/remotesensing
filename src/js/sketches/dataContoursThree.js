import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { createNoise2D } from 'simplex-noise';

export async function dataContoursThree(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found');
    return;
  }

  // Define scene
  const scene = new THREE.Scene();

  // Orthographic camera setup
  const camera = new THREE.OrthographicCamera(
    container.offsetWidth / -2,
    container.offsetWidth / 2,
    container.offsetHeight / 2,
    container.offsetHeight / -2,
    0.00001,
    5000,
  );
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

  // Function to convert geographic coordinates (longitude, latitude) and elevation to Three.js scene coordinates
  function geoCoordsToSceneCoords(longitude, latitude, elevation) {
    // Placeholder transformation, replace with actual logic appropriate for your scene's scale and layout
    const x = longitude; // Scale or offset as necessary
    const y = elevation; // Scale elevation to match the scene's units
    const z = latitude; // Scale or offset as necessary
    return new THREE.Vector3(x, y, z);
  }

  // Function to create a contour line from a GeoJSON feature
  function createContourFromFeature(feature) {
    const coordinates = feature.geometry.coordinates[0]; // Assuming Polygon geometry
    const elevationData = feature.properties.elevation_data;
    const vertices = coordinates.map((coord, index) => {
      const elevation = elevationData[index];
      return geoCoordsToSceneCoords(coord[0], coord[1], elevation);
    });

    // Create geometry and line from vertices
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(geometry, material);
    return line;
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

  // Initialize the scene with GeoJSON data
  const filePath =
    'assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed_trunc.geojson';
  await initSceneWithGeoJSON(filePath, scene);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
  }
  animate();
}
