const API_URL = '/api';
let activeChart = null;

// --- UTILS ---
const formatTime = (d) => new Date(d).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', {day:'numeric', month:'short'});

// --- UPDATE DASHBOARD (REAL DATA) ---
async function updateDashboard() {
    try {
        // 1. FETCH LATEST SENSOR DATA
        const res = await fetch(`${API_URL}/engine-data/latest`);
        const json = await res.json();

        if (json.success && json.data) {
            const data = json.data;

            // Overview Cards
            setVal('val-rpm', data.rpm, ' RPM');
            setVal('val-temp', (data.coolant || data.temp), '°C', 1);
            setVal('val-volt', data.volt, ' V', 1);
            
            // Engine Status
            const isRun = data.status === 'RUNNING';
            const isSync = data.sync === 'ON-GRID';
            
            setStatus('engSync', isSync, 'Synchronized', 'Not Sync');
            setStatus('engStat', isRun, 'Running', 'Inactive');
            
            const fuelEl = document.getElementById('fuelLevel');
            fuelEl.innerText = Math.round(data.fuel) + '%';
            fuelEl.className = data.fuel < 20 ? 'st-err' : 'st-ok';

            document.getElementById('engLast').innerText = formatTime(data.timestamp);

            // System Status (Threshold Checks)
            checkThreshold('st-volt', data.volt, 200, 240);
            checkThreshold('st-amp', data.amp, 0, 100);
            checkThreshold('st-freq', data.freq, 49, 51);
            checkThreshold('st-oil', data.oil, 20, 100);
            checkThreshold('st-coolant', (data.coolant || data.temp), 0, 95);
            checkThreshold('st-iat', data.iat, 0, 60);
            checkThreshold('st-fuel', data.fuel, 20, 100);
            checkThreshold('st-afr', data.afr, 12, 16);
        }

        // 2. FETCH ALERT COUNT
        const resAlert = await fetch(`${API_URL}/alerts?limit=10`);
        const jsonAlert = await resAlert.json();
        if (jsonAlert.success) {
            const active = jsonAlert.data.filter(a => !a.resolved);
            document.getElementById('val-alerts').innerText = active.length;
            renderRecentAlerts(jsonAlert.data.slice(0, 3)); // Top 3
        }

    } catch (e) { console.error("Dashboard update failed", e); }
}

// --- HELPERS ---
function setVal(id, val, suffix, fix=0) {
    const el = document.getElementById(id);
    if(el && val != null) el.innerText = Number(val).toFixed(fix) + suffix;
}

function setStatus(id, condition, textTrue, textFalse) {
    const el = document.getElementById(id);
    el.innerText = condition ? textTrue : textFalse;
    el.className = condition ? 'st-ok' : 'st-err';
}

function checkThreshold(id, val, min, max) {
    const el = document.getElementById(id);
    if(!el) return;
    if(val == null) { el.innerText = '--'; return; }
    
    if (val >= min && val <= max) {
        el.innerText = 'Normal'; el.className = 'st-ok';
    } else {
        el.innerText = val < min ? 'Low' : 'Critical';
        el.className = 'st-err';
    }
}

function renderRecentAlerts(alerts) {
    const container = document.getElementById('alertContainer');
    if(!container) return;
    container.innerHTML = '';

    if(alerts.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#aaa; padding:10px;">No recent alerts</div>`;
        return;
    }

    alerts.forEach(a => {
        let type = 'info', icon = 'fa-info-circle';
        if(a.severity === 'critical') { type = ''; icon = 'fa-exclamation-triangle'; } // Red style
        else if(a.severity === 'medium') { type = 'warning'; icon = 'fa-exclamation-circle'; } // Yellow style

        const html = `
            <div class="alert-item ${type}">
                <div class="alert-icon"><i class="fas ${icon}"></i></div>
                <div class="alert-content">
                    <div class="alert-title">${a.message}</div>
                    <div class="alert-desc">Param: ${a.parameter || 'Sys'} | Val: ${a.value}</div>
                </div>
                <div class="alert-time">${formatDate(a.timestamp)}</div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- CHART: ACTIVE TIME (Last 7 Days) ---
async function initChart() {
    const ctx = document.getElementById('chartActive').getContext('2d');
    try {
        const res = await fetch(`${API_URL}/engine-data/history?hours=168`); // 7 days
        const json = await res.json();
        
        let labels = [], data = [];
        
        if(json.success) {
            const days = {};
            const today = new Date();
            // Init 7 days
            for(let i=6; i>=0; i--) {
                const d = new Date(); d.setDate(today.getDate()-i);
                days[d.toDateString()] = 0;
            }
            // Fill Data
            json.data.forEach(r => {
                if(r.rpm > 0) {
                    const k = new Date(r.timestamp).toDateString();
                    if(days[k] !== undefined) days[k] += (5/3600); // ~5s per record
                }
            });
            labels = Object.keys(days).map(k => new Date(k).toLocaleDateString('id-ID', {weekday:'short'}));
            data = Object.values(days);

            // Today's Active Text
            const todayHrs = days[today.toDateString()] || 0;
            const h = Math.floor(todayHrs);
            const m = Math.round((todayHrs-h)*60);
            document.getElementById('engToday').innerText = `${h}h ${m}m`;
        }

        activeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Hours Active',
                    data: data,
                    backgroundColor: '#1745a5',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, title: {display:true, text:'Hours'} },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch(e) { console.error("Chart err", e); }
}

// --- STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar
    fetch('sidebar.html').then(r=>r.text()).then(h => {
        document.getElementById('sidebar-container').innerHTML = h;
        const s = document.createElement('script'); s.src = 'sidebar.js'; document.body.appendChild(s);
    });

    // User & Clock
    document.getElementById('username').innerText = localStorage.getItem('userRole') || 'Operator';
    setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}), 1000);

    // Data Loop
    updateDashboard();
    initChart();
    setInterval(updateDashboard, 5000);
});