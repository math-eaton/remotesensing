import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { server as WebSocketServer } from 'websocket';

export function websocket() {
    // Adjust these variables to match your setup
    const SERIAL_PORT = '/dev/tty.usbmodem82663401'; // Serial port
    const BAUD_RATE = 9600; // Baud rate for serial communication

    // Initialize serial port
    const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    // Initialize WebSocket server
    const httpServer = require('http').createServer((req, res) => {
        console.log(new Date() + ' Received request for ' + req.url);
        res.writeHead(404);
        res.end();
    });
    httpServer.listen(8080, () => {
        console.log(new Date() + ' Server is listening on port 8080');
    });

    const wsServer = new WebSocketServer({
        httpServer,
        // You might want to add autoAcceptConnections: false here
        // for security reasons and handle request.accept/reject manually
    });

    wsServer.on('request', function(request) {
        const connection = request.accept(null, request.origin);
        console.log((new Date()) + ' Connection accepted.');

        parser.on('data', function(data) {
            console.log(`Data from serial port: ${data}`);
            connection.sendUTF(data);
        });

        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                console.log('Received Message: ' + message.utf8Data);
                // Here you can also write back to the serial port if needed
            }
        });

        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });
    });

    console.log('WebSocket server started on ws://localhost:8080');
}
