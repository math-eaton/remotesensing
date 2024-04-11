import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { server as WebSocketServer } from 'websocket';
import http from 'http';

const httpServer = http.createServer();
httpServer.listen(8080, () => console.log('Server listening on port 8080'));

const wsServer = new WebSocketServer({
  httpServer,
  autoAcceptConnections: false,
});

wsServer.on('request', (request) => {
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

  // Additional WebSocket event handlers (e.g., on 'close', 'error')
});


