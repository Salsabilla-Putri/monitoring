// public/js/reports.js

// === CONFIGURATION ===
const API_URL = '/api/reports';

// Konfigurasi Parameter
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
let fftChart = null;
let currentData = [];
let selectedSensors = ['rpm']; // Default sensor to show

// --- 1. CHART MANAGEMENT ---
function destroyChart() {
    try {
        if (myChart) {
            myChart.destroy();
            myChart = null;
        }
    } catch (error) {
        console.warn('Error destroying chart:', error);
        myChart = null;
    }
}

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Reports.js initialized');
    
    initDatePickers();
    setupEventListeners();
    initSensorSelector();
    loadReportData();
});

// --- 3. DATE PICKER FUNCTIONS ---
function initDatePickers() {
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    
    // Format untuk input type="date"
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Cari atau buat date picker
    const dateRangeDiv = document.querySelector('.date-range');
    if (dateRangeDiv) {
        let dateSelector = dateRangeDiv.querySelector('.date-selector');
        if (!dateSelector) {
            dateSelector = document.createElement('div');
            dateSelector.className = 'date-selector';
            const applyBtn = dateRangeDiv.querySelector('.apply-btn');
            dateRangeDiv.insertBefore(dateSelector, applyBtn);
        }
        
        dateSelector.innerHTML = `
            <div>
                <label style="font-size:12px; color:#666;">Start Date</label>
                <input type="date" id="dateFrom" class="date-input" 
                       style="padding:8px; border:1px solid #d0d7e1; border-radius:4px; width:150px;">
            </div>
            <div style="align-self: center; margin: 0 10px; color:#666;">to</div>
            <div>
                <label style="font-size:12px; color:#666;">End Date</label>
                <input type="date" id="dateTo" class="date-input" 
                       style="padding:8px; border:1px solid #d0d7e1; border-radius:4px; width:150px;">
            </div>
        `;
    }
    
    // Set nilai default
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom) {
        dateFrom.value = formatDate(yesterday);
        dateFrom.max = formatDate(now);
    }
    
    if (dateTo) {
        dateTo.value = formatDate(now);
        dateTo.max = formatDate(now);
        if (dateFrom) {
            dateTo.min = dateFrom.value;
        }
    }
}

// --- 4. SENSOR SELECTOR (untuk pilih sensor di chart) ---
function initSensorSelector() {
    const chartHeader = document.querySelector('.chart-header');
    if (!chartHeader || chartHeader.querySelector('.sensor-selector')) return;

    const sensorSelector = document.createElement('div');
    sensorSelector.className = 'sensor-selector';

    Object.entries(SENSORS).forEach(([sensorKey, sensor]) => {
        const btn = document.createElement('button');
        btn.className = 'sensor-selector-btn';
        btn.dataset.sensor = sensorKey;
        btn.innerHTML = `<i class="${sensor.icon || 'fas fa-chart-line'}"></i> ${sensor.name}`;

        btn.addEventListener('click', () => {
            selectSingleSensor(sensorKey);
        });

        sensorSelector.appendChild(btn);
    });

    chartHeader.appendChild(sensorSelector);
    syncSensorSelectorButtons();
}

function syncSensorSelectorButtons() {
    document.querySelectorAll('.sensor-selector-btn').forEach((btn) => {
        const isActive = selectedSensors.includes(btn.dataset.sensor);
        btn.classList.toggle('active', isActive);
    });
}

function selectSingleSensor(sensorKey, { focusChart = true } = {}) {
    if (!SENSORS[sensorKey]) return;

    selectedSensors = [sensorKey];
    syncSensorSelectorButtons();

    document.querySelectorAll('.sensor-card').forEach((card) => {
        card.classList.toggle('active-sensor', card.dataset.sensor === sensorKey);
    });

    if (currentData.length > 0) {
        renderChart(currentData);
        renderFftAnalysis(currentData);
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        updateChartTitle(dateFrom, dateTo);

        if (focusChart) {
            document.getElementById('chartContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// --- 5. EVENT LISTENERS ---
function setupEventListeners() {
    // Tombol preset waktu
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active button
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update dates
            const hours = this.getAttribute('data-hours');
            updateDateFromHours(hours);
            
            // Load data
            loadReportData();
        });
    });
    
    // Tombol Apply
    document.getElementById('applyDateRange')?.addEventListener('click', loadReportData);
    
    // Date picker change events
    document.addEventListener('change', function(e) {
        if (e.target.id === 'dateFrom') {
            const dateTo = document.getElementById('dateTo');
            if (dateTo) {
                dateTo.min = e.target.value;
            }
        }
    });
    
    // Enter key pada date picker
    document.addEventListener('keypress', function(e) {
        if ((e.target.id === 'dateFrom' || e.target.id === 'dateTo') && e.key === 'Enter') {
            loadReportData();
        }
    });
    
    // Export buttons
    document.getElementById('toggleExport')?.addEventListener('click', toggleExportOptions);
    document.getElementById('printChart')?.addEventListener('click', printChart);
    document.getElementById('recalculateFft')?.addEventListener('click', () => renderFftAnalysis(currentData));
}

function updateDateFromHours(hours) {
    const now = new Date();
    const past = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom) dateFrom.value = formatDate(past);
    if (dateTo) dateTo.value = formatDate(now);
    
    // Update constraints
    if (dateFrom && dateTo) {
        dateTo.min = dateFrom.value;
    }
}

function normalizeReportRows(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => {
        const tempVal = row.temp ?? row.temperature;
        const powerKw = row.power ?? row.kw;

        return {
            ...row,
            temp: tempVal,
            coolant: row.coolant ?? tempVal,
            power: powerKw,
            timestamp: row.timestamp || row.createdAt || new Date().toISOString()
        };
    }).filter((row) => row && row.timestamp);
}

// --- 6. DATA FETCHING ---
async function loadReportData() {
    console.log('Loading report data...');
    
    // Show loading state
    const loadingEl = document.getElementById('sensorsLoading');
    const containerEl = document.getElementById('sensorsContainer');
    
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading sensor data...';
    }
    
    if (containerEl) {
        containerEl.style.display = 'none';
    }
    
    try {
        // Get date values
        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');
        
        let url = `${API_URL}?limit=5000`;
        
        // Build URL with date parameters
        if (dateFrom && dateTo && dateFrom.value && dateTo.value) {
            const startDate = new Date(dateFrom.value);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(dateTo.value);
            endDate.setHours(23, 59, 59, 999);
            
            // Validate date range
            if (endDate < startDate) {
                showError('End date must be after start date');
                return;
            }
            
            url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
            console.log('Fetching with dates:', startDate.toISOString(), 'to', endDate.toISOString());
        } else {
            // Default to last 24 hours
            url += '&hours=24';
            console.log('Fetching last 24 hours');
        }
        
        // Fetch data
        console.log('Fetching from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const result = await response.json();
        const rows = Array.isArray(result) ? result : (result.data || []);
        
        if ((result.success !== false) && rows) {
            currentData = normalizeReportRows(rows);

            if (currentData.length > 0) {
                updateOverview(currentData);
                renderSensorCards(currentData);
                renderChart(currentData);
                renderFftAnalysis(currentData);
                updateChartTitle(dateFrom?.value, dateTo?.value);
            } else {
                showNoDataMessage();
            }
        } else {
            throw new Error(result.error || 'No data received');
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError(error.message);
    } finally {
        // Hide loading
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        // Show container
        if (containerEl) {
            containerEl.style.display = 'grid';
        }
    }
}

// --- 7. CHART FUNCTIONS (IMPROVED) ---
function renderChart(data) {
    console.log('Rendering chart with', data.length, 'data points');
    
    // Destroy old chart
    destroyChart();
    
    const canvas = document.getElementById('mainChart');
    if (!canvas) {
        console.error('Chart canvas not found');
        return;
    }
    
    if (!data || data.length === 0) {
        // Show placeholder
        const chartContainer = document.querySelector('#chartContainer .chart-content');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #6b7280;">
                    <div style="text-align: center;">
                        <i class="fas fa-chart-line fa-2x" style="margin-bottom: 15px; opacity: 0.3;"></i>
                        <p>No chart data available for selected period</p>
                    </div>
                </div>
            `;
        }
        return;
    }
    
    try {
        // Prepare chart data
        const { labels, datasets, timeRange } = prepareChartData(data);
        
        // Create chart
        const ctx = canvas.getContext('2d');
        
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: getChartOptions(timeRange)
        });
        
        console.log('Chart rendered successfully');
        
    } catch (error) {
        console.error('Error creating chart:', error);
        // Show error but don't block the rest of the page
        const chartContainer = document.querySelector('#chartContainer .chart-content');
        if (chartContainer) {
            chartContainer.innerHTML += `
                <div style="color: #f97316; padding: 10px; background: #fffbeb; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                    <i class="fas fa-exclamation-triangle"></i> Chart error: ${error.message}
                </div>
            `;
        }
    }
}




function destroyFftChart() {
    try {
        if (fftChart) {
            fftChart.destroy();
            fftChart = null;
        }
    } catch (error) {
        console.warn('Error destroying FFT chart:', error);
        fftChart = null;
    }
}

function nextPowerOfTwo(value) {
    let v = 1;
    while (v < value) v <<= 1;
    return v;
}

function computeFftMagnitudes(signal) {
    const n = signal.length;
    const real = signal.slice();
    const imag = new Array(n).fill(0);

    let j = 0;
    for (let i = 1; i < n; i++) {
        let bit = n >> 1;
        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
            [imag[i], imag[j]] = [imag[j], imag[i]];
        }
    }

    for (let len = 2; len <= n; len <<= 1) {
        const angle = -2 * Math.PI / len;
        const wLenCos = Math.cos(angle);
        const wLenSin = Math.sin(angle);

        for (let i = 0; i < n; i += len) {
            let wCos = 1;
            let wSin = 0;
            for (let k = 0; k < len / 2; k++) {
                const uReal = real[i + k];
                const uImag = imag[i + k];
                const vReal = real[i + k + len / 2] * wCos - imag[i + k + len / 2] * wSin;
                const vImag = real[i + k + len / 2] * wSin + imag[i + k + len / 2] * wCos;

                real[i + k] = uReal + vReal;
                imag[i + k] = uImag + vImag;
                real[i + k + len / 2] = uReal - vReal;
                imag[i + k + len / 2] = uImag - vImag;

                const nextCos = wCos * wLenCos - wSin * wLenSin;
                wSin = wCos * wLenSin + wSin * wLenCos;
                wCos = nextCos;
            }
        }
    }

    const half = n / 2;
    const mags = [];
    for (let i = 1; i < half; i++) {
        mags.push(Math.sqrt(real[i] ** 2 + imag[i] ** 2) / half);
    }
    return mags;
}

function renderFftAnalysis(data) {
    const summaryEl = document.getElementById('fftSummary');
    const insightsEl = document.getElementById('fftInsights');
    const canvas = document.getElementById('fftChart');
    if (!canvas || !summaryEl || !insightsEl) return;

    destroyFftChart();
    insightsEl.innerHTML = '';

    const sensorKey = selectedSensors[0] || 'rpm';
    const sensor = SENSORS[sensorKey] || { name: sensorKey, unit: '' };
    const rows = (data || []).filter((row) => row[sensorKey] != null && row.timestamp);

    if (rows.length < 16) {
        summaryEl.textContent = `FFT needs at least 16 samples for ${sensor.name}. Current: ${rows.length} sample(s).`;
        return;
    }

    const sorted = rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const values = sorted.map((r) => Number(r[sensorKey]) || 0);
    const dt = [];
    for (let i = 1; i < sorted.length; i++) {
        const delta = (new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp)) / 1000;
        if (delta > 0 && Number.isFinite(delta)) dt.push(delta);
    }
    const medianDt = dt.length ? dt.sort((a, b) => a - b)[Math.floor(dt.length / 2)] : 1;
    const sampleRate = 1 / Math.max(medianDt, 1e-6);

    const fftSize = Math.min(1024, nextPowerOfTwo(values.length));
    const signal = new Array(fftSize).fill(0);
    const offset = Math.max(0, values.length - fftSize);
    for (let i = 0; i < fftSize; i++) signal[i] = values[offset + i] || 0;

    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    for (let i = 0; i < signal.length; i++) signal[i] -= mean;

    const mags = computeFftMagnitudes(signal);
    const freqs = mags.map((_, i) => ((i + 1) * sampleRate) / fftSize);

    const points = freqs.map((freq, i) => ({ freq, amp: mags[i] }))
        .filter((p) => Number.isFinite(p.freq) && Number.isFinite(p.amp));

    const topPeaks = [...points]
        .sort((a, b) => b.amp - a.amp)
        .slice(0, 3);

    summaryEl.textContent = `FFT of ${sensor.name} | Samples: ${fftSize} | Estimated sampling: ${sampleRate.toFixed(3)} Hz`;

    topPeaks.forEach((peak, idx) => {
        const cycPerMin = peak.freq * 60;
        const el = document.createElement('div');
        el.className = 'fft-pill';
        el.innerHTML = `<strong>Peak ${idx + 1}</strong><br>${peak.freq.toFixed(3)} Hz (${cycPerMin.toFixed(1)} cyc/min)<br>Amp: ${peak.amp.toFixed(3)}`;
        insightsEl.appendChild(el);
    });

    const chartPoints = points.slice(0, Math.min(points.length, 300));
    fftChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: chartPoints.map((p) => p.freq.toFixed(3)),
            datasets: [{
                label: `${sensor.name} FFT Amplitude`,
                data: chartPoints.map((p) => p.amp),
                borderColor: sensor.color || '#1745a5',
                backgroundColor: hexToRgba(sensor.color || '#1745a5', 0.12),
                fill: true,
                pointRadius: 0,
                tension: 0.2,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                x: { title: { display: true, text: 'Frequency (Hz)' } },
                y: { title: { display: true, text: 'Amplitude' } }
            }
        }
    });
}

function formatTimestampLabel(timestamp, timeRange) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp || '');

    if (timeRange > 30 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }

    if (timeRange > 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function prepareChartData(data) {
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Calculate time range for scaling
    const timestamps = sortedData.map(d => new Date(d.timestamp));
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));
    const timeRange = maxTime - minTime;
    
    // Downsample based on time range
    let displayData = sortedData;
    const dataPoints = sortedData.length;
    
    // Adjust sampling based on time range
    let sampleFactor = 1;
    if (timeRange > 7 * 24 * 60 * 60 * 1000) { // > 1 week
        sampleFactor = Math.ceil(dataPoints / 500);
    } else if (timeRange > 24 * 60 * 60 * 1000) { // > 1 day
        sampleFactor = Math.ceil(dataPoints / 1000);
    } else {
        sampleFactor = Math.ceil(dataPoints / 2000);
    }
    
    if (sampleFactor > 1) {
        displayData = sortedData.filter((_, index) => index % sampleFactor === 0);
    }
    
    // Prepare datasets based on selected sensors
    const datasets = selectedSensors
        .filter(sensorKey => SENSORS[sensorKey])
        .map((sensorKey, index) => {
            const config = SENSORS[sensorKey];
            const values = displayData.map(d => d[sensorKey] || 0);
            
            return {
                label: config.name,
                data: values,
                borderColor: config.color,
                backgroundColor: hexToRgba(config.color, 0.1),
                borderWidth: 2,
                pointRadius: 0,
                fill: index === 0, // Only fill first dataset
                tension: 0.2,
                yAxisID: `y${index === 0 ? '' : index + 1}`
            };
        });
    
    // If no sensors selected, show RPM by default
    if (datasets.length === 0) {
        const config = SENSORS.rpm;
        datasets.push({
            label: config.name,
            data: displayData.map(d => d.rpm || 0),
            borderColor: config.color,
            backgroundColor: hexToRgba(config.color, 0.1),
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.2,
            yAxisID: 'y'
        });
    }
    
    return {
        labels: displayData.map((d) => formatTimestampLabel(d.timestamp, timeRange)),
        datasets: datasets,
        timeRange: timeRange
    };
}

function getChartOptions(timeRange) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    title: function(tooltipItems) {
                        if (tooltipItems.length > 0) {
                            return tooltipItems[0].label;
                        }
                        return '';
                    },
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        const value = context.parsed.y;
                        const sensorKey = selectedSensors[context.datasetIndex] || 'rpm';
                        const unit = SENSORS[sensorKey]?.unit || '';
                        label += value.toFixed(1) + ' ' + unit;
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'category',
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 12
                },
                title: {
                    display: true,
                    text: 'Time',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: getYAxisTitle(0),
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                beginAtZero: false, // Don't force zero for better scaling
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function(value) {
                        // Format numbers with appropriate precision
                        if (value >= 1000) {
                            return (value / 1000).toFixed(0) + 'k';
                        }
                        return value.toFixed(0);
                    }
                }
            }
        },
        animation: {
            duration: 750,
            easing: 'easeInOutQuart'
        }
    };
}

function getYAxisTitle(datasetIndex) {
    if (selectedSensors[datasetIndex]) {
        const sensor = SENSORS[selectedSensors[datasetIndex]];
        return `${sensor.name} (${sensor.unit})`;
    }
    return 'Value';
}

function updateChartTitle(startDate, endDate) {
    const chartTitle = document.getElementById('chartTitle') || document.querySelector('.chart-title');
    if (chartTitle) {
        if (startDate && endDate) {
            const start = new Date(startDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            const end = new Date(endDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const activeSensor = SENSORS[selectedSensors[0]]?.name || 'Sensor';
            chartTitle.textContent = `${activeSensor} Trend (${start} - ${end})`; 
        } else {
            const activeSensor = SENSORS[selectedSensors[0]]?.name || 'Sensor';
            chartTitle.textContent = `${activeSensor} Trend (Last 24 Hours)`;
        }
    }
}

// --- 8. HELPER FUNCTIONS ---
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function showError(message) {
    const containerEl = document.getElementById('sensorsContainer');
    if (containerEl) {
        containerEl.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: white; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                <div style="color: #ef4444; font-size: 48px; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="margin-bottom: 10px; color: #dc2626;">Error Loading Data</h3>
                <p style="margin-bottom: 20px; color: #6b7280;">${message}</p>
                <button onclick="loadReportData()" 
                        style="padding: 10px 24px; background: #1745a5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        containerEl.style.display = 'block';
    }
}

function showNoDataMessage() {
    const containerEl = document.getElementById('sensorsContainer');
    if (containerEl) {
        containerEl.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                <div style="color: #9ca3af; font-size: 48px; margin-bottom: 20px;">
                    <i class="fas fa-database"></i>
                </div>
                <h3 style="margin-bottom: 10px; color: #4b5563;">No Data Available</h3>
                <p style="margin-bottom: 30px; color: #6b7280;">
                    No sensor data found for the selected time period.
                </p>
                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                    <button onclick="updateDateFromHours('24'); loadReportData();" 
                            class="time-btn active">
                        Last 24 Hours
                    </button>
                    <button onclick="updateDateFromHours('168'); loadReportData();" 
                            class="time-btn">
                        Last 7 Days
                    </button>
                </div>
            </div>
        `;
        containerEl.style.display = 'block';
    }
    
    // Reset overview
    setText('dailyAverage', '-- hrs');
    setText('totalHours', '-- hrs');
    setText('daysActive', '-- days');
    setText('longestSession', '-- hrs');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// --- 9. OVERVIEW CALCULATIONS ---
function updateOverview(data) {
    if (!data || data.length === 0) {
        setText('dailyAverage', '-- hrs');
        setText('totalHours', '-- hrs');
        setText('daysActive', '-- days');
        setText('longestSession', '-- hrs');
        return;
    }
    
    try {
        // Active records (RPM > 100)
        const activeRecords = data.filter(d => d.rpm > 100);
        const totalHours = (activeRecords.length * 2) / 3600;
        
        // Unique active days
        const daysSet = new Set();
        activeRecords.forEach(d => {
            const dateStr = new Date(d.timestamp).toDateString();
            daysSet.add(dateStr);
        });
        
        const avgDaily = daysSet.size > 0 ? (totalHours / daysSet.size) : 0;
        
        // Longest session
        let maxSession = 0, currSession = 0;
        const sorted = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].rpm > 100) {
                const diff = (new Date(sorted[i].timestamp) - new Date(sorted[i-1].timestamp)) / 1000;
                if (diff < 300) {
                    currSession += diff;
                } else {
                    maxSession = Math.max(maxSession, currSession);
                    currSession = 0;
                }
            }
        }
        maxSession = Math.max(maxSession, currSession);
        
        setText('dailyAverage', `${avgDaily.toFixed(1)} hrs`);
        setText('totalHours', `${totalHours.toFixed(1)} hrs`);
        setText('daysActive', `${daysSet.size} days`);
        setText('longestSession', `${(maxSession/3600).toFixed(1)} hrs`);
        
    } catch (error) {
        console.error('Error in updateOverview:', error);
    }
}

// --- 10. RENDER SENSOR CARDS ---
function renderSensorCards(data) {
    const container = document.getElementById('sensorsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        showNoDataMessage();
        return;
    }
    
    const latest = data[0] || {};
    
    Object.entries(SENSORS).forEach(([key, config]) => {
        const values = data.map(d => d[key]).filter(v => v != null && !isNaN(v));
        
        if (values.length === 0) return;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const current = latest[key] != null ? latest[key] : avg;
        
        // Determine status
        let status = 'normal';
        let statusClass = 'status-normal';
        
        if (key === 'temp' && current > 90) {
            status = 'critical';
            statusClass = 'status-critical';
        } else if (key === 'volt' && (current < 11 || current > 15)) {
            status = 'warning';
            statusClass = 'status-warning';
        } else if (key === 'fuel' && current < 20) {
            status = 'warning';
            statusClass = 'status-warning';
        }
        
        const accentColor = statusClass === 'status-critical'
            ? '#dc2626'
            : statusClass === 'status-warning'
                ? '#f97316'
                : config.color;

        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.dataset.sensor = key;
        card.style.setProperty('--sensor-accent', accentColor);
        card.classList.toggle('active-sensor', selectedSensors.includes(key));
        
        card.innerHTML = `
            <div class="sensor-header">
                <div class="sensor-name">
                    <div class="sensor-icon" style="background: ${config.color}20; color: ${config.color}">
                        <i class="${config.icon}"></i>
                    </div>
                    <span class="sensor-title-text">${config.name}</span>
                </div>
                <div class="sensor-status ${statusClass}">${status.toUpperCase()}</div>
            </div>
            
            <div class="sensor-stats">
                <div class="stat-item">
                    <div class="stat-label">CURRENT</div>
                    <div class="stat-value current-value">
                        ${current.toFixed(1)}<small style="font-size: 12px;"> ${config.unit}</small>
                    </div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">AVERAGE</div>
                    <div class="stat-value">${avg.toFixed(1)} ${config.unit}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">MIN</div>
                    <div class="stat-value">${min.toFixed(1)} ${config.unit}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">MAX</div>
                    <div class="stat-value">${max.toFixed(1)} ${config.unit}</div>
                </div>
            </div>
            
            <div class="sensor-footer">
                <div class="warning-indicator ${min === 0 ? 'warning-nonzero' : 'warning-zero'}">
                    <i class="fas fa-${min === 0 ? 'exclamation-triangle' : 'check-circle'}"></i>
                    ${values.length} readings
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            selectSingleSensor(key);
        });

        container.appendChild(card);
    });
    
    container.style.display = 'grid';
}

// --- 11. EXPORT FUNCTIONS ---
function toggleExportOptions() {
    const exportOptions = document.getElementById('exportOptions');
    if (exportOptions) {
        exportOptions.style.display = exportOptions.style.display === 'block' ? 'none' : 'block';
    }
}

function printChart() {
    if (!myChart) {
        alert('No chart data available to print');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const chartImage = document.getElementById('mainChart').toDataURL('image/png');
    const dateFrom = document.getElementById('dateFrom')?.value || 'N/A';
    const dateTo = document.getElementById('dateTo')?.value || 'N/A';
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Gen-Track - Engine Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .print-header { text-align: center; margin-bottom: 30px; }
                    .chart-container { max-width: 800px; margin: 0 auto; }
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Engine Data Report</h1>
                    <p>Period: ${dateFrom} to ${dateTo}</p>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                <div class="chart-container">
                    <img src="${chartImage}" alt="Chart">
                </div>
                <script>
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// --- 12. GLOBAL FUNCTIONS ---
window.loadReportData = loadReportData;
window.updateDateFromHours = updateDateFromHours;
