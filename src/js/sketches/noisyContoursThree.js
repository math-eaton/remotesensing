import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function noisyContoursThree(containerId) {
  let scene;
  let camera;
  let controls;
  let renderer;
  // Define a constant pixelation factor
  let pixelationFactor = 0.35; // Lower values result in more pixelation
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
  const decrement = 26;

  let noiseOffset = 0;

  function createDeformedOval(
    diameter,
    noiseOffset,
    pixelationFactor,
    segments,
  ) {
    const vertices = [];
    const radius = diameter / 2;

    const aspectRatio = width / height;
    const baseSize = Math.sqrt(width * height) * (1 / pixelationFactor);
    const noiseScale = 0.002 * baseSize * (aspectRatio > 1 ? 0.75 : 1.25);
    const xyNoiseAmplitude = noiseScale * 2;

    const zNoiseAmplitude = xyNoiseAmplitude / 1.5;

    // Generate original vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const noiseXY =
        noise2D(x * noiseScale + noiseOffset, y * noiseScale + noiseOffset) *
        xyNoiseAmplitude;
      const nx = x + noiseXY;
      const ny = y + noiseXY;
      const nz =
        (noise2D(y * noiseScale + noiseOffset, x * noiseScale + noiseOffset) -
          0.5) *
        zNoiseAmplitude;

      vertices.push(new THREE.Vector3(nx, ny, nz));
    }

    // Use vertices to create Bezier curves
    const curveVertices = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const start = vertices[i];
      const end = vertices[i + 1];

      // Simple control points calculation (you could improve this for smoother curves)
      const cp1 = new THREE.Vector3(
        (start.x + end.x) / 2,
        start.y,
        (start.z + end.z) / 2,
      );
      const cp2 = new THREE.Vector3(
        (start.x + end.x) / 2,
        end.y,
        (start.z + end.z) / 2,
      );

      const curve = new THREE.CubicBezierCurve3(start, cp1, cp2, end);

      // Sample points from the curve
      curveVertices.push(...curve.getPoints(1000)); // Increase the number for smoother curves
    }

    // Create a geometry from the curve vertices
    const geometry = new THREE.BufferGeometry().setFromPoints(curveVertices);

    // Create a line material
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });

    // Create a line mesh
    const line = new THREE.Line(geometry, material);

    return line;
  }

  function updateContours(noiseOffset, segments) {
    circlesGroup.clear(); // Remove all objects from the group

    // Primary shape creation with Z-axis deformation
    const primaryShape = createDeformedOval(
      initialOvalWidth,
      noiseOffset,
      pixelationFactor,
      segments,
    );
    circlesGroup.add(primaryShape); // Add the primary shape directly to the group

    // Generate interior concentric shapes by scaling
    let scale = 1 - decrement / Math.min(initialOvalWidth, initialOvalHeight);
    for (
      let ovalWidth = initialOvalWidth - decrement,
        ovalHeight = initialOvalHeight - decrement;
      ovalWidth > 0 && ovalHeight > 0;
      ovalWidth -= decrement,
        ovalHeight -= decrement,
        scale -= decrement / Math.min(initialOvalWidth, initialOvalHeight)
    ) {
      // Clone the primary shape for each concentric shape
      let shapeClone = primaryShape.clone();
      // Apply scaling to create the concentric effect
      shapeClone.scale.set(scale, scale, scale);
      circlesGroup.add(shapeClone);
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

  // let scaleModFreq = 0;
  let segModFreq = 0;
  const segModThreshold = 1; // Threshold to trigger a coin toss event
  let segments = 100;

  // Linear interpolation function
  function lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  //  step function for interpolation
  function stepSlewed(edge0, edge1, x) {
    // Scale, and clamp x to 0..1 range
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    // Evaluate polynomial
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  // Generate smooth series of noise points
  function generateNoisePoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push(Math.random());
    }
    return points;
  }

  const noisePoints = generateNoisePoints(10);
  let currentNoiseIndex = 0;
  let lerpProgress = 0;

  function animateEffect(minScale, maxScale, minSegments, maxSegments) {
    const range = maxScale - minScale;
    const midPoint = (maxScale + minScale) / 2;
    const offsetAmp = 10;

    // Calculate noiseOffset using smoother interpolation
    const lerpStart = noisePoints[currentNoiseIndex % noisePoints.length];
    const lerpEnd = noisePoints[(currentNoiseIndex + 1) % noisePoints.length];
    const smoothProgress = stepSlewed(0, 1, lerpProgress);
    noiseOffset =
      lerp(lerpStart, lerpEnd, smoothProgress) * (range / offsetAmp) + midPoint;

    // Increment lerpProgress and update currentNoiseIndex if necessary
    lerpProgress += 0.01; // lerp speed
    if (lerpProgress >= 1) {
      lerpProgress = 0;
      currentNoiseIndex++;
    }

    segModFreq += 0.0025;
    if (segModFreq >= segModThreshold) {
      const coinToss = Math.random() > 0.5 ? 1 : -1;
      segments += coinToss;
      segments = Math.max(minSegments, Math.min(maxSegments, segments));
      segModFreq = 0;
    }

    updateContours(noiseOffset, segments);
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
    camera.position.z = 2000;

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

    camera.position.set(0, 0, 2000);

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
      animateEffect(2, 10, 25, 200);
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
