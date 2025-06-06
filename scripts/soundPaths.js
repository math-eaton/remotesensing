import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const soundsDir = path.join(__dirname, '../public/assets/sounds');
const outputPath = path.join(__dirname, '../public/assets/sounds/sounds.json');
const baseUrl = '/remotesensing/assets/sounds/';

fs.readdir(soundsDir, (err, files) => {
  if (err) {
    console.error('Failed to list sounds:', err);
    return;
  }
  
  const soundUrls = files
    .filter(file => file.endsWith('.mp3'))
    .map(file => baseUrl + file);

  fs.writeFile(outputPath, JSON.stringify(soundUrls), err => {
    if (err) {
      console.error('Failed to write sound list:', err);
    } else {
      console.log('Sound list written successfully.');
    }
  });
});