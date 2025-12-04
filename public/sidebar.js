// sidebar.js
function initializeSidebar() {
    // Set active nav item based on current page
    const currentPage = window.location.pathname.split('/').pop();
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Add hover effect to sidebar
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        sidebar.addEventListener('mouseenter', () => {
            mainContent.style.marginLeft = '220px';
        });
        
        sidebar.addEventListener('mouseleave', () => {
            mainContent.style.marginLeft = '80px';
        });
    }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSidebar);