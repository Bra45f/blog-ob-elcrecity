document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/admin/session');
  const data = await res.json();

  if (!data.loggedIn) {
      window.location.href = 'loginadmin.html';
  }

  document.getElementById('welcomeMessage').innerText = `Добро пожаловать, ${data.username}!`;
  document.getElementById('logoutButton').style.display = 'inline-block';
  document.getElementById('addBlogForm').style.display = 'block';

  loadBlogs();
});

// Выход из аккаунта
async function logout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
      window.location.href = 'loginadmin.html';
  }
}

let editingId = null;

    async function fetchBlogs() {
      const res = await fetch('/api/blogs');
      const blogs = await res.json();
      const container = document.getElementById('blogs');
      container.innerHTML = '';

      blogs.forEach(blog => {
        const div = document.createElement('div');
        const date = new Date(blog.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

        div.className = 'blog-card';
        div.innerHTML = `
        <p><b>Дата создания:</b> ${formattedDate}</p>
          <h4 style="color: #333;
    margin-top: 0;
    margin-bottom: 10px;">${blog.title}</h4>
          <p style="color: #666;
    margin-bottom: 15px;"><b>Описание:</b> ${blog.description || ''}</p>
    <p><b>Автор:</b> ${blog.author || 'неизвестен'}</p>
          <button class="fff" onclick="openBlog(${blog.id})">Открыть</button>
          <a href="#editModal"><button class="fff" onclick="openEdit(${blog.id}, \`${blog.title}\`, \`${blog.description || ''}\`, \`${blog.content.replace(/`/g, '\\`')}\`)">Изменить</button></a>
          <button class="fff" onclick="deleteBlog(${blog.id})">Удалить</button>
        `;
        container.appendChild(div);
      });
    }

    async function addBlog() {
      const title = document.getElementById('title').value;
      const description = document.getElementById('description').value;
      const content = document.getElementById('content').value;

      await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, description })
      });

      document.getElementById('title').value = '';
      document.getElementById('description').value = '';
      document.getElementById('content').value = '';
      fetchBlogs();
    }

    function openEdit(id, title, description, content) {
      editingId = id;
      document.getElementById('editTitle').value = title;
      document.getElementById('editDescription').value = description;
      document.getElementById('editContent').value = content;
      document.getElementById('editModal').style.display = 'block';
    }

    async function saveEdit() {
      const title = document.getElementById('editTitle').value;
      const description = document.getElementById('editDescription').value;
      const content = document.getElementById('editContent').value;

      await fetch(`/api/blogs/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, content })
      });

      closeEdit();
      fetchBlogs();
    }

    function closeEdit() {
      editingId = null;
      document.getElementById('editModal').style.display = 'none';
    }

    function deleteBlog(id) {
  if (confirm('Вы уверены, что хотите удалить этот блог? Это действие необратимо.')) {
    fetch(`/api/blogs/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('Блог удален');
          location.reload();
        }
      });
  }
}
    function openBlog(id) {
  window.open(`/blogadmin.html?id=${id}`, '_blank');
}

    fetchBlogs();