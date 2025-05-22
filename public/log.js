async function login() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) window.location.href = '/profile';
}
