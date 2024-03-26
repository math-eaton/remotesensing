import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { server as WebSocketServer } from 'websocket';
import http from 'http';

const httpServer = http.createServer();
httpServer.listen(8080, () => console.log('Server listening on port 8080'));

const wsServer = new WebSocketServer({
  httpServer,
  autoAcceptConnections: false, // For security, always validate connections
});

wsServer.on('request', (request) => {
  const connection = request.accept(null, request.origin);
  console.log('WebSocket connection accepted');

  // Here, set up your SerialPort and parser
  const serialPort = new SerialPort({ path: '/dev/tty.usbmodem82663401', baudRate: 9600 });
  const parser = serialPort.pipe(new ReadlineParser());

  parser.on('data', (data) => {
    connection.sendUTF(data);
  });

  // Additional WebSocket event handlers (e.g., on 'close', 'error')
});

console.log('WebSocket server and serial port reader initialized');
