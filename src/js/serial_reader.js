export function serialReader() {
  const SerialPort = require('serialport');
  const Readline = require('@serialport/parser-readline');
  const port = new SerialPort('/dev/ttyACM0', { baudRate: 9600 }); // Adjust the port

  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  parser.on('data', (data) => {
    console.log('Received data:', data);
    // Here, you can parse the CSV data and do something with it
    const parts = data.split(',');
    // Example: parts[0] would be the switch state, etc.
  });
}
