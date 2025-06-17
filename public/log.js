document.getElementById('togglePassword').addEventListener('click', () => {
  const passwordField = document.getElementById('password');
  const toggleButton = document.getElementById('togglePassword');
  
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggleButton.textContent = 'Скрыть';
  } else {
    passwordField.type = 'password';
    toggleButton.textContent = 'Показать';
  }
});

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
