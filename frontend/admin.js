const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
if (currentUser.role !== 'admin') {
    window.location.href = 'admin-login.html';
}

const logoutBtn = document.getElementById('adminLogoutBtn');
const candidateForm = document.getElementById('candidateForm');
const adminCandidateList = document.getElementById('adminCandidateList');
const adminStatus = document.getElementById('adminStatus');
const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
const toggleElectionBtn = document.getElementById('toggleElectionBtn');
const resetVotesBtn = document.getElementById('resetVotesBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');

let selectedImageData = '';
let latestAnalytics = null;

if (logoutBtn) {
    logoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

function setStatus(message, type = 'success') {
    adminStatus.className = `admin-status ${type}`;
    adminStatus.textContent = message;
}

function resetForm() {
    document.getElementById('candidateId').value = '';
    document.getElementById('candidateName').value = '';
    document.getElementById('candidateParty').value = '';
    document.getElementById('candidateImage').value = '';
    selectedImageData = '';
}

async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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
                <img src="${candidate.imageData}" alt="${candidate.name}" class="candidate-image" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'" />
                <div class="candidate-info">
                    <h3>${candidate.name}</h3>
                    <p>${candidate.party}</p>
                    <div class="admin-actions">
                        <button class="btn btn-primary" onclick="editCandidate('${candidate.id}', '${candidate.name.replace(/'/g, "\\'")}', '${candidate.party.replace(/'/g, "\\'")}')">Edit</button>
                        <button class="btn btn-secondary" onclick="removeCandidate('${candidate.id}')">Delete</button>
                    </div>
                </div>
            </article>
        `
        )
        .join('');
}

function renderAnalyticsTable(data) {
    const analyticsTable = document.getElementById('analyticsTable');
    if (!data.candidateBreakdown.length) {
        analyticsTable.innerHTML = '<p class="empty-state">No candidate analytics available yet.</p>';
        return;
    }

    const rows = data.candidateBreakdown
        .map(
            (row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${row.name}</td>
                <td>${row.party}</td>
                <td>${row.totalVotes}</td>
            </tr>
        `
        )
        .join('');

    analyticsTable.innerHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Candidate</th>
                    <th>Party</th>
                    <th>Total Votes</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function updateAnalyticsUi(data) {
    document.getElementById('totalVoters').textContent = data.totalVoters;
    document.getElementById('totalVotes').textContent = data.totalVotes;
    document.getElementById('turnoutPercent').textContent = `${data.turnoutPercent}%`;
    document.getElementById('electionStatus').textContent = data.isElectionOpen ? 'Open' : 'Closed';
    toggleElectionBtn.textContent = data.isElectionOpen ? 'Close Election' : 'Open Election';

    const leadingCandidate = document.getElementById('leadingCandidate');
    if (data.leadingCandidate) {
        leadingCandidate.textContent = `Leading: ${data.leadingCandidate.name} (${data.leadingCandidate.party}) with ${data.leadingCandidate.totalVotes} votes.`;
    } else {
        leadingCandidate.textContent = 'No leading candidate yet. Votes have not been cast.';
    }

    renderAnalyticsTable(data);
}

async function loadAnalytics() {
    try {
        const response = await fetch('/admin/analytics');
        if (!response.ok) {
            throw new Error('Unable to load analytics');
        }
        latestAnalytics = await response.json();
        updateAnalyticsUi(latestAnalytics);
    } catch (error) {
        setStatus('Failed to load analytics.', 'error');
    }
}

window.editCandidate = function (id, name, party) {
    document.getElementById('candidateId').value = id;
    document.getElementById('candidateName').value = name;
    document.getElementById('candidateParty').value = party;
    document.getElementById('candidateImage').value = '';
    selectedImageData = '';
    setStatus('Editing candidate. Upload new image only if replacing existing one.', 'success');
};

window.removeCandidate = async function (id) {
    try {
        const response = await fetch(`/candidates/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Delete failed');
        }
        setStatus('Candidate deleted successfully.');
        await Promise.all([loadAdminCandidates(), loadAnalytics()]);
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

const candidateImageInput = document.getElementById('candidateImage');
candidateImageInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
        selectedImageData = '';
        return;
    }

    try {
        selectedImageData = await fileToDataUrl(file);
        setStatus('Image selected successfully.');
    } catch (error) {
        selectedImageData = '';
        setStatus('Unable to read selected image file.', 'error');
    }
});

candidateForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('candidateId').value;
    const payload = {
        name: document.getElementById('candidateName').value.trim(),
        party: document.getElementById('candidateParty').value.trim()
    };

    if (selectedImageData) {
        payload.imageData = selectedImageData;
    }

    if (!id && !payload.imageData) {
        setStatus('Please upload a candidate image.', 'error');
        return;
    }

    try {
        const response = await fetch(id ? `/candidates/${id}` : '/candidates', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Save failed');
        }

        setStatus(id ? 'Candidate updated successfully.' : 'Candidate added successfully.');
        resetForm();
        await Promise.all([loadAdminCandidates(), loadAnalytics()]);
    } catch (error) {
        setStatus(error.message || 'Unable to save candidate. Check all fields and try again.', 'error');
    }
});

refreshAnalyticsBtn.addEventListener('click', async () => {
    await loadAnalytics();
    setStatus('Analytics refreshed.');
});

toggleElectionBtn.addEventListener('click', async () => {
    if (!latestAnalytics) {
        return;
    }

    try {
        const response = await fetch('/admin/election/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOpen: !latestAnalytics.isElectionOpen })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Unable to update election status');
        }

        await loadAnalytics();
        setStatus(result.message);
    } catch (error) {
        setStatus(error.message, 'error');
    }
});

resetVotesBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Are you sure you want to reset all votes? This cannot be undone.');
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch('/admin/reset-votes', { method: 'POST' });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Unable to reset votes');
        }

        await loadAnalytics();
        setStatus(`${result.message}. Deleted votes: ${result.deletedCount}`);
    } catch (error) {
        setStatus(error.message, 'error');
    }
});

exportCsvBtn.addEventListener('click', () => {
    if (!latestAnalytics?.candidateBreakdown?.length) {
        setStatus('No analytics data to export.', 'error');
        return;
    }

    const headers = ['Rank', 'Candidate', 'Party', 'Total Votes'];
    const rows = latestAnalytics.candidateBreakdown.map((row, index) => [index + 1, row.name, row.party, row.totalVotes]);
    const csv = [headers, ...rows].map((line) => line.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'election-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);

    setStatus('Analytics CSV exported.');
});

document.getElementById('resetBtn').addEventListener('click', () => {
    resetForm();
    setStatus('Form reset.');
});

loadAdminCandidates();
loadAnalytics();
