const candidateForm = document.getElementById('candidateForm');
const adminCandidateList = document.getElementById('adminCandidateList');
const adminStatus = document.getElementById('adminStatus');

function setStatus(message, type = 'success') {
    adminStatus.className = `admin-status ${type}`;
    adminStatus.textContent = message;
}

function resetForm() {
    document.getElementById('candidateId').value = '';
    document.getElementById('candidateName').value = '';
    document.getElementById('candidateParty').value = '';
    document.getElementById('candidateImage').value = '';
}

async function fetchCandidates() {
    const response = await fetch('/candidates');
    if (!response.ok) {
        throw new Error('Failed to load candidates');
    }
    return response.json();
}

function renderCandidates(candidates) {
    if (!candidates.length) {
        adminCandidateList.innerHTML = '<p class="empty-state">No candidates yet.</p>';
        return;
    }

    adminCandidateList.innerHTML = candidates
        .map(
            (candidate) => `
            <article class="candidate-card">
                <img src="${candidate.imageUrl}" alt="${candidate.name}" class="candidate-image" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'" />
                <div class="candidate-info">
                    <h3>${candidate.name}</h3>
                    <p>${candidate.party}</p>
                    <div class="admin-actions">
                        <button class="btn btn-primary" onclick="editCandidate('${candidate.id}', '${candidate.name.replace(/'/g, "\\'")}', '${candidate.party.replace(/'/g, "\\'")}', '${candidate.imageUrl.replace(/'/g, "\\'")}')">Edit</button>
                        <button class="btn btn-secondary" onclick="removeCandidate('${candidate.id}')">Delete</button>
                    </div>
                </div>
            </article>
        `
        )
        .join('');
}

window.editCandidate = function (id, name, party, imageUrl) {
    document.getElementById('candidateId').value = id;
    document.getElementById('candidateName').value = name;
    document.getElementById('candidateParty').value = party;
    document.getElementById('candidateImage').value = imageUrl;
    setStatus('Editing candidate. Update details and click Save Candidate.', 'success');
};

window.removeCandidate = async function (id) {
    try {
        const response = await fetch(`/candidates/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Delete failed');
        }
        setStatus('Candidate deleted successfully.');
        await loadAdminCandidates();
    } catch (error) {
        setStatus('Unable to delete candidate.', 'error');
    }
};

async function loadAdminCandidates() {
    try {
        const candidates = await fetchCandidates();
        renderCandidates(candidates);
    } catch (error) {
        adminCandidateList.innerHTML = '<p class="error-state">Failed to load candidates from MongoDB.</p>';
        setStatus('Could not connect to candidate service.', 'error');
    }
}

candidateForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('candidateId').value;
    const payload = {
        name: document.getElementById('candidateName').value.trim(),
        party: document.getElementById('candidateParty').value.trim(),
        imageUrl: document.getElementById('candidateImage').value.trim()
    };

    try {
        const response = await fetch(id ? `/candidates/${id}` : '/candidates', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Save failed');
        }

        setStatus(id ? 'Candidate updated successfully.' : 'Candidate added successfully.');
        resetForm();
        await loadAdminCandidates();
    } catch (error) {
        setStatus('Unable to save candidate. Check all fields and try again.', 'error');
    }
});

document.getElementById('resetBtn').addEventListener('click', () => {
    resetForm();
    setStatus('Form reset.');
});

loadAdminCandidates();
