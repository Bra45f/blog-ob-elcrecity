async function loadBlog() {
    const id = new URLSearchParams(window.location.search).get('id');
    const res = await fetch(`/api/blogs/${id}`);
    const blog = await res.json();
    const date = new Date(blog.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

    document.getElementById('blog').innerHTML = `
    <a href="bloglist.html"><button>Назад</button></a>
    <p><b>Дата создания:</b> ${formattedDate}</p>
      <h1>${blog.title}</h1>
      <p><i>${blog.description}</i></p>
      <div class="formatted-content">${blog.content}</div>
      <h2>Рейтинг</h2>
  <div class="rating">
    <input type="hidden" id="star1_hidden" value="1">
    <img src="IMG-TEST/fi-rr-star.png" onmouseover="change(this.id)" id="star1" class="rating-star">
    
    <input type="hidden" id="star2_hidden" value="2">
    <img src="IMG-TEST/fi-rr-star.png" onmouseover="change(this.id)" id="star2" class="rating-star">
    
    <input type="hidden" id="star3_hidden" value="3">
    <img src="IMG-TEST/fi-rr-star.png" onmouseover="change(this.id)" id="star3" class="rating-star">
    
    <input type="hidden" id="star4_hidden" value="4">
    <img src="IMG-TEST/fi-rr-star.png" onmouseover="change(this.id)" id="star4" class="rating-star">

    <input type="hidden" id="star5_hidden" value="5">
    <img src="IMG-TEST/fi-rr-star.png" onmouseover="change(this.id)" id="star5" class="rating-star">
</div>

<input type="hidden" id="ratingValue" value="0">
<p>Средняя оценка: <span id="averageRating">0</span>⭐</p>
<button id="ratingButton" onclick="saveRating()">Изменить</button>
<button id="deleteRatingButton" onclick="deleteRating()" style="display: none;">Удалить</button>
<hr>

<textarea id="comment" placeholder="Оставьте комментарий"></textarea><br>
<button onclick="sendComment()">Отправить</button>
<hr><h2>Комментарии</h2>
<div id="comments"></div>
<hr>
    `;}loadBlog();