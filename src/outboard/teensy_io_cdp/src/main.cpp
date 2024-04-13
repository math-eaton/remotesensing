#include <Arduino.h>
#include <Encoder.h>
// #include "TM1637Display.h"

// Define the pins connected to the SPDT switch
const int SPDTpin1 = 6; 
const int SPDTpin2 = 7; 
const int SPDTpin3 = 4; 
const int SPDTpin4 = 5;


// Slide potentiometer pin
const int LEDpotPin = A7;
const int zoomPotPin = A6; 

// LED pin (PWM-capable)
const int ledPin = A8;
// Number of full brightness ledCycles (dark-light-dark) across the potentiometer's range
const int ledCycles = 3;

// Encoders
Encoder knobLeft(9, 10); 
Encoder knobRight(16, 15);

// Encoder push-button pins
const int buttonPinLeft = 11; 
const int buttonPinRight = 14;

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
// const int potDebounceDelay = 200; // Potentiometer debounce time in ms
// int lastPotValue = -1; // Store the last stable pot value
// unsigned long lastPotReadTime = 0; // Last time the pot value was read
// const int potStabilityThreshold = 100; // Acceptable change in value to consider stable

// Sampling and averaging for potentiometer debounce
const int numSamples = 3;
int potSamples[numSamples]; // Array to store potentiometer samples
int sampleIndex = 0; // Current index in the samples array
long totalPotValue = 0; // Total of the samples
int averagePotValue = 0; // Average of the samples


// // TM1637 Display connections
// const int CLK = 2; // Use appropriate pins for your setup
// const int DIO = 3;
// TM1637Display display(CLK, DIO);


void setup() {
  Serial.begin(9600);
  Serial.println("System Initialization:");

  // Configure the SPDT switch pins as inputs with internal pull-up resistors
  pinMode(SPDTpin1, INPUT_PULLUP);
  pinMode(SPDTpin2, INPUT_PULLUP);
  pinMode(SPDTpin3, INPUT_PULLUP);
  pinMode(SPDTpin4, INPUT_PULLUP);

  pinMode(buttonPinLeft, INPUT_PULLUP);
  pinMode(buttonPinRight, INPUT_PULLUP);

  // pot pin modes
  pinMode(LEDpotPin, INPUT);
  pinMode(zoomPotPin, INPUT);

  // slide pot LED
  pinMode(ledPin, OUTPUT);
  
  // Initialize the TM1637 display
  // display.setBrightness(0x0f); // Adjust brightness as needed
  // display.clear(); // Clear any existing data on the display


  // Initialize potSamples array
  for(int i = 0; i < numSamples; i++) {
    potSamples[i] = 0;
  }
}

void loop() {
  // Read the state of SPDT switch 1 (radio vs cell)
  bool statePin1 = digitalRead(SPDTpin1);
  bool statePin2 = digitalRead(SPDTpin2);
  int switchState1 = 0; // Default to center position
  if (!statePin1 && statePin2) {
    switchState1 = 1; // Position 1
  } else if (statePin1 && !statePin2) {
    switchState1 = 2; // Position 2
  }

  // Read the state of SPDT switch 2 (terrain vs accessibility)
  bool statePin3 = digitalRead(SPDTpin3);
  bool statePin4 = digitalRead(SPDTpin4);
  int switchState2 = 0; // Default to center position
  if (!statePin3 && statePin4) {
    switchState2 = 1; // Position 1
  } else if (statePin3 && !statePin4) {
    switchState2 = 2; // Position 2
  }


  // Read and handle encoder positions
  long newLeft = knobLeft.read();
  long newRight = knobRight.read();
  long deltaLeft = newLeft - positionLeft;
  long deltaRight = newRight - positionRight;
  positionLeft = newLeft;
  positionRight = newRight;

  // Debounce logic for buttons
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

  // // read pot value
  // // and debounce on em
  // int LEDpotValue = analogRead(LEDpotPin);
  // if (abs(LEDpotValue - lastPotValue) <= potStabilityThreshold || lastPotValue == -1) {
  //   if ((millis() - lastPotReadTime) > potDebounceDelay) {
  //     // Value has stabilized; update the last stable value
  //     lastPotValue = LEDpotValue;
  //     lastPotReadTime = millis();
  //   }
  // } else {
  //   // Value has changed significantly; reset the debounce timer
  //   lastPotReadTime = millis();
  // }

  // // use the last stable pot value and
  // // map the value to a different range
  // int mappedPotValue = map(LEDpotValue, 0, 1023, 1023, 0); 

  // Take a new potentiometer reading
  int LEDpotValue = analogRead(LEDpotPin);
  int zoomPotValue = analogRead(zoomPotPin);

  // POTDEBOUNCE
  // Subtract the last reading
  totalPotValue -= potSamples[sampleIndex];
  // Read from the sensor and store it into the array
  potSamples[sampleIndex] = LEDpotValue;
  // Add the reading to the total
  totalPotValue += potSamples[sampleIndex];
  // Advance to the next position in the array
  sampleIndex = (sampleIndex + 1) % numSamples;
  // Calculate the average
  averagePotValue = totalPotValue / numSamples;

  // Now use averagePotValue instead of LEDpotValue for mapping and further logic
  int mappedLEDpotValue = map(averagePotValue, 0, 1023, 201, 300); 
  int mappedZoomPotValue = map(zoomPotValue, 0, 1023, 0, 1023); 

  // calculate pot LED brightness based on slider value
  float phase = (float(LEDpotValue) * 2 * PI * ledCycles) / 1023.0; // Calculate phase for sine wave
  int ledBrightness = (sin(phase) + 1) * 127.5; // Convert sine wave (-1 to 1) to (0 to 255) scale

  analogWrite(ledPin, ledBrightness);

  // Prepare and send the serial message with comma separated values
  Serial.print(switchState1); Serial.print(",");
  Serial.print(switchState2); Serial.print(",");
  Serial.print(deltaLeft); Serial.print(",");
  Serial.print(deltaRight); Serial.print(",");
  Serial.print(deltaLeftPressed); Serial.print(",");
  Serial.print(deltaRightPressed); Serial.print(",");
  Serial.print(buttonPressedLeft ? "1" : "0"); Serial.print(",");
  Serial.print(buttonPressedRight ? "1" : "0"); Serial.print(",");
  Serial.print(mappedLEDpotValue); Serial.print(",");
  Serial.println(mappedZoomPotValue);

  // Reset button states after sending to avoid repeating messages
  lastButtonStateLeft = readingLeft;
  lastButtonStateRight = readingRight;

  // Throttle the loop to reduce data rate (adjust as needed)
  delay(100);
}