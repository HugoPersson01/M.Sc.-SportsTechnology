// Variables for 1A
var F = 0;
var FOld = 0;
var yFirst = 0;
var oldYFirst = 0;
var ySecond = 0;
var oldYSecond = 0;
var g = 2.45;             // 1 g in the units of the polar data (sensor reads about 2.45 when still)

// Variabels for measuring the cadence
var seq = 0;
var NumberOfSamples = 0;
var date = new Date();
var timestamp = date.getTime();
var oldTimestamp = timestamp;
var cadence = 0;

// Variables for the load and shake detection
var xAccOld = 0;
var yAccOld = 0;
var zAccOld = 0;
var load = 0;
var smoothLoad = 0;
var shakeSamples = 0;

// Variables for 1B
var accRoll = 0;
var gyroRoll = 0;
var comRoll = 0;

function filter(accDataPoint, gyroDataPoint) {
  // Raw data
  let xAccNew = accDataPoint.data.x;
  let yAccNew = accDataPoint.data.y;
  let zAccNew = accDataPoint.data.z;
  let xGyroNew = gyroDataPoint.data.x;
  let yGyroNew = gyroDataPoint.data.y;
  let zGyroNew = gyroDataPoint.data.z;

  // The sampling time is set under the function findPeriodCharacteristic to 52Hz
  let dT = 1 / 52

  // When streaming live, polar.js sends x = y = z = 0 if it could not pair an
  // acc and a gyro sample. Reuse the previous acc values instead.
  if (xAccNew == 0 && yAccNew == 0 && zAccNew == 0) {
    xAccNew = xAccOld;
    yAccNew = yAccOld;
    zAccNew = zAccOld;
  }

  /* Tips: 
    * To print on the console use console.log() 
    * To plot a graph u can use the function bellow:    
      * plotOnRedLine(XAccOld);
      * plotOnGreenLine(XAccNew);
      * plotOnBlueLine([varible]);
    * The value of the variable should be inbetween -100 and 100 to fit the canvas
  */
  
  //alfa = 0.9
  //F = alfa * F + (1-alfa)*yAccNew
  //plotOnRedLine(yAccNew)
  //plotOnGreenLine(F)
  //console.log(F)


  // Start writing your code below this line 
  // 1A Cadence


  // 1A.1 - Calculate the combinde Acceleration 
  // The function to use is Math.sqrt() and Math.pow(g, 2) 

  FOld = F;
  F = Math.sqrt(Math.pow(xAccNew, 2) + Math.pow(yAccNew, 2) + Math.pow(zAccNew, 2)) - g;
  //plotOnRedLine(F * 10); // * 10 so it fills the canvas


  // 1A.2  - EWMA Exponential Weighted Moving Average

  let alfa = 0.8; // try different alfa values

  oldYFirst = yFirst;
  yFirst = alfa * yFirst + (1 - alfa) * F;
  //plotOnRedLine(F * 10);
  //plotOnGreenLine(yFirst * 10);


  // 1A.3 - Add an additional EWMA filter with both an alfa and beta value

  alfa = 0.5; // try different alfa values
  let beta = 0.95; // try different beta values

  oldYSecond = ySecond;
  if (F > FOld) {
    ySecond = alfa * ySecond + (1 - alfa) * F;
  } else {
    ySecond = beta * ySecond + (1 - beta) * F;
  }
  //plotOnRedLine(F * 10);
  //plotOnGreenLine(yFirst * 10);
  //plotOnBlueLine(ySecond * 10);


  // 1A.4 Calculate the cadence frequency
  // There is a variable cadence that you can use to make a EWMA filter of the cadence

  NumberOfSamples = NumberOfSamples + 1;
  if (yFirst > ySecond && oldYFirst < oldYSecond && NumberOfSamples * dT > 0.4) {
    let stepTime = NumberOfSamples * dT; // seconds since the last crossing
    if (cadence == 0) {
      cadence = 60 / stepTime;           // first step: nothing to filter yet
    }
    cadence = 0.7 * cadence + (1 - 0.7) * (60 / stepTime); // EWMA, steps per minute
    console.log(stepTime.toFixed(2) + ' sec between cadence, ' + cadence.toFixed(1) + ' steps/min');
    NumberOfSamples = 0;
  }


  // Load: L = sqrt((xi - xi-1)^2 + (yi - yi-1)^2 + (zi - zi-1)^2)

  load = Math.sqrt(Math.pow(xAccNew - xAccOld, 2) + Math.pow(yAccNew - yAccOld, 2) + Math.pow(zAccNew - zAccOld, 2));
  xAccOld = xAccNew;
  yAccOld = yAccNew;
  zAccOld = zAccNew;


  // 1A In depth assignment(optional)
  // Detect if Polar verity sensor is continually shaken for more than 1 second


  // 1B Rotation
  // 1B.1 Calculate the roll from the Accelerometer on the Polar verity and display the result

  accRoll = Math.atan(yAccNew / Math.sqrt(Math.pow(xAccNew, 2) + Math.pow(zAccNew, 2))) * 180 / Math.PI;
  plotOnBlueLine(accRoll);

/*
  // 1B.2 Calculate the roll from the Gyroscope on the Polar verity and display the result 

  let gyroX = xGyroNew * 2000 / 32768; // raw value to deg/s (assumes +-2000 deg/s range)
  gyroRoll = gyroRoll + dT * gyroX;
  // plotOnRedLine(gyroRoll);


  // 1B.3 Apply a Complimenter filter that fuses the Acceleromter and Gyro data, display and compare the result.

  let gamma = 0.98; // try different gamma values
  comRoll = gamma * (comRoll + dT * gyroX) + (1 - gamma) * accRoll;
  //plotOnGreenLine(comRoll);


  // 1B In depth assignment(optional)
  // Write a code that calculates pitch and yaw that also takes the magnetometer for the yaw into account 
  // Or change the complementary filter to a kalman filter
  
*/
}