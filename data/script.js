// Complete project details: https://randomnerdtutorials.com/esp8266-nodemcu-plot-readings-charts-multiple/

window.addEventListener('load', getReadings);

var chartV = new Highcharts.Chart({
  chart: {
    renderTo:'chart-values',
      events: {
        load: calculateStatistics,
        redraw: calculateStatistics
      }
//    animation: false
  },
//   plotOptions: {
//     series: {
//       animation: false
//     }
//   },
  legend: {
    enabled: true,
    labelFormatter: function() {
      return this.name + '<br>' + 'Now: ' + '0.0' + ' mA' + '<br>Max: ' + '0.0' + '<br>Min: ' + '0.0' + '<br>Avg: ' + '0.0';
    }
  },
  series: [
    {
      name: 'Current #1',
      type: 'line',
      color: '#101D42',
      marker: {
        symbol: 'circle',
        radius: 3,
        fillColor: '#101D42',
      }
    },
  ],
  title: {
    text: undefined
  },
  xAxis: {
    type: 'datetime',
    dateTimeLabelFormats: { second: '%H:%M:%S' }
  },
  yAxis: {
    title: {
      text: 'Current mA'
    }
  },
  credits: {
    enabled: false
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

    if(chartV.series[i].data.length > 60) {
      //chartV.series[i].addPoint([x, y], true, true, true);
      chartV.series[i].addPoint([x, y], true, true, false);
    } else {
      //chartV.series[i].addPoint([x, y], true, false, true);
      chartV.series[i].addPoint([x, y], true, false, false);
    }
  }
}

// Function to get current readings on the webpage when it loads for the first time
function getReadings(){
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      console.log(this.responseText);
    }
  };
  xhr.open("GET", "/readings", true);
  xhr.send();
}

if (!!window.EventSource) {
  var source = new EventSource('/events');

  source.addEventListener('open', function(e) {
    console.log("Events Connected");
  }, false);

  source.addEventListener('error', function(e) {
    if (e.target.readyState != EventSource.OPEN) {
      console.log("Events Disconnected");
    }
  }, false);

  source.addEventListener('message', function(e) {
    console.log("message", e.data);
  }, false);

  source.addEventListener('new_readings', function(e) {
    console.log("new_readings", e.data);
    var myObj = JSON.parse(e.data);
    console.log(myObj);
    plotValues(myObj);
  }, false);
}