import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function noisyContoursThree(containerId) {
  let scene;
  let camera;
  let controls;
  let renderer;
  // Define a constant pixelation factor
  let pixelationFactor = 0.7; // Lower values result in more pixelation
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
  const decrement = 25;

  let noiseOffset = 0;

  function createDeformedOval(
    diameter,
    noiseOffset,
    pixelationFactor,
    segments,
  ) {
    const vertices = [];
    const radius = diameter / 2;
    const zNoiseAmplitude = 1; // Control the Z-axis noise amplitude

    const aspectRatio = width / height;
    const baseSize = Math.sqrt(width * height) * (1 / pixelationFactor);
    const noiseScale = 0.001 * baseSize * (aspectRatio > 1 ? 0.75 : 1.25);
    const amplitude = noiseScale * 2;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Original noise for X and Y
      const noiseXY =
        noise2D(x * noiseScale + noiseOffset, y * noiseScale + noiseOffset) *
        amplitude;
      const nx = x + noiseXY;
      const ny = y + noiseXY;

      // Additional noise for Z
      const nz =
        noise2D(y * noiseScale + noiseOffset, x * noiseScale + noiseOffset) *
        zNoiseAmplitude;

      // Push the deformed vertex to the vertices array
      vertices.push(new THREE.Vector3(nx, ny, nz));
    }

    // Create a geometry and add vertices
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);

    // Create a line material
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });

    // Create a line segment mesh
    const lineSegments = new THREE.LineLoop(geometry, material);

    return lineSegments;
  }

  function updateContours(noiseOffset, segments) {
    circlesGroup.clear(); // Remove all objects from the group

    // Add the primary shape directly to the group
    const primaryShape = createDeformedOval(
      initialOvalWidth,
      noiseOffset,
      pixelationFactor,
      segments,
    );
    circlesGroup.add(primaryShape);

    // Generate interior concentric shapes with unique Z noise
    let scale = 1 - decrement / Math.min(initialOvalWidth, initialOvalHeight);
    for (
      let scaledWidth = initialOvalWidth * scale,
        scaledHeight = initialOvalHeight * scale;
      scaledWidth > 0 && scaledHeight > 0;
      scaledWidth *= scale,
        scaledHeight *= scale,
        scale = 1 - decrement / Math.min(scaledWidth, scaledHeight)
    ) {
      const concentricShape = createDeformedOval(
        Math.min(scaledWidth, scaledHeight), // Use the smaller dimension to maintain aspect ratio
        noiseOffset, // Keep the same noise offset for X and Y
        pixelationFactor,
        segments, // Keep the same segment count
        true, // Indicate this is a clone to apply unique Z noise
      );
      // Note: No need to scale here as we're directly adjusting the dimensions
      circlesGroup.add(concentricShape);
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

  let scaleModFreq = 0;
  let segModFreq = 0;
  const segModThreshold = 1; // Threshold to trigger a coin toss event
  let segments = 50;

  function animateEffect(minScale, maxScale, minSegments, maxSegments) {
    // Oscillating noise deformation + shape scaling within the range [minScale, maxScale]
    const range = maxScale - minScale;
    const midPoint = (maxScale + minScale) / 2;
    const offsetAmp = 10;
    noiseOffset = Math.sin(scaleModFreq) * (range / offsetAmp) + midPoint;

    // Increment segModFreq
    segModFreq += 0.0025; // Adjust this value to control the coin toss rate

    // Oscillate segment count - greater resolution means noise is more obv
    // "Coin toss" to decide whether to add or subtract a segment
    if (segModFreq >= segModThreshold) {
      const coinToss = Math.random() > 0.5 ? 1 : -1;
      segments += coinToss;
      segments = Math.max(minSegments, Math.min(maxSegments, segments));

      // Reset segModFreq after the coin toss
      segModFreq = 0;
    }

    updateContours(noiseOffset, segments);

    scaleModFreq += 0.025; // Continue to adjust scale modulation frequency as before
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
      window.innerWidth / -2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      0.00001,
      5000,
    );
    camera.position.z = 250;

    // // Define a constant pixelation factor
    // var pixelationFactor = 0.666; // Lower values result in more pixelation

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    camera.position.set(0, 20, 500);

    circlesGroup = new THREE.Group();
    scene.add(circlesGroup); // Add the empty group to the scene

    updateContours(0); // Initialize contours with zero offset

    // document.addEventListener('mousemove', onMouseMove, false);

    // let noiseOffset = 0;
    // setInterval(() => {
    //   noiseOffset += 0.5; // Increment the noise offset for each update
    //   updateContours(noiseOffset); // Update contours with the new noise offset
    // }, 100); // Update N times per second (e.g. 100 = 10fps)

    // rescaled and period effect to animate over time - scales with modFreq + amp
    // first two args is noise scaling, second two are segment mod ranges
    setInterval(() => {
      animateEffect(2, 5, 10, 200);
    }, 80);

    // Set up the resize event listener
    window.addEventListener('resize', function () {
      // Adjust camera, renderer, and circle dimensions on window resize
      updateDimensions();
    });

    updateDimensions(); // Initial setup
    animate();
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
    controls.update();
  }

  init();
  animate();
}
