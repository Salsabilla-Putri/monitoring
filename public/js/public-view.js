function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function setTips(tips) {
  const list = document.getElementById('publicTips');
  if (!list) return;
  if (tips.length === 0) {
    list.innerHTML = '<li>Tidak ada tindakan yang perlu dilakukan saat ini.</li>';
    return;
  }
  list.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
}

function setQuickValue(id, text, subId, subText) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  const sub = document.getElementById(subId);
  if (sub && subText !== undefined) sub.textContent = subText;
}

function updatePublicView(data) {
  const stateEl   = document.getElementById('generatorState');
  const noteEl    = document.getElementById('generatorNote');
  const msgEl     = document.getElementById('publicMessage');
  const lastEl    = document.getElementById('lastUpdate');
  const hero      = document.getElementById('statusHero');
  const badgeText = document.getElementById('heroBadgeText');
  const pulse     = document.querySelector('.hero-pulse');

  const profileName   = document.getElementById('profileName');
  const analysisVolt  = document.getElementById('analysisVoltage');
  const analysisFreq  = document.getElementById('analysisFrequency');
  const analysisSync  = document.getElementById('analysisSync');
  const analysisCtr   = document.getElementById('analysisControl');

  // ── Nilai dasar
  const isRunning = String(data.status || '').toUpperCase() === 'RUNNING' || Number(data.rpm || 0) > 0;
  const volt      = Number(data.volt    || 0);
  const freq      = Number(data.freq    || 0);
  const fuel      = Number(data.fuel    || 0);
  const temp      = Number(data.temp    || data.coolant || 0);
  const oil       = Number(data.oil     || 0);
  const syncText  = String(data.sync    || '').toUpperCase();
  const tips      = [];

  // ── Profil
  if (profileName) {
    profileName.textContent = localStorage.getItem('username') || 'Pengguna Umum';
  }

  // ── Hero: status generator
  if (isRunning) {
    stateEl.textContent  = 'Generator Sedang Menyala';
    noteEl.textContent   = 'Pasokan listrik cadangan sedang aktif dan beroperasi.';
    hero.style.background = 'linear-gradient(135deg, #065f46 0%, #059669 55%, #34d399 100%)';
    badgeText.textContent = 'AKTIF';
    if (pulse) { pulse.style.background = '#4ade80'; pulse.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.3)'; }
  } else {
    stateEl.textContent  = 'Generator Tidak Menyala';
    noteEl.textContent   = 'Saat ini tidak ada operasi generator aktif.';
    hero.style.background = 'linear-gradient(135deg, #1e293b 0%, #475569 70%, #64748b 100%)';
    badgeText.textContent = 'TIDAK AKTIF';
    if (pulse) { pulse.style.background = '#94a3b8'; pulse.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.3)'; }
    tips.push('Jika terjadi pemadaman berkepanjangan, ikuti informasi resmi dari petugas setempat.');
  }

  // ── Quick cards
  const voltOk  = volt >= 200 && volt <= 240;
  const freqOk  = freq >= 48  && freq <= 52;
  const elecOk  = voltOk && freqOk;

  if (isRunning) {
    setQuickValue(
      'electricStatus', elecOk ? 'Stabil' : 'Kurang Stabil',
      'electricSub',    elecOk ? `${volt.toFixed(1)} V · ${freq.toFixed(1)} Hz` : 'Mungkin ada gangguan kecil'
    );
    if (!elecOk) tips.push('Kualitas listrik belum sepenuhnya stabil. Hindari menyalakan peralatan sensitif untuk sementara.');
  } else {
    setQuickValue('electricStatus', 'Tidak Aktif', 'electricSub', 'Generator sedang mati');
  }

  const engineOk = temp <= 95 && oil >= 20;
  setQuickValue(
    'engineStatus', engineOk ? 'Normal' : 'Perlu Periksa',
    'engineSub',    engineOk ? `Suhu ${temp.toFixed(0)}°C · Oli ${oil.toFixed(0)} bar` : 'Hubungi teknisi segera'
  );
  if (!engineOk) tips.push('Parameter mesin perlu pemeriksaan oleh teknisi.');

  if      (fuel >= 50) {
    setQuickValue('fuelStatus', `Aman (${fuel.toFixed(0)}%)`,         'fuelSub', 'Stok bahan bakar mencukupi');
    setQuickValue('runtimeEstimate', 'Lebih dari 6 jam',              'runtimeSub', 'Estimasi berdasarkan konsumsi normal');
  } else if (fuel >= 25) {
    setQuickValue('fuelStatus', `Perlu Dipantau (${fuel.toFixed(0)}%)`,'fuelSub', 'Segera siapkan pengisian');
    setQuickValue('runtimeEstimate', 'Sekitar 3–6 jam',               'runtimeSub', 'Disarankan isi bahan bakar');
    tips.push('Bahan bakar pada level menengah. Tim operasional disarankan menyiapkan pengisian.');
  } else {
    setQuickValue('fuelStatus', `Rendah (${fuel.toFixed(0)}%)`,       'fuelSub', 'Segera isi bahan bakar!');
    setQuickValue('runtimeEstimate', 'Kurang dari 3 jam',             'runtimeSub', 'Perlu pengisian segera');
    tips.push('Bahan bakar hampir habis. Mohon antisipasi kemungkinan gangguan layanan listrik.');
  }

  // ── Analisis grid
  if (analysisVolt) {
    analysisVolt.textContent = volt > 0
      ? `${volt.toFixed(1)} V ${voltOk ? '✓ sesuai standar' : '⚠ di luar target 200-240V'}`
      : '--';
  }
  if (analysisFreq) {
    analysisFreq.textContent = freq > 0
      ? `${freq.toFixed(2)} Hz ${freqOk ? '✓ sinkron' : '⚠ perlu stabilisasi'}`
      : '--';
  }

  const syncOk = syncText.includes('ON-GRID') || syncText.includes('SYNC');
  if (analysisSync) {
    analysisSync.textContent = isRunning
      ? (syncOk ? 'Tersinkron dengan grid utilitas' : 'Transisi / menyesuaikan sinkronisasi')
      : 'Tidak aktif';
  }
  if (analysisCtr) {
    analysisCtr.textContent = elecOk && syncOk && isRunning
      ? 'Bekerja normal (start, sinkron, transfer beban)'
      : (isRunning ? 'Sedang menyesuaikan parameter otomatis' : 'Standby');
  }

  // ── Pesan catatan
  if (msgEl) {
    if (!isRunning) {
      msgEl.textContent = 'Generator sedang tidak beroperasi. Jika listrik padam, sistem kendali otomatis akan menyalakan unit sesuai prosedur.';
    } else if (!elecOk) {
      msgEl.textContent = 'Generator aktif namun kualitas listrik belum sepenuhnya stabil. Sistem sinkronisasi otomatis sedang menyesuaikan tegangan dan frekuensi agar aman untuk beban rumah tangga.';
    } else if (fuel < 25) {
      msgEl.textContent = 'Generator berjalan normal dan sudah sinkron dengan grid, namun bahan bakar hampir habis. Tim operasional telah diinformasikan untuk segera melakukan pengisian.';
    } else {
      msgEl.textContent = 'Kondisi generator aman untuk kebutuhan rumah tangga. Sinkronisasi dengan jaringan listrik berjalan normal, sistem kendali otomatis aktif dan bekerja sebagaimana mestinya.';
    }
  }

  if (tips.length === 0) {
    tips.push('Layanan berjalan normal. Masyarakat dapat menggunakan listrik seperti biasa.');
    tips.push('Tetap hemat energi. Laporkan gangguan kepada petugas jika terjadi masalah.');
  }

  setTips(tips);

  if (lastEl) {
    lastEl.innerHTML = `<i class="fas fa-clock" style="margin-right:5px"></i>Update terakhir: ${formatTime(data.timestamp)}`;
  }
}

async function loadPublicData() {
  const refreshBtn = document.getElementById('refreshPublic');
  try {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat...';
    }

    const res  = await fetch('/api/engine-data/latest');
    const json = await res.json();
    updatePublicView(json?.data || {});

  } catch (e) {
    const stateEl = document.getElementById('generatorState');
    const msgEl   = document.getElementById('publicMessage');
    if (stateEl) stateEl.textContent = 'Data tidak tersedia';
    if (msgEl)   msgEl.textContent   = 'Koneksi data sedang bermasalah. Silakan coba lagi beberapa saat.';
    setTips([
      'Pastikan koneksi internet aktif.',
      'Hubungi petugas jika data tidak muncul dalam waktu lama.'
    ]);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fas fa-rotate"></i> Perbarui';
    }
  }
}

// ── Event listeners
document.getElementById('logoutPublic')?.addEventListener('click', () => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userRole');
  localStorage.removeItem('username');
  window.location.replace('login.html');
});

document.getElementById('refreshPublic')?.addEventListener('click', loadPublicData);

document.getElementById('toggleSidebar')?.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-open');
});

document.querySelectorAll('.ps-nav a').forEach(a => {
  a.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
});

// ── Init
loadPublicData();
setInterval(loadPublicData, 10000);