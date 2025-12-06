// === CONFIGURATION ===
const API_URL = '/api/engine-data/history';

// State Management
let rawApiData = [];
let processedRows = [];
let filteredRows = [];
let currentPage = 1;
const itemsPerPage = 20;
let myChart = null;

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
    if (!startStr || !endStr) { el.innerText = "All Time"; return; }
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    // Jika range <= 1 hari, tampilkan '24 Hours'
    el.innerText = diffDays <= 1 ? "24 Hours" : `${diffDays} Days`;
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
            <td><b>${row.generator}</b></td>
            <td>${row.label}</td>
            <td style="font-weight:bold">${Number(row.value).toFixed(1)}</td>
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

function updateChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (myChart) myChart.destroy();

    // 1. Tentukan Range Waktu dari Filter
    const dateFromVal = document.getElementById('dateFrom').value;
    const dateToVal = document.getElementById('dateTo').value;
    const paramFilter = document.getElementById('paramFilter').value;

    let minTime, maxTime, diffHours = 24; // Default 24 jam

    if (dateFromVal && dateToVal) {
        const start = new Date(dateFromVal);
        const end = new Date(dateToVal);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        
        minTime = start.getTime();
        maxTime = end.getTime();
        diffHours = (maxTime - minTime) / (1000 * 3600);
    }

    // 2. Logic Dinamis Sumbu X
    // Jika <= 24 jam, tampilkan Jam (HH:mm)
    // Jika > 24 jam, tampilkan Tanggal (dd MMM)
    let timeUnit = 'hour';
    let displayFormat = 'HH:mm'; 
    let tooltipFormat = 'dd MMM HH:mm';
    
    if (diffHours > 24) {
        timeUnit = 'day';
        displayFormat = 'dd MMM'; // Contoh: 10 Dec
    }

    // 3. Siapkan Data (Sort -> Filter -> Smooth)
    let chartData = [...rawApiData].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (minTime && maxTime) {
        chartData = chartData.filter(d => {
            const t = new Date(d.timestamp).getTime();
            return t >= minTime && t <= maxTime;
        });
    }

    // Lakukan Smoothing (Rata-rata 60 titik)
    const smoothData = downsampleData(chartData, 60);

    // 4. Siapkan Datasets Berdasarkan Filter
    let datasets = [];
    
    if (paramFilter === 'all') {
        // Jika ALL: Tampilkan RPM dan Voltage sebagai default view
        return;
    } else {
        // Jika Parameter Spesifik Dipilih (Fuel, Temp, Power, dll)
        const conf = PARAMS[paramFilter];
        const color = conf.color || '#1745a5';
        
        datasets = [{
            label: `${paramFilter.toUpperCase()} (${conf.unit || ''})`,
            data: smoothData.map(d => ({ x: d.timestamp, y: d[paramFilter] })), // Ambil data sesuai param
            borderColor: color,
            backgroundColor: color + '20', // Tambah transparansi hex
            yAxisID: 'y', 
            fill: true, 
            tension: 0.4, 
            pointRadius: 3, // Titik lebih jelas jika single param
            borderWidth: 2
        }];
    }

    // 5. Render Grafik
    myChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
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
                            return date.toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'time', 
                    time: { 
                        unit: timeUnit, 
                        displayFormats: { 
                            hour: 'HH:mm', 
                            day: 'dd MMM',
                            minute: 'HH:mm'
                        },
                        tooltipFormat: tooltipFormat 
                    }, 
                    grid: { display: false },
                    min: minTime, 
                    max: maxTime 
                },
                y: { 
                    position: 'left', 
                    title: { display: true, text: paramFilter === 'all' ? 'RPM' : (PARAMS[paramFilter]?.unit || '') }, 
                    beginAtZero: false 
                },
                y1: { 
                    display: paramFilter === 'all', // Sumbu kanan hanya muncul jika 'All'
                    position: 'right', 
                    grid: { drawOnChartArea: false }, 
                    title: { display: true, text: 'Voltage (V)' } 
                }
            }
        }
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetch('sidebar.html').then(r=>r.text()).then(h=>document.getElementById('sidebar-container').innerHTML=h);
    document.getElementById('userarea').querySelector('span').innerText = localStorage.getItem('userRole') || 'Operator';

    updateDateInputs('24');
    applyFilters(); // Load awal
});