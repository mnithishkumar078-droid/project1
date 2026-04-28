const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMessage = document.getElementById('adminLoginMessage');

function setAdminMessage(message, type = 'error') {
    if (!adminLoginMessage) return;
    adminLoginMessage.textContent = message;
    adminLoginMessage.className = `message-box show ${type}`;
}

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/admin/login', {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (!response.ok) {
                setAdminMessage(result.error || 'Admin login failed.');
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify(result.user));
            setAdminMessage('Admin login successful.', 'success');
            window.location.href = 'admin.html';
        } catch (error) {
            setAdminMessage('Unable to login right now. Please try again later.');
            console.error(error);
        }
    });
}
