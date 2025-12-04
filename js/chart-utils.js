// chart-utils.js
// Requires Chart.js loaded globally.

function createLineChart(ctx, label, color) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.25,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { beginAtZero: false }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function pushToChart(chart, value, maxPoints = 60) {
  const label = new Date().toLocaleTimeString();
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(Number(value));
  if (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}
