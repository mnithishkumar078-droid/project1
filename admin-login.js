const adminLoginForm = document.getElementById('adminLoginForm');

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value;

        const validAdminPassword = password === 'password' || password === 'admin@123';

        if (username === 'admin' && validAdminPassword) {
            localStorage.setItem('currentUser', JSON.stringify({ username: 'admin', role: 'admin' }));
            alert('Admin login successful. Redirecting to dashboard...');
            window.location.href = 'admin-dashboard.html';
            return;
        }

        alert('Invalid admin credentials.');
    });
}
