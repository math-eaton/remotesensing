import express from 'express';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { server as WebSocketServer } from 'websocket';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: ['http://localhost:5173', 'https://math-eaton.github.io']
}));


const soundsDir = path.join(__dirname, 'public', 'assets', 'sounds');
app.use('/assets/sounds', express.static(soundsDir));

app.get('/api/samples', (req, res) => {
  fs.readdir(soundsDir, (err, files) => {
      if (err) {
          console.error('Error reading directory:', err);
          return res.status(500).send('Failed to read directory');
      }
      const soundFiles = files
          .filter(file => file.endsWith('.mp3'))  // Ensure only MP3 files are listed
          .map(file => `/assets/sounds/${file}`);  

      res.json(soundFiles);
  });
});

server.listen(8080, () => console.log('Server listening on port 8080'));

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false,
});

// update config to use ur own teensy
async function findTeensyPort() {
  const ports = await SerialPort.list();
  const teensyPort = ports.find(port => port.productId === '0x0483' || port.serialNumber === '8266340');
  if (teensyPort) {
      return teensyPort.path;
  } else {
      throw new Error('Teensy not found');
  }
}

function initializeSerialPort(connection) {
  findTeensyPort().then(path => {
      const serialPort = new SerialPort({ path: path, baudRate: 9600 });
      const parser = serialPort.pipe(new ReadlineParser());
      parser.on('data', data => {
          console.log('Received data:', data);
          processData(data, connection);
      });
      serialPort.on('error', err => {
          console.error('Serial Port Error:', err);
      });
  }).catch(error => {
      console.error('Failed to initialize serial port:', error);
  });
}


function processData(data, connection) {
  const parts = data.split(',');
  if (parts.length >= 10) {
    const structuredData = {
      switchState1: parseInt(parts[0], 10),
      switchState2: parseInt(parts[1], 10),
      deltaLeft: parseInt(parts[2], 10),
      deltaRight: parseInt(parts[3], 10),
      deltaLeftPressed: parseInt(parts[4], 10),
      deltaRightPressed: parseInt(parts[5], 10),
      buttonPressedLeft: parts[6] === '1',
      buttonPressedRight: parts[7] === '1',
      LEDpotValue: parseInt(parts[8], 10),
      zoomPotValue: parseInt(parts[9], 10),
  };
  if (structuredData.buttonPressedLeft) {
    const payload = { type: "buttonPress", key: "a" };
    connection.sendUTF(JSON.stringify(payload));
  } else {
    connection.sendUTF(JSON.stringify(structuredData));
  }
}
}

wsServer.on('request', request => {
  if (request.origin !== 'http://localhost:5173') {
    request.reject();
    console.log('Connection from origin ' + request.origin + ' rejected.');
    return;
  }
  const connection = request.accept(null, request.origin);
  console.log('WebSocket connection accepted');
  initializeSerialPort(connection);
});