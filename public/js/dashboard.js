const API_URL = '/api';
let activeChart = null;

// --- UTILS ---
const formatTime = (d) => new Date(d).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});

// --- UPDATE DASHBOARD ---
async function updateDashboard() {
    try {
        // 1. FETCH ENGINE DATA
        const res = await fetch(`${API_URL}/engine-data/latest`);
        const json = await res.json();

        if (json.success && json.data) {
            const data = json.data;

            // Overview (Tampilkan 0 jika data tidak ada)
            setVal('val-rpm', (data.rpm||0) + ' RPM');
            setVal('val-temp', (data.coolant || data.temp || 0).toFixed(1) + '°C');
            setVal('val-volt', (data.volt || 0).toFixed(1) + ' V');
            
            // --- ENGINE STATUS COLOR LOGIC ---
            // Hijau jika RUNNING, Merah jika STOPPED
            const isRun = data.status === 'RUNNING';
            setStatus('engStat', isRun, 'RUNNING', 'STOPPED');

            // Hijau jika ON-GRID, Merah jika OFF-GRID/UNKNOWN
            const isSync = data.sync === 'ON-GRID' || data.sync === 'SYNCHRONIZED';
            setStatus('engSync', isSync, 'ON-GRID', 'OFF-GRID');
            
            // Fuel Level
            const fuelVal = Math.round(data.fuel || 0);
            const fuelEl = document.getElementById('fuelLevel');
            fuelEl.innerText = fuelVal + '%';
            fuelEl.className = fuelVal < 20 ? 'st-err' : (fuelVal < 40 ? 'st-warn' : 'st-ok');

            document.getElementById('engLast').innerText = formatTime(data.timestamp);

            // --- SYSTEM HEALTH (Mencegah -- jika data 0) ---
            // Kita gunakan (val || 0) agar jika data undefined dari ESP32, dianggap 0 dan dicek thresholdnya
            checkThreshold('st-volt', data.volt || 0, 180, 250);
            checkThreshold('st-amp', data.amp || 0, 0, 100);
            checkThreshold('st-freq', data.freq || 0, 48, 52);
            checkThreshold('st-oil', data.oil || 0, 20, 100);     // Jika 0 -> Low (Merah)
            checkThreshold('st-coolant', (data.coolant||data.temp||0), 0, 95);
            checkThreshold('st-iat', data.iat || 0, 0, 60);
            checkThreshold('st-fuel', data.fuel || 0, 20, 100);
            checkThreshold('st-afr', data.afr || 0, 10, 18);      // Jika 0 -> Low (Merah)
        }

        // 2. FETCH MAINTENANCE LOG (Recent Activity)
        const resMaint = await fetch(`${API_URL}/maintenance`);
        const jsonMaint = await resMaint.json();
        if (jsonMaint.success) renderMaintenance(jsonMaint.data);

        // 3. FETCH ALERTS
        const resAlert = await fetch(`${API_URL}/alerts?limit=10`);
        const jsonAlert = await resAlert.json();
        if(jsonAlert.success) {
            const active = jsonAlert.data.filter(a => !a.resolved);
            document.getElementById('val-alerts').innerText = active.length;
            renderAlerts(jsonAlert.data.slice(0, 3));
        }

    } catch (e) { console.error("Dashboard update failed", e); }
}

// --- HELPERS ---
function setVal(id, val) { const e = document.getElementById(id); if(e) e.innerText = val; }

// Fungsi Warna Status (Running/Sync)
function setStatus(id, isOk, textOk, textErr) {
    const el = document.getElementById(id);
    if(el) {
        el.innerText = isOk ? textOk : textErr;
        // st-ok = hijau, st-err = merah (definisikan di CSS)
        el.className = isOk ? 'st-ok' : 'st-err'; 
    }
}

// Fungsi Cek Threshold
function checkThreshold(id, val, min, max) {
    const el = document.getElementById(id);
    if(!el) return;
    
    // Jika val 0 dan min > 0, maka ini akan masuk kondisi Low (Merah), bukan --
    if (val >= min && val <= max) {
        el.innerText = 'Normal'; el.className = 'st-ok';
    } else {
        // Tampilkan Low atau High
        el.innerText = val < min ? 'Low' : 'High';
        el.className = 'st-err';
    }
}

function renderMaintenance(logs) {
    const c = document.getElementById('maintenanceContainer');
    c.innerHTML = '';
    if(!logs.length) { c.innerHTML='<div style="padding:10px; color:#999">No activity</div>'; return; }
    
    logs.forEach(log => {
        const date = new Date(log.date).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
        c.innerHTML += `
            <div class="list-row">
                <span style="font-weight:600; color:#1e293b">${log.activity}</span> 
                <span style="font-size:12px; color:#64748b">${date}</span>
            </div>`;
    });
}

function renderAlerts(alerts) {
    const c = document.getElementById('alertContainer');
    c.innerHTML = '';
    if(!alerts.length) { c.innerHTML = '<div style="text-align:center;color:#aaa;padding:15px">No recent alerts</div>'; return; }
    
    alerts.forEach(a => {
        let type = 'info', icon = 'fa-info-circle';
        if(a.severity==='critical') { type='alert-item'; icon='fa-exclamation-triangle'; } 
        else if(a.severity==='medium') { type='alert-item warning'; icon='fa-exclamation-circle'; }
        
        c.innerHTML += `
        <div class="${type}">
            <div class="alert-icon"><i class="fas ${icon}"></i></div>
            <div class="alert-content">
                <div class="alert-title">${a.message}</div>
                <div class="alert-time">${formatDate(a.timestamp)} ${formatTime(a.timestamp)}</div>
            </div>
        </div>`;
    });
}

// --- CHART ---
async function initChart() {
    const ctx = document.getElementById('chartActive').getContext('2d');
    try {
        const res = await fetch(`${API_URL}/engine-data/history?hours=168`);
        const json = await res.json();
        
        if(json.success && json.data.length) {
            const days = {};
            const today = new Date();
            for(let i=6; i>=0; i--) {
                const d = new Date(); d.setDate(today.getDate()-i);
                days[d.toDateString()] = 0;
            }
            
            // Sort Data Lama -> Baru untuk hitung durasi
            const sorted = json.data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            for(let i=1; i<sorted.length; i++) {
                const curr = sorted[i];
                const prev = sorted[i-1];
                
                // Hanya hitung jika mesin NYALA (RPM > 0)
                if (curr.rpm > 0) {
                    const diff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000; // detik
                    // Filter glitch: jika selisih < 5 menit (asumsi data continue)
                    if(diff > 0 && diff < 300) {
                         days[new Date(curr.timestamp).toDateString()] += (diff / 3600);
                    }
                }
            }

            const labels = Object.keys(days).map(k => new Date(k).toLocaleDateString('id-ID', {weekday:'short'}));
            const data = Object.values(days);
            
            // Update text Today's Active
            const todayHrs = days[today.toDateString()] || 0;
            const h = Math.floor(todayHrs);
            const m = Math.round((todayHrs-h)*60);
            document.getElementById('engToday').innerText = `${h}h ${m}m`;

            new Chart(ctx, {
                type: 'bar',
                data: { 
                    labels, 
                    datasets: [{ 
                        label: 'Hours', 
                        data, 
                        backgroundColor: '#1745a5', 
                        borderRadius:4,
                        barPercentage: 0.6
                    }] 
                },
                options: { 
                    responsive:true, 
                    maintainAspectRatio:false, 
                    plugins:{legend:{display:false}}, 
                    scales:{y:{beginAtZero:true}, x:{grid:{display:false}}} 
                }
            });
        }
    } catch(e) { console.error(e); }
}
// ... kode lainnya tetap sama ...

// 2. UPDATE MAINTENANCE LOG
async function updateMaintenanceLog() {
    try {
        // Pastikan endpoint ini sama dengan yang di server
        const res = await fetch('/api/maintenance'); 
        if (!res.ok) return;

        const json = await res.json();
        const container = document.getElementById('maintenanceContainer'); // Pastikan ID ini ada di index.html (sesuai kode sebelumnya)

        if (json.success && json.data.length > 0 && container) {
            container.innerHTML = '';
            
            // Ambil 5 data terbaru berdasarkan dueDate atau createdAt
            // Kita filter yang belum selesai (status != completed) untuk ditampilkan sebagai "Upcoming"
            // Atau tampilkan semua mix, di sini saya tampilkan yang terbaru dibuat
            const logs = json.data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

            logs.forEach(log => {
                const dateStr = new Date(log.dueDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'});
                // Style status badge kecil
                let statusColor = '#64748b';
                if(log.status === 'completed') statusColor = '#10b981';
                if(log.status === 'overdue') statusColor = '#ef4444';

                container.innerHTML += `
                <div class="list-row">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:600; color:#1e293b; font-size:14px;">${log.task}</span>
                        <span style="font-size:11px; color:${statusColor}; text-transform:capitalize;">${log.status}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:13px; color:#64748b; font-weight:bold;">${dateStr}</span><br>
                        <span style="font-size:11px; color:#94a3b8;">${log.assignedTo}</span>
                    </div>
                </div>`;
            });
        } else if (container) {
            container.innerHTML = '<div style="text-align:center; padding:15px; color:#aaa">No recent activity</div>';
        }
    } catch (e) {
        console.warn("Maintenance Log error:", e);
    }
}
// ... kode lainnya tetap sama ...

document.addEventListener('DOMContentLoaded', () => {
    fetch('sidebar.html').then(r=>r.text()).then(h=>{ 
        document.getElementById('sidebar-container').innerHTML=h; 
        if(window.initializeSidebar) window.initializeSidebar();
    });
    
    setInterval(() => document.getElementById('clock').innerText=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),1000);
    
    updateDashboard(); 
    initChart(); 
    setInterval(updateDashboard, 3000);
});