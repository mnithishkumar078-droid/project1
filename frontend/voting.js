let activeUser = null;

function setVoteStatus(message, type = 'success') {
    const container = document.getElementById('candidateList');
    const existing = document.getElementById('voteMessage');
    if (existing) {
        existing.remove();
    }

    const messageBox = document.createElement('div');
    messageBox.id = 'voteMessage';
    messageBox.className = `verification-status ${type}`;
    messageBox.textContent = message;
    container.parentElement.insertBefore(messageBox, container);
}


async function hydrateUserFromSession() {
    try {
        const response = await fetch('/session/me', { credentials: 'include' });
        if (!response.ok) {
            localStorage.removeItem('currentUser');
            return null;
        }

        const result = await response.json();
        return result.user || null;
    } catch (error) {
        return null;
    }
}

async function setupUserHeader() {
    const sessionUser = await hydrateUserFromSession();
    if (!sessionUser || sessionUser.role !== 'voter') {
        window.location.href = 'register.html';
        return;
    }

    activeUser = sessionUser;
    localStorage.setItem('currentUser', JSON.stringify(sessionUser));

    const fullNameDisplay = document.getElementById('fullNameDisplay');
    if (fullNameDisplay) {
        fullNameDisplay.innerHTML = `<i class="fas fa-user"></i> ${activeUser.fullName || activeUser.username || 'Voter'}`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/logout', { method: 'POST', credentials: 'include' });
            } catch (error) {
                console.error(error);
            }
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
}

async function getVoteInfo() {
    if (!activeUser?.username) {
        return { hasVoted: false };
    }

    const response = await fetch(`/votes/${encodeURIComponent(activeUser.username)}`, { credentials: 'include' });
    if (!response.ok) {
        return { hasVoted: false };
    }
    return response.json();
}

async function castVote(candidateId) {
    if (!activeUser?.username) {
        window.location.href = 'register.html';
        return;
    }

    try {
        const response = await fetch('/votes', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voterUsername: activeUser.username, candidateId })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Unable to submit vote');
        }

        setVoteStatus(result.message, 'success');
        await loadCandidates();
    } catch (error) {
        setVoteStatus(error.message, 'error');
    }
}

async function loadCandidates() {
    const candidateList = document.getElementById('candidateList');
    candidateList.innerHTML = '<p class="loading-state">Loading candidates...</p>';

    try {
        const [candidateResponse, voteInfo] = await Promise.all([fetch('/candidates', { credentials: 'include' }), getVoteInfo()]);
        if (!candidateResponse.ok) {
            throw new Error('Failed to fetch candidates');
        }

        const candidates = await candidateResponse.json();
        if (!candidates.length) {
            candidateList.innerHTML = '<p class="empty-state">No candidates added by admin yet.</p>';
            return;
        }

        candidateList.innerHTML = candidates
            .map(
                (candidate) => {
                    const isSelected = voteInfo.hasVoted && voteInfo.candidateId === candidate.id;
                    return `
                    <article class="candidate-card">
                        <img src="${candidate.imageData}" alt="${candidate.name}" class="candidate-image" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'" />
                        <div class="candidate-info">
                            <h3>${candidate.name}</h3>
                            <p>${candidate.party}</p>
                            <button class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'}" onclick="voteNow('${candidate.id}')">
                                ${isSelected ? 'Voted Candidate' : 'Vote Now'}
                            </button>
                        </div>
                    </article>
                `;
                }
            )
            .join('');

        if (voteInfo.hasVoted) {
            setVoteStatus(`Your current vote is stored for ${voteInfo.candidateName} (${voteInfo.party}).`, 'success');
        }
    } catch (error) {
        candidateList.innerHTML = '<p class="error-state">Could not load candidates right now.</p>';
        console.error(error);
    }
}

window.voteNow = castVote;

(async () => {
    await setupUserHeader();
    if (activeUser) {
        await loadCandidates();
    }
})();
