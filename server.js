import express from 'express';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { server as WebSocketServer } from 'websocket';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const samplesDir = path.join(__dirname, 'public/assets/sounds');
app.use('/assets/sounds', express.static(samplesDir));

app.get('/api/samples', (req, res) => {
    fs.readdir(samplesDir, (err, files) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading samples directory');
            return;
        }
        const urls = files.filter(file => file.endsWith('.mp3'))
                          .map(file => `/assets/sounds/${file}`);
        res.json(urls);
    });
});

server.listen(8080, () => console.log('Server listening on port 8080'));

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false,
});

wsServer.on('request', (request) => {
  if (request.origin !== 'expectedOrigin') {
    request.reject();
    console.log('Connection from origin ' + request.origin + ' rejected.');
    return;
  }
  const connection = request.accept(null, request.origin);
  console.log('WebSocket connection accepted');

  const serialPort = new SerialPort({ path: '/dev/tty.usbmodem82663401', baudRate: 9600 });
  const parser = serialPort.pipe(new ReadlineParser());

  parser.on('data', (data) => {
    console.log('Received data:', data);
    // Assume the data is comma-separated values
    const parts = data.split(',');
    if (parts.length >= 8) { // Adjust based on your actual data format
      // Parse and structure the data as needed
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
      // Send structured data as a JSON string to the connected WebSocket client
      connection.sendUTF(JSON.stringify(structuredData));
    }
  });

});