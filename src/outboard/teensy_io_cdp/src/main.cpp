#include <Arduino.h>
#include <Encoder.h>

// Define the pins connected to the SPDT switch
const int pin1 = 0; 
const int pin2 = 1; 

// Encoders
Encoder knobLeft(14, 15); 
Encoder knobRight(2, 3);

// Encoder push-button pins
const int buttonPinLeft = 11; 
const int buttonPinRight = 12;

// Encoder positions
long positionLeft  = -999;
long positionRight = -999;

// Debounce variables for buttons
unsigned long lastDebounceTimeLeft = 0;
unsigned long lastDebounceTimeRight = 0;
const unsigned long debounceDelay = 50; // 50 ms debounce time
bool lastButtonStateLeft = HIGH;
bool lastButtonStateRight = HIGH;
bool buttonPressedLeft = false;
bool buttonPressedRight = false;

void setup() {
  Serial.begin(9600);
  Serial.println("System Initialization:");

  // Configure the switch pins as inputs with internal pull-up resistors
  pinMode(pin1, INPUT_PULLUP);
  pinMode(pin2, INPUT_PULLUP);

  pinMode(buttonPinLeft, INPUT_PULLUP);
  pinMode(buttonPinRight, INPUT_PULLUP);
  
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

  // Button debounce logic
  bool readingLeft = !digitalRead(buttonPinLeft);
  bool readingRight = !digitalRead(buttonPinRight);

  if (readingLeft != lastButtonStateLeft) {
    lastDebounceTimeLeft = millis();
  }
  if (readingRight != lastButtonStateRight) {
    lastDebounceTimeRight = millis();
  }

  if ((millis() - lastDebounceTimeLeft) > debounceDelay) {
    if (readingLeft != buttonPressedLeft) {
      buttonPressedLeft = readingLeft;
      if (buttonPressedLeft) {
        Serial.println("Left button pressed!");
      }
    }
  }

  if ((millis() - lastDebounceTimeRight) > debounceDelay) {
    if (readingRight != buttonPressedRight) {
      buttonPressedRight = readingRight;
      if (buttonPressedRight) {
        Serial.println("Right button pressed!");
      }
    }
  }

  lastButtonStateLeft = readingLeft;
  lastButtonStateRight = readingRight;
}
