import { gfx } from './gfx.js';

setTimeout(gfx, 1);
const threeContainer = document.getElementById('gfx');
function removeBackground() {
  threeContainer.classList.remove('background');
}
removeBackground();
console.log("loaded")
