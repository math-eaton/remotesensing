import { gfx } from './gfx.js';

// init external js
setTimeout(gfx(), 1000);

const threeContainer = document.getElementById('gfx');

function removeBackground() {
  threeContainer.classList.remove('background');
}

window.onload = () => {
  // setTimeout(() => {}, 500);
  removeBackground();
};

// threeContainer.addEventListener('click', removeBackground);
