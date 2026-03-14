// === CONFIGURATION ===
const API_URL = '/api/engine-data/history';

// State Management
let rawApiData = [];
let processedRows = [];
let filteredRows = [];
let currentPage = 1;
const itemsPerPage = 20;
let myChart = null;
const MIN_CHART_SAMPLES = 30;

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
        const days = parseInt(val, 10);
        if (!Number.isFinite(days)) return;
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
        el.innerText = 'All Time';
        return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

    el.innerText = diffHours < 48 ? `${diffHours} Hours` : `${Math.ceil(diffHours / 24)} Days`;
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
    updateDateInputs('30');
    document.getElementById('timeRange').value = '30';
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


function calculateSensorStats(values) {
    if (!values.length) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((acc, val) => acc + val, 0) / values.length;
    const first = values[0];
    const last = values[values.length - 1];
    const changePct = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;

    return {
        min,
        max,
        avg,
        first,
        last,
        changePct,
        span: max - min
    };
}

function buildAIInsights(seriesByParam, pointCount) {
    const insights = [];

    if (!pointCount) {
        insights.push('Data tren tidak tersedia pada range ini. Coba perluas rentang waktu untuk analisis mesin.');
        return insights;
    }

    const rpmStats = calculateSensorStats(seriesByParam.rpm || []);
    const voltStats = calculateSensorStats(seriesByParam.volt || []);
    const freqStats = calculateSensorStats(seriesByParam.freq || []);
    const coolantStats = calculateSensorStats(seriesByParam.coolant || []);
    const fuelStats = calculateSensorStats(seriesByParam.fuel || []);

    if (rpmStats) {
        const rpmTrend = rpmStats.changePct > 8 ? 'naik' : (rpmStats.changePct < -8 ? 'turun' : 'stabil');
        insights.push(`RPM cenderung ${rpmTrend} (${rpmStats.first.toFixed(0)} → ${rpmStats.last.toFixed(0)}). Variasi ${rpmStats.span.toFixed(0)} RPM menandakan ${rpmStats.span > 900 ? 'beban mesin berubah cukup agresif' : 'pembebanan mesin relatif terkendali'}.`);
    }

    if (voltStats && freqStats) {
        const voltageStable = voltStats.min >= 200 && voltStats.max <= 240;
        const freqStable = freqStats.min >= 48 && freqStats.max <= 52;
        insights.push(`Kualitas listrik ${voltageStable && freqStable ? 'stabil' : 'perlu perhatian'}: tegangan ${voltStats.min.toFixed(1)}-${voltStats.max.toFixed(1)} V dan frekuensi ${freqStats.min.toFixed(1)}-${freqStats.max.toFixed(1)} Hz.`);
    }

    if (coolantStats) {
        insights.push(coolantStats.max >= 95
            ? `Temperatur coolant sempat mencapai ${coolantStats.max.toFixed(1)}°C (zona tinggi). Rekomendasi: cek sistem pendingin dan kebersihan radiator.`
            : `Temperatur coolant berada di ${coolantStats.min.toFixed(1)}-${coolantStats.max.toFixed(1)}°C, masih dalam kisaran operasi aman.`);
    }

    if (fuelStats) {
        insights.push(fuelStats.last < 30
            ? `Fuel level tersisa ${fuelStats.last.toFixed(1)}%. Jadwalkan pengisian agar operasi tidak terganggu.`
            : `Fuel level akhir ${fuelStats.last.toFixed(1)}% dengan rata-rata ${fuelStats.avg.toFixed(1)}%. Cadangan bahan bakar masih memadai.`);
    }

    if (insights.length === 0) {
        insights.push('Data sensor belum cukup untuk menyusun insight kondisi mesin.');
    }

    return insights;
}



function setChartStateMessage(message = '') {
    const messageEl = document.getElementById('chartStateMessage');
    if (!messageEl) return;

    if (!message) {
        messageEl.hidden = true;
        messageEl.innerText = '';
        return;
    }

    messageEl.hidden = false;
    messageEl.innerText = message;
}

function renderSampleWarning(currentSamples) {
    renderAIInsights([
        `Data pada rentang waktu ini baru ${currentSamples} sampel. Grafik & analisis AI membutuhkan minimal ${MIN_CHART_SAMPLES} sampel agar tren lebih akurat.`
    ]);
}

function renderAIInsights(insights) {
    const listEl = document.getElementById('aiInsightList');
    if (!listEl) return;
    listEl.innerHTML = insights.map((item) => `<li>${item}</li>`).join('');
}

function updateChart() {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    const dateFromVal = document.getElementById('dateFrom').value;
    const dateToVal = document.getElementById('dateTo').value;
    const paramFilter = document.getElementById('paramFilter').value;

    let minTime = null;
    let maxTime = null;

    if (dateFromVal && dateToVal) {
        const startDate = new Date(dateFromVal);
        const endDate = new Date(dateToVal);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        minTime = startDate.getTime();
        maxTime = endDate.getTime();
    }

    let chartData = [...rawApiData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (minTime !== null && maxTime !== null) {
        chartData = chartData.filter((d) => {
            const t = new Date(d.timestamp).getTime();
            return t >= minTime && t <= maxTime;
        });
    }

    if (!chartData.length) {
        setChartStateMessage('Tidak ada data pada rentang waktu terpilih.');
        renderAIInsights(['Tidak ada data pada rentang waktu terpilih.']);
        return;
    }

    if (chartData.length < MIN_CHART_SAMPLES) {
        setChartStateMessage(`Data belum cukup untuk grafik. Minimal ${MIN_CHART_SAMPLES} sampel, saat ini ${chartData.length} sampel.`);
        renderSampleWarning(chartData.length);
        return;
    }

    setChartStateMessage('');

    const diffMs = Math.max(1, (maxTime ?? new Date(chartData[chartData.length - 1].timestamp).getTime()) - (minTime ?? new Date(chartData[0].timestamp).getTime()));
    const diffHours = diffMs / (1000 * 3600);

    let timeUnit = 'hour';
    if (diffHours <= 8) timeUnit = 'minute';
    else if (diffHours > 48) timeUnit = 'day';

    const targetPoints = Math.max(MIN_CHART_SAMPLES, Math.min(120, chartData.length));
    const smoothData = downsampleData(chartData, targetPoints);

    const visibleParams = paramFilter === 'all'
        ? ['rpm', 'volt', 'freq']
        : [paramFilter];

    const datasets = visibleParams.map((key) => {
        const conf = PARAMS[key] || { unit: '', color: '#1745a5' };
        return {
            label: `${key.toUpperCase()}${conf.unit ? ` (${conf.unit})` : ''}`,
            data: smoothData
                .filter((row) => row[key] !== null && row[key] !== undefined)
                .map((row) => ({ x: row.timestamp, y: row[key] })),
            borderColor: conf.color,
            backgroundColor: `${conf.color}22`,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: paramFilter === 'all' ? 1.5 : 2.5,
            fill: false
        };
    });

    myChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                x: {
                    type: 'time',
                    min: minTime ?? undefined,
                    max: maxTime ?? undefined,
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'dd MMM HH:mm',
                            day: 'dd MMM'
                        },
                        tooltipFormat: 'dd MMM yyyy HH:mm'
                    },
                    ticks: { maxRotation: 0, autoSkip: true },
                    grid: { color: '#e2e8f0' }
                },
                y: {
                    beginAtZero: false,
                    grid: { color: '#e2e8f0' }
                }
            }
        }
    });

    const seriesByParam = {};
    Object.keys(PARAMS).forEach((key) => {
        seriesByParam[key] = chartData
            .map((row) => Number(row[key]))
            .filter((value) => Number.isFinite(value));
    });

    renderAIInsights(buildAIInsights(seriesByParam, chartData.length));
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetch('sidebar.html').then(r=>r.text()).then(h=>document.getElementById('sidebar-container').innerHTML=h);
    document.getElementById('userarea').querySelector('span').innerText = localStorage.getItem('username') || 'Pengguna';

    updateDateInputs('30');
    applyFilters(); // Load awal
});