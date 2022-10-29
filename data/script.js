// Complete project details: https://randomnerdtutorials.com/esp8266-nodemcu-plot-readings-charts-multiple/
var simulation = false;

window.addEventListener('load', getReadings);

var chartV = new Highcharts.Chart({
  chart: {
    renderTo: 'chart-values',
    events: {
      load: calculateStatistics,
      redraw: calculateStatistics
    }
  },
  legend: {
    enabled: true,
    labelFormatter: function () {
      return this.name + '<br>' + 'Now: ' + '0.0' + '<br>Max: ' + '0.0' + '<br>Min: ' + '0.0' + '<br>Avg: ' + '0.0';
    }
  },
  series: [
    {
      yAxis: 0,
      name: 'Current mA',
      type: 'line',
      color: '#101D42',
      marker: {
        symbol: 'circle',
        radius: 3,
        fillColor: '#101D42',
      }
    },
    {
      yAxis: 1,
      name: 'Lambda &#955;',
      type: 'line',
      color: '#00A6A6',
      marker: {
        symbol: 'circle',
        radius: 3,
        fillColor: '#00A6A6',
      }
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

function calculateStatistics() {
  this.series.slice(0, 2).forEach(series => { // take only two first series, the last is for the navigator
    const data = series.data.filter(point => point.isInside).map(point => point.y); // grab only points within the visible range

    // calculate statistics for visible points
    const statistics = [
      data[data.length - 1],
      Math.max.apply(null, data),
      Math.min.apply(null, data),
      (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)
    ];

    const legendItem = series.legendItem;
    let i = -1;
    // construct the legend string
    const text = legendItem.textStr.replace(/-?\d+\.\d/g, () => statistics[++i]);

    // set the constructed text for the legend
    legendItem.attr({
      text: text
    });
  });
}

function plotValues(jsonValue) {
  var keys = Object.keys(jsonValue);
  console.log(keys);
  console.log(keys.length);

  for (var i = 0; i < keys.length; i++) {
    var x = (new Date()).getTime();
    console.log(x);
    const key = keys[i];
    var y = Number(jsonValue[key]);
    console.log(y);

    if (chartV.series[i].data.length > 60) {
      //chartV.series[i].addPoint([x, y], true, true, true);
      chartV.series[i].addPoint([x, y], true, true, false);
    } else {
      //chartV.series[i].addPoint([x, y], true, false, true);
      chartV.series[i].addPoint([x, y], true, false, false);
    }

    var gaugeAnimation = true;
    if (i == 0) {
      currentGauge.series[0].setData([y], true, gaugeAnimation);
    } else if (i == 1) {
      lambdaGauge.series[0].setData([y], true, gaugeAnimation);
    }
  }
}

// Function to get current readings on the webpage when it loads for the first time
function getReadings() {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      console.log(this.responseText);
    }
  };
  xhr.open("GET", "/readings", true);
  xhr.send();
}

if (!!window.EventSource) {
  var source = new EventSource('/events');

  source.addEventListener('open', function (e) {
    console.log("Events Connected");
  }, false);

  source.addEventListener('error', function (e) {
    if (e.target.readyState != EventSource.OPEN) {
      console.log("Events Disconnected");
    }
  }, false);

  source.addEventListener('message', function (e) {
    console.log("message", e.data);
  }, false);

  source.addEventListener('new_readings', function (e) {
    console.log("new_readings", e.data);
    var myObj = JSON.parse(e.data);
    console.log(myObj);
    plotValues(myObj);
  }, false);
}

if (simulation) {
function getRandomFloat(min, max, decimals) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);

  return parseFloat(str);
}

var count = 1;
var interval = setInterval(function () {
  var values =
    '{' +
    '"sensor1":"' + getRandomFloat(-80, 120, 0) + '",' +
    '"sensor2":"' + getRandomFloat(0.6, 1.4, 2) + '"' +
    '}';
  var myObj = JSON.parse(values);

  plotValues(myObj);
}, 500);

setInterval();
}