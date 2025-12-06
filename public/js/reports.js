// === CONFIGURATION ===
const API_URL = '/api/engine-data/history';

// Konfigurasi Parameter (Icon, Satuan, Warna)
const SENSORS = {
    rpm: { name: 'RPM', unit: 'rpm', icon: 'fas fa-tachometer-alt', color: '#1745a5' },
    volt: { name: 'Voltage', unit: 'V', icon: 'fas fa-bolt', color: '#f97316' },
    amp: { name: 'Current', unit: 'A', icon: 'fas fa-plug', color: '#ec4899' },
    freq: { name: 'Frequency', unit: 'Hz', icon: 'fas fa-wave-square', color: '#8b5cf6' },
    power: { name: 'Power', unit: 'kW', icon: 'fas fa-charging-station', color: '#14b8a6' },
    temp: { name: 'Engine Temp', unit: '°C', icon: 'fas fa-thermometer-half', color: '#ef4444' },
    coolant: { name: 'Coolant', unit: '°C', icon: 'fas fa-snowflake', color: '#06b6d4' },
    fuel: { name: 'Fuel', unit: '%', icon: 'fas fa-gas-pump', color: '#10b981' },
    oil: { name: 'Oil Press', unit: 'PSI', icon: 'fas fa-oil-can', color: '#6366f1' },
    iat: { name: 'Intake Air', unit: '°C', icon: 'fas fa-wind', color: '#f59e0b' },
    map: { name: 'MAP', unit: 'kPa', icon: 'fas fa-compress-arrows-alt', color: '#84cc16' },
    afr: { name: 'AFR', unit: '', icon: 'fas fa-burn', color: '#3b82f6' }
};

let myChart = null;

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Load Sidebar
    fetch('sidebar.html').then(r => r.text()).then(h => {
        document.getElementById('sidebar-container').innerHTML = h;
        if(window.initializeSidebar) window.initializeSidebar();
    });

    // Setup Date Inputs (Default: Last 24 Hours)
    initDateInputs();

    // Event Listeners
    document.getElementById('applyDateRange').addEventListener('click', loadReportData);
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            // Update input tanggal sesuai tombol
            const hours = e.target.dataset.hours;
            updateDateFromHours(hours);
            loadReportData();
        });
    });

    // First Load
    loadReportData();
});

// --- 2. DATA FETCHING ---
async function loadReportData() {
    // Tampilkan Loading
    document.getElementById('sensorsLoading').style.display = 'block';
    document.getElementById('sensorsContainer').style.display = 'none';

    // Ambil Filter Tanggal
    const dFrom = document.getElementById('dateFrom').value;
    const dTo = document.getElementById('dateTo').value;

    // Buat URL Query
    let url = `${API_URL}?limit=5000`; // Limit besar untuk akurasi
    if (dFrom && dTo) {
        // Tambahkan jam agar mencakup full day
        const start = new Date(dFrom); start.setHours(0,0,0,0);
        const end = new Date(dTo); end.setHours(23,59,59,999);
        url += `&startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
    } else {
        url += `&hours=24`; // Default
    }

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
            const data = json.data;
            updateOverview(data);
            renderSensorCards(data);
            updateChart(data);
        } else {
            console.error("API Error:", json.error);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    } finally {
        // Sembunyikan Loading
        document.getElementById('sensorsLoading').style.display = 'none';
        document.getElementById('sensorsContainer').style.display = 'grid';
    }
}

// --- 3. UI UPDATE FUNCTIONS ---

function updateOverview(data) {
    if (!data.length) return;

    // Hitung Statistik Sederhana
    const activeRecords = data.filter(d => d.rpm > 0);
    const totalHours = (activeRecords.length * 5) / 3600; // Asumsi interval 5 detik
    
    // Hitung Hari Aktif
    const daysSet = new Set(activeRecords.map(d => new Date(d.timestamp).toDateString()));
    
    // Hitung Rata-rata Harian
    const avgDaily = daysSet.size > 0 ? (totalHours / daysSet.size) : 0;

    // Cari Sesi Terpanjang (Sederhana)
    let maxSession = 0, currSession = 0;
    // Sort dulu data dari lama ke baru
    const sorted = [...data].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rpm > 0) {
            const diff = (new Date(sorted[i].timestamp) - new Date(sorted[i-1].timestamp)) / 1000;
            if (diff < 300) currSession += diff; // Gabung jika jeda < 5 menit
            else currSession = 0;
            if (currSession > maxSession) maxSession = currSession;
        }
    }

    // Update Text
    setText('dailyAverage', `${avgDaily.toFixed(1)} hrs`);
    setText('totalHours', `${totalHours.toFixed(1)} hrs`);
    setText('daysActive', `${daysSet.size} days`);
    setText('longestSession', `${(maxSession/3600).toFixed(1)} hrs`);
}

function renderSensorCards(data) {
    const container = document.getElementById('sensorsContainer');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center">No data found</p>';
        return;
    }

    // Ambil data terakhir untuk "Current Value"
    const latest = data[0] || {};

    Object.keys(SENSORS).forEach(key => {
        const conf = SENSORS[key];
        const vals = data.map(d => d[key]).filter(v => v != null);
        
        if (vals.length === 0) return;

        // Hitung Min/Max/Avg
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
        const current = latest[key] || 0;

        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.innerHTML = `
            <div class="sensor-header">
                <div class="sensor-name">
                    <div class="sensor-icon" style="color:${conf.color}"><i class="${conf.icon}"></i></div>
                    ${conf.name}
                </div>
            </div>
            <div class="sensor-stats">
                <div class="stat-item">
                    <span class="stat-label">Average</span>
                    <span class="stat-value">${avg.toFixed(1)} ${conf.unit}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Min / Max</span>
                    <span class="stat-value">${min.toFixed(0)} / ${max.toFixed(0)}</span>
                </div>
                <div class="stat-item" style="grid-column:span 2; margin-top:5px; border-top:1px solid #eee; padding-top:5px;">
                    <span class="stat-label">Latest Value</span>
                    <span class="stat-value" style="color:${conf.color}">${current.toFixed(1)} ${conf.unit}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function updateChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (myChart) myChart.destroy();

    // Downsample agar grafik tidak berat (ambil 1 dari setiap N data)
    const factor = Math.ceil(data.length / 100);
    const chartData = data
        .filter((_, i) => i % factor === 0)
        .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => new Date(d.timestamp)),
            datasets: [
                {
                    label: 'RPM',
                    data: chartData.map(d => d.rpm),
                    borderColor: '#1745a5',
                    backgroundColor: 'rgba(23, 69, 165, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Voltage',
                    data: chartData.map(d => d.volt),
                    borderColor: '#f97316',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { 
                    type: 'time', 
                    time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
                    grid: { display: false }
                },
                y: { position: 'left', title: {display:true, text:'RPM'} },
                y1: { position: 'right', grid:{drawOnChartArea:false}, title: {display:true, text:'Voltage'} }
            }
        }
    });
}

// --- UTILS ---
function setText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

function initDateInputs() {
    const now = new Date();
    const prev = new Date(); prev.setDate(now.getDate() - 1);
    
    // Format YYYY-MM-DD
    const toDateVal = (d) => d.toISOString().split('T')[0];
    
    document.getElementById('dateTo').value = toDateVal(now);
    document.getElementById('dateFrom').value = toDateVal(prev);
}

function updateDateFromHours(hours) {
    const now = new Date();
    const past = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    document.getElementById('dateTo').value = now.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = past.toISOString().split('T')[0];
}