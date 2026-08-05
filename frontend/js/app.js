document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8080/api';
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const btnRefresh = document.getElementById('btn-refresh-turfs');

    // Check Backend Connectivity
    async function checkBackendHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
            if (response.ok) {
                statusDot.classList.remove('disconnected');
                statusDot.classList.add('connected');
                statusText.textContent = 'Backend Connected';
            } else {
                setDisconnectedState();
            }
        } catch (error) {
            setDisconnectedState();
        }
    }

    function setDisconnectedState() {
        statusDot.classList.remove('connected');
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Backend Disconnected';
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            checkBackendHealth();
        });
    }

    // Initial check
    checkBackendHealth();
});
