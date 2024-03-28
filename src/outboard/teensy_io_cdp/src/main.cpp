#include <Arduino.h>
#include <Encoder.h>
// #include "TM1637Display.h"

// Define the pins connected to the SPDT switch
const int pin1 = 0; 
const int pin2 = 1; 

// Slide potentiometer pin
const int potPin = A4;

// LED pin (PWM-capable)
const int ledPin = A6;
// Number of full brightness ledCycles (dark-light-dark) across the potentiometer's range
const int ledCycles = 3;

// Encoders
Encoder knobLeft(14, 15); 
Encoder knobRight(16, 17);

// Encoder push-button pins
const int buttonPinLeft = 11; 
const int buttonPinRight = 12;

// Encoder positions
long positionLeft  = -999;
long positionRight = -999;

// Initialize counters for button-encoder-spin combinations
long positionLeftPressed = -999;
long positionRightPressed = -999;

// Debounce variables for buttons
unsigned long lastDebounceTimeLeft = 0;
unsigned long lastDebounceTimeRight = 0;
const unsigned long debounceDelay = 50; // 50 ms debounce time
bool lastButtonStateLeft = HIGH;
bool lastButtonStateRight = HIGH;
bool buttonPressedLeft = false;
bool buttonPressedRight = false;

// Debounce variables for potentiometer
const int potDebounceDelay = 10; // Potentiometer debounce time in ms
int lastPotValue = -1; // Store the last stable pot value
unsigned long lastPotReadTime = 0; // Last time the pot value was read
const int potStabilityThreshold = 5; // Acceptable change in value to consider stable


// // TM1637 Display connections
// const int CLK = 2; // Use appropriate pins for your setup
// const int DIO = 3;
// TM1637Display display(CLK, DIO);


void setup() {
  Serial.begin(9600);
  Serial.println("System Initialization:");

  // Configure the switch pins as inputs with internal pull-up resistors
  pinMode(pin1, INPUT_PULLUP);
  pinMode(pin2, INPUT_PULLUP);

  pinMode(buttonPinLeft, INPUT_PULLUP);
  pinMode(buttonPinRight, INPUT_PULLUP);

  // Initialize the analog pin for the potentiometer
  pinMode(potPin, INPUT);

  // slide pot LED
  pinMode(ledPin, OUTPUT);
  
  // Initialize the TM1637 display
  // display.setBrightness(0x0f); // Adjust brightness as needed
  // display.clear(); // Clear any existing data on the display
}

void loop() {
  // Read the state of the switch
  bool statePin1 = digitalRead(pin1);
  bool statePin2 = digitalRead(pin2);
  int switchState = 0; // Default to center position
  if (!statePin1 && statePin2) {
    switchState = 1; // Position 1
  } else if (statePin1 && !statePin2) {
    switchState = 2; // Position 2
  }

  // Read and handle encoder positions
  long newLeft = knobLeft.read();
  long newRight = knobRight.read();
  long deltaLeft = newLeft - positionLeft;
  long deltaRight = newRight - positionRight;
  positionLeft = newLeft;
  positionRight = newRight;

  // Debounce logic for buttons (unchanged)
  bool buttonPressedLeft = !digitalRead(buttonPinLeft);
  bool buttonPressedRight = !digitalRead(buttonPinRight);

  // Calculate delta for press-spins
  long deltaLeftPressed = 0;
  long deltaRightPressed = 0;

  if (buttonPressedLeft) {
    deltaLeft = 0; // Override deltaLeft if button is pressed
    if (positionLeftPressed == -999) { // First detection
      positionLeftPressed = newLeft;
    } else {
      deltaLeftPressed = newLeft - positionLeftPressed;
      positionLeftPressed = newLeft; // Update for next loop iteration
    }
  } else {
    positionLeftPressed = -999; // Reset when button is not pressed
  }

  if (buttonPressedRight) {
    deltaRight = 0; // Override deltaRight if button is pressed
    if (positionRightPressed == -999) { // First detection
      positionRightPressed = newRight;
    } else {
      deltaRightPressed = newRight - positionRightPressed;
      positionRightPressed = newRight; // Update for next loop iteration
    }
  } else {
    positionRightPressed = -999; // Reset when button is not pressed
  }

  // Debounce logic for left button
  bool readingLeft = !digitalRead(buttonPinLeft);
  if (readingLeft != lastButtonStateLeft) {
    lastDebounceTimeLeft = millis();
  }
  if ((millis() - lastDebounceTimeLeft) > debounceDelay) {
    if (readingLeft != buttonPressedLeft) {
      buttonPressedLeft = readingLeft;
    }
  }


  // Debounce logic for right button
  bool readingRight = !digitalRead(buttonPinRight);
  if (readingRight != lastButtonStateRight) {
    lastDebounceTimeRight = millis();
  }
  if ((millis() - lastDebounceTimeRight) > debounceDelay) {
    if (readingRight != buttonPressedRight) {
      buttonPressedRight = readingRight;
    }
  }

  // read pot value
  // and debounce on em
  int potValue = analogRead(potPin);
  if (abs(potValue - lastPotValue) <= potStabilityThreshold || lastPotValue == -1) {
    if ((millis() - lastPotReadTime) > potDebounceDelay) {
      // Value has stabilized; update the last stable value
      lastPotValue = potValue;
      lastPotReadTime = millis();
    }
  } else {
    // Value has changed significantly; reset the debounce timer
    lastPotReadTime = millis();
  }

  // use the last stable pot value and
  // map the value to a different range
  int mappedPotValue = map(potValue, 0, 1023, 1023, 0); 

  // calculate pot LED brightness based on slider value
  float phase = (float(potValue) * 2 * PI * ledCycles) / 1023.0; // Calculate phase for sine wave
  int ledBrightness = (sin(phase) + 1) * 127.5; // Convert sine wave (-1 to 1) to (0 to 255) scale

  // Assuming you want to display the raw pot value or any mapped value directly
  // int displayValue = map(potValue, 0, 1023, 0, 9999);
  // display.showNumberDec(displayValue, true); // Display the value

  analogWrite(ledPin, ledBrightness);

  // Prepare and send the serial message
  Serial.print(switchState); Serial.print(",");
  Serial.print(deltaLeft); Serial.print(",");
  Serial.print(deltaRight); Serial.print(",");
  Serial.print(deltaLeftPressed); Serial.print(",");
  Serial.print(deltaRightPressed); Serial.print(",");
  Serial.print(buttonPressedLeft ? "1" : "0"); Serial.print(",");
  Serial.print(buttonPressedRight ? "1" : "0"); Serial.print(",");
  Serial.println(mappedPotValue);

  // Reset button states after sending to avoid repeating messages
  lastButtonStateLeft = readingLeft;
  lastButtonStateRight = readingRight;

  // Throttle the loop to reduce data rate (adjust as needed)
  delay(100);
}