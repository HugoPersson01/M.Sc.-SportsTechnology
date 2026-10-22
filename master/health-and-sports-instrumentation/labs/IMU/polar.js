// Variables to draw on canvases
var canvas, canvas2, canvas3, ctx, ctx2, ctx3, requestId;
var OutputString = "Output";
// Lists to store the acceleration data (we draw on canvas)
var xAcc = [];
var yAcc = [];
var zAcc = [];
// Lists to store the gyro data (we draw on canvas2)
var xGyro = [];
var yGyro = [];
var zGyro = [];
// Lists to store the filtered data (we draw on canvas3)
var rollAr = [];
var pitchAr = [];
var yawAr = [];
// Bluetooth variables
let targetDevice = null;
const AccGyro_SERVICE = "fb005c80-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_PERDIO = "fb005c81-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_DATA = "fb005c82-02e7-f387-1cad-8acd2d8df0c8";

class DataPoint {
  // Class for one datapoint
  constructor(timestamp, type, data) {
    this.timestamp = timestamp;
    this.type = type; // 'acceleration' or 'gyro'
    this.data = data; // x, y and z
  }
}

class DataQueue {
  // Class for the queue that synchronizes the acceleration and gyro data
  constructor() {
    this.queue = [];
    this.MAX_TIMESTAMP_DIFF = 20000000; // Maximum allowed timestamp difference for synchronization in ns
    this.MIN_QUEUE_SIZE = 25; // Minimum length of queue before data is processed
  }

  // function that adds a datapoint to the queue
  add(dataPoint) {
    // Insert the data point in a sorted manner based on timestamp
    let index = this.queue.findIndex(item => dataPoint.timestamp < item.timestamp);
    if (index === -1) {
      this.queue.push(dataPoint);
    } else {
      this.queue.splice(index, 0, dataPoint);
    }
  }

  // Function that processes the queue
  processQueue() {
    while (this.queue.length >= this.MIN_QUEUE_SIZE) {
      // We get the two data points in front of the queue
      const firstDataPoint = this.queue.shift();
      const secondDataPoint = this.queue[0];

      if (secondDataPoint.timestamp - firstDataPoint.timestamp < this.MAX_TIMESTAMP_DIFF) {
        // Here the timestamps are within our tolerance
        if (firstDataPoint.type !== secondDataPoint.type) {
          let accDataPoint = firstDataPoint.type === 'acceleration' ? firstDataPoint : secondDataPoint;
          let gyroDataPoint = firstDataPoint.type === 'gyro' ? firstDataPoint : secondDataPoint;
          //console.log('Match!');
          filter(accDataPoint, gyroDataPoint);
          continue;
        }
      }
      // The data points did not match so we add a 'zero' data point with the 
      // same timestamp as the first data point
      if (firstDataPoint.type === 'acceleration') {
        // Here we add a 'zero' gyro data point
        let gyroDataPoint = new DataPoint(firstDataPoint.timestamp, 'gyro', { x: 0, y: 0, z: 0 });
        filter(firstDataPoint, gyroDataPoint)
      } else if(firstDataPoint.type === 'gyro') {
        // Here we add a 'zero' acceleration data point
        let accDataPoint = new DataPoint(firstDataPoint.timestamp, 'acceleration', {x: 0, y: 0, z: 0});
        filter(accDataPoint, firstDataPoint)
      }
    }
  }
}
// Variable we use to put data packages into and process
const queue = new DataQueue();

function onDataChanged(event) {
  // RSSI Recived Signal Strength Indicator
  let RSSI = event.rssi;

  // Event data is converted into 6 parameters. X, Y, Z of the Accelerometer and Gyro
  let value = event.target.value

  let measId = value.getUint8(0);

  // console.log('The ID:'+measId);
  // console.log('byteLength:'+value.byteLength);

  value = value.buffer ? value : new DataView(value); // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.

  var uint8View = new Uint8Array(value.buffer);
  // console.log("incoming data: ", uint8View);

  // HEADING [streamType x 8 bit, timestamp x 64 bits, frameType x 8 bits, refSample x (numOfChannels * 16 bits), ...]
  // DELTA DUMP 1 [..., deltaSize x 8 bits, deltaSampleCount x 8 bits, samples x (deltaSize * numOfChannels * deltaSampleCount), ...]
  // DELTA DUMP 2 [..., deltaSize x 8 bits, deltaSampleCount x 8 bits, samples x (deltaSize * numOfChannels * deltaSampleCount), ...]

  let offset = 10 + 2 * 3;
  let deltaSize = value.getUint8(offset);
  let sampleCount = value.getUint8(offset + 1);
  let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);
  //console.log(`>> ID: ${measId} deltaSize: ${deltaSize} bits/value | sampleCount: ${sampleCount} samples`);

  if (measId == 2) {
    updateAcc(value);
  } else if (measId == 5) {
    updateGyro(value);
  }
}

function uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp) {
  // Adjustment for drawing
  let adjustX = 100 + (xAccNew * 8);
  let adjustY = 100 + (yAccNew * 8);
  let adjustZ = 100 + (zAccNew * 8);

  let accDataPoint = new DataPoint(timestamp, 'acceleration', { x: xAccNew, y: yAccNew, z: zAccNew });
  queue.add(accDataPoint);
  queue.processQueue();
  xAcc.shift();
  xAcc.push(adjustX);
  yAcc.shift();
  yAcc.push(adjustY);
  zAcc.shift();
  zAcc.push(adjustZ);
  if (recording) {
    recAccX.push(adjustX);
    recAccY.push(adjustY);
    recAccZ.push(adjustZ);
  }
}

function uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp) {
  // Adjustment for drawing
  let adjustX = 100 + (xGyroNew / 100);
  let adjustY = 100 + (yGyroNew / 100);
  let adjustZ = 100 + (zGyroNew / 100);

  let gyroDataPoint = new DataPoint(timestamp, 'gyro', { x: xGyroNew, y: yGyroNew, z: zGyroNew });
  queue.add(gyroDataPoint);
  queue.processQueue();
  xGyro.shift();
  xGyro.push(adjustX);
  yGyro.shift();
  yGyro.push(adjustY);
  zGyro.shift();
  zGyro.push(adjustZ);
  if (recording) {
    recGyrX.push(adjustX);
    recGyrY.push(adjustY);
    recGyrZ.push(adjustZ);
  }
}

function updateGyro(value) {
  let xGyroNew = value.getInt16(10 + 2 * 0, true);
  let yGyroNew = value.getInt16(10 + 2 * 1, true);
  let zGyroNew = value.getInt16(10 + 2 * 2, true);

  let timestamp = Number(value.getBigUint64(1, true));
  //console.log(`x: ${xGyroNew} y: ${yGyroNew} z: ${zGyroNew*0.24399999}`);

  uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp);

  let offset = 10 + 2 * 3;
  let sampleCount = value.getUint8(offset + 1);
  let indexDeltaStart = offset + 2;
  let deltaSize = value.getUint8(offset);
  let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);
  let indexDeltaStop = indexDeltaStart + deltaBytesCount;

  let deltaData = value.buffer.slice(indexDeltaStart, indexDeltaStop); // get the current delta dump
  let binDeltaData = bufferToReverseBinString(deltaData);

  for (let i = 0; i < sampleCount; i++) {
    let j = 0;
    let binSample = binDeltaData.slice(i * 3 * deltaSize);
    let channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    let signedInt = bitStringToSignedInt(channelSample);
    xGyroNew = xGyroNew + (signedInt);
    j = 1
    binSample = binDeltaData.slice(i * 3 * deltaSize);
    channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    signedInt = bitStringToSignedInt(channelSample);
    yGyroNew = yGyroNew + (signedInt);
    j = 2
    binSample = binDeltaData.slice(i * 3 * deltaSize);
    channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    signedInt = bitStringToSignedInt(channelSample);
    zGyroNew = zGyroNew + (signedInt);
    let correctedTimestamp = timestamp + ((i + 1) * 1 / 52) * Math.pow(10, 9);
    uppdateGyro(xGyroNew, yGyroNew, zGyroNew, correctedTimestamp);
    //console.log(`x: ${xGyroNew} y: ${yGyroNew} z: ${zGyroNew}`);
  }
}

function updateAcc(value) {
  let xAccNew = value.getInt16(10 + 2 * 0, true) * 0.24399999 * 0.00980665;
  let yAccNew = value.getInt16(10 + 2 * 1, true) * 0.24399999 * 0.00980665;
  let zAccNew = value.getInt16(10 + 2 * 2, true) * 0.24399999 * 0.00980665;

  let timestamp = Number(value.getBigUint64(1, true));
  uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp);

  let offset = 10 + 2 * 3;
  let sampleCount = value.getUint8(offset + 1);
  let indexDeltaStart = offset + 2;
  let deltaSize = value.getUint8(offset);
  let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);

  let indexDeltaStop = indexDeltaStart + deltaBytesCount;
  let deltaData = value.buffer.slice(indexDeltaStart, indexDeltaStop); // get the current delta dump
  let test = value.buffer.slice(indexDeltaStart, Math.ceil(indexDeltaStart + deltaSize / 8));
  let binDeltaData = bufferToReverseBinString(deltaData);
  var uint8View = new Uint8Array(test);
  if (deltaSize == 12) {
    uint8View[1] = uint8View[1] ^ 15;
  }
  if (deltaSize == 6) {
    uint8View[0] = uint8View[0] ^ 63;
  }

  //console.log("incoming data: ", uint8View);
  for (let i = 0; i < sampleCount; i++) {
    let j = 0;
    let binSample = binDeltaData.slice(i * 3 * deltaSize);
    let channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    let signedInt = bitStringToSignedInt(channelSample);
    xAccNew = xAccNew + (signedInt * 0.24399999 * 0.01);
    j = 1
    binSample = binDeltaData.slice(i * 3 * deltaSize);
    channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    signedInt = bitStringToSignedInt(channelSample);
    yAccNew = yAccNew + (signedInt * 0.24399999 * 0.01);
    j = 2
    binSample = binDeltaData.slice(i * 3 * deltaSize);
    channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
    signedInt = bitStringToSignedInt(channelSample);
    zAccNew = zAccNew + (signedInt * 0.24399999 * 0.01);
    let correctedTimestamp = timestamp + ((i + 1) * 1 / 52) * Math.pow(10, 9);
    uppdateAcc(xAccNew, yAccNew, zAccNew, correctedTimestamp);
  }
}

function init() {
  canvas = document.getElementById('AccCanvas');
  ctx = canvas.getContext('2d');
  canvas2 = document.getElementById('GyroCanvas');
  ctx2 = canvas2.getContext('2d');
  canvas3 = document.getElementById('SensorFusion');
  ctx3 = canvas3.getContext('2d');
  for (i = 0; i < 250; i++) {
    xAcc.push(100);
    yAcc.push(100);
    zAcc.push(100);
    xGyro.push(100);
    yGyro.push(100);
    zGyro.push(100);
    rollAr.push(100);
    pitchAr.push(100);
    yawAr.push(100);
  }
  console.log("init");
}

function startBluetooth() {
  navigator.bluetooth.requestDevice({
    filters: [{ services: [AccGyro_SERVICE] }, { namePrefix: "Polar Sense" }]
  })
    .then(device => {
      targetDevice = device;
      return device.gatt.connect();
    })
    .then(server => {
      return server.getPrimaryService(AccGyro_SERVICE);
    })
    .then(service => {
      findDataCharacteristic(service);
      findPeriodCharacteristic(service);
    })
    .catch(error => {
      console.log(error);
      targetDevice = null;
    });
}


function findDataCharacteristic(service) {
  service.getCharacteristic(AccGyro_DATA)
    .then(characteristic => {
      return characteristic.startNotifications();
    })
    .then(characteristic => {
      characteristic.addEventListener('characteristicvaluechanged', onDataChanged);
      console.log("change ");
    })
    .catch(error => {
      console.log(error);
    });
}

function plotOnRedLine(newValue) {
  rollAr.shift();
  rollAr.push(100 + newValue);
}

function plotOnBlueLine(newValue) {
  yawAr.shift();
  yawAr.push(100 + newValue);
}

function plotOnGreenLine(newValue) {
  pitchAr.shift();
  pitchAr.push(100 + newValue);
}

function findPeriodCharacteristic(service) {
  console.log("setData");
  service.getCharacteristic(AccGyro_PERDIO)
    .then(characteristic => {

      //   const valAcc = new Uint8Array([2, 2, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 8, 0, 4, 1, 3]);
      const valAcc = new Uint8Array([2, 2, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 8, 0, 4, 1, 3]);
      characteristic.writeValueWithResponse(valAcc)
      .catch(async () =>  {
        console.log("DOMException: GATT operation already in progress.")
        await Promise.resolve();
        this.delayPromise(1000);
        characteristic.writeValue(valAcc);
      });

      setTimeout(function () {
        const valGyro = new Uint8Array([2, 5, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 208, 7, 4, 1, 3]);
        characteristic.writeValueWithResponse(valGyro)
        .catch(async () =>  {
          console.log("DOMException: GATT operation already in progress.")
          return Promise.resolve()
              .then(() => this.delayPromise(1000))
              .then(() => { characteristic.writeValue(valGyro);});
        });
      }, 100);


    })
    .catch(error => {
      console.log(error);
    });
}

function delayPromise(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function start() {
  // Start the animation loop, targets 60 frames/s
  stopReplay();
  startBluetooth();
  if (!requestId) {
    requestId = requestAnimationFrame(animationLoop);
  }
}

function stop() {
  stopReplay();
  if (requestId) {
    cancelAnimationFrame(requestId);
    requestId = null;
  }
  if (targetDevice == null) {
    console.log('The target device is null.');
    return;
  }
  //bluetoothCharacteristic.stopNotifications()
  targetDevice.gatt.disconnect();
  console.log('Disconnected');
}


function animationLoop(timestamp) {
  //console.log("animate");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#FF0000";
  ctx.fillText("Accelerometer X Y Z:", 5, 12);

  ctx.strokeStyle = "#FF0000";
  ctx.beginPath(0, 200 - xAcc[0]);
  for (foo = 0; foo < canvas.width; foo++) {
    ctx.lineTo(foo * 2, 200 - xAcc[foo]);
  }
  ctx.stroke();

  ctx.strokeStyle = "#00FF00";
  ctx.beginPath(0, 200 - yAcc[0]);
  for (foo = 0; foo < canvas.width; foo++) {
    ctx.lineTo(foo * 2, 200 - yAcc[foo]);
  }
  ctx.stroke();

  ctx.strokeStyle = "#0000FF";
  ctx.beginPath(0, 200 - zAcc[0]);
  for (foo = 0; foo < canvas.width; foo++) {
    ctx.lineTo(foo * 2, 200 - zAcc[foo]);
  }
  ctx.stroke();


  ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

  ctx2.font = "12px Arial";
  ctx2.fillStyle = "#FF0000";
  ctx2.fillText('Gyro X Y Z: ', 5, 12);

  ctx2.strokeStyle = "#FF0000";
  ctx2.beginPath(0, 200 - xGyro[0]);
  for (foo = 0; foo < canvas2.width; foo++) {
    ctx2.lineTo(foo * 2, 200 - xGyro[foo]);
  }
  ctx2.stroke();

  ctx2.strokeStyle = "#00FF00";
  ctx2.beginPath(0, 200 - yGyro[0]);
  for (foo = 0; foo < canvas2.width; foo++) {
    ctx2.lineTo(foo * 2, 200 - yGyro[foo]);
  }
  ctx2.stroke();

  ctx2.strokeStyle = "#0000FF";
  ctx2.beginPath(0, 200 - zGyro[0]);
  for (foo = 0; foo < canvas2.width; foo++) {
    ctx2.lineTo(foo * 2, 200 - zGyro[foo]);
  }
  ctx2.stroke();

  ctx3.clearRect(0, 0, canvas3.width, canvas3.height);

  ctx3.font = "12px Arial";
  ctx3.fillStyle = "#FF0000";
  ctx3.fillText(OutputString, 5, 12);

  ctx3.strokeStyle = "#FF0000";
  ctx3.beginPath(0, 200 - rollAr[0]);
  for (foo = 0; foo < canvas3.width; foo++) {
    ctx3.lineTo(foo * 2, 200 - rollAr[foo]);
  }
  ctx3.stroke();

  ctx3.strokeStyle = "#00FF00";
  ctx3.beginPath(0, 200 - pitchAr[0]);
  for (foo = 0; foo < canvas3.width; foo++) {
    ctx3.lineTo(foo * 2, 200 - pitchAr[foo]);
  }
  ctx3.stroke();

  ctx3.strokeStyle = "#0000FF";
  ctx3.beginPath(0, 200 - yawAr[0]);
  for (foo = 0; foo < canvas3.width; foo++) {
    ctx3.lineTo(foo * 2, 200 - yawAr[foo]);
  }
  ctx3.stroke();

  /*
  if(xAcc.length > 250){
      xAcc.shift();
      yAcc.shift();
      zAcc.shift();
  }

  if(xGyro.length > 250){
      xGyro.shift();
      yGyro.shift();
      zGyro.shift();
  }
  */

  requestId = requestAnimationFrame(animationLoop);
}

// convert buffer array to binary
function bufferToReverseBinString(buffer) {
  array = new Uint8Array(buffer);
  let bin = [];
  array.forEach(function (element) {
    let elementBin = (element >>> 0).toString(2);
    let elementBin8 = elementBin.padStart(8, '0');
    bin.push(elementBin8.split('').reverse().join(''));
  });
  return bin.join('');
}

function bitStringToSignedInt(binStr) {
  if (binStr.length > 64) throw new RangeError('parsing only supports ints up to 32 bits');
  return parseInt(binStr[0] === "1" ? binStr.padStart(32, "1") : binStr.padStart(32, "0"), 2) >> 0;
}

// Recording of all data between Start Record and Stop Record
var recording = false;
var recAccX = [];
var recAccY = [];
var recAccZ = [];
var recGyrX = [];
var recGyrY = [];
var recGyrZ = [];

function startRecording() {
  recAccX = [];
  recAccY = [];
  recAccZ = [];
  recGyrX = [];
  recGyrY = [];
  recGyrZ = [];
  recording = true;
  console.log('Recording started');
}

function stopRecording() {
  if (!recording) {
    console.log('Not recording.');
    return;
  }
  recording = false;
  console.log('Recording stopped, ' + recAccX.length + ' acceleration samples and ' + recGyrX.length + ' gyro samples');
  if (recAccX.length === 0 && recGyrX.length === 0) {
    console.log('No data recorded.');
    return;
  }
  saveToFile();
}

function saveToFile() {
  var file;
  var properties = { type: 'application/json' }; // Specify the file's mime-type.
  var myObj = { accX: recAccX, accY: recAccY, accZ: recAccZ, gyrX: recGyrX, gyrY: recGyrY, gyrZ: recGyrZ };
  var myJSON = JSON.stringify(myObj);
  try {
    // Specify the filename using the File constructor, but ...
    file = new File(myJSON, "6DOF.json", properties);
  } catch (e) {
    // ... fall back to the Blob constructor if that isn't supported.
    file = new Blob([myJSON], { type: "application/json" });
  }
  var a = document.createElement('a');
  a.href = window.URL.createObjectURL(file);
  a.download = "6DOF.json";
  a.click();
}

// Replay of a saved 6DOF.json file
var replayTimer = null;
var replayIndex = 0;
var replayData = null;
const REPLAY_SAMPLE_PERIOD = 1000 / 52; // ms, loops at the recorded sample rate of 52 Hz
var replaySamplePeriod = REPLAY_SAMPLE_PERIOD;

function loadFromFile(input) {
  var file = input.files[0];
  if (!file) {
    console.log('No file selected.');
    return;
  }
  var reader = new FileReader();
  reader.onload = function (event) {
    var parsed;
    try {
      parsed = JSON.parse(event.target.result);
    } catch (e) {
      console.log('Could not parse the file as JSON: ' + e);
      return;
    }
    if (Array.isArray(parsed)) {
      replayData = convertSensorLogger(parsed);
      if (!replayData) {
        return;
      }
    } else if (parsed && parsed.accX && parsed.gyrX) {
      replayData = parsed;
    } else {
      console.log('Unrecognized file format. Expected a 6DOF.json or SensorLogger.json recording.');
      return;
    }
    replaySamplePeriod = replayData.samplePeriod || REPLAY_SAMPLE_PERIOD;
    replayIndex = 0;
    console.log('Loaded ' + file.name + ', looping the samples at ' + (1000 / replaySamplePeriod).toFixed(1) + ' Hz');
    startReplay();
  };
  reader.readAsText(file);
  input.value = '';
}

// Converts a SensorLogger app export (a JSON array of x/y/z/sensor/seconds_elapsed
// entries) into the replay format, using the calibrated sensors when present.
// Accelerometer is in m/s^2 and gyroscope in rad/s; the gyroscope values are
// converted to deg/s to match the Polar stream, then the drawing adjustments
// (acc: 100 + raw * 8, gyro: 100 + raw / 100) are applied.
function convertSensorLogger(entries) {
  var accEntries = entries.filter(function (e) { return e.sensor === 'Accelerometer'; });
  var gyroEntries = entries.filter(function (e) { return e.sensor === 'Gyroscope'; });
  if (accEntries.length === 0) {
    accEntries = entries.filter(function (e) { return e.sensor === 'AccelerometerUncalibrated'; });
  }
  if (gyroEntries.length === 0) {
    gyroEntries = entries.filter(function (e) { return e.sensor === 'GyroscopeUncalibrated'; });
  }
  if (accEntries.length === 0 || gyroEntries.length === 0) {
    console.log('The SensorLogger file contains no accelerometer and gyroscope samples.');
    return null;
  }
  var byElapsed = function (a, b) { return parseFloat(a.seconds_elapsed) - parseFloat(b.seconds_elapsed); };
  accEntries.sort(byElapsed);
  gyroEntries.sort(byElapsed);
  var length = Math.min(accEntries.length, gyroEntries.length);
  var converted = { accX: [], accY: [], accZ: [], gyrX: [], gyrY: [], gyrZ: [] };
  for (var i = 0; i < length; i++) {
    converted.accX.push(100 + parseFloat(accEntries[i].x) * 8);
    converted.accY.push(100 + parseFloat(accEntries[i].y) * 8);
    converted.accZ.push(100 + parseFloat(accEntries[i].z) * 8);
    converted.gyrX.push(100 + (parseFloat(gyroEntries[i].x) * 180 / Math.PI) / 100);
    converted.gyrY.push(100 + (parseFloat(gyroEntries[i].y) * 180 / Math.PI) / 100);
    converted.gyrZ.push(100 + (parseFloat(gyroEntries[i].z) * 180 / Math.PI) / 100);
  }
  // Detect the native sample rate from the recording so the replay matches
  // the speed the data was captured at
  var elapsed = [];
  for (var j = 0; j < accEntries.length; j++) {
    elapsed.push(parseFloat(accEntries[j].seconds_elapsed));
  }
  var meanPeriodMs = REPLAY_SAMPLE_PERIOD;
  if (elapsed.length > 1 && elapsed[elapsed.length - 1] > elapsed[0]) {
    meanPeriodMs = (elapsed[elapsed.length - 1] - elapsed[0]) / (elapsed.length - 1) * 1000;
  }
  if (isFinite(meanPeriodMs) && meanPeriodMs > 0) {
    converted.samplePeriod = meanPeriodMs;
  }
  console.log('SensorLogger recording: ' + length + ' sample pairs' +
    (converted.samplePeriod ? ' at ' + (1000 / converted.samplePeriod).toFixed(1) + ' Hz' : ''));
  return converted;
}

function startReplay() {
  stopReplay();
  replayTimer = setInterval(replayStep, replaySamplePeriod);
  if (!requestId) {
    requestId = requestAnimationFrame(animationLoop);
  }
}

function stopReplay() {
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
  }
}

function replayStep() {
  if (!replayData || !replayData.accX || !replayData.gyrX) {
    stopReplay();
    return;
  }
  var length = Math.min(
    replayData.accX.length, replayData.accY.length, replayData.accZ.length,
    replayData.gyrX.length, replayData.gyrY.length, replayData.gyrZ.length
  );
  if (length === 0) {
    stopReplay();
    return;
  }
  var i = replayIndex % length;

  // The saved arrays hold the drawing-adjusted values, invert the adjustments
  // (acc: 100 + raw * 8, gyro: 100 + raw / 100) to get the raw sensor values back
  var accXRaw = (replayData.accX[i] - 100) / 8;
  var accYRaw = (replayData.accY[i] - 100) / 8;
  var accZRaw = (replayData.accZ[i] - 100) / 8;
  var gyrXRaw = (replayData.gyrX[i] - 100) * 100;
  var gyrYRaw = (replayData.gyrY[i] - 100) * 100;
  var gyrZRaw = (replayData.gyrZ[i] - 100) * 100;

  var accDataPoint = new DataPoint(replayIndex, 'acceleration', { x: accXRaw, y: accYRaw, z: accZRaw });
  var gyroDataPoint = new DataPoint(replayIndex, 'gyro', { x: gyrXRaw, y: gyrYRaw, z: gyrZRaw });

  // Update the drawing arrays the same way uppdateAcc and uppdateGyro do
  xAcc.shift(); xAcc.push(replayData.accX[i]);
  yAcc.shift(); yAcc.push(replayData.accY[i]);
  zAcc.shift(); zAcc.push(replayData.accZ[i]);
  xGyro.shift(); xGyro.push(replayData.gyrX[i]);
  yGyro.shift(); yGyro.push(replayData.gyrY[i]);
  zGyro.shift(); zGyro.push(replayData.gyrZ[i]);

  filter(accDataPoint, gyroDataPoint);
  replayIndex++;
}