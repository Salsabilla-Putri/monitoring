function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID');
}

function setTips(tips) {
  const list = document.getElementById('publicTips');
  list.innerHTML = tips.map((t) => `<li>${t}</li>`).join('');
}

function updatePublicView(data) {
  const stateEl = document.getElementById('generatorState');
  const noteEl = document.getElementById('generatorNote');
  const electricEl = document.getElementById('electricStatus');
  const fuelEl = document.getElementById('fuelStatus');
  const engineEl = document.getElementById('engineStatus');
  const runtimeEl = document.getElementById('runtimeEstimate');
  const msgEl = document.getElementById('publicMessage');
  const lastEl = document.getElementById('lastUpdate');
  const hero = document.getElementById('statusHero');

  const isRunning = String(data.status || '').toLowerCase() === 'on' || Number(data.rpm || 0) > 0;
  const volt = Number(data.volt || 0);
  const freq = Number(data.freq || 0);
  const fuel = Number(data.fuel || 0);
  const temp = Number(data.temp || data.coolant || 0);
  const oil = Number(data.oil || 0);

  const tips = [];

  if (isRunning) {
    stateEl.textContent = 'Generator Sedang Menyala';
    noteEl.textContent = 'Pasokan listrik cadangan sedang aktif.';
    hero.style.background = 'linear-gradient(135deg, #0f9f6f, #22c55e)';
  } else {
    stateEl.textContent = 'Generator Tidak Menyala';
    noteEl.textContent = 'Saat ini tidak ada operasi generator aktif.';
    hero.style.background = 'linear-gradient(135deg, #64748b, #94a3b8)';
    tips.push('Jika listrik padam cukup lama, ikuti informasi resmi dari petugas setempat.');
  }

  const electricStable = volt >= 200 && volt <= 240 && freq >= 48 && freq <= 52;
  electricEl.textContent = electricStable ? 'Stabil' : (isRunning ? 'Kurang Stabil' : 'Tidak Aktif');
  if (!electricStable && isRunning) tips.push('Kualitas listrik belum stabil, hindari menyalakan peralatan sensitif sementara waktu.');

  if (fuel >= 50) {
    fuelEl.textContent = `Aman (${fuel.toFixed(0)}%)`;
    runtimeEl.textContent = 'Lebih dari 6 jam';
  } else if (fuel >= 25) {
    fuelEl.textContent = `Perlu Dipantau (${fuel.toFixed(0)}%)`;
    runtimeEl.textContent = 'Sekitar 3–6 jam';
    tips.push('Bahan bakar menengah, tim operasional disarankan menyiapkan pengisian.');
  } else {
    fuelEl.textContent = `Rendah (${fuel.toFixed(0)}%)`;
    runtimeEl.textContent = 'Kurang dari 3 jam';
    tips.push('Bahan bakar rendah, mohon antisipasi kemungkinan gangguan layanan.');
  }

  const engineNormal = temp <= 95 && oil >= 20;
  engineEl.textContent = engineNormal ? 'Normal' : 'Perlu Pemeriksaan';
  if (!engineNormal) tips.push('Parameter mesin motor terdeteksi perlu pemeriksaan oleh engineer.');

  if (!isRunning) {
    msgEl.textContent = 'Generator sedang tidak beroperasi. Jika terjadi pemadaman, tim engineer akan menyalakan unit sesuai prosedur.';
  } else if (!electricStable) {
    msgEl.textContent = 'Generator aktif namun kualitas listrik belum stabil. Tim engineer sedang melakukan pemantauan intensif.';
  } else if (fuel < 25) {
    msgEl.textContent = 'Generator berjalan normal tetapi bahan bakar rendah. Tim operasional sudah diinformasikan.';
  } else {
    msgEl.textContent = 'Kondisi generator dalam batas aman untuk layanan masyarakat.';
  }

  if (tips.length === 0) {
    tips.push('Layanan berjalan normal, masyarakat dapat menggunakan listrik seperti biasa.');
    tips.push('Tetap hemat energi dan laporkan gangguan ke petugas terdekat jika diperlukan.');
  }

  setTips(tips);
  lastEl.textContent = `Update terakhir: ${formatTime(data.timestamp)}`;
}

async function loadPublicData() {
  const refreshBtn = document.getElementById('refreshPublic');
  try {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat...';

    const res = await fetch('/api/engine-data/latest');
    const json = await res.json();
    const data = json?.data || {};
    updatePublicView(data);
  } catch (e) {
    document.getElementById('generatorState').textContent = 'Data tidak tersedia';
    document.getElementById('publicMessage').textContent = 'Koneksi data sedang bermasalah. Silakan coba lagi beberapa saat.';
    setTips(['Pastikan koneksi internet/stasiun monitoring aktif.', 'Hubungi petugas jika data tidak muncul dalam waktu lama.']);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<i class="fas fa-rotate"></i> Perbarui';
  }
}

document.getElementById('logoutPublic').addEventListener('click', () => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userRole');
  localStorage.removeItem('username');
  window.location.replace('login.html');
});

document.getElementById('refreshPublic').addEventListener('click', loadPublicData);

loadPublicData();
setInterval(loadPublicData, 10000);
