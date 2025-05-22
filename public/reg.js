async function register() {
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Клиентская валидация
    if (!email || !username || !password) {
        alert('Пожалуйста, заполните все поля.');
        return;
    }

    // Проверка email регуляркой
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('Введите корректный email.');
        return;
    }

    if (username.length < 3) {
        alert('Имя пользователя должно быть минимум 3 символа.');
        return;
    }

    if (password.length < 6) {
        alert('Пароль должен быть минимум 6 символов.');
        return;
    }

    // Если всё ок, отправляем на сервер
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        alert(data.message);
        if (data.success) window.location.href = '/login';
    } catch (e) {
        console.error('Ошибка парсинга JSON:', text);
    }
}
