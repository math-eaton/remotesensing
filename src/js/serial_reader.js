export function serialReader() {
  const SerialPort = require('serialport');
  const Readline = require('@serialport/parser-readline');
  const port = new SerialPort('/dev/tty.usbmodem82663401', { baudRate: 9600 });

  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  parser.on('data', (data) => {
    console.log('Received data:', data);
    // Split the incoming CSV data into parts
    const parts = data.split(',');

    if (parts.length >= 10) {
      const switchState1 = parseInt(parts[0], 10);
      const switchState2 = parseInt(parts[1], 10);
      const deltaLeft = parseInt(parts[2], 10);
      const deltaRight = parseInt(parts[3], 10);
      const deltaLeftPressed = parseInt(parts[4], 10);
      const deltaRightPressed = parseInt(parts[5], 10);
      const buttonPressedLeft = parts[6] === '1';
      const buttonPressedRight = parts[7] === '1';
      const LEDpotValue = parseInt(parts[8], 10);
      const zoomPotValue = parseInt(parts[9], 10);
  
      // Log or use these values as needed
      console.log({
        switchState1,
        switchState2,
        deltaLeft,
        deltaRight,
        deltaLeftPressed,
        deltaRightPressed,
        buttonPressedLeft,
        buttonPressedRight,
        LEDpotValue,
        zoomPotValue,
      });
      }
  });
}
