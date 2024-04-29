// Import modules
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import proj4 from 'proj4';
import hull from 'convex-hull';
import Delaunator from 'delaunator';
import { GeoJSON } from 'geojson';
import { Earcut } from 'three/src/extras/Earcut.js'
import Stats from 'three/addons/libs/stats.module.js'
import * as Tone from 'tone';
import { Chord, Interval, Note, Scale } from "tonal";
// import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
// import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
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
  let fmPropagationContours = new THREE.Group();
  let fmPropagationPolygons = new THREE.Group();
  let waterPolys = new THREE.Group();
  let cellServiceMesh = new THREE.Group();
  let cellServiceRayMesh = new THREE.Group();
  let accessibilityMesh = new THREE.Group();
  let accessibilityHex = new THREE.Group();
  let analysisArea = new THREE.Group();
  let coastline = new THREE.Group();
    

  // init visibility 
  fmTransmitterPoints.visible = true;
  fmPropagationContours.visible = true;
  fmPropagationPolygons.visible = false;
  cellServiceMesh.visible = true;
  cellServiceRayMesh.visible = true;
  cellTransmitterPoints.visible = true;
  cellMSTLines.visible = true;
  elevContourLines.visible = true;
  accessibilityHex.visible = true;
  accessibilityMesh.visible = true;
  // cellRayLine.visible = true;

  // group the geometry subgroups
  let analogGroup = new THREE.Group();
  let accessGroup = new THREE.Group();
  let digitalGroup = new THREE.Group();

  /// establish visibility
  analogGroup.visible = false;
  accessGroup.visible = false;
  digitalGroup.visible = false;


  let scaleBar;
  // analog = fmtransmitter, fmPropagationContours, 
  // digital = cellServiceMesh, cellTransmitterPoints, cellMSTLines

  // downsample framerate for performance
  let clock = new THREE.Clock();
  let delta = 0;
  // N fps
  let interval = 1 / 18;

  let sliderValue = 1;  //  default value
  const sliderLength = 100;
  
  const ws = null;
  let globalDeltaLeftPressed = 0;
  let globalDeltaRightPressed = 0;
  let globalDeltaLeft = 0;
  let globalDeltaRight = 0;
  let prevDeltaX = 0;
  let prevDeltaY = 0;
  const knobDampingFactor = 0.05;
  let switchState1 = 0;
  let switchState2 = 0;

  // geometry for raycaster intersection point
  let rayOrigin;
  const reticuleSize = 0.0075;
  // const reticuleGeometry = new THREE.RingGeometry( reticuleSize,reticuleSize, 8)
  const reticuleGeometry = new THREE.CircleGeometry( reticuleSize, 48)
  const reticuleMaterial = new THREE.MeshBasicMaterial({ color: '#0000ff', wireframe: true, });
  let raycasterReticule = new THREE.LineSegments(reticuleGeometry, reticuleMaterial);
  
  // Define color scheme variables
  const colorScheme = {
    graticuleColor: '#2f2f2f0b', 
    // ambientLightColor: '#404040', 
    directionalLightColor: '#ffffff', 
    backgroundColor: '#000000', 
    polygonColor: '#FF1493',
    pyramidColorFM: '#FFFF00', 
    pyramidColorCellular: '#FFFF00', 
    // lowestElevationColor: "#0000ff", // Blue
    // middleElevationColor: "#00ff00", // Green
    // highestElevationColor: "#ff0000", // Red
    mstFmColor: '#FF5F1F', 
    boundingBoxColor: '#b80000',
    coastlineColor: '#303030',
    // contoursLabelColor: '#00ff00',
    // cellColor: '#ffffff',
    mstCellColor: '#FFFF00', 
    matchingPyramidColor: '#FFFF00',
    nonMatchingPyramidColor: '#FF1493',
    waterColor: '#303030',
    accessibilityHexColor: '#310057',
    // cellServiceNo: '#00E661',
    cellServiceNo: '#ff00ff',
    cellServiceYes: '#3b3b3b',
    fmRayColor: '#3b3b3b',
    cellRayColor: '#3b3b3b',

  };


///////////////////////// MAP /////////////////////////////
////////////////////// PROJECTION /////////////////////////////////
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

  // reverse projection for geodesic distance calcs
  proj4.defs('StatePlaneToLatLon', statePlaneProjString);
  const reverseProj = proj4('EPSG:2261', 'WGS84');

  // Function to convert from State Plane to Geographic Coordinates
  function toGeographic(x, y) {
    const [lon, lat] = reverseProj.inverse([x, y]);
    return { lon, lat };
  }


  // set clipping extent
  const latMin = -5, latMax = 5; // Example bounds
  const lonMin = -5, lonMax = 5; // Example bounds
  const bottomLeft = toStatePlane(lonMin, latMin);
  const topRight = toStatePlane(lonMax, latMax);


  // Function to calculate distance between two points in State Plane coordinates
  function distanceBetweenPoints(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function remapValues(num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  function remapValuesExp(num, in_min, in_max, out_min, out_max, exponent) {
    // Normalize the input value within [0, 1]
    const normalized = (num - in_min) / (in_max - in_min);
    // Apply exponential curve and then scale to output range
    const scaled = Math.pow(normalized, exponent) * (out_max - out_min) + out_min;
    return scaled;
  } 

  // tone.js ////////////////////////////
  //////////////

  // scales init

  // const range = Scale.rangeOf("F minor pentatonic");
  // range("A1", "A4");

  // console.log(range("A1", "A4"));

  function createRandomNoteSelector(scaleRange, offsetPct = 10) { // Default offset set to 10%
    // Calculate the full scale notes from tonal.js
    const notes = Scale.rangeOf(scaleRange)("F2", "F4"); // Ensure you call this correctly
    let lastIndex = -1; // No note has been selected initially

    return function randomNoteInRange() {
        if (lastIndex === -1) {
            // First call: choose any random note from the array
            lastIndex = Math.floor(Math.random() * notes.length);
        } else {
            // Subsequent calls: choose a note within a percentage of the total notes from the last index
            const variance = Math.floor(notes.length * (offsetPct / 100)); // Calculate variance based on the percentage
            const minIndex = Math.max(0, lastIndex - variance);
            const maxIndex = Math.min(notes.length - 1, lastIndex + variance);
            const indexRange = maxIndex - minIndex + 1;
            lastIndex = minIndex + Math.floor(Math.random() * indexRange);
        }
        return notes[lastIndex];
    };
}

// init quantizer + offset amp per call
const FminPentRandomNote = createRandomNoteSelector("F minor pentatonic", 25); // N% variance along scale per step
const DmalkosRandomNote = createRandomNoteSelector("D malkos raga", 50); // N% variance along scale per step

  // synth init
  let synth, synths;
  let synthPresets = {};
  let droneSynth, droneLP, droneHP, droneBP; 
  let radioTuner, ToneAudioBuffer
  let noiseTuner;
  let sampleUrls = [];  // radio tuner URLs
  let membraneSynth, membraneHP;
  let noiseSynth, noiseHP, noiseBP, noiseLP;
  let globalVolume, reverbSend, pitchLFO;
  let bitCrusher;
  let meter = new Tone.Meter();
  let outputEQ = createRadioEQ();  // Create the AM radio EQ effect


// fx init
function setupFx() {
  // Initialize volume and dynamic range processors
  globalVolume = new Tone.Volume().toDestination();
  let limiter = new Tone.Limiter(-5);
  // Routing audio signals through effects


    
  let outputEQ = createRadioEQ();  // Create the AM radio EQ effect

  // Setup compressor
  let compressor = new Tone.Compressor({
      threshold: -2,  
      ratio: 6,        
      attack: 0.003,   
      release: 0.25    
  });

  // Setup reverb
  reverbSend = new Tone.Reverb({ 
      decay: 3,
      preDelay: 0.15
  }).connect(globalVolume);
  reverbSend.wet.value = 0.1;

  // Connect reverb to the global volume
  outputEQ.connect(reverbSend);    // Connect EQ before the global volume in the routing chain

  bitCrusher = new Tone.BitCrusher(12); 
  reverbSend.connect(bitCrusher);
  bitCrusher.connect(globalVolume); // Connect the BitCrusher to the global volume

  globalVolume.chain(meter, compressor, limiter);  // Update the routing
  limiter.toDestination();               


  // Initialize and configure the LFO for pitch modulation
  pitchLFO = new Tone.LFO({
    frequency: 0.5,
    type: 'sine',
    min: -1,
    max: 1
  });
}
    // output EQ for vibes
    function createRadioEQ() {
      const eq = new Tone.EQ3({
          low: -48,
          mid: 0,
          high: -48
      });
  
      const midBoost = new Tone.Filter({
          type: "peaking",
          frequency: 2110,
          Q: 1.0,
          gain: 15
      });
      midBoost.connect(eq.mid);
  
      const highPass = new Tone.Filter({
          type: "highpass",
          frequency: 700,
          Q: 0.7
      });
      highPass.connect(midBoost);
  
      const lowPass = new Tone.Filter({
          type: "lowpass",
          frequency: 3300,
          Q: 0.7
      });
      lowPass.connect(highPass);
  
      return eq;
  }

  
/////////////////////////////////////////////
/// init each sound source here /////////////
////////////////////////////////////////////

function setupSynths() {
  synths = {
      droneSynth: setupDroneSynth(),
      membraneSynth: setupMembraneSynth(),
      noiseSynth: setupNoiseSynth(),
      radioTuner: setupRadioTuner(),
      noiseTuner: setupNoiseTuner(),
      cellPing: setupCellPing(),
      // harmonicOscillator: setupHarmonicOscillator()
  };
}


function setupDroneSynth() {
  droneSynth = new Tone.AMSynth({
      oscillator: { type: "sine" },
      envelope: {
          attack: 1,   // in seconds
          decay: 0.4,
          sustain: 1,
          release: 1
      },
      detune: 150,
      harmonicity: 0.5,
      volume: 0,
  });

// init drone filters

  droneHP = new Tone.Filter({
    type: 'highpass',
    frequency: 50,  // Starting cutoff frequency
    rolloff: -12,
    Q: 4,
  });


  droneLP = new Tone.Filter({
      type: 'lowpass',
      frequency: 250,  // Starting cutoff frequency
      rolloff: -96,
      Q: 0,
  });


  droneBP = new Tone.Filter({
    type: 'peaking',
    frequency: 300,
    rolloff: -24,
    Q: 4
  });


  // filters -> reverb
  droneSynth.connect(droneHP);
  droneHP.connect(droneLP);
  droneLP.connect(droneBP);
  droneBP.connect(reverbSend);


  // Trigger continuous note
  droneSynth.triggerAttack("F2");

  return droneSynth;
}

// FM RADIO PLAYER
// GRANULAR SYNTHESIZZZ

let currentSampleIndex = 0; // Track the index of the current sample
let lastIntersectedIds = new Set(); // to keep track of FM propagation polys
const polygonSampleMap = new Map();
const maxEntries = 20;
function setupRadioTuner() {

  if (!outputEQ) {
    console.error('outputEQ is not defined');
    return;
}

  radioTuner = new Tone.GrainPlayer({
     // url: "src/assets/sounds/iddqd_loopy.WAV",
     url: sampleBuffers[0], // Start with the first preloaded buffer
     loop: true,
     grainSize: 1, 
     overlap: 0,
     drift: 0, // Random timing variations between grains
     playbackRate: 1,
     detune: 0,
     volume: Tone.gainToDb(0)
 }).connect(reverbSend);
 radioTuner.autoStart = true;
 radioTuner.onload = () => {
     console.log('radioTuner sample loaded successfully');
     if (typeof lastChannelValue === 'number') {
        //  updatePlaybackPosition(lastChannelValue);
     }
 };
 radioTuner.onerror = (e) => {
     console.error('Failed to load the radioTuner sample:', e);
 };
 radioTuner.fadeIn = 0.1;
 radioTuner.fadeOut = 0.1;
//  setInterval(changeSample, 5000); // Change radio samples every N ms
 radioTuner.connect(outputEQ); 
 return radioTuner;
}
// playback init with check for sample load
function checkAndStartPlayback() {
  const currentBuffer = sampleBuffers[currentSampleIndex];
  if (currentBuffer && currentBuffer.loaded) {
      radioTuner.buffer = currentBuffer.buffer;
      radioTuner.start(getNextEventTime(Tone.now()));
      console.log('Playback started with loaded buffer.');
  } else {
      console.error('Attempted to play a sample that is not loaded yet.');
  }
}
function getRandomSampleIndex(excludeIndex) {
  let newIndex = Math.floor(Math.random() * sampleBuffers.length);
  while (newIndex === excludeIndex) {
      newIndex = Math.floor(Math.random() * sampleBuffers.length);
  }
  return newIndex;
}
function changeSampleToIndex(index) {
  currentSampleIndex = index;
  checkAndStartPlayback();
  console.log(`Switched to sample: ${currentSampleIndex}`);
}

// function changeSampleToIndex(index) {
//   currentSampleIndex = index;
//   checkAndStartPlayback();
//   updateLoopStart(radioTuner); // Update loop start for radio tuner
//   console.log(`Switched to sample: ${currentSampleIndex}`);
// }


function updatePolygonSampleMap(uniqueId) {
  if (!polygonSampleMap.has(uniqueId)) {
      if (polygonSampleMap.size >= maxEntries) {
          // Remove the oldest entry; Maps maintain the order of keys as they were added
          const oldestKey = polygonSampleMap.keys().next().value;
          polygonSampleMap.delete(oldestKey);
      }
      // Assign a new random sample index
      const newIndex = getRandomSampleIndex();
      polygonSampleMap.set(uniqueId, newIndex);
  }
  return polygonSampleMap.get(uniqueId);
}
function getRandomSampleIndex() {
  let newIndex;
  do {
      newIndex = Math.floor(Math.random() * sampleBuffers.length);
  } while (sampleBuffers[newIndex] && sampleBuffers[newIndex].buffer === radioTuner.buffer);
  return newIndex;
}
// update FM radio player based on slider tuning
function updatePlaybackPosition(channelValue) {
  // Calculate new positions based on the channel value scaled by the buffer durations
  const radioSampleDuration = radioTuner.buffer.duration;
  const noiseSampleDuration = noiseTuner.buffer.duration;
  
  const newRadioPosition = (channelValue / 100) * radioSampleDuration;
  const newNoisePosition = (channelValue / 100) * noiseSampleDuration;
  
  const currentTime = Tone.now();
  const nextTime = getNextEventTime(currentTime);

  // Ensure the new positions are scheduled correctly
  if (nextTime < currentTime) {
      console.warn('Adjusted nextTime to avoid scheduling error.');
      nextTime = currentTime + 0.1;
  }

  // Start or change playback for both tuners
  radioTuner.start(nextTime + 0.05, newRadioPosition);
  noiseTuner.start(nextTime + 0.05, newNoisePosition);
}

function updateLoopStart(radioTuner) {
  if (radioTuner && radioTuner.buffer && radioTuner.buffer.loaded) {
    radioTuner.loopStart = Math.random() * radioTuner.buffer.duration;
      console.log(`Updated loopStart for instrument to: ${radioTuner.loopStart} ${synths[0]}`);
  } else {
      console.error("Buffer not loaded; cannot set loopStart.");
  }
}




let noiseBuffer;
new Tone.Buffer("/assets/sounds/amRadioTuning.mp3", function(buffer) {
    noiseBuffer = buffer;
    console.log("Buffer loaded, can now be used in GrainPlayer");
    setupNoiseTuner(); // Initialize the noiseTuner once the buffer is ready
});

function setupNoiseTuner() {
  // Check if the buffer is loaded before setting up the GrainPlayer
  if (!noiseBuffer) {
      console.error("Buffer is not loaded yet.");
      return;
  }

   noiseTuner = new Tone.GrainPlayer({
      url: noiseBuffer, // Use the loaded Tone.Buffer
      loop: true,
     playbackRate: 1.666,
     loopStart: Math.random(0),
     grainSize: 0.35, 
     overlap: 1.5,
     drift: 0.25, // Random timing variations between grains
     detune: 0.5,
     volume: Tone.gainToDb(0.33)
 }).connect(reverbSend);
 noiseTuner.start(); // Start playing the noise tuner

 noiseTuner.onload = () => {
  console.log('noisetuner sample loaded successfully');
  // Set a random loop start once the buffer is loaded
  noiseTuner.loopStart = Math.random() * noiseTuner.buffer.duration;
  if (typeof lastChannelValue === 'number') {
      // updatePlaybackPosition(lastChannelValue);
  }
};

noiseTuner.onerror = (e) => {
  console.error('Failed to load the noiseTuner sample:', e);
};

//  noiseTuner.fadeIn = 0.1;
//  noiseTuner.fadeOut = 0.1;
//  setInterval(changeSample, 5000); // Change radio samples every N ms

// console.log("playing noise tuner")
 noiseTuner.connect(reverbSend); 
 return noiseTuner;
}


// TODO HARMONICSSSS AS MADE FAMOUS BY MR DONALD BUCHLA 
// .. MAYBE SHOULD JUST CREATE A DICTIONARY WITH THESE HARDCODED FREQS
function setupHarmonicOscillator() {
  const fundamentalFreq = 110; // A2, an example fundamental frequency
  const numHarmonics = 10; // Number of harmonics
  const harmonicOscillators = [];
  const gains = [];

  // Create an array of oscillators for the harmonics
  for (let i = 1; i <= numHarmonics; i++) {
      const freq = fundamentalFreq * i;
      const oscillator = new Tone.Oscillator(freq, "sine").start();
      const gain = new Tone.Gain(0); // Initialize with gain at 0
      oscillator.connect(gain);
      gain.connect(reverbSend); // Connect each gain to the destination
      harmonicOscillators.push(oscillator);
      gains.push(gain);
  }

  return {
      oscillators: harmonicOscillators,
      gains: gains,
      setAmplitude: function(harmonicIndex, amplitude) {
          // Ensure amplitude is within bounds and harmonic index is valid
          if (harmonicIndex >= 1 && harmonicIndex <= numHarmonics) {
              gains[harmonicIndex - 1].gain.rampTo(amplitude, 0.1);
          }
      }
  };
}

function setHarmonicOscillatorVolume(volume) {
  synths.harmonicOscillator.gains.forEach(gain => {
    gain.gain.value = volume;
  });
}


function setupCellPing() {
  const cellPing = new Tone.Player({
      url: "path/to/your/cellPing/sample.wav",
      loop: false,
      volume: -10
  }).toDestination();

  cellPing.connect(reverbSend); // Optionally connect to the reverb if needed
  return cellPing;
}


function setupMembraneSynth() {
  membraneSynth = new Tone.Synth({
      envelope: {
          attack: 0.005, // Quick attack for a sharp percussive sound
          decay: 0.05,
          sustain: 0.5,
          release: 0.005
      },
      pitchDecay: 0.5,
      volume: Tone.gainToDb(1), 
  });

  // Initialize the filter specifically for the membrane synth
  membraneHP = new Tone.Filter({
      type: 'highpass', // High-pass filter might suit percussive elements better
      frequency: 400, // Starting cutoff frequency
      Q: 1
  });

  // Connect the synth to the filter and then to the shared reverb
  membraneSynth.connect(membraneHP);
  membraneHP.connect(reverbSend);

  // Optional: Connect directly to destination if you want a clearer sound in addition to reverb
  // membraneHP.toDestination();

  return membraneSynth
}


function setupNoiseSynth() {
  noiseSynth = new Tone.NoiseSynth({
      volume: -20,
      noise: {
          type: 'pink'
      },
      envelope: {
          attack: 0.5,
          decay: 0,
          sustain: 1,
          release: 0.5
      }
  });

  noiseHP = new Tone.Filter({
      type: 'highpass',
      frequency: 3000,
      Q: 0
  });

  noiseBP = new Tone.Filter({
    type: 'peaking',
    frequency: 1000,
    Q: 5,
    gain: 2,
  });

  noiseLP = new Tone.Filter({
    type: 'lowpass',
    frequency: 1800, 
    rolloff: -96,
    Q: 0,
});


  noiseSynth.connect(noiseHP);
  noiseHP.connect(noiseBP);
  noiseBP.connect(noiseLP);
  noiseLP.connect(reverbSend);
  noiseSynth.triggerAttack(); // drone env

  return noiseSynth;
}

// function stopNoiseSynth() {
//   noiseSynth.triggerRelease();
// }

// function startNoiseSynth() {
//   noiseSynth.triggerAttack();
// }


// audio mixer !

let audioChannels = {
  analogChannel: {
      synths: ['droneSynth', 'radioTuner', 'noiseTuner'],
      volume: -10,
      muted: true
  },
  digitalChannel: {
      synths: ['membraneSynth', 'droneSynth', 'noiseTuner'],
      volume: -10,
      muted: true
  },
  elevationChannel: {
    synths: [''],
    volume: -10,
    muted: true
},
accessChannel: {
    synths: ['noiseSynth'],
    volume: -10,
    muted: true
}

};

// Function to update channel volume or mute state
function updateAudioChannels(audioChannelName, settings) {
  const audioChannel = audioChannels[audioChannelName];
  const scheduleTime = Tone.now() + 0.1; // Schedule updates to avoid timing conflicts

  if (settings.volume !== undefined && !isNaN(settings.volume)) {
      audioChannel.volume = settings.volume;
      audioChannel.synths.forEach(synthName => {
          const synth = synths[synthName];
          if (synth && synth.volume) {
              synth.volume.setValueAtTime(settings.volume, scheduleTime);
          }
      });
  } else {
      console.error("Invalid volume setting:", settings.volume);
  }

  if (settings.muted !== undefined) {
      audioChannel.muted = settings.muted;
      const muteVolume = settings.muted ? -Infinity : audioChannel.volume;
      if (!isNaN(muteVolume)) {
          audioChannel.synths.forEach(synthName => {
              const synth = synths[synthName];
              if (synth && synth.volume) {
                  synth.volume.setValueAtTime(muteVolume, scheduleTime);
              }
          });
      } else {
          console.error("Invalid mute volume:", muteVolume);
      }
  }
}


///////////////////
///////////
// other tone.js helper function stuff /////
//////////////////////


function switchSynth(activeChannel) {
  new Tone.Delay(0.1) // adding a delay seems to help async issues
  Object.keys(audioChannels).forEach(audioChannelName => {
    const isMuted = audioChannelName !== activeChannel;
    // fadeOutVol(audioChannelName, isMuted ? 2 : 0); // Mute other channels
    updateAudioChannels(audioChannelName, { muted: isMuted, volume: isMuted ? -Infinity : audioChannels[audioChannelName].volume });
  });

  // Log the activation
  console.log(`Activated channel: ${activeChannel} with synths ${audioChannels[activeChannel].synths}`);
}

let lastEventTime = Tone.now();
const timeIncrement = 0.025;
const randomBuffer = 0.01; // Adding a small random buffer to avoid collisions

// transport stuff
function getNextEventTime() {
  const now = Tone.now();
  lastEventTime = Math.max(lastEventTime + timeIncrement, now) + (Math.random() * randomBuffer);
  return lastEventTime;
}

// ensure linear time / consecutive events ... latency isn't great here
function safeTriggerSound(synth, note, duration) {
  if (!synth || synth.loaded) {
  console.error("Attempted to trigger an instrument that does not exist");
  return;
}
const time = getNextEventTime();
synth.triggerAttackRelease(note, duration, time);
}

function fadeOutVol(audioChannelName, duration) {
  const channel = audioChannels[audioChannelName];
  if (channel) {
    channel.synths.forEach(synthName => {
      const synth = synths[synthName];
      if (synth && synth.volume) {
        const targetVolume = channel.muted ? -Infinity : audioChannels[audioChannelName].volume;
        synth.volume.rampTo(targetVolume, duration, Tone.now() + 0.1);
      }
    });
  }
}


function updateReverbBasedOnCameraZoom(camera) {
  const wetLevel = calculateReverbWetLevel(camera.zoom);
  reverbSend.wet.rampTo(wetLevel, 0.5);  // Ramp the wet level to smooth transitions
  adjustVolumeForReverb(wetLevel); // Adjust volume based on the new wet level
}

function calculateReverbWetLevel(cameraZoom) {
  const minZoom = controls.minZoom;  
  const maxZoom = controls.maxZoom; 
  const minWetLevel = 0.05;
  const maxWetLevel = 1.0;

  // Ensure the camera zoom is clamped within the expected range
  const clampedZoom = Math.max(minZoom, Math.min(maxZoom, cameraZoom));
  
  // Normalize the zoom value between 0 (min zoom) and 1 (max zoom)
  const normalized = (clampedZoom - minZoom) / (maxZoom - minZoom);

  // Apply an exponential curve to the normalized value
  // A higher exponent results in a faster increase of reverb as you zoom out
  const exponent = 3; // Adjust this value to tweak the curve
  const exponentialFactor = Math.pow(1 - normalized, exponent);

  // Calculate the wet level based on the exponential factor
  const wetLevel = minWetLevel + exponentialFactor * (maxWetLevel - minWetLevel);

  return wetLevel;
}

function adjustVolumeForReverb(wetLevel) {
  const minVolume = -15; 
  const maxVolume = -7;

  // As wet level increases, decrease the volume (since wetLevel ranges from 0.05 to 1.0)
  const volumeAdjustment = maxVolume - ((wetLevel - 0.05) / 0.95) * (minVolume - maxVolume);

  globalVolume.volume.rampTo(volumeAdjustment, 0.5); // Smooth transition to the new volume level
}


// presets if they happen
function loadSynthPresets(data) {
  synthPresets = data;
  console.log("Synth presets loaded", synthPresets);
}


function transitionToFMRestingState() {
  // Ensure to ramp back to a resting state smoothly
  droneSynth.harmonicity.rampTo(1, 1);
  droneSynth.volume.rampTo(Tone.gainToDb(0.75), 0.75);
  droneLP.frequency.rampTo(450, 1);
  droneLP.Q.rampTo(3, 1);
  droneBP.frequency.rampTo(100, 3);
  droneBP.Q.rampTo(20, 1);
  // droneHP.frequency.rampTo(1000, 1);
  // droneHP.Q.rampTo(4, 1);

  noiseSynth.volume.rampTo(Tone.gainToDb(0.03), 0.75);
  noiseBP.frequency.rampTo(666,5);
  noiseBP.Q.rampTo(0,2);

  noiseTuner.volume.rampTo(Tone.gainToDb(0.53), 0.75);


  if (synths.radioTuner) {
    synths.radioTuner.volume.rampTo(Tone.gainToDb(0), 0.5);  // Mute the radioTuner
}


}

function noCellServiceState() {
  // Ensure to ramp back to a resting state smoothly
  droneSynth.harmonicity.rampTo(1, 0.5);
  droneSynth.volume.rampTo(Tone.gainToDb(0.75), 0.75);
  droneLP.frequency.rampTo(450, 0.5);
  droneLP.Q.rampTo(3, 1);
  droneBP.frequency.rampTo(100, 1);
  droneBP.Q.rampTo(20, 1);
  // droneHP.frequency.rampTo(1000, 1);
  // droneHP.Q.rampTo(4, 1);

  noiseSynth.volume.rampTo(Tone.gainToDb(0.03), 0.75);
  noiseBP.frequency.rampTo(666,5);
  noiseBP.Q.rampTo(0,2);




}


// function applyPreset(preset) {
//   if (preset.type) {
//     synth = createSynth(preset.type); // This ensures the synth is properly initialized
//     synth.volume.value = 0; // Unmute this synth
//   }
//   if (synth && preset.settings) {
//     synth.set(preset.settings);
//     safeTriggerSound(synth, "D4", "8n"); // Use the safe trigger function
//   }
// }



// function interpolatePresets(presetMin, presetMax, fraction) {
//   let interpolatedPreset = {};

//   Object.keys(presetMin.settings).forEach(key => {
//     interpolatedPreset[key] = {};
//     Object.keys(presetMin.settings[key]).forEach(subKey => {
//       const minVal = presetMin.settings[key][subKey];
//       const maxVal = presetMax.settings[key][subKey];
//       if (typeof minVal === 'number' && typeof maxVal === 'number') {
//         interpolatedPreset[key][subKey] = lerp(minVal, maxVal, fraction);
//       } else {
//         interpolatedPreset[key][subKey] = fraction > 0.5 ? maxVal : minVal;
//       }
//     });
//   });

//   return interpolatedPreset;
// }

// // Example LERP function for numeric values
// function lerp(value1, value2, fraction) {
//   return value1 + (value2 - value1) * fraction;
// }

// function updateDroneSynthParams(intersections, minDistance = 0.001, maxDistance = 1.0) {
//   if (intersections.length > 0) {
//       // Find the intersection with the closest distance
//       let closest = intersections.reduce((min, intersection) => {
//           return intersection.distance < min.distance ? intersection : min;
//       }, { distance: Infinity, object: null });

//       // Retrieve the average radius from the closest intersected object's userData
//       let avgRadius = closest.object.userData.avgRadius || 1; // Use default of 1 if not defined

//       // Normalize the closest distance using the average radius
//       let normalizedDistance = Math.max(0, Math.min(1, (closest.distance / avgRadius - minDistance) / (maxDistance - minDistance)));

//       // Interpolate synth presets based on the normalized distance
//       const interpolatedPreset = interpolatePresets(synthPresets.presets.droneSynth['0'], synthPresets.presets.droneSynth['1'], normalizedDistance);
      
//       // Update the synthesizer's oscillator and envelope settings based on the interpolated preset
//       droneSynth.set({
//           oscillator: interpolatedPreset.oscillator,
//           envelope: interpolatedPreset.envelope,
//       });

//       // Detune the synthesizer based on the normalized distance
//       droneSynth.detune.value = (1.0 - normalizedDistance) * 200;  // Adjust detune multiplier as needed for desired effect

//   } else {
//       // Set to a base "idle" state with low volume or subtle modulation if no intersections are present
//       droneSynth.set({
//           oscillator: { type: "sine", frequency: 220 }, // Example idle state configuration
//           envelope: { attack: 1, decay: 1, sustain: 1, release: 1 }
//       });

//       // Additional idle state adjustments can be made here
//       droneSynth.harmonicity.rampTo(0.1, 2); // Slow ramp for a subtle effect
//       droneSynth.volume.rampTo(Tone.gainToDb(0.1), 2); // Extended time for a smoother fade-out
//   }
// }

function adjustDroneSynthParametersForSwitch(switchState) {

  if (switchState === 1) {

    setupDroneSynth();

} else {
      droneSynth.volume.rampTo(-Infinity, 3);  
  }
}

// function updateMembraneSynthParams(proximity) {
//   let cutoffFrequency = mapProximityToMembraneFrequency(proximity);
//   membraneHP.frequency.rampTo(cutoffFrequency, 0.2);
// }

// function calculateInterpolationFraction(distance, minDistance, maxDistance) {
//   return (distance - minDistance) / (maxDistance - minDistance);
// }

// Function to map VU meter values to colors
function getColorFromVUMeter(vuMeterValue) {
  // Define the start and end colors
  const startColor = hexToRgb(0x00ff00); //  low values
  const endColor = hexToRgb(0xff00ff);   //  high values

  // Check for -Infinity which is the case when there is no sound
  if (vuMeterValue <= -60) {
    return '#00ff00'; // Default color when there is no sound
  }
  
  // Normalize the VU meter value to a 0-1 range for interpolation
  const minVUMeterValue = -30;
  const maxVUMeterValue = -1;
  const normalizedFactor = (vuMeterValue - minVUMeterValue) / (maxVUMeterValue - minVUMeterValue);
  
  // Apply an exponential curve to the factor (e.g., square the normalized factor)
  const factor = normalizedFactor * normalizedFactor; // Change this to adjust the curve shape

  // Interpolate between start and end colors based on the normalized VU meter value
  const interpolatedColor = interpolateColor(startColor, endColor, factor);
  console.log("da color is: " + rgbToHex(interpolatedColor))
  return rgbToHex(...interpolatedColor);
}

let currentColor = 0xf000ff;  // Default color, will be updated dynamically
// console.log("color is:" + currentColor)

function updateColorFromVUMeter() {
  const vuMeterValue = Math.round(meter.getValue(), 1);
  // console.log(`current color is: ${currentColor}`)
  currentColor = getColorFromVUMeter(vuMeterValue * 1.5);
  // console.log("vu: " + vuMeterValue)
  updateAllLinesWithNewColor(currentColor);  // Update all lines with the new color
}


// Set the interval to update the color based on VU meter readings
setInterval(() => {
  updateColorFromVUMeter();  // This function will internally calculate and update the color
  // console.log(Math.round(meter.getValue(), 1))
}, 10);


function monitorSynths() {
  let activeSynthsInfo = [];

  Object.keys(synths).forEach(type => {
      const synth = synths[type];
      if (synth) {
          // Collecting information about each synth
          const info = {
              type: type,
              volume: synth.volume.value
          };
          
          info.details = {
              oscillator: synth.oscillator ? synth.oscillator.type : 'N/A', // Specific to certain synth types
              envelope: synth.envelope ? {
                  attack: synth.envelope.attack,
                  decay: synth.envelope.decay,
                  sustain: synth.envelope.sustain,
                  release: synth.envelope.release
              } : 'N/A'
          };

          activeSynthsInfo.push(info);
      }
  });

  console.log("Active Synths:", activeSynthsInfo);
  return activeSynthsInfo;
}



  //////////////////////////////////////
  // loading screen! //////////////////

  // Three.js - Initialize the Scene
  let scene, camera, renderer, controls, stats, pixelationFactor;
  let isCameraRotating = true; // Flag to track camera rotation
  const rotationSpeed = 0.00001; // Define the speed of rotation

  // stuff for raycaster visuals, need to compartmentalize
  let cellRayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  let fmRayMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
  let cellRayGeometry = new THREE.BufferGeometry();
  let fmRayGeometry = new THREE.BufferGeometry();
  let cellRayLine = new THREE.Line(cellRayGeometry, cellRayMaterial);
  let fmRayLine = new THREE.Line(fmRayGeometry, fmRayMaterial);


  function initThreeJS() {
    scene = new THREE.Scene();
  //   scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: "green",
  // wireframe: true, });

    
    // camera = new THREE.PerspectiveCamera(
    //   75,
    //   window.innerWidth / window.innerHeight,
    //   0.1,
    //   100,
    // );

    let size = 1;
    let near = 0.25;
    let far = 2.5;



    camera = new THREE.OrthographicCamera(
      -size, size, size, -size, near, far
    );

    camera.up.set(0, 0, 1); // Set Z as up-direction

    const fogNear = 2; // The starting distance of the fog (where it begins to appear)
    const fogFar = camera.far; // The ending distance of the fog (where it becomes fully opaque)

    // Adding fog to the scene
    scene.fog = new THREE.Fog(colorScheme.backgroundColor, fogNear, fogFar);

    renderer = new THREE.WebGLRenderer({ 
      canvas: document.querySelector('#canvas'),
      antialias: false,
      precision: "lowp",
      powerPreference: "high-performance"
   });

    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(1);

    document.getElementById('gfx').appendChild(renderer.domElement);



    stats = new Stats();
    stats.showPanel(2); 
    stats.domElement.style.cssText = 'position:absolute;bottom:0px;left:0px;scale:70%;';
    document.getElementById('stats').appendChild(stats.domElement);

    // scaleBar = createScaleBar(scene);  // Ensure this is called after scene is defined


    // Initialize MapControls
    controls = new MapControls(camera, renderer.domElement);

    // Set up the control parameters as needed for a mapping interface
    controls.screenSpacePanning = false;
    controls.enablePan = true; // Enable panning
    controls.enableRotate = true; // tilt up down
    controls.enableDamping = true; // an optional setting to give a smoother control feeling
    controls.dampingFactor = 0.05; // amount of damping (drag)


    // Set the minimum and maximum polar angles (in radians) to prevent the camera from going over the vertical
    controls.minPolarAngle = (53.1301024/2) * (Math.PI / 180); // isometric view - π/n radians (z degrees)
    // controls.minPolarAngle = 0; // top-down
    controls.maxPolarAngle = 35.264 * (Math.PI / 180); // π/n radians (z degrees) - on the horizon
    // Set the maximum distance the camera can dolly out
    controls.maxDistance = 1.5; // max camera zoom out (perspective cam)
    controls.minDistance = 0.5; // min camera zoom in (perspective cam)
    controls.minZoom = 0.5; // min camera zoom out (ortho cam)
    controls.maxZoom = 5; // max camera zoom in (ortho cam)

      // Listener to handle camera zoom changes
      controls.addEventListener('change', () => {
        updateReverbBasedOnCameraZoom(camera);
    });
  
    // console.log(controls.angle)

    scene.add(cellRayLine);  // Add the line to the scene initially
    scene.add(fmRayLine);  // Add the line to the scene initially


    // const audioListener = new THREE.AudioListener();
    // camera.add(audioListener);

            
    camera.updateProjectionMatrix();



    renderer.setClearColor(colorScheme.backgroundColor);
    window.addEventListener('resize', onWindowResize, false);
    adjustCameraZoom();
  }

  function initToneJS() {

    Tone.start("+0.1");

    // Start Tone.Transport with a slight future offset to ensure all is ready
    Tone.Transport.start("+0.02");


    setupFx();

    setupSynths();


    // Connect LFO to the drone synth's frequency if droneSynth is initialized
    if (synths && synths.droneSynth) {
      pitchLFO.connect(synths.droneSynth.oscillator.frequency);
  }

    pitchLFO.start();



    console.log('Synths initialized:', synths);

}


  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // CAMERA CONTROLS /////////////////////////////
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  function adjustCameraZoomSlidePot(value) {
    if (camera.isOrthographicCamera) {
      // controls.minZoom = 0.5; // min camera zoom out (ortho cam)
      // controls.maxZoom = 5; // max camera zoom in (ortho cam)  
      // Map the potentiometer value to the orthographic camera zoom range.
      // const zoomRange = (controls.maxZoom - controls.minZoom);
      let zoomValue = value / 100;
      zoomValue = Math.max(controls.minZoom, Math.min(controls.maxZoom, zoomValue));
      camera.zoom = zoomValue;

      // Update the projection matrix after changing the zoom
      camera.updateProjectionMatrix();

      // Update reverb based on the new zoom level
      updateReverbBasedOnCameraZoom(camera);
  } else  {
      console.log("unknown camera!")
    }
  }
  

  // rotation logic on load //////////////////////
  function flipCamera() {
    // Calculate the distance to the target
    const distanceToTarget = camera.position.distanceTo(controls.target);

    function getRandom(min, max) {
      let randomMin = 0.5
      let randomMax = 1.5  
      return Math.random() * (randomMax - randomMin) + randomMin;
     }

    const angle =  (- Math.PI / 5) * getRandom(); // Define the angle for rotation

    // Calculate the new position
    const relativePosition = new THREE.Vector3().subVectors(
      camera.position,
      controls.target,
    );
    const axis = new THREE.Vector3(0, 0, 1); 
    const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    relativePosition.applyQuaternion(quaternion);

    // Apply the new position while maintaining the distance
    camera.position
      .copy(controls.target)
      .add(relativePosition.setLength(distanceToTarget));

    // Ensure the camera keeps looking at the target
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix()
    }
            
  
  //////////////////////////////////////
  // Resize function
  function onWindowResize() {
    // Get the dimensions of the container
    const container = document.getElementById('three-container');
    const width = 800;
    const height = 480;

    // Update camera aspect ratio and renderer size
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);

    // update this value to alter pixel ratio scaled with the screen
    pixelationFactor = 0.35;

    // Calculate new dimensions based on the value
    var newWidth = Math.max(1, window.innerWidth * pixelationFactor);
    var newHeight = Math.max(1, window.innerHeight * pixelationFactor);

    const scaleX = width / newWidth; 
    const scaleY = height / newHeight;
    // document.getElementById('canvas').style.transform = `scale(${scaleX}, ${scaleY})`;

    const canvas = document.getElementById('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';


    if (renderer && camera) {
      renderer.setSize(newWidth, newHeight, false);
      renderer.setPixelRatio(1);

      // Update camera aspect ratio and projection matrix
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    }

    updateLabelPosition();
    
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
      const minFov = 90; // perspective only
      const maxFov = 60;
      const minZoom = 0.5; // ortho only
      const maxZoom = 1.5;

      // Map the window width to the FOV range
      const scale = (window.innerWidth - minWidth) / (maxWidth - minWidth);

    if (camera.isPerspectiveCamera) {


      let fov = minFov + (maxFov - minFov) * Math.max(0, Math.min(1, scale));
      camera.fov = fov;

    }

    else if (camera.isOrthographicCamera) {


      let fov = minZoom + (maxZoom - minZoom) * Math.max(0, Math.min(1, scale));
      camera.fov = fov;


    }

      camera.updateProjectionMatrix();
    }
  }

  // Initial call to set up the zoom level
  adjustCameraZoom();


  // hardware xy panning - manual camera controls
  function applyPan(deltaX, deltaY) {
    // Apply damping to the deltas
    deltaX += (deltaX - prevDeltaX) * knobDampingFactor;
    deltaY += (deltaY - prevDeltaY) * knobDampingFactor;
  
    // Update previous deltas for the next frame
    prevDeltaX = deltaX;
    prevDeltaY = deltaY;
  
    // pan sensitivity
    const panScaleX = 0.005;
    const panScaleY = 0.005;
  
    // Calculate camera right vector (east-west direction)
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  
    // Calculate forward vector perpendicular to the right vector and global up vector (Z-up)
    let globalUp = new THREE.Vector3(0, 0, 1);
    let forward = new THREE.Vector3().crossVectors(globalUp, right).normalize();
  
    // Adjust encoder movements to the camera's orientation
    let panVectorX = right.multiplyScalar(deltaX * panScaleX);
    let panVectorY = forward.multiplyScalar(deltaY * panScaleY);
  
    // Combine the adjusted vectors for complete pan direction
    let panVector = new THREE.Vector3().addVectors(panVectorX, panVectorY);
  
    // Apply the pan to the camera and controls target
    camera.position.add(panVector);
    controls.target.add(panVector);
  
    controls.update();
  }
  

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // RAYCASTER /////////////////////////////
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


  // Registry for storing raycasters
  const raycasterDict = {
    // 1: determine presence or absence of cell signal
    // method: nearest CELL SERVICE MESH vertex
    // cellServiceMesh: { group: cellServiceMesh, enabled: false, onIntersect: raycastCellServiceMesh },
    // 2: reflect the degree of remoteness of a place
    // method: nearest ACCESSIBILITY MESH vertex
    // accessibilityHex: { group: accessibilityHex, enabled: false, onIntersect: raycastAccessVertex },
    accessibilityMesh: { group: accessibilityMesh, enabled: false, onIntersect: raycastAccessVertex },
    // 3: draw a line to the nearest cell tower at all times
    // method: nearest CELL TRANSMITTER vertex
    // cellTransmitterPoints: { group: cellTransmitterPoints, enabled: false, onIntersect: raycastCellTower },
    cellTransmitterPoints: { group: cellServiceRayMesh, enabled: false, onIntersect: raycastCellServiceVertex },
    // 4: play a 'radio station' signal
    // method: distance from PROPAGATION POLYGON edge to centroid
    fmTransmitterPoints: { group: fmPropagationPolygons, enabled: false, onIntersect: raycastFMpolygon },
    cameraCenter: { 
      group: cellServiceRayMesh,  // terrain proxy 
      enabled: true,  // always enabled
      onIntersect: () => printCameraCenterCoordinates(camera)  // this function prints coords to a text div
}
  

};




function raycastCellServiceVertex(intersection, maxCellTowerRays = 1) {
  const intersectPoint = intersection.point;
  const nearestTowers = findNearestCellTowers(intersectPoint, maxCellTowerRays);
  const gridCode = intersection.object.userData.gridCode || 'unknown';  // Default to 'unknown' if not provided

  // console.log("Intersected gridCode:", gridCode);  // Log the current gridCode at intersection

  if (nearestTowers.length > 0) {
      // Only use the nearest tower for audio parameters and ray drawing
      const nearestTower = nearestTowers[0];
      // console.log("nearest tower: ", JSON.stringify(nearestTower.distance))

      drawcellRayLine(intersectPoint, nearestTower.position, maxCellTowerRays, nearestTower.uniqueCellid, gridCode, nearestTower.distance, currentColor);

      // Update audio parameters based on distance and gridCode of the nearest tower
      updateCellAudioParams(Math.round(nearestTower.distance,0), gridCode);
  } else {
      console.log('No cell towers found or dead zone!');
      cellRayCleanup(maxCellTowerRays);
  }
}

function updateCellAudioParams(distance, gridCode) {
  const cellRayMi = distance / 5280;
  // console.log(cellRayMi)
  // Normalize distance to a 0-1 scale for audio parameter use
  let normalizedCellDistance = Math.max(0, Math.min(1, (cellRayMi - 0.1) / (10 - 0.1)));
  // console.log("normalized: " + normalizedCellDistance)

  
  switch (gridCode) {
    case '0':
      synths.membraneSynth.set({
          // detune: -1200 * normalizedCellDistance, // Example: detune more as distance increases
          volume: Tone.gainToDb(0) // Quieter as distance increases
      });
      synths.droneSynth.set({
        harmonicity: 1 + 2 * normalizedCellDistance, // More harmonicity as distance increases
      });
      synths.droneSynth.frequency.rampTo(110, 1)
      droneLP.frequency.rampTo(700, 1.5);
      droneLP.Q.rampTo(3, 1);
      noiseBP.frequency.rampTo(7000, 1.5);
      if (noiseTuner) { 
        noiseTuner.playbackRate = 0.5; // Directly set playback rate
        noiseTuner.grainSize = 0.1;
        noiseTuner.loopStart = 120;
        noiseTuner.overlap = 0;
        noiseTuner.detune = 30
        noiseTuner.reverse = true;
        noiseTuner.volume.value = Tone.gainToDb(1);
      }
      break;
    case '1':
      synths.membraneSynth.set({
        detune: -1200 * normalizedCellDistance, // Example: detune more as distance increases
        volume: Tone.gainToDb(1) 
      });
      synths.droneSynth.set({
          harmonicity: 1 + 2 * normalizedCellDistance, // More harmonicity as distance increases
          volume: Tone.gainToDb(0.75 - 0.5 * normalizedCellDistance), // Quieter as distance increases
          frequency: 110 - normalizedCellDistance * 100
      });
      // synths.droneSynth.frequency.rampTo(220 - normalizedCellDistance * 5, 1)
      droneLP.frequency.rampTo(250 + normalizedCellDistance, 0.5);
      droneLP.Q.rampTo(4, 1);
      noiseBP.frequency.rampTo(Math.abs(5000 - (normalizedCellDistance * 1000)), 0.5);
      synths.noiseSynth.set({
          volume: Tone.gainToDb(normalizedCellDistance) // Louder as distance increases
      });
      if (noiseTuner) { 
        noiseTuner.playbackRate = 1 + normalizedCellDistance; // Directly set playback rate
        noiseTuner.volume.value = Tone.gainToDb(Math.abs(normalizedCellDistance - 0.25)); // Directly set volume in decibels
      }
      break;
  }
  // console.log(`current grid code is ${gridCode}`)

}

function normalizedCellRayDistance(distance) {
  // Normalize distance based on your application's specific range
  return Math.min(Math.max(0, (distance - 100) / (1000 - 100)), 1);
}



let currentRayLines = [];
let lastTowerId = null; // tower focus init


function drawcellRayLine(start, end, maxCellTowerRays, towerId, gridCode, distance, color) {
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMaterial = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(lineGeometry, lineMaterial);

  lineMaterial.color.set(color);
  lineMaterial.needsUpdate = true;  // Ensure the material updates


  // Set visibility based on gridCode
  line.visible = gridCode !== '0';

  scene.add(line);
  currentRayLines.push(line);

  // console.log("tower ID: " + towerId + ", last tower ID: " + lastTowerId + ", tower gridCode: " + gridCode);

  // Trigger the membrane synth only if gridCode is not 0 and it's a new tower
  if (gridCode !== '0' && lastTowerId !== towerId) {
      triggerMembraneSynth();
      lastTowerId = towerId;
  }

  // Clean up old lines to keep the array size within the maxCellTowerRays limit
  while (currentRayLines.length > maxCellTowerRays) {
      const oldLine = currentRayLines.shift();
      scene.remove(oldLine);
      if (oldLine.geometry) oldLine.geometry.dispose();
  }
}

function cellRayCleanup(maxCellTowerRays) {
while (currentRayLines.length > maxCellTowerRays) {
    const oldLine = currentRayLines.shift();
    if (oldLine) {
        scene.remove(oldLine);
        if (oldLine.geometry) oldLine.geometry.dispose();
    }
}
}

function clearCellRays() {
currentRayLines.forEach(line => {
    scene.remove(line);
    if (line.geometry) line.geometry.dispose();
});
currentRayLines = [];  // Reset the array after clearing
}



function findNearestCellTowers(intersectPoint, maxCellTowerRays = 1) {
  let towers = [];
  
  // Convert intersection point from Three.js coordinates to geographic coordinates
  const intersectGeo = toGeographic(intersectPoint.x, intersectPoint.y);

  cellTransmitterPoints.children.forEach(pyramid => {
      const towerGeo = toGeographic(pyramid.position.x, pyramid.position.y, pyramid.position.z);
      const distance = calculateGeodesicDistance(intersectGeo, towerGeo);
      towers.push({
        distance: distance,
        // gridCode: pyramid.userData.gridCode, 
        uniqueCellid: pyramid.userData.uniqueCellid, 
        position: pyramid.position.clone()
      });
    });

  // Sort towers by distance and return up to `maxCellTowerRays` towers
  return towers.sort((a, b) => a.distance - b.distance).slice(0, maxCellTowerRays);
}

function triggerMembraneSynth() {
  const note = DmalkosRandomNote(); 
  safeTriggerSound(membraneSynth, note, "0.15"); 
  console.log(`triggering " + ${note}`); // Log the same note
}



function getSortedCellRayDistances() {
  // Calculate distances and store them with indices
  const rayDistances = currentRayLines.map((line, index) => {
      const start = line.geometry.attributes.position.array.slice(0, 3);
      const end = line.geometry.attributes.position.array.slice(3, 6);
      const distance = Math.sqrt(
          Math.pow(end[0] - start[0], 2) +
          Math.pow(end[1] - start[1], 2) +
          Math.pow(end[2] - start[2], 2)
      );
      return { index, distance };
  });

  // Sort rays by distance
  rayDistances.sort((a, b) => a.distance - b.distance);

  // Assign unique indices from shortest to longest
  const sortedRaysWithIndices = rayDistances.map((ray, newIdx) => ({
      originalIndex: ray.index,
      sortedIndex: newIdx,
      distance: ray.distance
  }));

  return sortedRaysWithIndices;
}

// Function to access and use the sorted rays outside
function processSortedCellRays() {
  const sortedRays = getSortedCellRayDistances();
  sortedRays.forEach(ray => {
      // console.log(`Ray ${ray.originalIndex} is sorted at index ${ray.sortedIndex} with distance ${ray.distance.toFixed(2)}`);
  });
}

// fm propagation raycasting stuff
function raycastFMpolygon(intersections) {
  let currentActiveIds = new Set();

  intersections.forEach(intersection => {
      const mesh = intersection.object; // This should be the mesh intersected by the raycaster
      const uniqueId = mesh.userData.uniqueId;
      const vertices = mesh.userData.vertices;

      if (!vertices) {
          console.error("Vertices not found for object", mesh);
          return; // Skip processing this intersection
      }

      currentActiveIds.add(uniqueId);
      if (!lastIntersectedIds.has(uniqueId)) {
          const sampleIndexToPlay = updatePolygonSampleMap(uniqueId);
          changeSampleToIndex(sampleIndexToPlay);
      }

      const { towers, found } = findAllMatchingFMTowers(uniqueId);
      if (found) {
          towers.forEach(tower => {
              drawFMLine(intersection.point, tower.position, uniqueId, mesh, currentColor);
          });
      } else {
          const centroid = calculateCentroid(mesh); // calculateCentroid should handle the mesh directly
          drawFMLine(intersection.point, centroid, uniqueId, mesh, currentColor);
      }
  });

  lastIntersectedIds = currentActiveIds;
  updateDroneSynthBasedOnShortestRay();
  fmRayLinesByUniqueId.forEach((line, uniqueId) => {
      if (!currentActiveIds.has(uniqueId)) {
          removeRayLine(uniqueId);
      }
  });
}

function updateDroneSynthBasedOnShortestRay() {
  let shortestDistance = Infinity;
  let nearestVertexDistance = 1; // Default if no lines are found
  let shouldAdjust = false;

  fmRayLinesByUniqueId.forEach(line => {
      const positions = line.geometry.attributes.position.array;
      const start = new THREE.Vector3(positions[0], positions[1], positions[2]);
      const end = new THREE.Vector3(positions[3], positions[4], positions[5]);
      const length = start.distanceTo(end);

      if (length < shortestDistance) {
          shortestDistance = length;
          nearestVertexDistance = line.userData.nearestVertexDistance || 1;
          shouldAdjust = true;
      }
  });

  if (shouldAdjust) {
      updateParamsBasedOnDistFM(synths.droneSynth, droneLP, shortestDistance, nearestVertexDistance);
      updateParamsBasedOnDistFM(synths.radioTuner, null, shortestDistance, nearestVertexDistance);
      updateParamsBasedOnDistFM(synths.noiseTuner, null, shortestDistance, nearestVertexDistance);
  } else {
      transitionToFMRestingState();
  }
}

let previousNormalizedDistance = 1; // 1.0 is ideally fm poly edge
// sampler tuning on contour traversal
function updateParamsBasedOnDistFM(audioComponent, filterComponent, shortestDistance, nearestVertexDistance) {
  // Normalize distance calculation against the nearest vertex distance
  const normalizedDistance = Math.max(0, Math.min(1, (shortestDistance / nearestVertexDistance - 0.01) / (2 - 0.01)) - 0.15); // minus 0.15 constant
  const targetSampleVolume = Tone.gainToDb(Math.abs(1 - normalizedDistance) + 0.01);
  const targetNoiseVolume = Tone.gainToDb(Math.abs(1 - normalizedDistance) + 0.02);
  const targetCutoff =  5500 * (1 - normalizedDistance);  // Adjust filter cutoff based on distance
  const maxDepth = 3; // Maximum depth of pitch modulation
  const scaledDepth = maxDepth * (1 - normalizedDistance);
  const targetSampleVolume_log = Math.log(10) * targetSampleVolume;
  const targetNoiseVolume_log = Math.log(10) * targetNoiseVolume;

  // console.log("shortest dist?: " + shortestDistance)
  // console.log("nearest vertex dist: " + nearestVertexDistance)
  // console.log("NEW NORMAL IS: " + normalizedDistance)

  // update any active instrument parameters
  // console.log("updating " + audioComponent.name);


  // update only filters
  if (filterComponent) {
      filterComponent.frequency.rampTo(targetCutoff, 0.5);
      // filterComponent.Q.rampTo(4, 1);
  }

  // only drone
  if (audioComponent === synths.droneSynth) {
    audioComponent.volume.rampTo(Tone.gainToDb(normalizedDistance / 2), 0.5);
    // console.log(audioComponent.volume)
    audioComponent.harmonicity.rampTo((1 - (normalizedDistance)), 0.5);

    pitchLFO.min = -scaledDepth;
    pitchLFO.max = scaledDepth;
  
    if (filterComponent) {
      // idk
    }

    // only primary sample player
  } else if (audioComponent === synths.radioTuner) {
    audioComponent.volume.rampTo(targetSampleVolume_log - 0.5, 0.45);

    // Conditional logic based on the threshold
    if (normalizedDistance < 0.3) {
      // Check if just crossing below the threshold
      if (previousNormalizedDistance >= 0.3) {
        // Switch to normal playback settings
        audioComponent.set({
          grainSize: 1.0,
          playbackRate: 1.0,
          overlap: 1,
        });
      }
    } else {
      // freaky settings when above the dist threshold
      audioComponent.set({
        grainSize: Math.exp(1 - normalizedDistance) / 10,
        playbackRate: Math.abs(normalizedDistance),
        overlap: 2,
        drift: Math.exp(1 - normalizedDistance) / 10
      });
    }

    // noise stuff
    let noiseVolume = Tone.gainToDb((1 - targetNoiseVolume_log)); 

    // noise-only sample player
    noiseTuner.volume.rampTo(noiseVolume - 35, 0.5);
    console.log(noiseTuner.volume.value)


    // pink noise 
    synths.noiseSynth.volume.rampTo(noiseVolume - 45, 0.5);
    noiseHP.frequency.rampTo(targetCutoff, 0.5);



    // Update previousNormalizedDistance for the next call
    previousNormalizedDistance = normalizedDistance;
  }
}



function rampGrainSize(audioComponent, targetGrainSize, duration) {
  const initialGrainSize = audioComponent.grainSize; // Assuming grainSize is a direct numeric property
  const stepTime = 20; // milliseconds per step
  const totalSteps = duration / stepTime;
  const stepSize = (targetGrainSize - initialGrainSize) / totalSteps;
  let currentStep = 0;
  
  const intervalId = setInterval(() => {
      if (currentStep < totalSteps) {
          audioComponent.grainSize += stepSize;  // Directly update the grainSize
          currentStep++;
      } else {
          clearInterval(intervalId);
          audioComponent.grainSize = targetGrainSize; // Ensure it ends exactly at target
      }
  }, stepTime);
  }
  
  function adjustGrainSizeBasedOnDistance(audioComponent, normalizedDistance) {
  const minGrainSize = 0.001; // very small grain size at the edge
  const maxGrainSize = 0.1;  // larger grain size, closer to real-time, at the center
  
  // Calculate the target grain size
  const targetGrainSize = minGrainSize + (maxGrainSize - minGrainSize) * (1 - normalizedDistance);
  
  rampGrainSize(audioComponent, targetGrainSize, 500); // Smooth transition over 500 ms
  }
  
  

function removeRayLine(uniqueId) {
  let line = fmRayLinesByUniqueId.get(uniqueId);
  if (line) {
    scene.remove(line);
    line.geometry.dispose();
    fmRayLinesByUniqueId.delete(uniqueId);
    if (fmRayLinesByUniqueId.size === 0) {
      // updateDroneSynthParams([]); // Mute the drone synth if no lines are active
    }
  }
}

// Helper function to update all lines with new color
function updateAllLinesWithNewColor(newColor) {
  fmRayLinesByUniqueId.forEach((line, uniqueId) => {
    line.material.color.set(newColor);  // Update the existing line's material color
    line.material.needsUpdate = true;  // Ensure the material updates in the scene
  });

  currentRayLines.forEach((line) => {
    line.material.color.set(newColor);  // Update each cell ray line's color
    line.material.needsUpdate = true;  // Ensure the material updates in the scene
  });
}


function findAllMatchingFMTowers(uniqueId) {
  let matchingTowers = [];
  let found = false;

  [window.instancedPyramidMatching, window.instancedPyramidNonMatching].forEach(instancedMesh => {
    const count = instancedMesh.count;
    for (let i = 0; i < count; i++) {
      if (instancedMesh.userData[i]?.uniqueId === uniqueId) {
        const matrix = new THREE.Matrix4();
        instancedMesh.getMatrixAt(i, matrix);
        const position = new THREE.Vector3().setFromMatrixPosition(matrix);

        if (!isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z)) {
          matchingTowers.push({
            uniqueId: uniqueId,
            position: position.clone()
          });
          found = true;
        }
      }
    }
  });

  return { towers: matchingTowers, found };
}

function calculateCentroid(polygon) {
  const vertices = polygon.geometry.attributes.position.array;
  let centroid = new THREE.Vector3(0, 0, 0);
  let count = vertices.length / 3;
  for (let i = 0; i < vertices.length; i += 3) {
    centroid.x += vertices[i];
    centroid.y += vertices[i + 1];
    centroid.z += vertices[i + 2];
  }
  centroid.divideScalar(count);
  return centroid;
}


let fmRayLines = [];
let fmRayLinesByUniqueId = new Map();
let avgRadius;

function drawFMLine(start, end, uniqueId, mesh, color) {
  let line = fmRayLinesByUniqueId.get(uniqueId);
  let lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);

  if (line) {
      scene.remove(line);
      line.geometry.dispose();
  }

  let fmRayMaterial = new THREE.LineBasicMaterial({ color });
  line = new THREE.Line(lineGeometry, fmRayMaterial);

  // Calculate nearest vertex distance using vertices stored in mesh userData
  let nearestVertexDistance = calculateNearestVertexDistance(start, mesh);
  line.userData.nearestVertexDistance = nearestVertexDistance;

  line.material.color.set(color);
  line.material.needsUpdate = true;  // Ensure the material updates


  scene.add(line);
  fmRayLinesByUniqueId.set(uniqueId, line);
}


function calculateNearestVertexDistance(point, mesh) {
  let nearestDistance = Infinity;
  if (mesh.userData.vertices) {
      mesh.userData.vertices.forEach(vertex => {
          const distance = vertex.distanceTo(point);
          if (distance < nearestDistance) {
              nearestDistance = distance;
          }
      });
  } else {
      console.error("No vertices data found in mesh userData");
  }
  return nearestDistance;
}



function clearFMrays(currentActiveIds) {
  
  // Check if currentActiveIds is defined and is a Set
  if (!currentActiveIds || !(currentActiveIds instanceof Set)) {
    fmRayLinesByUniqueId.forEach((line, uniqueId) => {
      scene.remove(line);
      line.geometry.dispose();
      fmRayLinesByUniqueId.delete(uniqueId);
      // synth.triggerRelease([Tone.now() + 0.1]); 
});
      // console.error("Invalid or undefined currentActiveIds passed to clearFMrays");
      return;  // Exit the function if currentActiveIds is not valid
  }
}


// function rampGrainSize(audioComponent, targetGrainSize, duration) {
//   const initialGrainSize = audioComponent.grainSize; // Assuming grainSize is a direct numeric property
//   const stepTime = 20; // milliseconds per step
//   const totalSteps = duration / stepTime;
//   const stepSize = (targetGrainSize - initialGrainSize) / totalSteps;
//   let currentStep = 0;

//   const intervalId = setInterval(() => {
//       if (currentStep < totalSteps) {
//           audioComponent.grainSize += stepSize;  // Directly update the grainSize
//           currentStep++;
//       } else {
//           clearInterval(intervalId);
//           audioComponent.grainSize = targetGrainSize; // Ensure it ends exactly at target
//       }
//   }, stepTime);
// }

// function adjustGrainSizeBasedOnDistance(audioComponent, normalizedDistance) {
//   const minGrainSize = 0.001; // very small grain size at the edge
//   const maxGrainSize = 0.1;  // larger grain size, closer to real-time, at the center

//   // Calculate the target grain size
//   const targetGrainSize = minGrainSize + (maxGrainSize - minGrainSize) * (1 - normalizedDistance);

//   rampGrainSize(audioComponent, targetGrainSize, 500); // Smooth transition over 500 ms
// }



// optimizing ray redrawing
// Last known values to detect significant changes
let lastCameraPosition = new THREE.Vector3();
let lastCameraQuaternion = new THREE.Quaternion();

// Thresholds for detecting significant movement or rotation
const positionThreshold = 0; // page units
const rotationThreshold = 0; // radians

function needsUpdate(camera) {
    // Calculate the change in position
    const positionChange = lastCameraPosition.distanceTo(camera.position);

    // Calculate the change in rotation using quaternion angle difference
    const rotationChange = lastCameraQuaternion.angleTo(camera.quaternion);

    // Check if the changes exceed thresholds
    if (positionChange > positionThreshold || rotationChange > rotationThreshold) {
        // Update last known values
        lastCameraPosition.copy(camera.position);
        lastCameraQuaternion.copy(camera.quaternion);
        return true;
    }
    return false;
}

function updateActiveRaycasterRays() {
  if (needsUpdate(camera)) {
      if (raycasterDict.cellTransmitterPoints.enabled) {
          getSortedCellRayDistances();
          processSortedCellRays();
      } else if (raycasterDict.fmTransmitterPoints.enabled) {
          // getSortedFMRayDistances();
          // processSortedFmRays();
          return
      }
  }
}


  let currentGridCode = null; // Keep track of the last gridCode encountered

  function raycastCellServiceMesh(intersection, gridCode) {
    // Check if the gridCode has changed
    if (gridCode !== currentGridCode) {
      // Update the currentGridCode
      currentGridCode = gridCode;
  
      // Access the preset for the new gridCode
      const preset = synthPresets.presets["cellServiceMesh"][gridCode];
      if (currentGridCode = 1) {

  
      } else {
        console.log(`Intersected unspecified gridCode ${gridCode}`, intersection);
      }
    }
  }

  // calculate the nearest vertex distance
  function raycastAccessVertex(intersection) {
    const intersectPoint = intersection.point;
    const vertices = intersection.object.userData.vertices;
    const gridCode = intersection.object.userData.gridCode || 'unknown';  // Default to 'unknown' if not provided

    if (vertices) {
        const nearestVertex = vertices.reduce((nearest, vertex) => {
            const distance = Math.hypot(vertex.x - intersectPoint.x, vertex.y - intersectPoint.y, vertex.z - intersectPoint.z);
            return distance < nearest.distance ? { vertex, distance } : nearest;
        }, { vertex: null, distance: Infinity });

        // Check if gridCode is a valid number and update audio parameters accordingly
        if (!isNaN(gridCode) && gridCode >= 0 && gridCode <= 5) {
            updateAccessAudioParams(nearestVertex.distance, parseInt(gridCode));
        }

        // console.log(`Nearest vertex distance: ${nearestVertex.distance}, Vertex: ${JSON.stringify(nearestVertex.vertex)}, Grid Code: ${gridCode}`);
    } else {
        console.log('No vertices data found in userData');
    }
}

function updateAccessAudioParams(distance, gridCode) {
  const accessRayMi = distance / 5280;
  let normalizedCellDistance = Math.max(0, Math.min(1, (accessRayMi - 0.1) / (10 - 0.1)));

  // init bits
  let bitDepth = 12;

  // Calculate BitCrusher settings based on gridCode
  if (gridCode !== undefined && gridCode !== 'unknown' && !isNaN(gridCode) && gridCode >= 0 && gridCode <= 5) {
    const scaleFactor = gridCode / 5;
    bitDepth = Math.ceil(2 + 7 * scaleFactor);  // Scale bit depth from 1 to 8
}

  bitCrusher.bits.rampTo(bitDepth, 0.5);  // Ramp the wet level to smooth transitions

}

  ///////////////////////////// 
  /// raycaster helpers n handlers
  //////////////////////////////////////////////////////////////

  // reorient cam-center raycaster for orthographic perspective
  function updateRaycasterOriginForTilt(camera, controls, terrainHeight = 0) {
    // let terrainHeight = meanElevation * zScale;
    const polarAngle = controls.getPolarAngle(); // Current vertical rotation in radians
    const cameraHeight = camera.position.z - terrainHeight; // Height of the camera from the terrain

    // Calculate the forward vector projection on the XY plane
    const forward = new THREE.Vector3(0, 0, -1); // Downward vector in z-up world
    camera.getWorldDirection(forward);
    forward.z = 0; // Project onto XY plane
    forward.normalize();

    // Calculate offset based on polar angle and camera height
    const offsetMagnitude = Math.tan(polarAngle) * cameraHeight;
    const offset = forward.multiplyScalar(offsetMagnitude);

    return new THREE.Vector3(camera.position.x + offset.x, camera.position.y + offset.y, terrainHeight);
}
 
// overall raycaster handler for animation loop
function handleRaycasters(camera, scene) {
  Object.entries(raycasterDict).forEach(([key, { group, enabled, onIntersect }]) => {
      if (enabled && group) {
          const raycaster = new THREE.Raycaster();
          const rayOrigin = updateRaycasterOriginForTilt(camera, controls);
          raycaster.set(rayOrigin, new THREE.Vector3(0, 0, -1));
          raycaster.params.Points.threshold = 0.175;

          const visibleChildren = group.children.filter(child => child.visible);
          const intersections = raycaster.intersectObjects(visibleChildren, true);
          // const intersections = raycaster.intersectObjects(group.children);

          if (intersections.length > 0) {
              if (key === 'fmTransmitterPoints') {
                  // updateDroneSynthParams(intersections); // Ensure this updates based on current intersections
                  onIntersect(intersections);
              } else {
                  onIntersect(intersections[0]);
              }

              intersections.forEach(intersection => {
                  printCameraCenterCoordinates(intersection.point);
                  raycasterReticule.position.set(intersection.point.x, intersection.point.y, intersection.point.z + 0.01);
                  raycasterReticule.material.color.set(currentColor);
                  if (!raycasterReticule.parent) {
                      scene.add(raycasterReticule);
                  }
              });
          } else {
              if (key === 'fmTransmitterPoints') {

                // drone to resting state
                transitionToFMRestingState();

                // remove rays
                clearFMrays();
              }
              if (raycasterReticule.parent) {
                  scene.remove(raycasterReticule);
              }
              // console.log("NO INTERSECTIONS");
          }
      }
  });
}


// Simple geodesic distance calculation (Haversine formula)
function calculateGeodesicDistance(p1, p2) {
  const R = 6371000; // Radius of Earth in meters, more precise value
  const φ1 = p1.lat * Math.PI / 180; // Convert degrees to radians
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180; // Delta latitude in radians
  const Δλ = (p2.lon - p1.lon) * Math.PI / 180; // Delta longitude in radians

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
    

///////////////////////////////////////////////////
/// add scale bar + lat/long printout
///////////////////////////////////////////////////

function decimalToDMS(coord, isLongitude = false) {
  const absolute = Math.abs(coord);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

  // Ensuring two digits
  const degreesStr = degrees.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = parseFloat(seconds).toFixed(2).toString().padStart(5, '0'); // '5' because "00.00"

  // Determining cardinal directions
  let cardinal = '';
  if (isLongitude) {
      cardinal = coord >= 0 ? 'E' : 'W';  // East or West for longitude
  } else {
      cardinal = coord >= 0 ? 'N' : 'S';  // North or South for latitude
  }

  return `${degreesStr}° ${minutesStr}' ${secondsStr}" ${cardinal}`;
}

function printCameraCenterCoordinates(intersectPoint) {
  // Convert from State Plane coordinates back to Geographic coordinates
  try {
      const result = proj4('EPSG:2261').inverse([intersectPoint.x, intersectPoint.y]);
      const latitudeDMS = decimalToDMS(result[1], false);  // Passing false for latitude
      const longitudeDMS = decimalToDMS(result[0], true);  // Passing true for longitude
      // const elevationReadout = [intersectPoint.z] / zScale;
      const displayText = `${latitudeDMS}<br>${longitudeDMS}`;  // Using DMS format with cardinal directions
      document.getElementById('latLonDisplay').innerHTML = displayText;  // Use innerHTML to render the line break
  } catch (error) {
      // console.error(`Error converting coordinates: ${error}`);
      document.getElementById('latLonDisplay').textContent = "Error in displaying coordinates.";
  }
}


function createScaleBar(scene) {
  const scaleBarLength = 100; // Adjust this based on your scale
  const divisionLength = scaleBarLength / 4;

  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const points = [];
  for (let i = 0; i <= 4; i++) {
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 0, 0));
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 5, 0));
      points.push(new THREE.Vector3(i * divisionLength - scaleBarLength / 2, 0, 0));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineSegments(geometry, material);
  line.position.set(0, -100, 0);

  scene.add(line);
  return line;
}

function updateScaleBar(scaleBar, camera) {
  if (!scaleBar || !camera) {
      console.error('Scale bar or camera is undefined!');
      return;
  }

  // Adjust scale bar size based on camera zoom or scene scale
  const scale = camera.zoom;
  scaleBar.scale.set(1 / scale, 1 / scale, 1 / scale);

  // Position scale bar relative to camera
  scaleBar.position.copy(camera.position);
  scaleBar.position.x -= 50;  // Adjust this value based on your scene setup
  scaleBar.position.y = -50;  // Keeps the scale bar at the bottom of the camera's view
}


////////////////

  ////////////
  /////////// 
  ////////////////////////////////


  // Function to animate your scene
  function animate() {
    delta += clock.getDelta();

    if (delta  > interval) {

      controls.update();

      // adjustCameraViewForTilt(camera, controls);

      handleRaycasters(camera, scene);

      // Check if camera and controls are initialized
      if (camera && controls) {
        if (isCameraRotating) {
          // autorotate stuff first //////////////
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

          ///// now hardware movement
          // encoder strafing + panning
          if (globalDeltaLeft !== 0 || globalDeltaRight !== 0) {
            // inverted values to align with etch a sketch style : )
            applyPan(-globalDeltaLeft, -globalDeltaRight);
      
            // Reset global deltas to prevent continuous panning
            globalDeltaLeft = 0;
            globalDeltaRight = 0;
          }
      
          // encoder rotation and tilt
          if (globalDeltaLeftPressed !== 0 || globalDeltaRightPressed !== 0) {
            const deltaXScale = 0.01;
            const deltaYScale = 0.01;
            camera.position.y += globalDeltaRightPressed * deltaYScale;
            camera.position.x += globalDeltaLeftPressed * deltaXScale;
    
            // Reset deltas after applying
            globalDeltaLeftPressed = 0;
            globalDeltaRightPressed = 0;
          }    

          // Ensure the camera keeps looking at the targe11t
          camera.lookAt(controls.target);

          updateActiveRaycasterRays();
          
          unlockAudioContext();

          Tone.Transport.cancel(Tone.now() + 0.1);  // Cancels all scheduled events 0.1 seconds ahead

          renderer.render(scene, camera);


        }}

      if (analogGroup.visible !== false) {
        updatefmContourGroups();

      }


      stats.update();  

      delta = delta % interval;
    }
    requestAnimationFrame(animate);
  }

  function clearRayLines() {
    // Remove all current ray lines from the scene and clear the array
    currentRayLines.forEach(line => {
        scene.remove(line);
        if (line.geometry) line.geometry.dispose();
    });
    currentRayLines = [];
  }
  

  // unlock AudioContext with websocket interaction
  function unlockAudioContext() {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext unlocked!');
        }).catch((error) => {
            console.error('Error resuming audio context:', error);
        });
    }
}

function initAudioContext() {
  // Check if context is in suspended state (this is the usual state in modern browsers due to autoplay policy)
  if (Tone.context.state === 'suspended') {
      Tone.context.resume().then(() => {
          console.log('AudioContext activated successfully');
      }).catch((error) => {
          console.log('Error activating AudioContext:', error);
      });
  }
}

  // Event listener for the button
  document.getElementById('audioControl').addEventListener('click', function() {
    initAudioContext();
    Tone.start() + 0.1; // Start Tone.js as well if not started
  });



var lastSwitchState1 = null; // Initialize last state for switch1
var lastSwitchState2 = null; // Initialize last state for switch2
var audioContext = new (window.AudioContext || window.AudioContext)(); // Initialize audio context

function initWebSocketConnection() {

  
  var ws = new WebSocket('ws://localhost:8080');
  // unlockAudioContext(); // Attempt to unlock AudioContext on WebSocket connection

  ws.onopen = function() {
    console.log('Connected to WebSocket server');
    // unlockAudioContext(); // Attempt to unlock AudioContext on WebSocket connection
  };

  ws.onmessage = function(event) {
    try {
      let serialData = JSON.parse(event.data);
      handleSerialData(serialData);
    } catch (e) {
      console.error("Error parsing WebSocket data:", e);
    }
  };

ws.onclose = function(event) {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    // Attempt to reconnect
    setTimeout(initWebSocketConnection, 5000);
  };

  ws.onerror = function(event) {
    console.error('WebSocket error observed:', event);
    // Optional: Close the WebSocket connection if it's still open to trigger a reconnection attempt.
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}

function handleSerialData(serialData){

  // console.log(serialData)

  let threeContainer = document.getElementById('gfx');
  // hide mouse cursor if/when data is received
  document.body.style.cursor = 'none';
  setTimeout(() => threeContainer.classList.remove('background'), 1000);

  // let serialData = JSON.parse(event.data);

  // console.log('ws data:', serialData); // This will correctly log the object structure

  // Check if the left button is pressed or if there's any movement on the left encoder
  if (serialData.buttonPressedLeft || serialData.deltaLeft !== 0) {
    document.getElementById('audioControl').click();
    console.log('Triggered AudioContext unlock via button or encoder movement');
}



  if (serialData.LEDpotValue !== undefined && !isDragging) {
    const scaledValue = Math.round(remapValues(serialData.LEDpotValue, 201, 300, 300, 201));
    const slider = document.getElementById('fm-channel-slider');
    slider.value = scaledValue; // Programmatically update slider value
    updateLabelPosition(scaledValue); 
    updateDisplays(scaledValue);
  }
  
  if (serialData.zoomPotValue !== undefined && !isDragging) {
    // scale between min zoom and max zoom values for ortho cam
    const exponent = 2;  // add exponential curve to remapping
    const scaledValue = Math.round(remapValuesExp(serialData.zoomPotValue, 0, 1023, 60, 360, exponent));
    adjustCameraZoomSlidePot(scaledValue);
  }


  if (serialData.deltaLeft !== undefined && serialData.deltaRight !== undefined) {
    globalDeltaLeft = serialData.deltaLeft;
    globalDeltaRight = serialData.deltaRight;
  }

  if (serialData.deltaLeftPressed !== undefined && serialData.deltaRightPressed !== undefined) {
    globalDeltaLeftPressed = serialData.deltaLeftPressed;
    globalDeltaRightPressed = serialData.deltaRightPressed;
  }

  // Check for switchState1 in the data and toggle group visibility accordingly 
  // if the state changes
  if (serialData.switchState1 !== undefined && serialData.switchState1 !== lastSwitchState1) {
    lastSwitchState1 = serialData.switchState1;
    toggleMapScene(serialData.switchState1, 'switch1');
  }

  // Check for switchState2 and update if changed
  if (serialData.switchState2 !== undefined && serialData.switchState2 !== lastSwitchState2) {
    lastSwitchState2 = serialData.switchState2;
    toggleMapScene(serialData.switchState2, 'switch2');
  }
}

// keyboard commands, mirror spdt switch functionality
function onDocumentKeyDown(event) {
  switch (event.key) {
    case '1':
      toggleMapScene(1, 'switch1');
      break;
    case '2':
      toggleMapScene(2, 'switch1');
      break;
    case '3':
      toggleMapScene(1, 'switch2');
      break;
    case '4':
      toggleMapScene(2, 'switch2');
      break;
    default:
      break;
  }
}

// scene layer toggles
function toggleMapScene(switchState, source) {
  const canvas = document.getElementById('gfx');
  let activeAudioChannel;  // Declare variable at function scope
  let isDecaying;

  if (source === 'switch1') {
    analogGroup.visible = false;
    digitalGroup.visible = false;
    // channelSlider.domElement.style.cssText = 'visible:false,';
    let channelSlider = document.getElementById('fm-channel-controls');

    // analog if switch is in pos1, otherwise digital
    activeAudioChannel = switchState === 1 ? 'analogChannel' : 'digitalChannel';


    // raycasterDict.cellServiceMesh.enabled = false;
    raycasterDict.cellTransmitterPoints.enabled = false;
    raycasterDict.fmTransmitterPoints.enabled = false;

    // Clear existing ray lines from all groups
    clearFMrays();
    clearCellRays();

    // Set all FM propagation groups to decay immediately or hide them
    Object.keys(fmContourGroups).forEach(groupId => {
      fmContourGroups[groupId].isDecaying = true;
      fmContourGroups[groupId].decayRate = 1.0;
      updatefmContourGroups();
    });

    switch (switchState) {
      case 1: // Analog mode
        analogGroup.visible = true;
        fmTransmitterPoints.visible = true;  
        raycasterDict.fmTransmitterPoints.enabled = true;
        raycasterDict.cellTransmitterPoints.enabled = false;
        channelSlider.style.visibility = "visible";
        // synths.droneSynth.triggerRelease(Tone.now()+ 0.1)
        synths.droneSynth.triggerAttack("F2", Tone.now() + 0.1);
        // safeTriggerSound(droneSynth, "F2", "0.5"); 


        if (lastChannelFilter !== null) {
          addFMpropagation3D(fmContoursGeojsonData, lastChannelFilter, fmPropagationContours);
        }


        break;

      case 2: // Digital mode
        lastChannelFilter = channelFilter;
        digitalGroup.visible = true;
        analogGroup.visible = false;
        fmTransmitterPoints.visible = false;
        // raycasterDict.cellServiceMesh.enabled = true;
        raycasterDict.cellTransmitterPoints.enabled = true;
        raycasterDict.fmTransmitterPoints.enabled = false;
        activeAudioChannel = 'digitalChannel';
        // synths.droneSynth.triggerRelease(Tone.now()+ 0.1)
        synths.droneSynth.triggerAttack("A3", Tone.now() + 0.1);
        // safeTriggerSound(droneSynth, "A3", "0.5"); 

        channelSlider.style.visibility = "hidden";

        Object.keys(fmContourGroups).forEach(groupId => {
          fmContourGroups[groupId].isDecaying = true;
          fmContourGroups[groupId].decayRate = 1.0; // Set decay rate for immediate effect
          updatefmContourGroups(); // Call update function to process changes
        });

        break;

    
    }

    // Use the activeAudioChannel determined by the switch
    if (activeAudioChannel) {
      switchSynth(activeAudioChannel);  // Use the consolidated switching function
    } else {
      console.error("No active audio channel was set for " + source);
    }
  
  } else if (source === 'switch2') {

    activeAudioChannel = switchState === 1 ? 'elevationChannel' : 'accessChannel';


    switch (switchState) {
      case 1:
        elevContourLines.visible = true;
        accessGroup.visible = false;
        raycasterDict.accessibilityMesh.enabled = false;
        activeAudioChannel = 'elevationChannel'; // This should match an existing channel or be defined similarly
        break;

      case 2:
        accessGroup.visible = true;
        elevContourLines.visible = false;
        raycasterDict.accessibilityMesh.enabled = true;
        activeAudioChannel = 'accessChannel'; // This should match an existing channel or be defined similarly
        break;

        default:
          accessGroup.visible = false;
          elevContourLines.visible = false;
          
        break;

    }

    // Use the activeAudioChannel determined by the switch
    if (activeAudioChannel) {
      switchSynth(activeAudioChannel);  // Use the consolidated switching function
    } else {
      console.error("No active audio channel was set for " + source);
    }
  }
}

  
  // Function to initialize the scene and other components
  async function initialize() {
    initThreeJS();
    initToneJS();

    // Initialize pixelationFactor
    pixelationFactor = null;

    onWindowResize(); // Update the resolution

    // Load GeoJSON data and then enable interaction
    try {
      await loadAllData();
      postLoadOperations();
      initWebSocketConnection();
      // unlockAudioContext(); // Attempt to unlock AudioContext on WebSocket connection
      enableInteraction();
      flipCamera();
  } catch (error) {
      console.error('Initialization failed:', error);
  }

    // loadGeoJSONData(() => {
    //   postLoadOperations(); // Setup the scene after critical datasets are loaded

    //   // // Ensure the sliderValue is up-to-date
    //   // sliderValue = (parseFloat(document.getElementById('fm-channel-slider').value) / sliderLength);
    //   // const resolutionSlider = document.getElementById('fm-channel-slider');
    //   // updateSliderDisplay(sliderValue, resolutionSlider);
  

    //   initWebSocketConnection();
    //   enableInteraction(); // Directly enable interaction without waiting for a button click
    //   flipCamera();



    //   // document.getElementById('progress-bar').style.display = 'none'; // Hide the progress bar
    // });



  }


  function enableInteraction() {
    const threeContainer = document.getElementById('gfx');


    // Render the scene once before making it visible
    renderer.render(scene, camera);


    camera.updateProjectionMatrix();

    // Use requestAnimationFrame to ensure the rendering is done
    requestAnimationFrame(() => {
      // Reveal the container and info button simultaneously
      threeContainer.style.visibility = 'visible';
      threeContainer.style.opacity = '1';
      threeContainer.style.pointerEvents = 'auto';



      // Start the animation loop
      animate();
      document.addEventListener('keydown', onDocumentKeyDown, false); // Attach the keydown event handler

    });

    visualizationReady = true;
  }

  document.addEventListener('DOMContentLoaded', (event) => {
    initialize();
  });


  document.addEventListener('mousemove', function() {
    document.body.style.cursor = ''; // reset to default cursor if we got a mouse going
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
    { threshold: 0.666, dashSize: dashSize / 2, gapSize: gapSize / 8 }, // Closest zoom
    { threshold: 0.75, dashSize: dashSize, gapSize: gapSize / 6},
    { threshold: 1.5, dashSize: dashSize * 4, gapSize: gapSize / 3},
    // { threshold: 2, dashSize: dashSize, gapSize: gapSize }, // Farthest zoom
  ];
  
    let currentZoomLevelIndex = -1; // Index of the currently applied zoom level

    function updateDashSizeForZoom() {
      const distanceToTarget = camera.position.distanceTo(controls.target);
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
          
          // Iterate over each group in fmContourGroups
          Object.values(fmContourGroups).forEach(group => {
              // Update all line loops within the group
              group.meshes.forEach(mesh => {
                  if (mesh.material instanceof THREE.LineBasicMaterial) {
                      mesh.material.dashSize = selectedZoomLevel.dashSize;
                      mesh.material.gapSize = selectedZoomLevel.gapSize;
                      mesh.material.needsUpdate = true;
                      mesh.computeLineDistances();
                  }
              });
          });
      }
  }
      
  function getBoundingBoxOfGeoJSON(geojson) {
    if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        console.error('GeoJSON data is invalid or not a FeatureCollection:', geojson);
        throw new Error('GeoJSON data is invalid or not a FeatureCollection');
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    geojson.features.forEach((feature) => {
        const geometry = feature.geometry;
        const coordinates = geometry.coordinates;

        switch (geometry.type) {
            case 'Polygon':
                coordinates.forEach(polygon => {
                    polygon.forEach(coord => {
                        const [x, y] = toStatePlane(coord[0], coord[1]);
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    });
                });
                break;
            case 'MultiPolygon':
                coordinates.forEach(polygons => {
                    polygons.forEach(polygon => {
                        polygon.forEach(coord => {
                            const [x, y] = toStatePlane(coord[0], coord[1]);
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                        });
                    });
                });
                break;
        }
    });


    return {
        min: new THREE.Vector3(minX, minY, -Infinity),
        max: new THREE.Vector3(maxX, maxY, Infinity),
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
  // const zScale = 0.00025; // smaller value better for perspective cam
  const zScale = 0.00035; // larger value better for ortho cam

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
    const meanElevation = Math.round(totalElevation / elevations.length,0);
  
    // Optionally, calculate min and max elevations for additional insights
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
  
    // console.log(`Min Elevation: ${minElevation}, Max Elevation: ${maxElevation}, Mean Elevation: ${meanElevation}`);
  
    return meanElevation;
  }

  
  // Define a variable to store the minimum elevation
  // This should be determined from the addElevContourLines function
  let globalMinElevation = Infinity;
  let meanElevation = Infinity + 1;

  function addElevContourLines(geojson, contourInterval = 100) { // Only process contours at specified intervals
    return new Promise((resolve, reject) => {
      console.log('adding elevation');
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
  
      // console.log('terrain features: ', geojson.features.length / 2);
      geojson.features.forEach((feature, index) => {
        const contour = feature.properties.contour;
  
        // Skip contours not at the specified interval
        if (contour % contourInterval !== 0) {
          return;
        }
  
        const coordinates = feature.geometry.coordinates; // Array of [lon, lat] pairs
        const color = getColorForElevation(contour, minElevation, maxElevation);
  
        // Calculate logarithmic opacity scaling
        let minOpacity = 0.2;
        let maxOpacity = 0.75;
        let scaleExponent = 0.75; // Adjust this to control the rate of change

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
        scene.add(elevContourLines); 
        resolve(); // Resolve the promise when done
      } catch (error) {
        reject(`Error in addElevContourLines: ${error.message}`);
      }
    });
  }

  //   // radiating triangle fill polys - needs closed geom
  // function addWaterPoly(geojson, stride = 1) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       for (let i = 0; i < geojson.features.length; i += stride) {
  //         const feature = geojson.features[i];

  //         // Create a new material for each polygon
  //         const material = new THREE.MeshBasicMaterial({
  //           color: colorScheme.waterColor,
  //           transparent: true,
  //           wireframe: true,
  //           dithering: true,
  //           opacity: 0.8, // Start with lower opacity
  //           side: THREE.FrontSide,
  //         });

  //         try {
  //           const shapeCoords = feature.geometry.coordinates[0];
  //           const vertices = [];
  //           let centroid = new THREE.Vector3(0, 0, 0);

  //           // Convert coordinates to vertices and calculate centroid
  //           shapeCoords.forEach((coord) => {
  //             const [x, y] = toStatePlane(coord[0], coord[1]);
  //             const z = meanElevation * zScale; // Set Z to a hardcoded contour elevation
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
  //           waterPolys.add(mesh);
  //         } catch (error) {
  //           console.error(`Error processing feature at index ${i}:`, error);
  //         }
  //       }
  //       // Add the water poly group to the scene
  //       scene.add(waterPolys);

  //       // Set the initial visibility of the fm propagation curves layer to false
  //       waterPolys.visible = false;

  //       resolve(); // Resolve the promise when done
  //     } catch (error) {
  //       reject(`Error in addPolygons: ${error.message}`);
  //     }
  //   });
  // }

// debug

function logMeshData(group) {
  group.children.forEach((child, index) => {
      console.log(`Child ${index}: Type = ${child.type}`);
      if (child.userData && Object.keys(child.userData).length > 0) {
          console.log(`  UserData: `, child.userData);
      } else {
          console.log(`  No userData found`);
      }
      if (child.children && child.children.length > 0) {
          console.log(`  This child has ${child.children.length} sub-children, checking those now:`);
          logMeshData(child);  // Recursively log data for nested children
      }
  });
}


  function addCellServiceMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        // Reset/clear the group to avoid adding duplicate meshes
        cellServiceMesh.clear();
        cellServiceRayMesh.clear();  // Additional mesh group for raycasting

        // Downsample and group points by 'group_ID'
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const gridCode = feature.properties.grid_code;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat);
          const z = feature.properties.Z * (zScale*1.025); // slightly higher z-scale bc z-fighting w other meshes
  
          if (!groups[gridCode]) {
            groups[gridCode] = [];
          }
          groups[gridCode].push(new THREE.Vector3(x, y, z));
        }

  
        // Process each grid_code group separately
        Object.keys(groups).forEach((gridCode) => {
          const pointsForDelaunay = groups[gridCode];
          const flatPointsForDelaunay = pointsForDelaunay.map(p => new THREE.Vector3(p.x, p.y, 0)); // Clone for flat mesh
  
          var delaunay = Delaunator.from(
            pointsForDelaunay.map((p) => [p.x, p.y]),
          );
          var meshIndex = [];
          // set triangulation distance threshold to avoid connecting distant pts
          const thresholdDistance = 0.15; 

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

          var geom = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
          geom.setIndex(meshIndex);
          geom.computeVertexNormals();
        
          var flatGeom = new THREE.BufferGeometry().setFromPoints(flatPointsForDelaunay); // Geometry for flat mesh
          flatGeom.setIndex(meshIndex);
          flatGeom.computeVertexNormals();
                  
          // unique symbols based on grid_code
          let wireframeMaterial, fillMaterial, flatWireframeMaterial;
          switch (gridCode) {

            case `0`:

                // Wireframe material
                wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: colorScheme.cellServiceNo,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.5,
                  wireframe: true,
                  side: THREE.DoubleSide,
                });

                // Solid fill material (black fill)
                fillMaterial = new THREE.MeshBasicMaterial({
                  color: 0x000000, // Black color for the fill
                  transparent: true,    
                  opacity: 0.85, 
                  alphaHash: true,
                  side: THREE.DoubleSide, //
                  wireframe: false,
                  visible: true,
                });

                flatWireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.3,
                  wireframe: true,
                  side: THREE.DoubleSide,
                  visible: false,
                });



            break;

              case `1`:

                // Wireframe material
                wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: colorScheme.cellServiceYes,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.4,
                  wireframe: true,
                  side: THREE.DoubleSide,
                  visible: true,
                });

                // Solid fill material (black fill)
                fillMaterial = new THREE.MeshBasicMaterial({
                  color: 0x000000, // Black color for the fill
                  transparent: true,    
                  opacity: 1, 
                  alphaHash: true,
                  side: THREE.DoubleSide, //
                  wireframe: false,
                  visible: false,
                });

                flatWireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.3,
                  wireframe: true,
                  side: THREE.DoubleSide,
                  visible: false,
                });



            break;

              default:

                flatWireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  transparent: true,
                  alphaHash: true,
                  opacity: 0.3,
                  wireframe: true,
                  side: THREE.DoubleSide,
                  visible: false,
                });


                // Solid fill material (black fill)
                // fillMaterial = new THREE.MeshBasicMaterial({
                //   color: 0x000000, // Black color for the fill
                //   transparent: true,    
                //   opacity: 1, 
                //   alphaHash: true,
                //   side: THREE.DoubleSide, //
                //   wireframe: false,
                // });


            }


          // Create mesh with the fill material
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          // fillMesh.name = 'fillMesh-' + gridCode;

          // Create mesh with the wireframe material
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
          var flatWireframeMesh = new THREE.Mesh(flatGeom, flatWireframeMaterial);
                  // wireframeMesh.name = 'wireframeMesh-' + gridCode;

          // add metadata to the meshes for raycaster triggers
          fillMesh.userData.gridCode = gridCode;
          console.log("Setting gridCode userData for mesh:", gridCode);
          wireframeMesh.userData.gridCode = gridCode;
          flatWireframeMesh.userData.gridCode = gridCode;
          
          // Group to hold both meshes
          var group = new THREE.Group();
          group.add(wireframeMesh);
          group.add(fillMesh);

          var flatGroup = new THREE.Group();
          flatGroup.add(flatWireframeMesh);
        
          // Add the group to the cellServiceMesh group
          cellServiceMesh.add(group);
          cellServiceRayMesh.add(flatGroup); 
        });

        // // create points group for raycasting / sound triggers only
        Object.keys(groups).forEach(gridCode => {
          const pointsForDelaunay = groups[gridCode];
          const pointsMaterial = new THREE.PointsMaterial({
            size: 1,
            // color: accessibilityColorRamp(parseInt(gridCode)),
            // opacity: accessibilityOpacityRamp(parseInt(gridCode)),
            transparent: false,
            visible: true,
          });
          const pointsGeometry = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
          const points = new THREE.Points(pointsGeometry, pointsMaterial);

          points.userData = { gridCode, vertices: pointsForDelaunay };

          var pointsGroup = new THREE.Group();
          pointsGroup.add(points);  // Add points directly to the group

          // cellServiceMesh.add(pointsGroup);


        });
        


        scene.add(cellServiceMesh);
        scene.add(cellServiceRayMesh); // Add the flat mesh group to the scene

  
        // report on group geom types
        // logMeshData(cellServiceMesh);



        resolve({ cellServiceMesh, cellServiceRayMesh }); // Optionally return both groups
      } catch (error) {
        reject(`Error in addCellServiceMesh: ${error.message}`);
      }
    });
  }



  // function to create color ramps programatically
  function interpolateColor(color1, color2, factor) {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
      result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return result;
  }
  
  function hexToRgb(hex) {
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    return [r, g, b];
  }
  
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  
  // calculate color ramp for accessibility mesh
  function accessibilityColorRamp(gridCode) {
    // '#230075'
    const startColor = hexToRgb(0x230075); 
    const endColor = hexToRgb(0x00ff00); 
    // const startColor = hexToRgb(0x4b2c92); 
    // const endColor = hexToRgb(0x00b545); 
    const factor = gridCode / 8;
    const interpolatedColor = interpolateColor(startColor, endColor, factor);
    return rgbToHex(...interpolatedColor);
  }
  

  // calculate opacity ramp for accessibility mesh
  function accessibilityOpacityRamp(gridCode) {
    const minOpacity = 0.1;
    const maxOpacity = 0.9;
    const scaleExponent = 0.15; // Adjust this to control the rate of change
    
    // Normalize gridCode value between 0 and 1
    const normalizedGridCode = 1 - (gridCode / 8); // Assuming grid codes range from 0 to 8

    
    // Apply exponential scaling to opacity
    const opacity = minOpacity + (maxOpacity - minOpacity) * Math.pow(normalizedGridCode, scaleExponent);
    
    return 0.1 + (0.8 * gridCode / 8); // Evenly spread from 0.1 to 0.9
  }
  

  function addAccessibilityMesh(geojson, stride = 1) {
    return new Promise((resolve, reject) => {
      try {
        accessibilityMesh.clear(); // Clear existing meshes to avoid duplicates.
  
        const groups = {};
        for (let i = 0; i < geojson.features.length; i += stride) {
          const feature = geojson.features[i];
          const gridCode = feature.properties.grid_code;
          const [lon, lat] = feature.geometry.coordinates;
          const [x, y] = toStatePlane(lon, lat);
          const z = feature.properties.Z * zScale;
  
          if (!groups[gridCode]) {
            groups[gridCode] = [];
          }
          groups[gridCode].push(new THREE.Vector3(x, y, z));
        }

      // create points group for raycasting / sound triggers only
      Object.keys(groups).forEach(gridCode => {
        const pointsForDelaunay = groups[gridCode];
        const pointsMaterial = new THREE.PointsMaterial({
          // size: 5,
          // color: accessibilityColorRamp(parseInt(gridCode)),
          // opacity: accessibilityOpacityRamp(parseInt(gridCode)),
          transparent: false,
          visible: false,
        });
        const pointsGeometry = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
        const points = new THREE.Points(pointsGeometry, pointsMaterial);

        points.userData = { gridCode, vertices: pointsForDelaunay };

        var group = new THREE.Group();
        group.add(points);  // Add points directly to the group

        accessibilityMesh.add(group);
      });
  
  
        Object.keys(groups).forEach(gridCode => {
          const pointsForDelaunay = groups[gridCode];
          var delaunay = Delaunator.from(pointsForDelaunay.map(p => [p.x, p.y]));
          var meshIndex = [];
          const thresholdDistance = 0.15; // Threshold distance for triangulation.
  
          for (let i = 0; i < delaunay.triangles.length; i += 3) {
            const p1 = pointsForDelaunay[delaunay.triangles[i]];
            const p2 = pointsForDelaunay[delaunay.triangles[i + 1]];
            const p3 = pointsForDelaunay[delaunay.triangles[i + 2]];
  
            if (distanceBetweenPoints(p1, p2) <= thresholdDistance &&
                distanceBetweenPoints(p2, p3) <= thresholdDistance &&
                distanceBetweenPoints(p3, p1) <= thresholdDistance) {
              meshIndex.push(delaunay.triangles[i], delaunay.triangles[i + 1], delaunay.triangles[i + 2]);
            }
          }
  
          var geom = new THREE.BufferGeometry().setFromPoints(pointsForDelaunay);
          geom.setIndex(meshIndex);
          geom.computeVertexNormals();
  
          const gridCodeColor = accessibilityColorRamp(parseInt(gridCode));
          const accessibilityOpacity = accessibilityOpacityRamp(parseInt(gridCode));
  
          let fillMaterial = new THREE.MeshBasicMaterial({
            color: gridCodeColor,
            opacity: accessibilityOpacity / 1.5,
            transparent: true,
            alphaHash: true,
            side: THREE.DoubleSide,
            visible: true
          });
  
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: gridCodeColor,
            opacity: accessibilityOpacity * 1.5,
            wireframe: true,
            transparent: true,
            alphaHash: true,
            side: THREE.DoubleSide,
            visible: true
          });
          const flatMaterial = new THREE.MeshBasicMaterial({
            color: gridCodeColor,
            opacity: accessibilityOpacity * 1.5,
            wireframe: true,
            transparent: true,
            alphaHash: true,
            side: THREE.DoubleSide,
            visible: true
          });

  
          var fillMesh = new THREE.Mesh(geom, fillMaterial);
          var wireframeMesh = new THREE.Mesh(geom, wireframeMaterial);
  
          fillMesh.userData = { gridCode, vertices: pointsForDelaunay };
          wireframeMesh.userData = { gridCode, vertices: pointsForDelaunay };
  
          var group = new THREE.Group();
          group.add(fillMesh);
          group.add(wireframeMesh);
  
          accessibilityMesh.add(group);
        });
  
        scene.add(accessibilityMesh);
        // console.log(`Accessibility mesh added with ${geojson.features.length / stride} features`);
  
        resolve(accessibilityMesh);
      } catch (error) {
        console.error(`Error in adding accessibility mesh: ${error.message}`);
        reject(error);
      }
    });
  }
  

// Define an array to track all line loops and their decay status
let fmContourGroups = {}; // Object to store line loop groups
let lineLoops = {};

function updatefmContourGroups() {
  Object.keys(fmContourGroups).forEach(groupId => {
    const group = fmContourGroups[groupId];
    if (group.isDecaying) {
      group.opacity -= group.decayRate;
      group.opacity = Math.max(group.opacity, 0);

      group.meshes.forEach(mesh => {
        mesh.material.opacity = group.opacity;
        mesh.visible = group.opacity > 0;
      });

      if (group.opacity <= 0) {
        group.meshes.forEach(mesh => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        });
        delete fmContourGroups[groupId];
      }
    }
  });
}

// Helper function to calculate the centroid of a polygon
function computeCentroid(vertices) {
  let centroid = new THREE.Vector3(0, 0, 0);
  vertices.forEach(vertex => {
      centroid.add(vertex);
  });
  centroid.divideScalar(vertices.length);
  return centroid;
}

// Helper function to calculate the average radius from the centroid
function computeAverageRadius(vertices, centroid) {
  let totalDistance = 0;

  vertices.forEach(vertex => {
      // Convert vertex coordinates back to geographic coordinates
      const vertexGeo = toGeographic(vertex.x, vertex.y);
      const centroidGeo = toGeographic(centroid.x, centroid.y);

      // Calculate geodesic distance using the provided Haversine function
      const distanceInMeters = calculateGeodesicDistance(
          { lat: vertexGeo.lat, lon: vertexGeo.lon },
          { lat: centroidGeo.lat, lon: centroidGeo.lon }
      );

      // Accumulate the total distance
      totalDistance += distanceInMeters;
  });

  // Convert total distance from meters to kilometers and calculate the average
  return (totalDistance / vertices.length) / 1000;
}

// Function to add FM propagation 3D line loops
function addFMpropagation3D(geojson, channelFilter, fmPropagationContours, stride = 1) {
  return new Promise((resolve, reject) => {
      fmPropagationContours.children.forEach(child => {
        fmPropagationContours.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.lineMaterial) child.lineMaterial.dispose();
    });


        // Existing groups not matching the current channelFilter are marked for decay
        Object.keys(fmContourGroups).forEach(groupId => {
            if (groupId !== channelFilter.toString() || analogGroup.visible === false) {
                fmContourGroups[groupId].isDecaying = true;
                fmContourGroups[groupId].decayRate = 0.1; // Adjust decay rate as needed
            }
        });

        // Extract all indices
        const indices = geojson.features.map(feature => {
          const keyParts = feature.properties.key.split('_');
          return parseInt(keyParts[keyParts.length - 1], 10); 
      });

      // Determine the new range for dynamic opacity
      const opacityReductionThreshold = 1; // Start reducing opacity from this index
      const minIndexForOpacity = Math.min(...indices);
      const maxOpacity = .9;
      const minOpacity = 0.3;

      // Separate indices into negative and non-negative
        const negativeIndices = geojson.features.map(feature => {
        const keyParts = feature.properties.key.split('_');
        const index = parseInt(keyParts[keyParts.length - 1], 10); 
        return index < 0 ? index : null; // Only consider negative indices
        }).filter(index => index !== null);

        const maxNegativeIndex = Math.max(...negativeIndices); // Closer to 0
        const minNegativeIndex = Math.min(...negativeIndices); // Further from 0
        const opacityRange = maxOpacity - minOpacity; // Defined range for negatives

        // console.log(`FM propagation curves added with ${geojson.features.length / stride} features`);

        geojson.features.forEach((feature, idx) => {
            if (idx % stride !== 0) return;
            const uniqueId = feature.properties.key.split('_')[0]; // Assuming this is how you extract the ID
            const channel = parseInt(feature.properties.channel, 10);
            if (channel !== channelFilter) return;

            const elevationData = feature.properties.elevation_data;
            // if (!elevationData || elevationData.length !== feature.geometry.coordinates[0].length) {
            //     console.error(`Elevation data length does not match coordinates length for feature at index ${idx}`);
            //     return; // Skip this feature
            // }

            // Calculate feature opacity based on its index
            let contourIndex = parseInt(feature.properties.key.split('_').pop(), 10);
            let opacity = maxOpacity;

            // Apply dynamic opacity for indices < N through the minimum negative index
            if (contourIndex < opacityReductionThreshold) {
              opacity = minOpacity + (opacityRange * (contourIndex - minIndexForOpacity) / (opacityReductionThreshold - 1 - minIndexForOpacity));
            }

            const lineMaterial = new THREE.LineBasicMaterial({
              color: colorScheme.polygonColor,
              transparent: true,
              alphaHash: true,
              opacity: opacity,   
              visible: analogGroup.visible && channel === channelFilter // Set visibility based on analogGroup  
          });
      
          const vertices = feature.geometry.coordinates[0].map(coord => {
              const [x, y] = toStatePlane(coord[0], coord[1]);
              const z = elevationData[Math.abs(contourIndex)] * zScale;
              return new THREE.Vector3(x, y, z);
          });
      
          const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
          const lineLoop = new THREE.Line(geometry, lineMaterial);
          lineLoop.computeLineDistances();
      
          // Triangulate for filled mesh
          const flatVertices = [];
          vertices.forEach(vertex => {
              flatVertices.push(vertex.x, vertex.y); // Flatten for earcut
          });
          const triangles = Earcut.triangulate(flatVertices, null, 2); // Second argument for holes, third for dimensions

          // Compute the centroid and average radius property
          const centroid = computeCentroid(vertices);
          const avgRadius = computeAverageRadius(vertices, centroid);
      
          const meshGeometry = new THREE.BufferGeometry();
          const positionArray = new Float32Array(triangles.length * 3); // 3 vertices per triangle
          triangles.forEach((index, i) => {
              positionArray[i * 3] = vertices[index].x;
              positionArray[i * 3 + 1] = vertices[index].y;
              // positionArray[i * 3 + 2] = vertices[index].z; // Apply elevation
              positionArray[i * 3 + 2] = 0 // or not! for raycasting sake
          });
          meshGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
      
          const meshMaterial = new THREE.MeshBasicMaterial({
              color: colorScheme.polygonColor,
              side: THREE.DoubleSide,
              wireframe: false,
              transparent: true,
              opacity: opacity,
              visible: analogGroup.visible && channel === channelFilter
            });

          const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
          mesh.userData = {
            channelFilter: feature.properties.channel, 
            uniqueId: uniqueId,
            contourIndex: contourIndex,
            avgRadius: avgRadius,
            vertices: vertices,
          };

          // console.log(" vertices are: " + JSON.stringify(vertices))
                  
          // Add to group and scene
          const groupId = feature.properties.key.split('_')[0];
          if (!fmContourGroups[groupId] || analogGroup.visible === false) {
              fmContourGroups[groupId] = {
                  meshes: [],
                  opacity: 1.0,
                  isDecaying: false,
                  decayRate: 0.1
              };
          }
          fmContourGroups[groupId].meshes.push(lineLoop, mesh);
          fmPropagationContours.add(lineLoop);
          fmPropagationPolygons.add(mesh);
      });


      scene.add(fmPropagationContours);
      scene.add(fmPropagationPolygons);

      resolve();
  });
}

async function addFMTowerPts(geojson, channelFilter, group) {
  try {
    // Define the base size, height, and characteristics for the pyramids
    const baseSizeMatching = 0.008;
    const pyramidHeightMatching = 0.035;
    const baseSizeNonMatching = baseSizeMatching * 0.7;
    const pyramidHeightNonMatching = pyramidHeightMatching * 0.7;

    // Define colors and opacities
    const matchingColor = new THREE.Color(colorScheme.matchingPyramidColor);
    const nonMatchingColor = new THREE.Color(colorScheme.nonMatchingPyramidColor);
    const matchingOpacity = 0.8;
    const nonMatchingOpacity = 0.6;

    // Prepare instanced mesh materials
    const materialMatching = new THREE.MeshBasicMaterial({ 
      color: matchingColor, 
      transparent: true, 
      alphaHash: true,
      opacity: matchingOpacity 
    });
    const materialNonMatching = new THREE.MeshBasicMaterial({ 
      color: nonMatchingColor, 
      transparent: true, 
      alphaHash: true,
      opacity: nonMatchingOpacity 
    });

    // Create pyramid geometries
    const pyramidGeometryMatching = new THREE.ConeGeometry(baseSizeMatching, pyramidHeightMatching, 4);
    pyramidGeometryMatching.rotateX(Math.PI / 2);
    const pyramidGeometryNonMatching = new THREE.ConeGeometry(baseSizeNonMatching, pyramidHeightNonMatching, 4);
    pyramidGeometryNonMatching.rotateX(Math.PI / 2);

    // Estimate total counts for instanced meshes
    const totalCount = geojson.features.length;

    // Initialize or clear previous instanced meshes
    if (window.instancedPyramidMatching) fmTransmitterPoints.remove(window.instancedPyramidMatching);
    if (window.instancedPyramidNonMatching) fmTransmitterPoints.remove(window.instancedPyramidNonMatching);

    window.instancedPyramidMatching = new THREE.InstancedMesh(pyramidGeometryMatching, materialMatching, totalCount);
    window.instancedPyramidNonMatching = new THREE.InstancedMesh(pyramidGeometryNonMatching, materialNonMatching, totalCount);

    let dummy = new THREE.Object3D();

    geojson.features.forEach((feature, index) => {
      const [lon, lat] = feature.geometry.coordinates;
      const elevation = feature.properties.elevation;
      const [x, y] = toStatePlane(lon, lat);
      const z = elevation * zScale;
      const uniqueId = feature.properties.lms_application_id;
      
      if (x === null || y === null || isNaN(z)) return;
      
      const isMatching = parseInt(feature.properties.channel, 10) === channelFilter;
      
      dummy.position.set(x, y, z);
      dummy.scale.set(1, 1, 1); // Default scale

      // Use the same index for both matching and non-matching instances
      dummy.updateMatrix();
      if (isMatching) {
        window.instancedPyramidMatching.setMatrixAt(index, dummy.matrix);
        window.instancedPyramidMatching.userData[index] = {
          channel: parseInt(feature.properties.channel, 10),
          uniqueId: uniqueId
        };
        // Scale non-matching instances to normal size; they remain visible regardless
        window.instancedPyramidNonMatching.setMatrixAt(index, dummy.matrix);
      } else {
        // Hide matching instances by scaling to zero
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        window.instancedPyramidMatching.setMatrixAt(index, dummy.matrix);
        // Non-matching instances are not hidden, so we reset their scale to ensure visibility
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        window.instancedPyramidNonMatching.setMatrixAt(index, dummy.matrix);
        window.instancedPyramidNonMatching.userData[index] = { channelFilter };  // Assign channel data to userData
      }
    });

    // Mark matrices as needing update
    window.instancedPyramidMatching.instanceMatrix.needsUpdate = true;
    window.instancedPyramidNonMatching.instanceMatrix.needsUpdate = true;

    // Add the instanced meshes to the fmTransmitterPoints group
    fmTransmitterPoints.add(window.instancedPyramidMatching);
    fmTransmitterPoints.add(window.instancedPyramidNonMatching);
    scene.add(fmTransmitterPoints);
  } catch (error) {
    console.error('Error in addFMTowerPts:', error);
    throw error; // Rethrow or handle as needed
  }
}

  
// Function to add wireframe pyramids and text labels for POINT data from GeoJSON
function addCellTowerPts(geojson) {
  return new Promise((resolve, reject) => {
    try {
      // Define the base size and height for the pyramids
      const baseSize = 0.005;
      const pyramidHeight = 0.03;

      // Material for the wireframe pyramids
      let pyramidMaterialCellular = new THREE.MeshBasicMaterial({
        color: colorScheme.pyramidColorCellular,
        wireframe: true,
        transparent: true,
        alphaHash: true,
        opacity: 0.25,
      });


      const points = []; // Array to store points for the convex hull

      // Parse the POINT data from the GeoJSON
      geojson.features.forEach((feature, index) => {
        if (feature.geometry.type === 'Point') {
          // Directly use the coordinates array
          const [lon, lat] = feature.geometry.coordinates;
          const elevation = feature.properties.Z || 0;  // Default to 0 if Z is not provided

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
            // let cellTowerZ = 0; // hardcode zero for reticule
            pyramid.position.set(x, y, z);
            const uniqueCellid = `Tower-${index}`;  // This creates a unique identifier like "Tower-0", "Tower-1", etc.

            pyramid.userData = {
              position: new THREE.Vector3(x, y, z),
              gridCode: feature.properties.gridCode || 'unknown', // todo: attach a sound preset key json in lieu of gridcode
              uniqueCellid: uniqueCellid || 'unknown',
            };
  
            // Add the pyramid to the cellTransmitterPoints group
            cellTransmitterPoints.add(pyramid);

            // Check for coincident points and get a z-offset
            const label = `cell`;
            //   const zOffset = getCoincidentPointOffset(lon, lat, 8, 0.00001);

            // Ensure Callsign or another property is correctly referenced
            // const label = feature.properties.Callsign || `Tower ${index}`;

            // const textSprite = makeTextSprite(` ${label} `, {
            //   fontsize: 24,
            //   strokeColor: 'rgba(255, 255, 255, 0.9)',
            //   strokeWidth: 1,

              // borderColor: { r: 255, g: 0, b: 0, a: 1.0 },
              // backgroundColor: { r: 255, g: 100, b: 100, a: 0.8 }
            // });

            // Position the sprite above the pyramid
            const pyramidHeightScaled = pyramidHeight * zScale;

            // Position the sprite above the pyramid, applying the offset for coincident points
            // textSprite.position.set(
            //   x,
            //   y,
            //   z + pyramidHeightScaled + zOffset + 0.009,
            // );
            // textSprite.scale.set(0.05, 0.025, 1.0);

            // cellTransmitterPoints.add(textSprite); // Add the label to the cellTransmitterPoints group
            // console.log(`creating label for ${label}`);

            // const gridCode = firstIntersection.object.userData.gridCode;

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
          0.00075,
          0.003,
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
  ///////// slider stuff


  let lastChannelValue = null; // For tracking significant channel value changes
  let lastChannelFilter = null; // For reinitializing after switching map scenes
  let debounceTimer = null; // For debouncing updates to the display
  let channelFilter = null;

  function updateSliderDisplay(value, resolutionSlider) {
    let sliderDisplay = '[';
    for (let i = 0; i < sliderLength; i++) {
      sliderDisplay += i < value ? '#' : '-';
    }
    sliderDisplay += ']';
    resolutionSlider.textContent = sliderDisplay;
  }
  
  function updateLabelPosition(sliderValue) {
    // new Tone.Delay(0.01);
    const slider = document.getElementById('fm-channel-slider');
    const label = document.getElementById('fm-frequency-display');

    // console.log(sliderValue)
  
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
  
    // Calculate thumb position percentage
    const percent = ((sliderValue - min) / (max - min)) * 100;
  
    // Adjust label position based on thumb position
    const sliderWidth = slider.offsetWidth;
    const labelWidth = label.offsetWidth;
    label.style.maxWidth = `${sliderWidth / 4}px`;
    const leftPosition = (percent / 100) * sliderWidth - (labelWidth / 2) + (slider.getBoundingClientRect().left - label.offsetParent.getBoundingClientRect().left);
  
    // Update the label's position
    label.style.left = `${leftPosition}px`;
  }
  
  // Initialize the position update
  updateLabelPosition(parseInt(document.getElementById('fm-channel-slider').value, 10));
  
  // Update label position on slider input
  document.getElementById('fm-channel-slider').addEventListener('input', function() {
    updateLabelPosition(parseInt(this.value, 10));
  });
  
  let isDragging = false;
  document.getElementById('fm-channel-slider').addEventListener('mousedown', function() {
    isDragging = true;
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
  });

  
  let channelFrequencies = {}; // Ensure this is accessible globally
  
  function updateDisplays(channelValue) {
    // Debounce logic to only update if the channel value changes significantly
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (lastChannelValue === null || Math.abs(lastChannelValue - channelValue) >= 2) {
        channelFilter = channelValue; // for global channelFilter vals
        const display = document.getElementById('fm-channel-display');
        const frequencyLabel = document.getElementById('fm-frequency-display');
        const frequencyText = channelFrequencies[Math.round(channelValue).toString()] || "Frequency not found";
  
        display.textContent = `FM channel: ${Math.round(channelValue)}`;
        frequencyLabel.textContent = frequencyText;

      // Calculate the new playback position in the sample
      if (synths.radioTuner.loaded) {
        const sampleDuration = synths.radioTuner.buffer.duration;
        const newPosition = (channelValue / 100) * sampleDuration;
        const nextStartTime = getNextEventTime(); // Get the next valid start time using the new timing function
        synths.radioTuner.start(nextStartTime, newPosition);
    } else {
        console.log("radioTuner buffer is not loaded yet");
    }

        if ( fmContoursGeojsonData && fmTransmitterGeojsonData) {
          updateVisualizationWithChannelFilter(fmContoursGeojsonData, fmTransmitterGeojsonData, channelValue);
          lastChannelValue = channelValue; // Update lastChannelValue
        }
      }
    }, 20); // Delay for debouncing
  }
  


  function initFMsliderAndContours(frequencyData) {
    channelFrequencies = frequencyData;
  
    const slider = document.getElementById('fm-channel-slider');
    slider.addEventListener('input', function() {
      const channelValue = Math.round(parseInt(this.value, 10));
      updateDisplays(channelValue);
    });

    // console.log("init value: " + slider.value)
    
    // Initial update based on the slider's default value
    const initialChannelValue = Math.round(parseInt(slider.value, 10));
    updateDisplays(initialChannelValue);
  }
  

  function updateVisualizationWithChannelFilter(fmContoursGeojsonData, towerGeojsonData, channelFilter) {
    // Ensure data availability
    if (!fmContoursGeojsonData || !towerGeojsonData) {
      console.warn("GeoJSON data not available.");
      return;
    }


    addFMpropagation3D(fmContoursGeojsonData, channelFilter, fmPropagationContours)
      // .then(() => console.log("FM propagation updated"))
      .catch(error => console.error("Failed to update contour channel:", error));

    addFMTowerPts(towerGeojsonData, channelFilter, fmTransmitterPoints)
      // .then(() => console.log("FM towers updated"))
      .catch(error => console.error("Failed to update tower channel:", error));



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
        alphaHash: true,
        opacity: 0.5,
      });
      const glowTube = new THREE.Mesh(glowGeometry, glowMaterial);
      targetGroup.add(glowTube);
    });
  }

  // ACCESSIBILITY POLYGONS
  // function drawAccessibilityHex(geojson) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       geojson.features.forEach((feature) => {
  //         const color = getColorFromContour(feature.properties.ContourMax);
  //         const material = new THREE.MeshBasicMaterial({
  //           color: colorScheme.accessibilityHexColor,
  //           side: THREE.FrontSide,
  //           transparent: true,
  //           wireframe: true,
  //           opacity: 0.3,
  //           alphaHash: true,
  //           visible: true,
  //         });
  
  //         const processPolygon = (polygon) => {
  //           polygon.forEach((ring) => {
  //             const vertices = [];
  //             ring.forEach((coord) => {
  //               if (!Array.isArray(coord)) {
  //                 throw new Error("Coordinate is not an array");
  //               }
  
  //               const [lon, lat] = coord;
  //               const [x, y] = toStatePlane(lon, lat);
  //               vertices.push(x, y);
  //             });
  
  //             if (vertices.length > 0) {
  //               const geometry = new THREE.BufferGeometry();
  //               const verticesArray = new Float32Array(vertices);
  //               const indices = Earcut.triangulate(vertices, null, 2);
  //               const positionArray = new Float32Array(indices.length * 3);
  
  //               indices.forEach((index, i) => {
  //                 positionArray[i * 3] = vertices[index * 2];
  //                 positionArray[i * 3 + 1] = vertices[index * 2 + 1];
  //                 positionArray[i * 3 + 2] = 0; // Z coordinate
  //               });
  
  //               geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  //               const mesh = new THREE.Mesh(geometry, material);

  //               vertices.forEach((value, index) => {
  //                 // Assuming vertices are stored as x0, y0, x1, y1, ..., xn, yn
  //                 // Save every vertex's position in userData for easy access later
  //                 if(index % 2 === 0) { // Even indices are x coordinates
  //                   mesh.userData.vertices = mesh.userData.vertices || [];
  //                   mesh.userData.vertices.push({x: value, y: vertices[index + 1]});
  //                 }
  //                 // console.log(mesh.userData.vertices)
  //               });        
        
  //               accessibilityHex.add(mesh);
  //             }
  //           });
  //         };
  
  //         if (feature.geometry.type === 'Polygon') {
  //           processPolygon(feature.geometry.coordinates);
  //         } else if (feature.geometry.type === 'MultiPolygon') {
  //           feature.geometry.coordinates.forEach(processPolygon);
  //         }
          
  //       });

  
  //       scene.add(accessibilityHex);
  //       resolve();
  //     } catch (error) {
  //       reject(`Error in drawAccessibility: ${error.message}`);
  //     }
  //   });
  // }
    
  // Utility function to determine color based on access composite property ContourMax
  // function getColorFromContour(contourMax) {
  //   // Example gradient: blue (low) to red (high)
  //   const lowValueColor = 0x0000FF; // Blue
  //   const highValueColor = 0xFF0000; // Red
  //   const minValue = 0;
  //   const maxValue = 14; 
  
  //   // Normalize ContourMax value between 0 and 1
  //   const normalizedValue = (contourMax - minValue) / (maxValue - minValue);
  
  //   // Calculate intermediate color
  //   const color = interpolateColors(lowValueColor, highValueColor, normalizedValue);
  //   return color;
  // }
  
  // // Interpolate between two colors based on a factor (0 to 1)
  // function interpolateColors(color1, color2, factor) {
  //   const r1 = (color1 >> 16) & 0xFF;
  //   const g1 = (color1 >> 8) & 0xFF;
  //   const b1 = color1 & 0xFF;
    
  //   const r2 = (color2 >> 16) & 0xFF;
  //   const g2 = (color2 >> 8) & 0xFF;
  //   const b2 = color2 & 0xFF;
    
  //   const r = Math.round(r1 + (r2 - r1) * factor);
  //   const g = Math.round(g1 + (g2 - g1) * factor);
  //   const b = Math.round(b1 + (b2 - b1) * factor);
    
  //   return (r << 16) | (g << 8) | b;
  // }
    

  // Function to visualize bounding box from GeoJSON
  function visualizeBoundingBoxGeoJSON(geojson) {
    return new Promise((resolve, reject) => {
      try {
        const material = new THREE.MeshBasicMaterial({
          color: colorScheme.boundingBoxColor, // Use the existing color scheme
          wireframe: false,
          transparent: false,
          opacity: 1,
          side: THREE.DoubleSide // Render both sides of the polygon
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
                const line = new THREE.Mesh(geometry, material);
                scene.add(line);
                analysisArea.add(line);
              });
            });
          }
          if (feature.geometry.type === 'Polygon') {
            // Create a flat array of vertex coordinates for Earcut
            const vertices = [];
            const holes = []; //useful for polygons with holes
            feature.geometry.coordinates[0].forEach(coord => {
              const [lon, lat] = coord;
              const [x, y] = toStatePlane(lon, lat); // Assuming this function returns planar coordinates suitable for your application
              vertices.push(x, y); // Earcut expects a flat array of coordinates
            });

            // Use Earcut to triangulate the vertices. No holes in this case, so the second argument is null.
            const indices = Earcut.triangulate(vertices, null, 2);

            const positionAttribute = new THREE.Float32BufferAttribute(vertices, 2);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', positionAttribute);

            // Set the indices returned by Earcut as the element index array for the geometry
            geometry.setIndex(indices);

            // earcut is 2d only, so modify the vertex positions
            // to add a z-coordinate (which is 0 in this case)
            geometry.attributes.position.array = new Float32Array(geometry.attributes.position.array.map((value, index) => index % 3 === 2 ? 0 : value));

            const mesh = new THREE.Mesh(geometry, material);

            scene.add(mesh);
            analysisArea.add(mesh);
            }    
          });
            scene.add(analysisArea);
            resolve(); // Resolve the promise when done
          } catch (error) {
            reject(`Error in visualizeBoundingBoxGeoJSON: ${error.message}`);
          }
        });
      }
      
  // Function to visualize bounding box from GeoJSON
  function addCoastline(geojson) {
    return new Promise((resolve, reject) => {
      try {
        const material = new THREE.LineBasicMaterial({
          color: colorScheme.coastlineColor,
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
              coastline.add(line);
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
                coastline.add(line);
              });
            });
          }
          // Add handling for other geometry types if necessary
        });

        scene.add(coastline);

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

let sampleBuffers = [];
let currentBufferIndex = 0;

async function loadAllData() {
  // Fetch all URLs including GeoJSON and sample URLs
  const sampleUrlsPromise = loadSampleUrls();  // Load sample URLs
  const geoJsonPromise = loadGeoJSONData();  // Adjust this function to return a promise
  
  // Wait for both promises to complete
  await Promise.all([geoJsonPromise, sampleUrlsPromise]);
  console.log("All data loaded successfully.");
}


  // Fetching the contour lines GeoJSON and adding to the scene
  async function loadGeoJSONData() {
    // console.log("loading...")
    const urls = [
      'src/assets/data/elevation_contours_shaved.geojson',
      'src/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson',
      // 'src/assets/data/FmTowers_FeaturesToJSON_AOI_20231204.geojson',
      'src/assets/data/ne_50m_coastline_aoiClip.geojson',
      // 'src/assets/data/cellServiceCentroids_2000m_20231210.geojson',
      'src/assets/data/fm_freq_dict.json',
      'src/assets/data/FM_transmitter_sites.geojson',
      'src/assets/data/fm_contours_shaved.geojson',
      'src/assets/data/ne_50m_ocean_aoiClip.geojson',
      // 'src/assets/data/compositeSurface_polygon_surface.geojson',
      'src/assets/data/NYS_fullElevDEM_boundingBox.geojson',
      'src/assets/data/cellService_contours_5KM_pts_20240407.geojson',
      // 'src/assets/data/cellService_contours_5KM_explode_mini.geojson',
      'src/assets/data/accessService_contours_5KM_pts_20240407.geojson',
      // 'src/assets/data/AccessHexTesselation_lvl5_nodata.geojson',
      // 'src/assets/sounds/presets.json',
      'src/assets/data/study_area_admin0clip.geojson'
    ];

    try {
      let criticalDatasetsLoaded = 0;
      const criticalDatasetsCount = 3;  // Adjust as needed

      const dataPromises = urls.map(url => 
          fetch(url).then(res => {
              if (!res.ok) throw new Error(`Network response was not ok for ${url}`);
              return res.json();
          })
          .then(data => {
              handleGeoJSONData(url, data);
              if (isCriticalDataset(url)) {
                  criticalDatasetsLoaded++;
                  if (criticalDatasetsLoaded === criticalDatasetsCount) {
                      return 'critical';  // Indicate critical data loaded
                  }
              }
              return 'non-critical';  // Indicate non-critical data loaded
          })
          .catch(error => {
              console.error(`Error loading ${url}:`, error);
              throw error;  // Re-throw to handle in outer catch
          })
      );

      const results = await Promise.allSettled(dataPromises);
      const criticalResults = results.filter(result => result.value === 'critical');
      if (criticalResults.length < criticalDatasetsCount) {
          throw new Error('Not all critical datasets were loaded successfully');
      }
      console.log("All data loaded successfully.");
  } catch (error) {
      console.error("Failed to load some GeoJSON data:", error);
  }
}

  function isCriticalDataset(url) {
    // Define logic to determine if a dataset is critical for initial rendering
    // todo: this breaks if the contours aren't required up front but they take longest to load
    return url.includes('elevation') || url.includes('fm_contours') || url.includes('transmitter')
  }
  

  let contourGeojsonData,
    cellTowerGeojsonData,
    fmContoursGeojsonData,
    fmTransmitterGeojsonData,
    boundingBoxGeojsonData,
    coastlineGeojsonData,
    waterPolyGeojsonData,
    cellServiceGeojsonData,
    accessibilityHexGeojsonData,
    accessibilityMeshGeojsonData,
    fmFreqDictionaryJson;


  function handleGeoJSONData(url, data) {
    switch (url) {

      ////////////////// lines

      case 'src/assets/data/elevation_contours_shaved.geojson':
        contourGeojsonData = data;
        const meanElevation = calculateMeanContourElevation(data);
        // console.log(`mean elevation: ${meanElevation}`)
        addElevContourLines(data);
        break;

      case 'src/assets/data/fm_contours_shaved.geojson':
        fmContoursGeojsonData = data;
        // run on pageload with default channel 201 as filter
        addFMpropagation3D(data, channelFilter, fmPropagationContours)
        analogGroup.add(fmPropagationContours)
        analogGroup.add(fmPropagationPolygons)
        break;
  

      case 'src/assets/data/NYS_fullElevDEM_boundingBox.geojson':
        boundingBoxGeojsonData = data;
        getBoundingBoxOfGeoJSON(data);
        break;

      case 'src/assets/data/ne_50m_coastline_aoiClip.geojson':
        coastlineGeojsonData = data;
        addCoastline(data);
        break;

      case 'src/assets/data/cellService_contours_5KM_pts_20240407.geojson':
        cellServiceGeojsonData = data;
        addCellServiceMesh(data);
        digitalGroup.add(cellServiceMesh);
        digitalGroup.add(cellServiceRayMesh);
        break;

      case 'src/assets/data/accessService_contours_5KM_pts_20240407.geojson':
        accessibilityMeshGeojsonData = data;
        addAccessibilityMesh(data);
        accessGroup.add(accessibilityMesh);
        break;


      ////////////////////// polygons

      // case 'src/assets/data/AccessHexTesselation_lvl5_nodata.geojson':
      //   accessibilityHexGeojsonData = data;
      //   drawAccessibilityHex(data);
      //   accessGroup.add(accessibilityHex);
      //   break;

      //////////////////////// points

      case 'src/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson':
        cellTowerGeojsonData = data;
        addCellTowerPts(data);
        digitalGroup.add(cellTransmitterPoints);
        digitalGroup.add(cellMSTLines);
        break;


      // updated points using fm contour origins
      case 'src/assets/data/FM_transmitter_sites.geojson':
        fmTransmitterGeojsonData = data;
        addFMTowerPts(data, channelFilter, fmTransmitterPoints)
        analogGroup.add(fmTransmitterPoints);
        break;

  
      /////////////////// raster

      case 'src/assets/data/NYS_cellTower_viewshed_20231130.jpg':
        accessibilityRaster = data;
        // loadAndPositionRaster(data);
        break;

      /////////////////////// sound

      case 'src/assets/sounds/presets.json':
        synthPresets = data;
        loadSynthPresets(data);
        break;
  
      //////////////////// ancillary

      case 'src/assets/data/ne_50m_ocean_aoiClip.geojson':
        waterPolyGeojsonData = data;
        // addWaterPoly(data);
        break;

      case 'src/assets/data/study_area_admin0clip.geojson':
        boundingBoxGeojsonData = data;
        // visualizeBoundingBoxGeoJSON(data);
        break;
    
  
      case 'src/assets/data/fm_freq_dict.json':
        fmFreqDictionaryJson = data;
        break;
  
      default:
        console.warn('Unrecognized URL:', url);
        break;
    }
  }

  async function loadSampleUrls() {
    try {
      const response = await fetch('/api/samples');
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const sampleUrls = await response.json();
      await Promise.all(sampleUrls.map(url => loadSample(url)));
      console.log("All samples loaded successfully.");
    } catch (error) {
      console.error('Failed to fetch sample URLs:', error);
    }
  }

  async function loadSample(url) {
    try {
        // Load the buffer and wait for it to complete
        const buffer = await Tone.ToneAudioBuffer.fromUrl(url);
        // console.log(`Sample loaded: ${url}`);

        // Push the loaded buffer into the array with the correct status
        sampleBuffers.push({ url, buffer, loaded: true });
        
        // checkAndStartPlayback();
    } catch (error) {
        console.error(`Error loading sample from ${url}:`, error);
    }
}

  function postLoadOperations() {
    const boundingBox = getBoundingBoxOfGeoJSON(boundingBoxGeojsonData);


    // Calculate center and size of bounding box
    const center = getCenterOfBoundingBox(boundingBox);
    const size = getSizeOfBoundingBox(boundingBox);

    const maxDim = Math.max(size.x, size.y);

    const geoCameraPositionLonLat = [-74.68057752571633, 42.79146513478376];

    const cameraPositionStatePlane = toStatePlane(...geoCameraPositionLonLat);

    // Adjust camera Z to be closer
    const fov = camera.fov * (Math.PI / 90);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 0.4; // reduce coefficient to move the camera closer

    camera.position.set(
      cameraPositionStatePlane[0], // x position
      cameraPositionStatePlane[1], // y position
      cameraZ
    );

    // console.log(`bounding box: ${boundingBox}`)

    // Set controls target to the center of bounding box
    controls.target.set(camera.position.x, camera.position.y, 0);

    // Ensure the camera keeps looking straight down at the target after rotation
    camera.lookAt(controls.target);

    // Apply constraints to camera and update controls
    constrainCamera(controls, boundingBox);

    initFMsliderAndContours(fmFreqDictionaryJson); // Setup slider and initial visualization

    // add grouped sub-groups
    scene.add(analogGroup, digitalGroup, accessGroup, elevContourLines);

    // console.log(`analog group: ${analogGroup}`)

    // init switch settings
    toggleMapScene(1, 'switch1'); // init fm on pageload
    toggleMapScene(1, 'switch2'); // init elev contours

    // loadSampleUrls(); // load sound sample URLs from node.js server

    controls.update();
}
}

// Export visualizationReady for access from main.js
export { visualizationReady };
