async function checkSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (!data.loggedIn) {
        window.location.href = '/login';
        return;
    }
    document.getElementById('welcome').innerText = `Привет, ${data.username}`;
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', checkSession);