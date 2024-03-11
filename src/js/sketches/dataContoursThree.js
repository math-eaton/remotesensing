import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export function dataContoursThree(containerId) {
  let scene;
  let camera;
  let renderer;
  let circlesGroup; // Now accessible to the update function
  const container = document.getElementById(containerId);

  const noise2D = createNoise2D();

  if (!container) {
    console.error('Container element not found');
    return;
  }

  if (container.clientHeight === 0) {
    container.style.height = '100vh';
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  const initialOvalWidth = 750;
  const initialOvalHeight = 750;
  const decrement = width / 66.6;

  function createDeformedOval(
    ovalWidth,
    ovalHeight,
    noiseOffset = 0,
    segments = 50,
  ) {
    const shape = new THREE.Shape();

    const noiseScale = 0.95;
    const amplitude = 7;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = (Math.cos(angle) * ovalWidth) / 2;
      const y = (Math.sin(angle) * ovalHeight) / 2;

      const noise =
        noise2D(x * noiseScale + noiseOffset, y * noiseScale + noiseOffset) *
        amplitude;
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

  function updateContours(noiseOffset) {
    circlesGroup.clear(); // Remove all objects from the group

    // Re-create and deform the exterior oval with the new noise offset
    const exteriorShape = createDeformedOval(
      initialOvalWidth,
      initialOvalHeight,
      noiseOffset,
    );
    const exteriorGeometry = new THREE.ShapeGeometry(exteriorShape);
    const exteriorEdges = new THREE.EdgesGeometry(exteriorGeometry);
    const exteriorLine = new THREE.LineSegments(
      exteriorEdges,
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    circlesGroup.add(exteriorLine);

    // Re-create interior concentric circles by scaling the exterior shape
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
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      );
      circlesGroup.add(scaledLine);
    }
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
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    circlesGroup = new THREE.Group();
    scene.add(circlesGroup); // Add the empty group to the scene

    updateContours(0); // Initialize contours with zero offset

    document.addEventListener('mousemove', onMouseMove, false);

    let noiseOffset = 0;
    setInterval(() => {
      noiseOffset += 0.1; // Increment the noise offset for each update
      updateContours(noiseOffset); // Update contours with the new noise offset
    }, 50); // Update N times per second (e.g. 100 = 10fps)
  }

  function onMouseMove(event) {
    const rect = container.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

    const vector = new THREE.Vector3(mouseX, mouseY, 0);
    vector.unproject(camera);

    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    if (circlesGroup) {
      circlesGroup.position.x = pos.x;
      circlesGroup.position.y = pos.y;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  init();
  animate();
}
