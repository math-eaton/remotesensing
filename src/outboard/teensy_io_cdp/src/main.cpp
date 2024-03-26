#include <Arduino.h>
#include <Encoder.h>

// Define the pins connected to the SPDT switch
const int pin1 = 0; 
const int pin2 = 1; 

// Slide potentiometer pin
const int potPin = A4;

// LED pin (PWM-capable)
const int ledPin = A6;
// Number of full brightness ledCycles (dark-light-dark) across the potentiometer's range
const int ledCycles = 4;

// Encoders
Encoder knobLeft(14, 15); 
Encoder knobRight(16, 17);

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

  // Initialize the analog pin for the potentiometer
  pinMode(potPin, INPUT);

  // slide pot LED
  pinMode(ledPin, OUTPUT);
  
  Serial.println("TwoKnobs Encoder Test:");
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

  // Debounce logic for left button
  bool readingLeft = !digitalRead(buttonPinLeft);
  if (readingLeft != lastButtonStateLeft) {
    lastDebounceTimeLeft = millis();
  }
  if ((millis() - lastDebounceTimeLeft) > debounceDelay && readingLeft != buttonPressedLeft) {
    buttonPressedLeft = readingLeft;
    lastButtonStateLeft = readingLeft;
  }

  // Debounce logic for right button
  bool readingRight = !digitalRead(buttonPinRight);
  if (readingRight != lastButtonStateRight) {
    lastDebounceTimeRight = millis();
  }
  if ((millis() - lastDebounceTimeRight) > debounceDelay && readingRight != buttonPressedRight) {
    buttonPressedRight = readingRight;
    lastButtonStateRight = readingRight;
  }

    // read pot value
  int potValue = analogRead(potPin);
  // map the pot value to a different range
  int mappedPotValue = map(potValue, 0, 1023, 1023, 0); // Adjust the range as necessary


  // calculate pot LED brightness based on slider value
  float phase = (float(potValue) * 2 * PI * ledCycles) / 1023.0; // Calculate phase for sine wave
  int ledBrightness = (sin(phase) + 1) * 127.5; // Convert sine wave (-1 to 1) to (0 to 255) scale

  // int ledBrightness = map(potValue, 0, 1023, 255, 0); // Map the pot value linearly to PWM range 
  analogWrite(ledPin, ledBrightness);

  // Prepare and send the serial message
  Serial.print(switchState); Serial.print(",");
  Serial.print(deltaLeft); Serial.print(",");
  Serial.print(deltaRight); Serial.print(",");
  Serial.print(buttonPressedLeft ? "1" : "0"); Serial.print(",");
  Serial.println(buttonPressedRight ? "1" : "0");
  Serial.println(mappedPotValue);
  // Serial.println(potValue);

  // Reset button states after sending to avoid repeating messages
  if (buttonPressedLeft) {
    buttonPressedLeft = false;
    lastDebounceTimeLeft = millis(); // Reset debounce timer
  }
  if (buttonPressedRight) {
    buttonPressedRight = false;
    lastDebounceTimeRight = millis(); // Reset debounce timer
  }

  // Throttle the loop to reduce data rate (adjust as needed)
  delay(100);
}
