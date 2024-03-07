import * as THREE from 'three';

export function contoursThree(containerId) {
  let scene;
  let camera;
  let renderer;
  const container = document.getElementById(containerId);
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

    const circlesGroup = new THREE.Group(); // Create a group for all circles

    let ovalWidth = 100; // Initial diameter of the largest circle
    let ovalHeight = 100;
    const decrement = 5;

    while (ovalWidth > 1 && ovalHeight > 1) {
      const ovalShape = new THREE.Shape();
      ovalShape.absellipse(
        0,
        0,
        ovalWidth / 2,
        ovalHeight / 2,
        0,
        2 * Math.PI,
        false,
      );

      const geometry = new THREE.ShapeGeometry(ovalShape);
      const edges = new THREE.EdgesGeometry(geometry);
      const circleLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x000000 }),
      );

      circlesGroup.add(circleLine); // Add each circleLine to the group

      ovalWidth -= decrement;
      ovalHeight -= decrement;
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
