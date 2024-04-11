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

import { gfx } from './gfx.js';

// window.onload = () => {
//   setTimeout(() => {}, 500);
// };

// init external js
setTimeout(gfx(), 500);

const threeContainer = document.getElementById('gfx');

function removeBackground() {
  threeContainer.classList.remove('background');
}

threeContainer.addEventListener('click', removeBackground);
