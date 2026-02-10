const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Подключение к базе данных Railway
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Создание таблицы при запуске
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tags JSON,
        is_important BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ База данных готова');
    connection.release();
  } catch (error) {
    console.error('❌ Ошибка базы данных:', error.message);
  }
}

// Инициализация базы данных
initDatabase();

// API: Получить все заметки
app.get('/api/notes', async (req, res) => {
  try {
    const { filter = 'all', search = '', sort = 'newest' } = req.query;
    
    let query = 'SELECT * FROM notes WHERE 1=1';
    let params = [];
    
    // Фильтр
    if (filter === 'deleted') {
      query += ' AND is_deleted = TRUE';
    } else if (filter === 'important') {
      query += ' AND is_important = TRUE AND is_deleted = FALSE';
    } else {
      query += ' AND is_deleted = FALSE';
    }
    
    // Поиск
    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Сортировка
    switch(sort) {
      case 'newest': query += ' ORDER BY updated_at DESC'; break;
      case 'oldest': query += ' ORDER BY updated_at ASC'; break;
      case 'alpha-asc': query += ' ORDER BY title ASC'; break;
      case 'alpha-desc': query += ' ORDER BY title DESC'; break;
      case 'important': query += ' ORDER BY is_important DESC'; break;
      default: query += ' ORDER BY updated_at DESC';
    }
    
    const [notes] = await pool.execute(query, params);
    
    // Преобразуем JSON теги
    const formattedNotes = notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags ? JSON.parse(note.tags) : [],
      important: note.is_important,
      deleted: note.is_deleted,
      createdAt: note.created_at,
      updatedAt: note.updated_at
    }));
    
    res.json(formattedNotes);
  } catch (error) {
    console.error('Ошибка получения заметок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Создать заметку
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content, tags = [], important = false } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Заголовок и текст обязательны' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
      [title, content, JSON.stringify(tags), important]
    );
    
    // Получаем созданную заметку
    const [notes] = await pool.execute('SELECT * FROM notes WHERE id = ?', [result.insertId]);
    
    const note = {
      id: notes[0].id,
      title: notes[0].title,
      content: notes[0].content,
      tags: notes[0].tags ? JSON.parse(notes[0].tags) : [],
      important: notes[0].is_important,
      deleted: notes[0].is_deleted,
      createdAt: notes[0].created_at,
      updatedAt: notes[0].updated_at
    };
    
    res.status(201).json(note);
  } catch (error) {
    console.error('Ошибка создания заметки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Обновить заметку
app.put('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags = [], important = false } = req.body;
    
    await pool.execute(
      'UPDATE notes SET title = ?, content = ?, tags = ?, is_important = ? WHERE id = ?',
      [title, content, JSON.stringify(tags), important, id]
    );
    
    const [notes] = await pool.execute('SELECT * FROM notes WHERE id = ?', [id]);
    
    if (notes.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    const note = {
      id: notes[0].id,
      title: notes[0].title,
      content: notes[0].content,
      tags: notes[0].tags ? JSON.parse(notes[0].tags) : [],
      important: notes[0].is_important,
      deleted: notes[0].is_deleted,
      createdAt: notes[0].created_at,
      updatedAt: notes[0].updated_at
    };
    
    res.json(note);
  } catch (error) {
    console.error('Ошибка обновления заметки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Удалить заметку (в корзину)
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notes SET is_deleted = TRUE WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Заметка перемещена в корзину' });
  } catch (error) {
    console.error('Ошибка удаления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Восстановить из корзины
app.patch('/api/notes/:id/restore', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notes SET is_deleted = FALSE WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Заметка восстановлена' });
  } catch (error) {
    console.error('Ошибка восстановления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Удалить навсегда
app.delete('/api/notes/:id/permanent', async (req, res) => {
  try {
    await pool.execute('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Заметка удалена навсегда' });
  } catch (error) {
    console.error('Ошибка удаления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Изменить важность
app.patch('/api/notes/:id/important', async (req, res) => {
  try {
    const { important } = req.body;
    await pool.execute(
      'UPDATE notes SET is_important = ? WHERE id = ?',
      [important, req.params.id]
    );
    res.json({ message: `Заметка ${important ? 'важная' : 'не важная'}` });
  } catch (error) {
    console.error('Ошибка изменения важности:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Старт сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Сайт: https://localhost:${PORT}`);
});