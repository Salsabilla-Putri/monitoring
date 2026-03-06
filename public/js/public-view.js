function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID');
}

function updatePublicView(data) {
  const stateEl = document.getElementById('generatorState');
  const noteEl = document.getElementById('generatorNote');
  const electricEl = document.getElementById('electricStatus');
  const fuelEl = document.getElementById('fuelStatus');
  const msgEl = document.getElementById('publicMessage');
  const lastEl = document.getElementById('lastUpdate');
  const hero = document.getElementById('statusHero');

  const isRunning = String(data.status || '').toLowerCase() === 'on' || Number(data.rpm || 0) > 0;
  const volt = Number(data.volt || 0);
  const freq = Number(data.freq || 0);
  const fuel = Number(data.fuel || 0);

  if (isRunning) {
    stateEl.textContent = 'Generator Sedang Menyala';
    noteEl.textContent = 'Pasokan listrik cadangan sedang aktif.';
    hero.style.background = 'linear-gradient(135deg, #0f9f6f, #22c55e)';
  } else {
    stateEl.textContent = 'Generator Tidak Menyala';
    noteEl.textContent = 'Saat ini tidak ada operasi generator aktif.';
    hero.style.background = 'linear-gradient(135deg, #64748b, #94a3b8)';
  }

  const electricStable = volt >= 200 && volt <= 240 && freq >= 48 && freq <= 52;
  electricEl.textContent = electricStable ? 'Stabil' : (isRunning ? 'Kurang Stabil' : 'Tidak Aktif');

  if (fuel >= 50) fuelEl.textContent = `Aman (${fuel.toFixed(0)}%)`;
  else if (fuel >= 25) fuelEl.textContent = `Perlu Dipantau (${fuel.toFixed(0)}%)`;
  else fuelEl.textContent = `Rendah (${fuel.toFixed(0)}%)`;

  if (!isRunning) {
    msgEl.textContent = 'Generator sedang tidak beroperasi. Jika terjadi pemadaman, tim engineer akan menyalakan unit sesuai prosedur.';
  } else if (!electricStable) {
    msgEl.textContent = 'Generator aktif namun kualitas listrik belum stabil. Tim engineer sedang melakukan pemantauan intensif.';
  } else if (fuel < 25) {
    msgEl.textContent = 'Generator berjalan normal tetapi bahan bakar rendah. Tim operasional sudah diinformasikan.';
  } else {
    msgEl.textContent = 'Kondisi generator dalam batas aman untuk layanan masyarakat.';
  }

  lastEl.textContent = `Update terakhir: ${formatTime(data.timestamp)}`;
}

async function loadPublicData() {
  try {
    const res = await fetch('/api/engine-data/latest');
    const json = await res.json();
    const data = json?.data || {};
    updatePublicView(data);
  } catch (e) {
    document.getElementById('generatorState').textContent = 'Data tidak tersedia';
    document.getElementById('publicMessage').textContent = 'Koneksi data sedang bermasalah. Silakan coba lagi beberapa saat.';
  }
}

document.getElementById('logoutPublic').addEventListener('click', () => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userRole');
  localStorage.removeItem('username');
  window.location.replace('login.html');
});

loadPublicData();
setInterval(loadPublicData, 10000);
