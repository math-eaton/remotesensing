export function serialReader() {
  const SerialPort = require('serialport');
  const Readline = require('@serialport/parser-readline');
  const port = new SerialPort('/dev/tty.usbmodem82663401', { baudRate: 9600 }); // Adjust the port as needed

  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  parser.on('data', (data) => {
    console.log('Received data:', data);
    // Split the incoming CSV data into parts
    const parts = data.split(',');

    if (parts.length >= 7) {
      // Ensure we have enough data points
      // Parse each part of the data
      const switchState = parseInt(parts[0], 10);
      const deltaLeft = parseInt(parts[1], 10);
      const deltaRight = parseInt(parts[2], 10);
      const deltaLeftPressed = parseInt(parts[3], 10);
      const deltaRightPressed = parseInt(parts[4], 10);
      const buttonPressedLeft = parts[5] === '1';
      const buttonPressedRight = parts[6] === '1';
      const potValue = parseInt(parts[7], 10); 

      // Example: Call functions or update parameters based on the parsed values
      // updateSwitchState(switchState);
      // updateEncoderPosition(deltaLeft, deltaRight);
      // handleButtonPress(buttonPressedLeft, buttonPressedRight);
      // adjustPotentiometerEffect(potValue);

      // Log or use these values as needed
      console.log({
        switchState,
        deltaLeft,
        deltaRight,
        deltaLeftPressed,
        deltaRightPressed,
        buttonPressedLeft,
        buttonPressedRight,
        potValue,
      });
    }
  });
}
