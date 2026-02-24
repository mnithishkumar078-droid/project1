const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Get stored users
        const users = JSON.parse(localStorage.getItem('voters')) || [];
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            // Check Aadhaar verification flag saved by register
            if (!user.aadhaarVerified) {
                alert('Aadhaar verification required. Please upload your Aadhaar XML file.');
                window.location.href = 'register.html?verify=aadhaar';
                return;
            }

            // Store current user session
            localStorage.setItem('currentUser', JSON.stringify(user));
            alert('Login successful! Redirecting to voting page...');
            window.location.href = 'vote.html';
        } else {
            alert('Invalid email or password!');
        }
    });
} else {
    // No login form on this page; don't throw an error
    console.warn('No #loginForm found on this page — login.js skipped attaching handler.');
}