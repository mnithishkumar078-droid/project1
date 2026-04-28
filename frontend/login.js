const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

function setMessage(message, type = 'error') {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = `message-box show ${type}`;
}

if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/login', {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (!response.ok) {
                setMessage(result.error || 'Invalid username or password!');
                return;
            }

            if (result.user?.role === 'admin') {
                setMessage('This is voter login. Please use the Admin Login page.');
                window.location.href = 'admin-login.html';
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify(result.user));
            setMessage('Login successful. Redirecting to Vote Now page...', 'success');
            window.location.href = 'votenow.html';
        } catch (error) {
            setMessage('Unable to login right now. Please try again later.');
            console.error(error);
        }
    });
}
