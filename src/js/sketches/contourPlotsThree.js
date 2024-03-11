import * as THREE from 'three';
import proj4 from 'proj4';

export function contourPlotsThree(containerId) {
  let scene;
  let camera;
  let renderer;
  let dataGroup; // Group for the data lines
  const container = document.getElementById(containerId);

  if (!container) {
    console.error('Container element not found');
    return;
  }

  if (container.clientHeight === 0) {
    container.style.height = '100vh';
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Correctly configured Proj4 coordinate conversion
  function convertCoordinates(lat, lon) {
    // Validate input coordinates
    if (isNaN(lat) || isNaN(lon)) {
      console.error(`Invalid coordinate: lat = ${lat}, lon = ${lon}`);
      return null;
    }

    try {
      const [x, y] = proj4('EPSG:4326', 'EPSG:3857', [lon, lat]);
      return new THREE.Vector3(x, -y, 0); // Note: Negating 'y' for correct Three.js orientation
    } catch (error) {
      console.error('Error converting coordinates:', error);
      return null;
    }
  }

  // Function to draw lines between coordinates
  function drawLines(data) {
    dataGroup.clear(); // Remove previous lines

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    data.forEach((feature) => {
      const points = feature.vertices
        .map((vertex) => convertCoordinates(vertex.lat, vertex.lon))
        .filter((point) => point !== null); // Exclude null points

      if (points.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.LineLoop(geometry, material);
        dataGroup.add(line);
      }
    });
  }

  function parseData(jsonData) {
    // Parse transmitter site coordinates
    const transmitterSiteCoords = jsonData.transmitter_site
      .split(',')
      .map(Number);

    // Initialize an array to hold the vertices
    let vertices = [];

    // Loop through the 'coordinates' object
    Object.entries(jsonData.coordinates).forEach(([key, value]) => {
      console.log(key);

      // Split the string by comma and convert to numbers
      const coords = value.split(',').map(Number);
      vertices.push({
        lon: coords[0], // Longitude
        lat: coords[1], // Latitude
      });
    });

    return {
      transmitterSite: {
        lon: transmitterSiteCoords[0],
        lat: transmitterSiteCoords[1],
      },
      vertices: vertices,
    };
  }

  function adjustCameraToFeature(vertices) {
    const bounds = vertices.reduce(
      (acc, vertex) => {
        acc.minX = Math.min(acc.minX, vertex.x);
        acc.maxX = Math.max(acc.maxX, vertex.x);
        acc.minY = Math.min(acc.minY, vertex.y);
        acc.maxY = Math.max(acc.maxY, vertex.y);
        return acc;
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );

    const offsetX = (bounds.maxX + bounds.minX) / 2;
    const offsetY = (bounds.maxY + bounds.minY) / 2;

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    camera.position.x = offsetX;
    camera.position.y = offsetY;
    camera.zoom = Math.min(
      container.clientWidth / width,
      container.clientHeight / height,
    );
    camera.updateProjectionMatrix();
  }

  async function init() {
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
      width / -2,
      width / 2,
      height / 2,
      height / -2,
      1,
      1000,
    );
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    dataGroup = new THREE.Group();
    scene.add(dataGroup); // Add the group to the scene

    // Load JSON data
    try {
      const response = await fetch(
        'src/assets/data/fcc/fm/processed/FM_service_contour_sample_downsampled.json',
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      const parsedFeatures = jsonData.map((feature) => parseData(feature));

      // Convert and draw each feature
      parsedFeatures.forEach((feature) => {
        drawLines([feature]); // Ensure drawLines can handle the format
      });

      // Iterate over features
      let currentIndex = 0;
      const cycleFeatures = () => {
        if (currentIndex < parsedFeatures.length) {
          const feature = parsedFeatures[currentIndex];
          adjustCameraToFeature(
            feature.vertices.map((vertex) =>
              convertCoordinates(vertex.lat, vertex.lon).toArray(),
            ),
          );
          currentIndex++;
        } else {
          currentIndex = 0; // Loop back to the first feature
        }

        setTimeout(cycleFeatures, 500); // Set the next cycle
      };

      cycleFeatures(); // Start the cycling
    } catch (error) {
      console.error('Could not load the JSON data: ', error);
    }

    animate();
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  init();
}
