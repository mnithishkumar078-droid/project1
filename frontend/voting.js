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

function setupUserHeader() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
        window.location.href = 'login.html';
        return;
    }

    try {
        activeUser = JSON.parse(storedUser);
    } catch (error) {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
        return;
    }

    const fullNameDisplay = document.getElementById('fullNameDisplay');
    if (fullNameDisplay) {
        fullNameDisplay.innerHTML = `<i class="fas fa-user"></i> ${activeUser.fullName || activeUser.username || 'Voter'}`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
}

async function getVoteInfo() {
    if (!activeUser?.username) {
        return { hasVoted: false };
    }

    const response = await fetch(`/votes/${encodeURIComponent(activeUser.username)}`);
    if (!response.ok) {
        return { hasVoted: false };
    }
    return response.json();
}

async function castVote(candidateId) {
    if (!activeUser?.username) {
        return;
    }

    try {
        const response = await fetch('/votes', {
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
        const [candidateResponse, voteInfo] = await Promise.all([fetch('/candidates'), getVoteInfo()]);
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
setupUserHeader();
loadCandidates();
