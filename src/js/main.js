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

// window.onload = () => {
//   setTimeout(() => {}, 500);
// };

// init external js
// serialReader();
// websocket();
setTimeout(gfx(), 500);

document.getElementById('fullscreenButton');
const threeContainer = document.getElementById('gfx');

if (threeContainer) {
  console.log('idk');
  threeContainer.classList.remove('background'); // Remove 'background' class from 'app'
} else {
  console.log('lol');
}
