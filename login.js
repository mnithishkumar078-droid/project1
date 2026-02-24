const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const result = await response.json();
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                alert('Login successful! Redirecting to Vote Now page...');
                window.location.href = 'votenow.html';
                return;
            }
        } catch (error) {
            console.warn('Backend login unavailable, trying local data login.', error);
        }

        const users = JSON.parse(localStorage.getItem('voters')) || [];
        const user = users.find((u) => u.username === username && u.password === password);

        if (user) {
            if (!user.aadhaarVerified) {
                alert('Aadhaar verification required. Please upload your Aadhaar XML file.');
                window.location.href = 'register.html?verify=aadhaar';
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify(user));
            alert('Login successful! Redirecting to Vote Now page...');
            window.location.href = 'votenow.html';
        } else {
            alert('Invalid username or password!');
        }
    });
} else {
    console.warn('No #loginForm found on this page — login.js skipped attaching handler.');
}
