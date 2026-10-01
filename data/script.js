// Complete project details: https://randomnerdtutorials.com/esp8266-nodemcu-plot-readings-charts-multiple/
var simulation = false;
var debug = false;

const MAX_LOG = 36000;       // samples kept in the browser (30 min at 20 Hz)
const FRAME_MS = 33;         // ms between chart frames (~30 fps), independent of the data rate
const DISPLAY_DELAY = 400;   // ms the chart runs behind real time so batches can be played back smoothly
const GAUGE_MS = 200;        // gauges and numbers update at this rate, with an ease animation
const MAX_CHART_POINTS = 600; // per series, longer windows are thinned out
const STALE_MS = 2000;       // no data for this long -> show warning

// ---- Always-on display ------------------------------------------------------
// Screen Wake Lock API needs https, so NoSleep.js (video fallback) is used.
// Browsers only allow it after a user gesture, so it is off by default and
// not remembered: it has to be switched on again after every page load.
var noSleep = new NoSleep();
var wakeLockEnabled = false;
var toggleEl = document.querySelector("#toggle");

function setAwakeUi(on) {
  wakeLockEnabled = on;
  document.body.classList.toggle('awake', on);
}

function enableWakeLock() {
  return Promise.resolve(noSleep.enable()).then(function () {
    setAwakeUi(true);
    return true;
  }).catch(function (err) {
    console.log("Wake lock failed", err);
    setAwakeUi(false);
    return false;
  });
}

function disableWakeLock() {
  noSleep.disable();
  setAwakeUi(false);
}

toggleEl.addEventListener('change', function () {
  if (toggleEl.checked) {
    enableWakeLock().then(function (ok) {
      if (!ok) toggleEl.checked = false; // refused, show the real state
    });
  } else {
    disableWakeLock();
  }
});

// the lock is released when the tab goes to the background, take it again
document.addEventListener('visibilitychange', function () {
  if (toggleEl.checked && !document.hidden) {
    enableWakeLock().then(function (ok) {
      if (!ok) toggleEl.checked = false;
    });
  }
});

// ---- Theme -----------------------------------------------------------------
var darkMode = false;
try {
  var storedTheme = localStorage.getItem('theme');
  darkMode = storedTheme ? storedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
} catch (e) { }

function themeColors() {
  return darkMode
    ? { text: '#e6e6e6', grid: '#333', line: '#555', c1: '#6ea8fe', c2: '#2ec4b6' }
    : { text: '#333333', grid: '#e6e6e6', line: '#ccd6eb', c1: '#101D42', c2: '#00A6A6' };
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.querySelector('#toggle-dark').checked = darkMode;
  var t = themeColors();
  var label = { style: { color: t.text } };
  var title = { style: { color: t.text } };
  var base = { chart: { backgroundColor: 'transparent' } };

  chartV.update({
    chart: base.chart,
    legend: { itemStyle: { color: t.text } },
    xAxis: { labels: label, lineColor: t.line, tickColor: t.line },
    yAxis: [
      { labels: label, title: title, gridLineColor: t.grid },
      { labels: label, title: title, gridLineColor: t.grid }
    ],
    series: [
      { color: t.c1, marker: { fillColor: t.c1 } },
      { color: t.c2, marker: { fillColor: t.c2 } }
    ]
  }, true, false);

  [currentGauge, lambdaGauge].forEach(function (g) {
    g.update({
      chart: base.chart,
      xAxis: { labels: label },
      yAxis: { labels: label }
    }, true, false);
  });
}

document.querySelector('#toggle-dark').addEventListener('change', function () {
  darkMode = this.checked;
  try { localStorage.setItem('theme', darkMode ? 'dark' : 'light'); } catch (e) { }
  applyTheme();
});

// ---- Chart -----------------------------------------------------------------
var chartV = new Highcharts.Chart({
  chart: {
    renderTo: 'chart-values',
    animation: false
  },
  time: {
    useUTC: false
  },
  legend: {
    enabled: true
  },
  plotOptions: {
    series: {
      animation: false,
      enableMouseTracking: false,
      marker: { enabled: false }
    }
  },
  series: [
    {
      yAxis: 0,
      name: 'Current mA',
      type: 'line',
      color: '#101D42'
    },
    {
      yAxis: 1,
      name: 'Lambda &#955;',
      type: 'line',
      color: '#00A6A6'
    }
  ],
  title: {
    text: undefined
  },
  xAxis: {
    type: 'datetime',
    dateTimeLabelFormats: { second: '%H:%M:%S' }
  },
  yAxis: [
    { //--- Primary yAxis
      title: {
        text: 'Current mA'
      }
    },
    { //--- Secondary yAxis
      title: {
        text: 'Lambda &#955;'
      },
      opposite: true
    }
  ],
  credits: {
    enabled: false
  }
});

Highcharts.setOptions({
  chart: {
    inverted: true,
    marginLeft: 100,
    marginRight: 30,
    height: 80,
    type: 'bullet',
  },
  title: {
    text: null
  },
  legend: {
    enabled: false
  },
  yAxis: {
    gridLineWidth: 0,
    startOnTick: false,
    endOnTick: false,
  },
  plotOptions: {
    series: {
      pointPadding: 0.25,
      borderWidth: 0,
      color: '#000',
      opacity: 0.75,
      targetOptions: {
        width: '200%'
      }
    }
  },
  credits: {
    enabled: false
  },
  exporting: {
    enabled: false
  }
});

var currentGauge = new Highcharts.chart('gauge1', {
  chart: {
    marginTop: 10,
  },
  xAxis: {
    categories: ['<span class="hc-cat-title">Current</span><br/>mA']
  },
  yAxis: {
    min: -80,
    max: 120,
    plotBands: [{
      from: -80,
      to: -10,
      color: '#f00',
      label: {
        text: 'abmagern'
      }
    }, {
      from: -10,
      to: 10,
      color: '#0f0'
    }, {
      from: 10,
      to: 9e9,
      color: '#00f',
      label: {
        text: 'anfetten',
        color: '#fff'
      }
    }],
    title: null
  },
  series: [{
    data: [{
      target: 0
    }]
  }],
  tooltip: {
    pointFormat: '<b>{point.y}</b> (with target at {point.target})'
  }
});

var lambdaGauge = new Highcharts.chart('gauge2', {
  xAxis: {
    categories: ['<span class="hc-cat-title">Lambda</span><br/>&#955;']
  },
  yAxis: {
    min: 0.6,
    max: 1.4,
    plotBands: [{
      from: 0.6,
      to: 0.8,
      color: '#0000ff',
      label: {
        text: 'zu fett',
        color: '#ffffff'
      }
    }, {
      from: 0.8,
      to: 0.88,
      color: '#00ff00'
    }, {
      from: 0.88,
      to: 0.98,
      color: '#90ee90'
    }, {
      from: 0.98,
      to: 1.02,
      color: '#e0ffff'
    }, {
      from: 1.02,
      to: 1.4,
      color: '#ff0000',
      label: {
        text: 'zu mager',
        color: '#fff'
      }
    }],
    title: null
  },
  series: [{
    threshold: 1,
    data: [{
      target: 1.0
    }]
  }],
  tooltip: {
    pointFormat: '<b>{point.y}</b> (with target at {point.target})'
  }
});

// ---- Data ------------------------------------------------------------------
// Ring buffer in the browser, the ESP stores nothing.
var logT = [];
var logC = [];
var logL = [];
var paused = false;
var windowSec = 30;
var lastDataTime = 0;
var sampleDt = 50;
var nextT = 0;      // timestamp of the next sample, kept continuous across batches
var shownIdx = 0;   // next log index that has not been given to the chart yet

// only every n-th sample goes into the chart so long windows stay light
function chartStep() {
  return Math.max(1, Math.ceil(windowSec * 1000 / sampleDt / MAX_CHART_POINTS));
}

function addSamples(msg) {
  var d = msg.d;
  var dt = msg.dt || 50;
  var now = Date.now();
  sampleDt = dt;

  // Batches arrive in bursts. Instead of stamping samples with their arrival
  // time, continue the previous batch's clock and only correct it slowly.
  var expectedLast = nextT + (d.length - 1) * dt;
  var err = now - expectedLast;
  if (nextT === 0 || Math.abs(err) > 1000) {
    nextT = now - (d.length - 1) * dt;
  } else {
    nextT += err * 0.1;
  }

  for (var i = 0; i < d.length; i++) {
    logT.push(nextT);
    logC.push(Number(d[i][0]));
    logL.push(Number(d[i][1]));
    nextT += dt;
  }
  if (logT.length > MAX_LOG + 1000) {
    var cut = logT.length - MAX_LOG;
    logT.splice(0, cut);
    logC.splice(0, cut);
    logL.splice(0, cut);
    shownIdx = Math.max(0, shownIdx - cut);
  }
  lastDataTime = now;
}

function fmt(v, digits) {
  return isFinite(v) ? v.toFixed(digits) : '–';
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function stats(arr, from, to, prefix, digits) {
  var min = Infinity, max = -Infinity, sum = 0;
  for (var i = from; i <= to; i++) {
    var v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  var n = to - from + 1;
  setText(prefix + '-now', fmt(arr[to], digits));
  setText(prefix + '-min', fmt(min, digits));
  setText(prefix + '-max', fmt(max, digits));
  setText(prefix + '-avg', fmt(n ? sum / n : NaN, digits));
}

// last log index that is old enough to be shown, -1 if none
function displayIndex(displayTime) {
  var to = logT.length - 1;
  while (to >= 0 && logT[to] > displayTime) to--;
  return to;
}

var lastGaugeTime = 0;

function updateReadouts(to, displayTime) {
  var from = to;
  var limit = displayTime - windowSec * 1000;
  while (from > 0 && logT[from - 1] >= limit) from--;
  stats(logC, from, to, 'c', 1);
  stats(logL, from, to, 'l', 2);
  var anim = { duration: GAUGE_MS };
  currentGauge.series[0].setData([{ y: logC[to], target: 0 }], true, anim);
  lambdaGauge.series[0].setData([{ y: logL[to], target: 1.0 }], true, anim);
}

// One frame: hand over the samples that became due, move the time axis.
// The axis follows the clock, so the chart scrolls smoothly even though the
// data arrives in batches, and there is nothing for Highcharts to morph.
function frame() {
  if (paused || document.hidden || logT.length === 0) return;

  var now = Date.now();
  var displayTime = now - DISPLAY_DELAY;
  var to = displayIndex(displayTime);
  if (to < 0) return;

  var xMin = displayTime - windowSec * 1000;
  var step = chartStep();
  var sC = chartV.series[0];
  var sL = chartV.series[1];

  for (; shownIdx <= to; shownIdx++) {
    if (shownIdx % step !== 0) continue;
    var shift = sC.data.length > 0 && sC.data[0].x < xMin - 1000;
    sC.addPoint([logT[shownIdx], logC[shownIdx]], false, shift, false);
    sL.addPoint([logT[shownIdx], logL[shownIdx]], false, shift, false);
  }

  chartV.xAxis[0].setExtremes(xMin, displayTime, false, false);
  chartV.redraw(false);

  if (now - lastGaugeTime >= GAUGE_MS) {
    lastGaugeTime = now;
    updateReadouts(to, displayTime);
  }
}

setInterval(frame, FRAME_MS);

// refill the chart from the log, after pause, window change or tab switch
function rebuildChart() {
  if (logT.length === 0) return;
  var displayTime = Date.now() - DISPLAY_DELAY;
  var to = displayIndex(displayTime);
  if (to < 0) return;

  var xMin = displayTime - windowSec * 1000;
  var from = to;
  while (from > 0 && logT[from - 1] >= xMin) from--;
  from -= from % chartStep(); // keep the step grid aligned with frame()

  var step = chartStep();
  var dataC = [];
  var dataL = [];
  for (var i = from; i <= to; i++) {
    if (i % step !== 0) continue;
    dataC.push([logT[i], logC[i]]);
    dataL.push([logT[i], logL[i]]);
  }
  chartV.series[0].setData(dataC, false, false, false);
  chartV.series[1].setData(dataL, false, false, false);
  shownIdx = to + 1;
  lastGaugeTime = 0;
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden && !paused) rebuildChart();
});

// ---- Controls --------------------------------------------------------------
document.querySelector('#btn-pause').addEventListener('click', function () {
  paused = !paused;
  this.classList.toggle('paused', paused);
  var label = paused ? 'Weiter' : 'Pause';
  this.title = label;
  this.setAttribute('aria-label', label);
  if (!paused) rebuildChart();
  updateStatus();
});

document.querySelector('#sel-window').addEventListener('change', function () {
  windowSec = Number(this.value);
  if (!paused) rebuildChart();
});

document.querySelector('#btn-csv').addEventListener('click', function () {
  var rows = ['time,current_mA,lambda'];
  for (var i = 0; i < logT.length; i++) {
    rows.push(new Date(logT[i]).toISOString() + ',' + logC[i] + ',' + logL[i]);
  }
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'currentdiag_' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
});

// ---- Connection status -----------------------------------------------------
var connected = false;

function updateStatus() {
  var dot = document.getElementById('status-dot');
  var text = '';
  var cls = '';
  if (!connected) {
    text = 'getrennt'; cls = 'bad';
  } else if (Date.now() - lastDataTime > STALE_MS) {
    text = 'keine Daten'; cls = 'bad';
  } else if (paused) {
    text = 'pausiert'; cls = 'ok';
  } else {
    text = 'live'; cls = 'ok';
  }
  dot.className = 'dot ' + cls;
  setText('status-text', text);
}

setInterval(updateStatus, 500);

if (!!window.EventSource) {
  var source = new EventSource('/events');

  source.addEventListener('open', function () {
    connected = true;
    updateStatus();
  }, false);

  source.addEventListener('error', function (e) {
    if (e.target.readyState != EventSource.OPEN) {
      connected = false;
      updateStatus();
    }
  }, false);

  source.addEventListener('new_readings', function (e) {
    addSamples(JSON.parse(e.data));
  }, false);
}

if (simulation) {
  setInterval(function () {
    var d = [];
    for (var i = 0; i < 5; i++) {
      d.push([Math.random() * 200 - 80, Math.random() * 0.8 + 0.6]);
    }
    addSamples({ dt: 50, d: d });
  }, 250);
}

applyTheme();
