
function setupAdminButton() {
    const adminNavLink = document.getElementById('adminNavLink');
    if (!adminNavLink) {
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isAdmin = currentUser && (currentUser.username === 'admin' || currentUser.role === 'admin');

    adminNavLink.textContent = isAdmin ? 'Admin Dashboard' : 'Admin Login';
    adminNavLink.href = isAdmin ? 'admin-dashboard.html' : 'admin.html';
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) {
        return;
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        alert('You have been logged out successfully.');
        window.location.href = 'login.html';
    });
}

async function loadCandidates() {
    const candidateList = document.getElementById('candidateList');
    candidateList.innerHTML = '<p class="loading-state">Loading candidates...</p>';

    try {
        const response = await fetch('/candidates');
        if (!response.ok) {
            throw new Error('Failed to fetch candidates');
        }

        const candidates = await response.json();
        if (!candidates.length) {
            candidateList.innerHTML = '<p class="empty-state">No candidates added by admin yet.</p>';
            return;
        }

        candidateList.innerHTML = candidates
            .map(
                (candidate) => `
                    <article class="candidate-card">
                        <img src="${candidate.imageUrl}" alt="${candidate.name}" class="candidate-image" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'" />
                        <div class="candidate-info">
                            <h3>${candidate.name}</h3>
                            <p>${candidate.party}</p>
                        </div>
                    </article>
                `
            )
            .join('');
    } catch (error) {
        candidateList.innerHTML = '<p class="error-state">Could not load candidates right now.</p>';
        console.error(error);
    }
}

setupAdminButton();
setupLogoutButton();
loadCandidates();
