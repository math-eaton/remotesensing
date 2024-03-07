import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export function contoursThree(containerId) {
  let scene;
  let camera;
  let renderer;
  const container = document.getElementById(containerId);

  const noise2D = createNoise2D();

  if (!container) {
    console.error('Container element not found');
    return;
  }

  // Ensure the container has a non-zero height; adjust as needed.
  if (container.clientHeight === 0) {
    container.style.height = '100vh'; // Example: Full viewport height. Adjust based on your layout needs.
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  function onMouseMove(event) {
    const rect = container.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

    const vector = new THREE.Vector3(mouseX, mouseY, 0);
    vector.unproject(camera);

    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    // Move the group of circles based on mouse position
    if (window.circlesGroup) {
      window.circlesGroup.position.x = pos.x;
      window.circlesGroup.position.y = pos.y;
    }
  }

  function createDeformedOval(ovalWidth, ovalHeight, segments = 100) {
    const shape = new THREE.Shape();
    const noiseScale = 0.5; // Adjust for more or less noise
    const amplitude = 10; // Adjust for bigger or smaller deformations

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = (Math.cos(angle) * ovalWidth) / 2;
      const y = (Math.sin(angle) * ovalHeight) / 2;

      // Apply Perlin noise to the exterior shape only
      const noise = noise2D(x * noiseScale, y * noiseScale) * amplitude;
      const nx = x + noise;
      const ny = y + noise;

      if (i === 0) {
        shape.moveTo(nx, ny);
      } else {
        shape.lineTo(nx, ny);
      }
    }

    return shape;
  }

  function init() {
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
    container.appendChild(renderer.domElement);

    const circlesGroup = new THREE.Group();
    const initialOvalWidth = 500;
    const initialOvalHeight = 500;
    const decrement = 25;

    // Create and deform the exterior oval
    const exteriorShape = createDeformedOval(
      initialOvalWidth,
      initialOvalHeight,
    );
    const exteriorGeometry = new THREE.ShapeGeometry(exteriorShape);
    const exteriorEdges = new THREE.EdgesGeometry(exteriorGeometry);
    const exteriorLine = new THREE.LineSegments(
      exteriorEdges,
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    circlesGroup.add(exteriorLine);

    // Create interior concentric circles by scaling the exterior shape
    let scale = 1 - decrement / Math.max(initialOvalWidth, initialOvalHeight);
    for (
      let ovalWidth = initialOvalWidth - decrement,
        ovalHeight = initialOvalHeight - decrement;
      ovalWidth > 1 && ovalHeight > 1;
      ovalWidth -= decrement,
        ovalHeight -= decrement,
        scale -= decrement / Math.max(initialOvalWidth, initialOvalHeight)
    ) {
      const scaledGeometry = exteriorGeometry.clone().scale(scale, scale, 1);
      const scaledEdges = new THREE.EdgesGeometry(scaledGeometry);
      const scaledLine = new THREE.LineSegments(
        scaledEdges,
        new THREE.LineBasicMaterial({ color: 0x000000 }),
      );
      circlesGroup.add(scaledLine);
    }

    scene.add(circlesGroup); // Add the group to the scene

    document.addEventListener('mousemove', onMouseMove, false);

    // Assign the group to a global variable or within a scope accessible by onMouseMove
    window.circlesGroup = circlesGroup;
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  init();
  animate();
}
