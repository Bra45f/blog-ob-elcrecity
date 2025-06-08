const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require("express-rate-limit");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Папка для сохранения
  },
  filename: (req, file, cb) => {
    // Уникальное имя: текущая дата + оригинальное имя
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP
  standardHeaders: true,
  legacyHeaders: false,
  message: "Слишком много запросов. Повторите позже."
});

const upload = multer({ storage: storage });

const app = express();
const port = 3000;

// Хранилище файлов



app.use(express.json({ limit: '15mb' })); 
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'adminsecret secret-key', resave: false, saveUninitialized: true }));
app.use(limiter);

app.use(express.static(path.join(__dirname, 'views')));

['register', 'login', 'profile', 'comments', 'admin', 'forum'].forEach(route => {
  app.get(`/${route}`, (req, res) => res.sendFile(path.join(__dirname, `public/${route}.html`)));
});


// Подключаем БД
const db = new sqlite3.Database('ratings.db', (err) => {
  if (err) return console.error('Ошибка при подключении к БД:', err.message);
  console.log('Подключено к БД ratings.db');
});

// Создаем БД
const tables = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT
)`,
  `CREATE TABLE IF NOT EXISTS blogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    content TEXT,
    author TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_id INTEGER,
    user_id INTEGER,
    text TEXT NOT NULL,
    FOREIGN KEY (blog_id) REFERENCES blogs(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    UNIQUE(blog_id, user_id),
    FOREIGN KEY (blog_id) REFERENCES blogs(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    username TEXT UNIQUE,
    password TEXT,
    secret_key TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS forum_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    tags TEXT,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

`CREATE TABLE IF NOT EXISTS forum_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    answer TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`
];



db.serialize(() => {
  tables.forEach(sql => db.run(sql, err => {
    if (err) console.error('Ошибка создания таблицы:', err.message);
  }));
});

const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'nikitaskavrenuk6@gmail.com',
          pass: 'mprv wyfm ejpx jspv'
        }
      });




// Маршрут для регистрации администратора
app.post('/api/admin/register', (req, res) => {
    const { email, username, password } = req.body;
    const secretKey = Math.floor(100000 + Math.random() * 900000).toString();
 
    function isPasswordValid(password) {
  const minLength = 8;
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;
  return password.length >= minLength && regex.test(password);
}

    if (!isPasswordValid(password)) {
    return res.status(400).json({ message: 'Пароль слишком простой. Используйте заглавные, строчные буквы, цифры и спецсимволы.' });
  }

    const insert = `INSERT INTO admins (email, username, password, secret_key) VALUES (?, ?, ?, ?)`;
    db.run(insert, [email, username, password, secretKey], function (err) {
      if (err) {
        console.error('Ошибка при регистрации администратора:', err.message);
        return res.status(500).json({ message: 'Ошибка регистрации администратора' });
      }

      // Создание текстового файла с данными
      const fileContent = `Ваш аккаунт администратора:\n\nEmail: ${email}\nUsername: ${username}\nPassword: ${password}\nSecret Key: ${secretKey}`;
      const filePath = path.join(__dirname, `../admin_${username}_info.txt`);
      fs.writeFileSync(filePath, fileContent);

      // Настройка письма
      const mailOptions = {
        from: 'nikitaskavrenuk6@gmail.com',
        to: email,
        subject: 'Ваши регистрационные данные',
        text: 'Во вложении находятся данные вашего администратора.',
        attachments: [
          {
            filename: `admin_${username}_info.txt`,
            path: filePath
          }
        ]
      };

      transporter.sendMail(mailOptions, (error, info) => {
        fs.unlink(filePath, () => {}); // Удаление файла после отправки

        if (error) {
          console.error('Ошибка при отправке email:', error);
          return res.status(500).json({ message: 'Ошибка отправки письма' });
        }

        res.status(200).json({ message: 'Администратор зарегистрирован. Данные отправлены на email.' });
      });
    });
 });

// Маршрут для входа администратора
app.post('/api/admin/login', (req, res) => {
  const { username, password, secret_key } = req.body;
  db.get(`SELECT * FROM admins WHERE username = ? AND password = ? AND secret_key = ?`,
    [username, password, secret_key],
    (err, row) => {
      if (err || !row) return res.status(401).json({ message: 'Неверные данные' });
      req.session.admin = { id: row.id, username: row.username, isAdmin: true };
  
      res.json({ message: 'Успешный вход' });
    });
});

// Проверка сессии
app.get('/api/admin/session', (req, res) => {
  if (req.session.admin) {
    res.json({ loggedIn: true, username: req.session.admin.username, isAdmin: true });
  } else {
    res.json({ loggedIn: false });
  }
});

function checkAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ message: 'Не авторизован' });
}


// Получение админитраторов
app.get('/api/admin/list', (req, res) => {
  db.all('SELECT id, username, email FROM admins', (err, rows) => {
    if (err) return res.status(500).json({ message: 'Ошибка при получении админов' });
    res.json(rows);
  });
});

// Удаление админа
app.delete('/api/admin/:id', (req, res) => {
  const id = req.params.id;

  // Сначала получим email удаляемого админа
  db.get('SELECT email, username FROM admins WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(500).json({ message: 'Ошибка при получении администратора' });

    const { email, username } = row;

    // Удалим администратора
    db.run('DELETE FROM admins WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ message: 'Ошибка при удалении администратора' });

        const mailOptions = {
        from: 'nikitaskavrenuk6@gmail.com',
        to: email,
        subject: 'Удаление учетной записи администратора',
        text: `Здравствуйте, ${username}!\n\nВы больше не являетесь администратором на нашем сайте.\n\nС уважением,\nАдминистрация сайта`
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('Ошибка при отправке письма:', err);
        }
      });

      res.json({ message: 'Администратор удалён и уведомлён по почте' });
    });
  });
});
// Регистрация
app.post('/api/register', (req, res) => {
    const { email, username, password } = req.body;

    // Проверки
    if (!email || !username || !password) {
        return res.status(400).json({ success: false, message: 'Все поля обязательны' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;
    if (!emailPattern.test(email)) {
        return res.status(400).json({ success: false, message: 'Некорректный email' });
    }

    if (username.length < 3) {
        return res.status(400).json({ success: false, message: 'Имя пользователя слишком короткое' });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль слишком короткий' });
    }

    if (!passwordPattern.test(password)) {
        return res.status(400).json({ success: false, message: 'Пароль слишком простой. Используйте заглавные, строчные буквы, цифры и спецсимволы.' });
    }

    db.run(`INSERT INTO users (email, username, password) VALUES (?, ?, ?)`, [email, username, password], function(err) {
        if (err) return res.json({ success: false, message: 'Ошибка регистрации' });
        res.json({ success: true, message: 'Новый пользователь зарегистрирован' });
    });
});

// Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body; // login — это либо email, либо username

    db.get(
        `SELECT id, username FROM users 
         WHERE (username = ? OR email = ?) AND password = ?`,
        [login, login, password],
        (err, user) => {
            if (err || !user) {
                return res.json({ success: false, message: 'Неверные учетные данные' });
            }

            req.session.user = user;
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.isAdmin = user.isAdmin;

            res.json({ success: true, message: 'Добро пожаловать!' });
        }
    );
});

// Проверка сессии
app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      id: req.session.userId, 
      username: req.session.username,
      isAdmin: req.session.isAdmin || false,
      loggedIn: true
    });
  } else {
    res.json({ loggedIn: false });
  }
});



// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Добавление комментария
app.post('/api/comments', (req, res) => {
  const { blogId, userId, comment } = req.body;
  const timestamp = new Date().toISOString();

  db.run('INSERT INTO comments (blog_id, user_id, comment, timestamp) VALUES (?, ?, ?, ?)',
    [blogId, userId, comment, timestamp],
    function (err) {
      if (err) return res.status(500).send('Ошибка при добавлении комментария');
      res.json('/blog/' + blogId);
    }
  );
});

// Получение всех комментариев
app.get('/api/comments', (req, res) => {
    db.all('SELECT comments.comment, users.username FROM comments JOIN users ON comments.user_id = users.id', [], (err, rows) => {
        if (err) return res.json({ success: false, message: 'Ошибка загрузки комментариев' });
        res.json(rows);
    });
});

app.put('/api/blogs/:id/comments/:commentId', checkAuth, (req, res) => {
  const blogId = req.params.id;
  const commentId = req.params.commentId;
  const userId = req.session.user.id;
  const { content } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({ message: 'Комментарий не может быть пустым' });
  }

  const sql = `UPDATE comments SET content = ? WHERE id = ? AND blog_id = ? AND user_id = ?`;

  db.run(sql, [content, commentId, blogId, userId], function(err) {
    if (err) {
      console.error('Ошибка при обновлении комментария:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (this.changes === 0) {
      return res.status(403).json({ message: 'Нет доступа или комментарий не найден' });
    }

    res.json({ message: 'Комментарий обновлён' });
  });
});

app.delete('/api/blogs/:id/comments/:commentId', (req, res) => {
  const blogId = req.params.id;
  const commentId = req.params.commentId;

  if (req.session.admin) {
    // Админ — может удалить любой комментарий
    db.run(`DELETE FROM comments WHERE id = ? AND blog_id = ?`, [commentId, blogId], function(err) {
      if (err) {
        console.error('Ошибка при удалении комментария админом:', err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      return res.json({ message: 'Комментарий удалён администратором' });
    });
  } else if (req.session.user) {
    // Пользователь может удалить только свой комментарий
    const userId = req.session.user.id;

    db.run(`DELETE FROM comments WHERE id = ? AND blog_id = ? AND user_id = ?`, [commentId, blogId, userId], function(err) {
      if (err) {
        console.error('Ошибка при удалении комментария:', err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      if (this.changes === 0) {
        return res.status(403).json({ message: 'Нет доступа или комментарий не найден' });
      }

      return res.json({ message: 'Комментарий удалён' });
    });
  } else {
    return res.status(401).json({ message: 'Не авторизован' });
  }
});


app.delete('/api/forum/questions/:questionId', (req, res) => {
  const questionId = req.params.questionId;

  if (!req.session.admin) {
    return res.status(403).json({ message: 'Нет доступа' });
  }

  db.run(`DELETE FROM forum_questions WHERE id = ?`, [questionId], function(err) {
    if (err) {
      console.error('Ошибка при удалении вопроса:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Также удалим ответы, связанные с этим вопросом
    db.run(`DELETE FROM forum_answers WHERE question_id = ?`, [questionId], function(err2) {
      if (err2) {
        console.error('Ошибка при удалении ответов к вопросу:', err2);
        return res.status(500).json({ message: 'Ошибка при удалении ответов' });
      }

      res.json({ message: 'Вопрос и связанные ответы удалены' });
    });
  });
});



app.post('/api/ratings', (req, res) => {
  const { blogId, userId, rating } = req.body;

  db.run(`INSERT INTO ratings (blog_id, user_id, rating)
    VALUES (?, ?, ?)
    ON CONFLICT(blog_id, user_id) DO UPDATE SET rating = excluded.rating`,
[blogId, userId, rating],
    function (err) {
      if (err) return res.status(500).send('Ошибка при добавлении рейтинга');
      res.json('/blog/' + blogId);
    }
  );
});



// Загрузка модуля multer для загрузки файлов

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    next();
}


// Создание вопроса
app.post('/estions', upload.single('image'), (req, res) => {
    const { title, description } = req.body;
    const image = req.file ? req.file.filename : null;
    const userId = req.session.userId;
    db.run(`INSERT INTO forum_questions (title, description, image, user_id) VALUES (?, ?, ?, ?)`,
        [title, description, image, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
});

// Добавление ответа
app.post('/api/forum/answers', (req, res) => {
    const { question_id, answer } = req.body;
    const userId = req.session.userId;
    db.run(`INSERT INTO forum_answers (question_id, answer, user_id) VALUES (?, ?, ?)`,
        [question_id, answer, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
});

app.get('/api/forum/questions', (req, res) => {
    db.all(`SELECT q.*, u.username FROM forum_questions q
            JOIN users u ON q.user_id = u.id
            ORDER BY q.created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.get('/api/forum/questions/:id', (req, res) => {
  const questionId = req.params.id;

  db.get(`SELECT q.*, u.username FROM forum_questions q
          JOIN users u ON q.user_id = u.id
          WHERE q.id = ?`, [questionId], (err, question) => {
    if (err) {
      console.error('Ошибка при получении вопроса:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!question) {
      console.log('Вопрос не найден');
      return res.status(404).json({ error: "Вопросы не найдены" });
    }

    db.all(`SELECT a.*, u.username FROM forum_answers a
            JOIN users u ON a.user_id = u.id
            WHERE a.question_id = ? ORDER BY a.created_at`, [questionId], (err2, answers) => {
      if (err2) {
        console.error('Ошибка при получении ответов:', err2);
        return res.status(500).json({ error: err2.message });
      }

      res.json({ question, answers });
    });
  });
});

app.post('/api/forum/questions', upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const tags = JSON.parse(req.body.selectedTags || '[]');

  if (!req.session.user) return res.status(401).send("Unauthorized");

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const db = new sqlite3.Database('ratings.db');

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO forum_questions (title, description, tags, image, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [title, description, tags.join(','), imagePath, req.session.user.id],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("Ошибка при добавлении вопроса:", err);
    res.status(500).send("Ошибка при добавлении вопроса");
  } finally {
    db.close();
  }
});




app.delete('/api/forum/questions/:id', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });

  const questionId = req.params.id;
  const userId = req.session.user.id;

  // Проверяем, что пользователь — автор вопроса
  db.get('SELECT * FROM forum_questions WHERE id = ?', [questionId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Вопрос не найден' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Нет прав на удаление' });

    // Удаляем вопрос
    db.run('DELETE FROM forum_questions WHERE id = ?', [questionId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Вопрос удалён' });
    });
  });
});


app.delete('/api/forum/questions/:id', (req, res) => {
  if (!req.session.admin) return res.status(403).json({ message: 'Доступ запрещён' });

  const questionId = req.params.id;

  // Удалить сначала ответы к вопросу, затем сам вопрос
  db.run('DELETE FROM forum_answers WHERE question_id = ?', [questionId], function(err) {
    if (err) return res.status(500).json({ message: 'Ошибка при удалении ответов' });

    db.run('DELETE FROM forum_questions WHERE id = ?', [questionId], function(err) {
      if (err) return res.status(500).json({ message: 'Ошибка при удалении вопроса' });
      res.json({ message: 'Вопрос и связанные ответы удалены' });
    });
  });
});

app.post('/api/forum/:id/answers', (req, res) => {
  const questionId = req.params.id;
  const { answer } = req.body;
  const userId = req.session.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Пользователь не авторизован' });
  }

  if (!answer || answer.trim() === '') {
    return res.status(400).json({ message: 'Ответ не может быть пустым' });
  }

  // Очистка от потенциально опасного HTML/JS
  const cleanAnswer = sanitizeHtml(answer.trim(), {
     allowedTags: ['b', 'i', 'em', 'strong', 'br'],        // можно разрешить теги, например ['b', 'i', 'br']
    allowedAttributes: {}   // и их атрибуты, если нужно
  });

  const sql = `INSERT INTO forum_answers (question_id, answer, user_id) VALUES (?, ?, ?)`;

  db.run(sql, [questionId, cleanAnswer, userId], function(err) {
    if (err) {
      console.error('Ошибка при добавлении ответа:', err.message);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    res.status(201).json({ message: 'Ответ добавлен', answerId: this.lastID });
  });
});

// Удаление ответа на вопрос форума
app.delete('/api/forum/answers/:id', (req, res) => {
  const answerId = req.params.id;

  if (!req.session.user && !req.session.admin) {
    return res.status(401).json({ message: 'Не авторизован' });
  }

  const userId = req.session.user ? req.session.user.id : null;
  const isAdmin = !!req.session.admin;

  if (isAdmin) {
    // Админ может удалять любой ответ
    db.run('DELETE FROM forum_answers WHERE id = ?', [answerId], function(err) {
      if (err) {
        console.error('Ошибка при удалении ответа админом:', err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Ответ не найден' });
      }
      res.json({ message: 'Ответ удалён администратором' });
    });
  } else {
    // Пользователь может удалять только свои ответы
    db.run('DELETE FROM forum_answers WHERE id = ? AND user_id = ?', [answerId, userId], function(err) {
      if (err) {
        console.error('Ошибка при удалении ответа пользователем:', err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      if (this.changes === 0) {
        return res.status(403).json({ message: 'Нет доступа или ответ не найден' });
      }
      res.json({ message: 'Ответ удалён' });
    });
  }
});


app.get('/api/admin/comments', (req, res) => {
  const blogId = req.query.blogId;
  if (!blogId) return res.status(400).json({ error: 'Отсутствует blogId' });

  db.all(`
  SELECT comments.id, users.username, comments.text 
  FROM comments 
  JOIN users ON comments.user_id = users.id
  WHERE comments.blog_id = ?
`, [blogId], (err, rows) => {
    if (err) {
      console.error('Ошибка при получении комментариев:', err);
      return res.status(500).json({ error: 'Ошибка сервера', details: err.message });
    }
    res.json(rows);
  });
});



app.delete('/api/admin/comments/:commentId', (req, res) => {
  if (!req.session.admin || !req.session.admin.isAdmin) {
    return res.status(403).json({ message: 'Нет доступа — требуется администратор' });
  }

  const commentId = req.params.commentId;

  db.run(`DELETE FROM comments WHERE id = ?`, [commentId], function(err) {
    if (err) {
      console.error('Ошибка при удалении комментария админом:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }

    res.json({ message: 'Комментарий удалён администратором' });
  });
});

app.delete('/api/admin/forum/answers/:id', (req, res) => {
  const answerId = req.params.id;
  // Можно дополнительно проверять, что пользователь - админ (через сессию)

  db.run('DELETE FROM forum_answers WHERE id = ?', [answerId], function(err) {
    if (err) {
      console.error('Ошибка при удалении ответа:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ответ не найден' });
    }
    res.json({ message: 'Ответ успешно удалён' });
  });
});


app.get('/api/blogs', (req, res) => {
  db.all('SELECT * FROM blogs ORDER BY datetime(created_at) DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Добавление блога
app.post('/api/blogs', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ message: 'Не авторизован' });

  const { title, description, content } = req.body;
  const author = req.session.admin.username;
  const createdAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD


  db.run(
    'INSERT INTO blogs (title, description, content, author, created_at) VALUES (?, ?, ?, ?, ?)',
    [title, description, content, author, createdAt],
    function (err) {
      if (err) return res.status(500).json({ message: 'Ошибка при добавлении блога' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Оценка блога
app.post('/api/blogs/:id/ratings', (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
  }

  const blogId = req.params.id;
  const userId = req.session.userId;
  const rating = parseInt(req.body.rating);

  db.run('INSERT INTO ratings (blog_id, user_id, rating) VALUES (?, ?, ?) ON CONFLICT(blog_id, user_id) DO UPDATE SET rating = excluded.rating', [blogId, userId, rating], function(err) {
      if (err) {
          res.status(500).json({ error: err.message });
      } else {
          res.json({ success: true });
      }
  });
});


// Получение средней оценки
app.get('/api/blogs/:id/average_rating', (req, res) => {
  const blogId = req.params.id;
  db.get('SELECT AVG(rating) AS average_rating FROM ratings WHERE blog_id = ?', [blogId], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
      } else {
          res.json({ average_rating: row.average_rating });
      }
  });
});

// Функция изменения оценки
app.get('/api/blogs/:id/user_rating', (req, res) => {
  if (!req.session.userId) {
      return res.json({ rating: null });
  }

  const blogId = req.params.id;
  const userId = req.session.userId;

  
db.get('SELECT rating FROM ratings WHERE blog_id = ? AND user_id = ?', [blogId, userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ rating: row ? row.rating : null });
  });
});

// удаление оценки

app.delete('/api/blogs/:id/ratings', (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
  }

  const blogId = req.params.id;
  const userId = req.session.userId;

  db.run('DELETE FROM ratings WHERE blog_id = ? AND user_id = ?', [blogId, userId], function(err) {
      if (err) {
          return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
  });
});

app.delete('/api/admin/blogs/:id/comments/:commentId', (req, res) => {
  if (!req.session.admin || !req.session.admin.isAdmin) {
    return res.status(403).json({ message: 'Доступ запрещён' });
  }

  const blogId = req.params.id;
  const commentId = req.params.commentId;

  const sql = `DELETE FROM comments WHERE id = ? AND blog_id = ?`;

  db.run(sql, [commentId, blogId], function(err) {
    if (err) {
      console.error('Ошибка при удалении комментария администратором:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }

    res.json({ message: 'Комментарий удалён администратором' });
  });
});


// Добавление комментария
app.post('/api/blogs/:id/comments', checkAuth, (req, res) => {
  const blogId = req.params.id;
  const userId = req.session.user.id;
  const text = sanitizeHtml(req.body.text.trim());

  if (!text) return res.status(400).json({ message: 'Комментарий не может быть пустым' });

  db.run(`INSERT INTO comments (blog_id, user_id, text) VALUES (?, ?, ?)`, [blogId, userId, text], function(err) {
    if (err) return res.status(500).json({ message: 'Ошибка добавления комментария' });
    res.status(200).json({ message: 'Комментарий добавлен' });
  });
});



// Получение всех комментариев для блога
app.get('/api/blogs/:id/comments', (req, res) => {
  const blogId = req.params.id;
  db.all(`
    SELECT users.username, comments.text
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE blog_id = ?
  `, [blogId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Ошибка загрузки комментариев' });
    res.json(rows);
  });
});
app.put('/api/blogs/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, content} = req.body;

  if (title !== undefined)
    db.run('UPDATE blogs SET title = ? WHERE id = ?', [title, id]);

  if (content !== undefined)
    db.run('UPDATE blogs SET content = ? WHERE id = ?', [content, id]);

  if (description !== undefined)
    db.run('UPDATE blogs SET description = ? WHERE id = ?', [description, id]);

  res.json({ success: true });
});


app.delete('/api/blogs/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM blogs WHERE id = ?', id, err => {
    if (err) return res.status(500).json({ error: err.message });

    
      res.json({ success: true });
    });
  });


app.get('/api/blogs/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM blogs WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});
app.use(bodyParser.json());

app.listen(port, () => {
 console.log(`Сервер запущен на http://localhost:${port}`);
});
