// File: public/js/sidebar.js

document.addEventListener("DOMContentLoaded", function() {
    fetch('sidebar.html')
        .then(response => response.text())
        .then(data => {
            const container = document.getElementById('sidebar-container');
            if (container) {
                container.outerHTML = data;
            }
            
            // Inisialisasi event setelah elemen masuk ke DOM
            initSidebarEvents();
            setActiveLink();
        })
        .catch(err => console.error("Gagal memuat sidebar:", err));
        
    const userBtn = e.target.closest('#user-btn') || e.target.closest('.user-info');
    
    // File: js/sidebar.js

    if (userBtn) {
        // Redirect ke halaman user
        window.location.href = 'user.html';
    }
});


// File: public/js/sidebar.js

function initSidebarEvents() {
    // --- Logika Tombol Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault(); 
            
            if(confirm("Apakah Anda yakin ingin keluar?")) {
                // --- LANGKAH PENTING: HAPUS SESI LOGIN ---
                // Harus sesuai dengan key yang dipakai di login.html
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userRole');
                localStorage.removeItem('username');
                
                // Setelah data dihapus, baru pindah ke login.html
                // Saat login.html dibuka, dia tidak akan menemukan 'isLoggedIn',
                // jadi dia tidak akan melempar balik ke dashboard.
                window.location.href = 'login.html'; 
            }
        });
    }

    // --- Logika Pindah ke Page User ---
    const userIcon = document.getElementById('user-icon');
    if (userIcon) {
        userIcon.addEventListener('click', function() {
            window.location.href = 'user.html';
        });
    }
}

// function initSidebarEvents() {
//     // --- Logika Tombol Logout (DIPERBAIKI) ---
//     const logoutBtn = document.getElementById('logout-btn');
//     if (logoutBtn) {
//         logoutBtn.addEventListener('click', function(e) {
//             e.preventDefault(); // Mencegah link langsung berjalan
            
//             if(confirm("Apakah Anda yakin ingin keluar?")) {
//                 // Opsional: Hapus token/session jika ada
//                 // localStorage.removeItem('userToken'); 
                
//                 // Redirect ke halaman login
//                 window.location.href = 'login.html';
//             }
//         });
//     }

//     // --- Logika Pindah ke Page User ---
//     const userIcon = document.getElementById('user-icon');
//     if (userIcon) {
//         userIcon.addEventListener('click', function() {
//             window.location.href = 'user.html';
//         });
//     }
// }

function setActiveLink() {
    // Menandai menu aktif berdasarkan URL
    const path = window.location.pathname;
    // Mengambil nama file (misal: engine.html)
    const page = path.split("/").pop() || 'index.html';

    // Hapus class active dari semua link dulu
    // Selector diperbaiki agar menarget class .nav-item langsung jika struktur HTML berubah
    document.querySelectorAll('.sidebar .nav-item').forEach(a => {
        a.classList.remove('active');
    });

    // Tambahkan class active ke ID yang sesuai (Pastikan ID ada di HTML)
    if(page === 'index.html' || page === '') document.getElementById('link-dashboard')?.classList.add('active');
    else if(page.includes('engine')) document.getElementById('link-engine')?.classList.add('active');
    else if(page.includes('history')) document.getElementById('link-history')?.classList.add('active');
    else if(page.includes('reports')) document.getElementById('link-reports')?.classList.add('active');
    else if(page.includes('maintenance')) document.getElementById('link-maintenance')?.classList.add('active');
    else if(page.includes('alarm')) document.getElementById('link-alarm')?.classList.add('active');
}