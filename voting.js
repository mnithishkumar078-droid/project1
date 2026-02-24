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

loadCandidates();
