async function checkSession() {
    const res = await fetch('/api/session' , { credentials: 'include' });
    const data = await res.json();
    if (!data.loggedIn) {
        window.location.href = '/login';
    }
}

async function sendComment() {
    const comment = document.getElementById('comment').value;
    const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
    });
    alert((await res.json()).message);
    loadComments();
}

async function loadComments() {
    const res = await fetch('/api/comments');
    const comments = await res.json();
    document.getElementById('comments').innerHTML = comments.map(c => `<p><b>${c.username}:</b> ${c.comment}</p>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    loadComments();
});
