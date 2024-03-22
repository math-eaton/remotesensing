// #include <Arduino.h>

// // Define the pins connected to the SPDT switch
// const int pin1 = 23; // Replace YOUR_FIRST_PIN with the actual pin number
// const int pin2 = 22; // Replace YOUR_SECOND_PIN with the actual pin number

// void setup() {
//   // Initialize serial communication
//   Serial.begin(9600);
  
//   // Configure the pins as inputs with internal pull-up resistors enabled
//   pinMode(pin1, INPUT_PULLUP);
//   pinMode(pin2, INPUT_PULLUP);
// }

// void loop() {
//   // Read the state of the pins
//   bool statePin1 = digitalRead(pin1);
//   bool statePin2 = digitalRead(pin2);

//   // Determine the position of the switch
//   if (!statePin1 && statePin2) {
//     // Pin 1 is LOW and Pin 2 is HIGH: Position 1
//     Serial.println("Position 1");
//   } else if (statePin1 && !statePin2) {
//     // Pin 1 is HIGH and Pin 2 is LOW: Position 2
//     Serial.println("Position 2");
//   } else if (statePin1 && statePin2) {
//     // Both pins are HIGH: Center (off) position
//     Serial.println("Center position");
//   } else {
//     // Handle unexpected case (both pins LOW) if necessary
//     Serial.println("Unexpected position");
//   }

//   // Small delay to avoid spamming serial output
//   delay(250);
// }
