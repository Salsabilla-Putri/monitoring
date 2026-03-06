(function () {
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';
  const isLoginPage = page.includes('login.html');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  if (!isLoginPage && !isLoggedIn) {
    window.location.replace('login.html');
    return;
  }

  if (isLoginPage && isLoggedIn) {
    window.location.replace('index.html');
  }
})();
