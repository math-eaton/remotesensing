/// start w template defaults

// import 'the-new-css-reset/css/reset.css';
// import '../styles/style.css';

// const dependencies = [
//   'ESlint',
//   'Prettier',
//   'PostCSS',
//   'PostCSS Nesting',
//   'Autoprefixer',
//   'CSS Nano',
//   'CSS Reset',
// ];

// import "src/css/style.css";
import { gfx } from './gfx.js';
// import { serialReader } from './serial_reader.js';
// import { websocket } from './server.js';

window.onload = () => {
  setTimeout(() => {}, 500);
};

const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

// ws.onmessage = (message) => {
//   const data = JSON.parse(message.data);
//   // Use this data to update your Three.js scene
// };

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// init external js
gfx();
// serialReader();
// websocket();

document.getElementById('fullscreenButton');
const threeContainer = document.getElementById('gfx');

if (threeContainer) {
  console.log('idk');
  threeContainer.classList.remove('background'); // Remove 'background' class from 'app'
} else {
  console.log('lol');
}
