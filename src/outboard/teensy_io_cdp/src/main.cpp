#include <Arduino.h>
#include <Encoder.h>

// Define the pins connected to the SPDT switch
const int pin1 = 0; 
const int pin2 = 1; 

// Encoders
Encoder knobLeft(14, 15); 
Encoder knobRight(2, 3);

// encoder push-button pins
const int buttonPinLeft = 11; 
const int buttonPinRight = 12;

// Encoder positions
long positionLeft  = -999;
long positionRight = -999;

void setup() {
  Serial.begin(9600);
  Serial.println("System Initialization:");

  // Configure the switch pins as inputs with internal pull-up resistors
  pinMode(pin1, INPUT_PULLUP);
  pinMode(pin2, INPUT_PULLUP);

  pinMode(buttonPinLeft, INPUT_PULLUP);
  pinMode(buttonPinRight, INPUT_PULLUP);

  
  // Encoder test message (optional)
  Serial.println("TwoKnobs Encoder Test:");
}

void loop() {
  // Read and handle the switch position
  bool statePin1 = digitalRead(pin1);
  bool statePin2 = digitalRead(pin2);

  if (!statePin1 && statePin2) {
    Serial.println("Position 1");
  } else if (statePin1 && !statePin2) {
    Serial.println("Position 2");
  } else if (statePin1 && statePin2) {
    Serial.println("Center position");
  } else {
    Serial.println("Unexpected position");
  }

  // Read and handle encoder positions
  long newLeft, newRight;
  newLeft = knobLeft.read();
  newRight = knobRight.read();
  if (newLeft != positionLeft || newRight != positionRight) {
    Serial.print("Left = ");
    Serial.print(newLeft);
    Serial.print(", Right = ");
    Serial.print(newRight);
    Serial.println();
    positionLeft = newLeft;
    positionRight = newRight;
  }

  // Reset encoders if a character is sent from the serial monitor
  if (Serial.available()) {
    Serial.read();
    Serial.println("Reset both knobs to zero");
    knobLeft.write(0);
    knobRight.write(0);
  }

    bool buttonStateLeft = !digitalRead(buttonPinLeft); // Inverted because of pull-up
  bool buttonStateRight = !digitalRead(buttonPinRight); // Inverted because of pull-up

  // Print a message when a button is pressed
  if (buttonStateLeft) {
    Serial.println("Left button pressed!");
  }
  if (buttonStateRight) {
    Serial.println("Right button pressed!");
  }

  // Small delay to avoid spamming
  delay(250);
}
