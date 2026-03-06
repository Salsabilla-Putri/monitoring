// File: public/js/sidebar.js

function initSidebarEvents() {
  // Logika logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();

      if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        window.location.replace('login.html');
      }
    });
  }
}

function setActiveLink() {
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  document.querySelectorAll('.sidebar .nav-item').forEach((a) => a.classList.remove('active'));

  if (page === 'index.html' || page === '') document.getElementById('link-dashboard')?.classList.add('active');
  else if (page.includes('engine')) document.getElementById('link-engine')?.classList.add('active');
  else if (page.includes('history')) document.getElementById('link-history')?.classList.add('active');
  else if (page.includes('reports')) document.getElementById('link-reports')?.classList.add('active');
  else if (page.includes('maintenance')) document.getElementById('link-maintenance')?.classList.add('active');
  else if (page.includes('alarm')) document.getElementById('link-alarm')?.classList.add('active');
}

function setupSidebarHoverState() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  let closeTimer;

  const openSidebar = () => {
    clearTimeout(closeTimer);
    document.body.classList.add('sidebar-expanded');
  };

  const closeSidebar = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      document.body.classList.remove('sidebar-expanded');
    }, 120);
  };

  sidebar.addEventListener('mouseenter', openSidebar);
  sidebar.addEventListener('mouseleave', closeSidebar);
}

document.addEventListener('DOMContentLoaded', function () {
  fetch('sidebar.html')
    .then((response) => response.text())
    .then((data) => {
      const container = document.getElementById('sidebar-container');
      if (!container) return;

      // Gunakan innerHTML agar wrapper #sidebar-container tetap ada (menghindari selector glitch)
      container.innerHTML = data;

      initSidebarEvents();
      setActiveLink();
      setupSidebarHoverState();
    })
    .catch((err) => console.error('Gagal memuat sidebar:', err));

  // Delegasi click untuk area user (ikon + teks)
  document.addEventListener('click', function (e) {
    const userBtn = e.target.closest('#user-btn') || e.target.closest('.user-info');
    if (userBtn && !window.location.pathname.includes('login.html')) {
      window.location.href = 'user.html';
    }
  });
});
