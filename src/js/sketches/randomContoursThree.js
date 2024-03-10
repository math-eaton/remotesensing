import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export function randomContoursThree(containerId) {
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

  const initialOvalWidth = width;
  const initialOvalHeight = height;
  const decrement = 50;

  let noiseOffset = 0;

  function createDeformedOval(diameter, noiseOffset, segments = 50) {
    const radius = diameter / 2;
    const shape = new THREE.Shape();

    const noiseScale = 0.3;
    const amplitude = 20;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius * noiseScale;
      const y = Math.sin(angle) * radius * noiseScale;

      const noise = noise2D(x + noiseOffset, y + noiseOffset) * amplitude;
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
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 1,
        scale: 1,
      }),
    );
    circlesGroup.position.set(0, 0, 0); // Explicitly center the group at the origin
    circlesGroup.add(exteriorLine);

    // Re-create interior concentric circles by scaling the exterior shape
    let scale = 1 - decrement / Math.max(initialOvalWidth, initialOvalHeight);

    for (
      let ovalWidth = initialOvalWidth - decrement,
        ovalHeight = initialOvalHeight - decrement;
      ovalWidth > 1 && ovalHeight > 1;
      ovalWidth -= decrement,
        ovalHeight -= decrement,
        scale -= decrement / Math.min(initialOvalWidth, initialOvalHeight)
    ) {
      const scaledGeometry = exteriorGeometry.clone().scale(scale, scale, 1);
      const scaledEdges = new THREE.EdgesGeometry(scaledGeometry);
      const scaledLine = new THREE.LineSegments(
        scaledEdges,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          linewidth: 1,
          scale: 2,
          dashSize: 2,
          gapSize: 4,
        }),
      );
      scaledLine.computeLineDistances();
      circlesGroup.add(scaledLine);
    }
  }

  function updateDimensions() {
    // Adjust the renderer size to match the new container size
    renderer.setSize(container.clientWidth, container.clientHeight);

    // Update camera aspect based on new dimensions
    camera.left = -container.clientWidth / 2;
    camera.right = container.clientWidth / 2;
    camera.top = container.clientHeight / 2;
    camera.bottom = -container.clientHeight / 2;
    camera.updateProjectionMatrix();

    // Recalculate dimensions for your shapes based on the new size, if necessary
    const smallerDimension = Math.min(
      container.clientWidth,
      container.clientHeight,
    );
    const circleDiameter = smallerDimension * 0.5;
    updateContours(0, circleDiameter / 2); // Use this line if your shapes' sizes depend on container size
  }

  let tick = 0;

  function animateEffect(minScale, maxScale) {
    // Oscillating pattern within the range [minScale, maxScale]
    const range = maxScale - minScale;
    const midPoint = (maxScale + minScale) / 2;
    noiseOffset = Math.sin(tick) * (range / 2) + midPoint;

    updateContours(noiseOffset);

    tick += 0.1;
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
      window.innerWidth / -2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      1,
      500,
    );
    camera.position.z = 1;

    // Define a constant pixelation factor
    var pixelationFactor = 0.333; // Lower values result in more pixelation

    // Calculate low-resolution dimensions based on the pixelation factor
    var pixelatedWidth = window.innerWidth * pixelationFactor;
    var pixelatedHeight = window.innerHeight * pixelationFactor;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(pixelatedWidth, pixelatedHeight); // Apply pixelated dimensions
    renderer.setPixelRatio(1); // No need to adjust pixel ratio further
    container.appendChild(renderer.domElement);

    // Scale the canvas to fit the full browser width while keeping the pixelated effect
    var scale = 1 / pixelationFactor;
    renderer.domElement.style.transformOrigin = 'center';
    renderer.domElement.style.transform = `scale(${scale})`;

    // Adjust the renderer and container size
    renderer.domElement.style.width = `${window.innerWidth}px`;
    renderer.domElement.style.height = `${window.innerHeight}px`;
    container.style.overflow = 'hidden'; // Prevent scrollbars from appearing

    circlesGroup = new THREE.Group();
    scene.add(circlesGroup); // Add the empty group to the scene

    updateContours(0); // Initialize contours with zero offset

    // document.addEventListener('mousemove', onMouseMove, false);

    // let noiseOffset = 0;
    // setInterval(() => {
    //   noiseOffset += 0.5; // Increment the noise offset for each update
    //   updateContours(noiseOffset); // Update contours with the new noise offset
    // }, 100); // Update N times per second (e.g. 100 = 10fps)

    // rescaled and period effect to animate over time
    setInterval(() => {
      animateEffect(7, 70);
    }, 100);

    // Set up the resize event listener
    window.addEventListener('resize', function () {
      // Adjust camera, renderer, and circle dimensions on window resize
      updateDimensions();
    });

    updateDimensions(); // Initial setup
  }

  // fn for following mouse cursor - keep for later
  // function onMouseMove(event) {
  //   const rect = container.getBoundingClientRect();
  //   const mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
  //   const mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

  //   const vector = new THREE.Vector3(mouseX, mouseY, 0);
  //   vector.unproject(camera);

  //   const dir = vector.sub(camera.position).normalize();
  //   const distance = -camera.position.z / dir.z;
  //   const pos = camera.position.clone().add(dir.multiplyScalar(distance));

  //   if (circlesGroup) {
  //     circlesGroup.position.x = pos.x;
  //     circlesGroup.position.y = pos.y;
  //   }
  // }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  init();
  animate();
}
