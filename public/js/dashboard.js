const API_URL = '/api';
let activeChart = null;

const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

async function updateDashboard() {
  await updateSensorData();
  await updateMaintenanceLog();
  await updateAlerts();
}

// ── 1. SENSOR DATA ────────────────────────────────────────────────────────────
async function updateSensorData() {
  try {
    const res  = await fetch(`${API_URL}/engine-data/latest`);
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;
    const d = json.data;

    // Overview cards
    setVal('val-rpm',   (d.rpm   || 0) + ' RPM');
    setVal('val-temp',  (d.coolant || d.temp || 0).toFixed(1) + ' °C');
    setVal('val-volt',  (d.volt  || 0).toFixed(1) + ' V');

    // Engine status
    const isRun  = d.status === 'RUNNING';
    const isSync = d.sync === 'ON-GRID' || d.sync === 'SYNCHRONIZED';
    updateStatus('engSync', isSync, 'Synchronized', 'Not Synced');
    updateStatus('engStat', isRun,  'Running',       'Stopped');

    const fuel    = Math.round(d.fuel || 0);
    const fuelEl  = document.getElementById('fuelLevel');
    if (fuelEl) { fuelEl.textContent = fuel + '%'; fuelEl.className = fuel < 20 ? 'st-err' : 'st-ok'; }

    // System health check
    checkLimit('st-volt', d.volt, 200, 240);
    checkLimit('st-amp',  d.amp,    0, 100);
    checkLimit('st-freq', d.freq,  48,  52);
    checkLimit('st-fuel', d.fuel,  20, 100);
    checkLimit('st-afr',  d.afr,   10,  18);

  } catch (e) { console.warn('Sensor Error', e); }
}

// ── 2. MAINTENANCE LOG ────────────────────────────────────────────────────────
async function updateMaintenanceLog() {
  try {
    const res  = await fetch(`${API_URL}/maintenance`);
    if (!res.ok) return;
    const json = await res.json();
    const container = document.getElementById('maintenanceContainer');
    if (!container) return;

    if (json.success && json.data.length > 0) {
      container.innerHTML = '';
      json.data.slice(0, 4).forEach(log => {
        const dateStr  = formatDate(log.dueDate || log.createdAt);
        const status   = log.status || 'scheduled';
        const pillClass = status === 'completed' ? 'sp-completed'
                        : status === 'overdue'   ? 'sp-overdue'
                        :                          'sp-scheduled';

        container.innerHTML += `
          <div class="maintenance-item">
            <div class="mi-info">
              <span class="mi-task">${log.task}</span>
              <span class="mi-meta">
                <span class="status-pill ${pillClass}">${status}</span>
                <span style="margin-left:6px;color:#64748b;font-size:11px">${log.assignedTo || '-'}</span>
              </span>
            </div>
            <div class="mi-date">${dateStr}</div>
          </div>`;
      });
    } else {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;font-size:13px">No recent activity</div>';
    }
  } catch (e) { console.warn('Maintenance Error', e); }
}

// ── 3. ALERTS ─────────────────────────────────────────────────────────────────
async function updateAlerts() {
  try {
    const res  = await fetch(`${API_URL}/alerts?limit=10`);
    const json = await res.json();
    if (!json.success) return;

    const active = json.data.filter(a => !a.resolved);
    setVal('val-alerts', active.length);
    renderAlertList(json.data.slice(0, 4));
  } catch (e) { console.warn('Alert Error', e); }
}

function renderAlertList(arr) {
  const c = document.getElementById('alertContainer');
  if (!c) return;
  c.innerHTML = '';

  if (!arr.length) {
    c.innerHTML = '<div style="text-align:center;color:#aaa;padding:28px;font-size:13px;font-style:italic">No recent alerts</div>';
    return;
  }

  arr.forEach(a => {
    const isCrit = a.severity === 'critical';
    const isWarn = a.severity === 'medium' || a.severity === 'warning';
    const styleClass = isCrit ? 'ac-critical' : isWarn ? 'ac-warning' : 'ac-info';
    const iconClass  = isCrit ? 'fa-exclamation' : isWarn ? 'fa-exclamation-triangle' : 'fa-info';
    const title      = (a.parameter || 'System').toUpperCase();
    const dateStr    = formatDate(a.timestamp);

    c.innerHTML += `
      <div class="alert-card ${styleClass}">
        <div class="ac-icon"><i class="fas ${iconClass}"></i></div>
        <div class="ac-content">
          <div class="ac-title">${title}</div>
          <div class="ac-desc">${a.message || ''}</div>
        </div>
        <div class="ac-date">${dateStr}</div>
      </div>`;
  });
}

// ── 4. CHART ──────────────────────────────────────────────────────────────────
async function initChart() {
  const ctx = document.getElementById('chartActive')?.getContext('2d');
  if (!ctx) return;

  try {
    const res  = await fetch(`${API_URL}/engine-data/history?hours=168`);
    const json = await res.json();
    let labels = [], dataPoints = [];

    if (json.success && json.data.length) {
      const days  = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i);
        days[d.toDateString()] = 0;
      }

      const sorted = json.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rpm > 0) {
          const diff = (new Date(sorted[i].timestamp) - new Date(sorted[i-1].timestamp)) / 1000;
          if (diff > 0 && diff < 300) {
            days[new Date(sorted[i].timestamp).toDateString()] += (diff / 3600);
          }
        }
      }

      labels     = Object.keys(days).map(k => new Date(k).toLocaleDateString('id-ID', { weekday: 'short' }));
      dataPoints = Object.values(days);

      const todayVal = days[today.toDateString()] || 0;
      const h = Math.floor(todayVal);
      const m = Math.round((todayVal - h) * 60);
      const tEl = document.getElementById('engToday');
      if (tEl) tEl.textContent = `${h}h ${m}m`;
    }

    if (activeChart) activeChart.destroy();

    activeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Min','Sen','Sel','Rab','Kam','Jum','Sab'],
        datasets: [{
          label: 'Active Hours',
          data: dataPoints.length ? dataPoints : [0,0,0,0,0,0,0],
          backgroundColor: 'rgba(26,79,196,0.85)',
          borderRadius: 8,
          barPercentage: 0.55
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true, max: 24,
            title: { display: true, text: 'Hours', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.04)' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (e) { console.error(e); }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function setVal(id, v) {
  const e = document.getElementById(id); if (e) e.textContent = v;
}
function updateStatus(id, ok, t1, t2) {
  const e = document.getElementById(id);
  if (e) { e.textContent = ok ? t1 : t2; e.className = ok ? 'st-ok' : 'st-err'; }
}
function checkLimit(id, v, min, max) {
  const e = document.getElementById(id); if (!e) return;
  if (v == null) { e.textContent = '--'; return; }
  const ok = v >= min && v <= max;
  e.textContent = ok ? 'Normal' : (v < min ? 'Low' : 'High');
  e.className   = ok ? 'st-ok' : 'st-err';
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Clock
  setInterval(() => {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }, 1000);

  updateDashboard();
  initChart();
  setInterval(updateDashboard, 3000);
});