// === CONFIGURATION ===
const API_URL = '/api/engine-data/history';

// State Management
let rawApiData = [];
let processedRows = [];
let filteredRows = [];
let currentPage = 1;
const itemsPerPage = 20;
let myChart = null;
let aiInsightList = [];

// Parameter Config (Satuan & Warna untuk Grafik)
const PARAMS = {
    rpm: { unit: 'RPM', max: 4000, warn: 3500, color: '#1745a5' }, // Biru
    volt: { unit: 'V', max: 250, warn: 240, min: 180, color: '#f97316' }, // Oranye
    amp: { unit: 'A', color: '#ec4899' }, // Pink
    power: { unit: 'kW', color: '#14b8a6' }, // Teal
    freq: { unit: 'Hz', color: '#8b5cf6' }, // Ungu
    fuel: { unit: '%', min: 20, warn: 30, color: '#10b981' }, // Hijau
    coolant: { unit: '°C', max: 100, warn: 90, color: '#06b6d4' }, // Cyan
    iat: { unit: '°C', color: '#f59e0b' }, // Amber
    map: { unit: 'kPa', color: '#84cc16' }, // Lime
    afr: { unit: 'R', color: '#3b82f6' }, // Blue
    tps: { unit: '%', color: '#a855f7' } // Purple
};

// --- 1. FILTER & DATE INPUT LOGIC ---

function updateDateInputs(val) {
    const end = new Date();
    let start = new Date();

    if (val === 'today') {
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
    } else if (val === 'yesterday') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
    } else if (val === 'custom') {
        return; // User set manual
    } else {
        const days = parseInt(val) === 24 ? 30 : parseInt(val); 
        start.setDate(start.getDate() - days);
    }

    // Set value ke input type="date" (Format YYYY-MM-DD)
    // Perlu penyesuaian timezone offset agar tidak meleset
    const toISODate = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    document.getElementById('dateFrom').value = toISODate(start);
    document.getElementById('dateTo').value = toISODate(end);
}

// Trigger saat tombol Apply diklik
async function applyFilters() {
    loadDataFromAPI();
}

// Load Data dari API
async function loadDataFromAPI() {
    const loader = document.getElementById('loading');
    const tbody = document.getElementById('historyTableBody');
    const dFrom = document.getElementById('dateFrom').value;
    const dTo = document.getElementById('dateTo').value;
    
    loader.style.display = 'block';
    tbody.innerHTML = ''; 

    // Update Text Summary
    updateSummaryTimeRange(dFrom, dTo);

    // Build URL Query
    let url = `${API_URL}?limit=5000`; // Ambil banyak data untuk grafik yang akurat
    if (dFrom && dTo) {
        url += `&startDate=${dFrom}&endDate=${dTo}`;
    } else {
        url += `&hours=720`; // Default 30 hari
    }

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
            rawApiData = json.data;
            processDataAndRender();
        } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red">Error: ${json.error}</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Connection Failed</td></tr>';
    } finally {
        loader.style.display = 'none';
    }
}

function updateSummaryTimeRange(startStr, endStr) {
    const el = document.getElementById('dataPeriod');
    if (!startStr || !endStr) {
        el.innerText = "All Time";
        return;
    }

    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T23:59:59`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24) {
        el.innerText = "24 Hours";
    } else if (diffHours < (24 * 7)) {
        el.innerText = `${Math.ceil(diffHours)} Hours`;
    } else {
        el.innerText = `${Math.ceil(diffHours / 24)} Days`;
    }
}

// --- 2. DATA PROCESSING ---

function processDataAndRender() {
    processedRows = [];
    let alertCount = 0;

    // Flatten Data
    rawApiData.forEach(item => {
        const ts = item.timestamp;
        const genName = item.deviceId || 'Gen-01'; 
        
        Object.keys(PARAMS).forEach(key => {
            const val = item[key];
            // Pastikan nilai valid (bukan undefined/null)
            if (val !== undefined && val !== null) {
                const conf = PARAMS[key];
                let status = 'normal';

                // Logic Status
                if (conf.max && val > conf.max) status = 'critical';
                else if (conf.warn && val > conf.warn) status = 'warning';
                else if (conf.min && val < conf.min) status = 'critical';

                if (status !== 'normal') alertCount++;

                processedRows.push({
                    timestamp: ts,
                    rawDate: new Date(ts),
                    generator: genName,
                    param: key,
                    label: key.toUpperCase(), // Nama Parameter (RPM, VOLT)
                    value: val,
                    unit: conf.unit,
                    status: status
                });
            }
        });
    });

    // Client-Side Filtering (Untuk Tabel)
    const pFilter = document.getElementById('paramFilter').value;
    const sFilter = document.getElementById('statusFilter').value;
    const qSearch = document.getElementById('searchQuery').value.toLowerCase();

    filteredRows = processedRows.filter(row => {
        if (pFilter !== 'all' && row.param !== pFilter) return false;
        if (sFilter !== 'all' && row.status !== sFilter) return false;
        if (qSearch && 
            !row.label.toLowerCase().includes(qSearch) && 
            !String(row.value).includes(qSearch) &&
            !row.generator.toLowerCase().includes(qSearch)) return false;
        return true;
    });

    // Update Info Cards
    document.getElementById('totalRecords').innerText = processedRows.length.toLocaleString();
    document.getElementById('alertCount').innerText = alertCount;
    
    currentPage = 1;
    renderTable();
    updateChart(); // Update Grafik
}

// --- 3. RENDER TABLE ---

function renderTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredRows.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No data match filters</td></tr>';
        return;
    }

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.rawDate.toLocaleString('id-ID')}</td>
            <td>${row.generator}</td>
            <td>${row.label}</td>
            <td>${Number(row.value).toFixed(1)}</td>
            <td>${row.unit}</td>
            <td><span class="status-badge status-${row.status}">${row.status}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // Pagination Info
    document.getElementById('pageStart').innerText = start + 1;
    document.getElementById('pageEnd').innerText = Math.min(end, filteredRows.length);
    document.getElementById('totalItems').innerText = filteredRows.length;
    document.getElementById('pageNum').innerText = currentPage;
    
    document.getElementById('btnPrev').disabled = (currentPage === 1);
    document.getElementById('btnNext').disabled = (end >= filteredRows.length);
}

function changePage(dir) {
    currentPage += dir;
    renderTable();
}

function resetFilters() {
    updateDateInputs('24');
    document.getElementById('timeRange').value = '24';
    document.getElementById('paramFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('searchQuery').value = '';
    applyFilters();
}

function exportCSV() {
    if(filteredRows.length === 0) return alert("No data to export");
    let csv = "Timestamp,Generator,Parameter,Value,Unit,Status\n";
    filteredRows.forEach(row => {
        csv += `"${row.rawDate.toISOString()}","${row.generator}","${row.label}",${row.value},${row.unit},${row.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `history_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// --- 4. CHART RENDER & LOGIC TREN (SMOOTHING & DYNAMIC X-AXIS) ---

// Fungsi Downsampling: Merata-rata data agar grafik tidak "bergerigi"
// Mengubah ribuan data menjadi ~60 titik data rata-rata
function downsampleData(data, targetPoints = 60) {
    if (data.length <= targetPoints) return data;

    const sampled = [];
    const blockSize = Math.ceil(data.length / targetPoints);
    const paramKeys = Object.keys(PARAMS);

    for (let i = 0; i < data.length; i += blockSize) {
        const chunk = data.slice(i, i + blockSize);
        
        // Ambil timestamp tengah
        const midTime = chunk[Math.floor(chunk.length / 2)].timestamp;
        const entry = { timestamp: midTime };
        
        // Hitung rata-rata untuk SETIAP parameter yang ada di PARAMS
        paramKeys.forEach(key => {
            // Filter nilai yang valid (angka)
            const validValues = chunk.filter(c => c[key] != null).map(c => Number(c[key]));
            if (validValues.length > 0) {
                const sum = validValues.reduce((a, b) => a + b, 0);
                entry[key] = sum / validValues.length; // Average
            } else {
                entry[key] = null;
            }
        });

        sampled.push(entry);
    }
    return sampled;
}


function getChartTimeRange() {
    const dateFromVal = document.getElementById('dateFrom').value;
    const dateToVal = document.getElementById('dateTo').value;

    if (dateFromVal && dateToVal) {
        const start = new Date(`${dateFromVal}T00:00:00`);
        const end = new Date(`${dateToVal}T23:59:59`);
        const minTime = start.getTime();
        const maxTime = end.getTime();
        const diffHours = (maxTime - minTime) / (1000 * 3600);
        return { minTime, maxTime, diffHours };
    }

    if (rawApiData.length > 1) {
        const sorted = [...rawApiData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const minTime = new Date(sorted[0].timestamp).getTime();
        const maxTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
        const diffHours = (maxTime - minTime) / (1000 * 3600);
        return { minTime, maxTime, diffHours };
    }

    return { minTime: undefined, maxTime: undefined, diffHours: 24 };
}

function buildAIInsights(dataInRange) {
    const insights = [];

    if (!dataInRange.length) {
        insights.push('Belum ada data pada rentang waktu ini, silakan ubah filter tanggal untuk memulai analisis.');
        return insights;
    }

    const latest = dataInRange[dataInRange.length - 1];
    const trendWindow = Math.max(2, Math.floor(dataInRange.length * 0.2));

    Object.entries(PARAMS).forEach(([key, conf]) => {
        const values = dataInRange.map(d => Number(d[key])).filter(Number.isFinite);
        if (values.length < 2) return;

        const latestValue = values[values.length - 1];
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        const recentSlice = values.slice(-trendWindow);
        const startSlice = values.slice(0, trendWindow);
        const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
        const startAvg = startSlice.reduce((a, b) => a + b, 0) / startSlice.length;
        const deltaPct = ((recentAvg - startAvg) / (Math.abs(startAvg) || 1)) * 100;

        if (conf.warn && latestValue > conf.warn) {
            insights.push(`${key.toUpperCase()} saat ini ${latestValue.toFixed(1)} ${conf.unit}, melewati ambang warning (${conf.warn} ${conf.unit}).`);
        }

        if (conf.max && latestValue > conf.max) {
            insights.push(`${key.toUpperCase()} mencapai ${latestValue.toFixed(1)} ${conf.unit}, melampaui batas maksimum (${conf.max} ${conf.unit}) dan perlu inspeksi cepat.`);
        }

        if (conf.min && latestValue < conf.min) {
            insights.push(`${key.toUpperCase()} berada di ${latestValue.toFixed(1)} ${conf.unit}, di bawah batas minimum (${conf.min} ${conf.unit}).`);
        }

        if (Math.abs(deltaPct) >= 15) {
            const direction = deltaPct > 0 ? 'naik' : 'turun';
            insights.push(`Tren ${key.toUpperCase()} ${direction} ${Math.abs(deltaPct).toFixed(1)}% dibanding awal periode (rata-rata ${avgValue.toFixed(1)} ${conf.unit}).`);
        }
    });

    const highTemp = Number(latest.coolant);
    const fuelLevel = Number(latest.fuel);
    const rpmValue = Number(latest.rpm);

    if (Number.isFinite(highTemp) && Number.isFinite(rpmValue) && highTemp > 90 && rpmValue > 3000) {
        insights.push('Kombinasi coolant tinggi dan RPM tinggi mengindikasikan potensi overheating saat beban puncak. Cek sistem pendingin dan beban generator.');
    }

    if (Number.isFinite(fuelLevel) && fuelLevel < 30) {
        insights.push('Fuel level rendah terdeteksi. Jadwalkan pengisian untuk mencegah penurunan performa mesin saat operasi berkelanjutan.');
    }

    if (!insights.length) {
        insights.push('Data tren relatif stabil pada rentang waktu terpilih. Belum ada anomali besar yang terdeteksi dari sensor utama.');
    }

    return insights.slice(0, 5);
}

function renderAIInsights() {
    const insightEl = document.getElementById('aiInsightList');
    if (!insightEl) return;

    insightEl.innerHTML = aiInsightList
        .map(item => `<li>${item}</li>`)
        .join('');
}

function updateChart() {
    const chartEl = document.getElementById('historyChart');
    if (!chartEl) return;

    const ctx = chartEl.getContext('2d');
    if (myChart) myChart.destroy();

    const paramFilter = document.getElementById('paramFilter').value;
    const { minTime, maxTime, diffHours } = getChartTimeRange();

    let timeUnit = 'hour';
    let tooltipFormat = 'dd MMM HH:mm';

    if (diffHours > (24 * 60)) timeUnit = 'month';
    else if (diffHours > (24 * 7)) timeUnit = 'week';
    else if (diffHours > 24) timeUnit = 'day';
    else if (diffHours <= 6) timeUnit = 'minute';

    const sortedData = [...rawApiData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const chartData = sortedData.filter(d => {
        const t = new Date(d.timestamp).getTime();
        if (minTime && t < minTime) return false;
        if (maxTime && t > maxTime) return false;
        return true;
    });

    const smoothData = downsampleData(chartData, 90);

    let datasets = [];
    if (paramFilter === 'all') {
        const defaultParams = ['rpm', 'volt', 'fuel', 'coolant'];
        datasets = defaultParams.map((key, idx) => {
            const conf = PARAMS[key];
            return {
                label: `${key.toUpperCase()} (${conf.unit || ''})`,
                data: smoothData.map(d => ({ x: d.timestamp, y: d[key] })),
                borderColor: conf.color,
                backgroundColor: conf.color + '22',
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 2,
                yAxisID: idx === 0 ? 'y' : 'y1'
            };
        });
    } else {
        const conf = PARAMS[paramFilter];
        const color = conf.color || '#1745a5';
        datasets = [{
            label: `${paramFilter.toUpperCase()} (${conf.unit || ''})`,
            data: smoothData.map(d => ({ x: d.timestamp, y: d[paramFilter] })),
            borderColor: color,
            backgroundColor: color + '22',
            yAxisID: 'y',
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            borderWidth: 2
        }];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        title: (ctx) => {
                            const date = new Date(ctx[0].parsed.x);
                            return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        tooltipFormat,
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'dd MMM',
                            week: 'dd MMM',
                            month: 'MMM yyyy'
                        }
                    },
                    grid: { display: false },
                    min: minTime,
                    max: maxTime,
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: paramFilter === 'all' ? 'Primary Sensor Value' : (PARAMS[paramFilter]?.unit || '') },
                    beginAtZero: false
                },
                y1: {
                    display: paramFilter === 'all',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Secondary Sensor Value' }
                }
            }
        }
    });

    aiInsightList = buildAIInsights(chartData);
    renderAIInsights();
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetch('sidebar.html').then(r=>r.text()).then(h=>document.getElementById('sidebar-container').innerHTML=h);
    document.getElementById('userarea').querySelector('span').innerText = localStorage.getItem('userRole') || 'Operator';

    updateDateInputs('24');
    applyFilters(); // Load awal
});