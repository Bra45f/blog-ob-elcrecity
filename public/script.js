const blogId = new URLSearchParams(window.location.search).get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!blogId) {
        console.error("blogId не найден в URL");
        return;
    }
    

    await fetchAverageRating();
    await loadComments();
    await loadUserRating();
});

// Универсальный fetch с обработкой ошибок
const fetchJSON = async (url, options = {}) => {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    } catch (err) {
        console.error(`Ошибка запроса к ${url}:`, err);
        throw err;
    }
};

const checkLogin = async () => {
    const data = await fetchJSON('/api/session');
    return data.loggedIn;
};

function updateStars(rating) {
    const stars = document.getElementsByClassName('rating-star');
    for (let i = 0; i < stars.length; i++) {
        stars[i].src = i < rating ? 'IMG-TEST/fi-sr-star2.png' : 'IMG-TEST/fi-rr-star.png';
    }
    document.getElementById('ratingValue').value = rating;
}

function change(id) {
    const rating = document.getElementById(`${id}_hidden`).value;
    updateStars(rating);
}

async function sendComment() {
    if (!await checkLogin()) {
        alert('Пожалуйста, войдите в аккаунт, чтобы оставить комментарий.');
        window.location.href = "/login.html";
        return;
    }

    const comment = document.getElementById('comment').value.trim();
    if (!comment) {
        alert('Комментарий не может быть пустым.');
        return;
    }

    try {
        await fetchJSON(`/api/blogs/${blogId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment })
        });
        document.getElementById('comment').value = '';
        await loadComments();
    } catch {
        alert('Ошибка при отправке комментария.');
    }
}

async function loadComments() {
    try {
        const comments = await fetchJSON(`/api/blogs/${blogId}/comments`);
        const container = document.getElementById('comments');
        container.innerHTML = '';

        comments.forEach(({ username, text }) => {
            const p = document.createElement('p');
            const b = document.createElement('b');
            b.textContent = `${username}: `;
            p.appendChild(b);
            p.appendChild(document.createTextNode(text));

          
            container.appendChild(p);
            
        });
    } catch {
        // Ошибка уже залогирована в fetchJSON
    }
}

async function fetchAverageRating() {
    try {
        const { average_rating } = await fetchJSON(`/api/blogs/${blogId}/average_rating`);
        document.getElementById('averageRating').innerText =
            average_rating !== null ? parseFloat(average_rating).toFixed(1) : "0.0";
    } catch {
        // Ошибка уже залогирована в fetchJSON
    }
}

async function saveRating() {
    if (!await checkLogin()) {
        alert('Пожалуйста, войдите в аккаунт, чтобы оценить блог.');
        window.location.href = "/login.html";
        return;
    }

    const rating = document.getElementById('ratingValue').value;
    if (!rating) {
        alert('Выберите оценку перед отправкой.');
        return;
    }

    try {
        await fetchJSON(`/api/blogs/${blogId}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
        });

        alert('Спасибо за вашу оценку!');
        await fetchAverageRating();
    } catch {
        alert('Ошибка при сохранении рейтинга.');
    }
}

async function loadUserRating() {
    try {
        const { rating } = await fetchJSON(`/api/blogs/${blogId}/user_rating`);

        if (rating !== null) {
            updateStars(rating);
            document.getElementById('ratingButton').innerText = 'Изменить оценку';
            document.getElementById('deleteRatingButton').style.display = 'inline-block';
        } else {
            document.getElementById('ratingButton').innerText = 'Оценить';
            document.getElementById('deleteRatingButton').style.display = 'none';
        }
    } catch {
        // Ошибка уже залогирована в fetchJSON
    }
}

async function deleteRating() {
    if (!await checkLogin()) {
        alert('Войдите, чтобы удалить оценку');
        return;
    }

    try {
        await fetch(`/api/blogs/${blogId}/ratings`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        alert('Оценка удалена');
        document.getElementById('ratingValue').value = '';
        await fetchAverageRating();
        await loadUserRating();
    } catch (error) {
        console.error('Ошибка при удалении оценки:', error);
    }
}
