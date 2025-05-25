let quill, editQuill;
let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Проверка сессии администратора
  const res = await fetch('/api/admin/session');
  const data = await res.json();

  if (!data.loggedIn) {
    window.location.href = 'loginadmin.html';
    return;
  }

  document.getElementById('welcomeMessage').innerText = `Добро пожаловать, ${data.username}!`;
  document.getElementById('logoutButton').style.display = 'inline-block';
  document.getElementById('addBlogForm').style.display = 'block';
  
});
function openEditFromId(id) {
  const blog = blogContents[id];
  openEdit(id, blog.title, blog.description, blog.content);
}
  // Инициализация редакторов
  quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Введите текст блога...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ header: [1, 2, 3, false] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['image', 'link'],
        ['clean']
      ]
    }
  });

  editQuill = new Quill('#editEditor', {
    theme: 'snow',
    placeholder: 'Редактируйте текст блога...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ header: [1, 2, false] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });

  fetchBlogs();

// Выход
async function logout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    window.location.href = 'loginadmin.html';
  }
}

// Получение блогов
const blogContents = {}; // Хранилище контента по ID

async function fetchBlogs() {
  const res = await fetch('/api/blogs');
  const blogs = await res.json();
  const container = document.getElementById('blogs');
  container.innerHTML = '';

  blogs.forEach(blog => {
    // Сохраняем контент отдельно, чтобы не вставлять HTML в onclick
    blogContents[blog.id] = {
      title: blog.title,
      description: blog.description,
      content: blog.content
    };

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
      <h4 style="color: #333; margin-top: 0; margin-bottom: 10px;">${blog.title}</h4>
      <p style="color: #666; margin-bottom: 15px;"><b>Описание:</b> ${blog.description || ''}</p>
      <p><b>Автор:</b> ${blog.author || 'неизвестен'}</p>
      <button class="nondelbtm" onclick="openBlog(${blog.id})">Открыть</button>
      <button class="nondelbtm" onclick="openEditFromId(${blog.id})">Изменить</button>
      <button class="delbtm" onclick="deleteBlog(${blog.id})">Удалить</button>
    `;
    container.appendChild(div);
  });
}

// Добавление блога
async function addBlog() {
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const content = quill.root.innerHTML;

  await fetch('/api/blogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, description })
  });

  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  quill.root.innerHTML = '';
  fetchBlogs();
}

// Открытие редактора
function openEdit(id, title, description, content) {
  editingId = id;
  document.getElementById('editTitle').value = title;
  document.getElementById('editDescription').value = description;
  editQuill.root.innerHTML = content;
  document.getElementById('editModal').style.display = 'block';
  document.getElementById('editModal').scrollIntoView({ behavior: 'smooth' });
}

// Сохранение изменений
async function saveEdit() {
  const title = document.getElementById('editTitle').value;
  const description = document.getElementById('editDescription').value;
  const content = editQuill.root.innerHTML;

  await fetch(`/api/blogs/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, content })
  });

  closeEdit();
  fetchBlogs();
}

// Закрытие модального окна
function closeEdit() {
  editingId = null;
  document.getElementById('editModal').style.display = 'none';
}

// Удаление блога
function deleteBlog(id) {
  if (confirm('Вы уверены, что хотите удалить этот блог? Это действие необратимо.')) {
    fetch(`/api/blogs/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('Блог удален');
          fetchBlogs();
        }
      });
  }
}

// Открытие блога
function openBlog(id) {
  window.open(`/blogadmin.html?id=${id}`, '_blank');
}