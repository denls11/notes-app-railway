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

// Инициализация базы данных
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Простая таблица (без сложных типов)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                important INT DEFAULT 0,
                deleted INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ База данных готова');
        connection.release();
    } catch (error) {
        console.error('❌ Ошибка базы данных:', error.message);
    }
}

// Инициализируем БД при запуске
initDatabase();

// API: Получить все заметки
app.get('/api/notes', async (req, res) => {
    try {
        const { filter = 'all', search = '', sort = 'newest' } = req.query;
        
        let query = 'SELECT * FROM notes WHERE 1=1';
        let params = [];
        
        // Фильтр
        if (filter === 'deleted') {
            query += ' AND deleted = 1';
        } else if (filter === 'important') {
            query += ' AND important = 1 AND deleted = 0';
        } else {
            query += ' AND deleted = 0';
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
            case 'important': query += ' ORDER BY important DESC'; break;
            default: query += ' ORDER BY updated_at DESC';
        }
        
        const [notes] = await pool.execute(query, params);
        
        // Форматируем заметки
        const formattedNotes = notes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags ? JSON.parse(note.tags) : [],
            important: note.important === 1,
            deleted: note.deleted === 1,
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
            'INSERT INTO notes (title, content, tags, important) VALUES (?, ?, ?, ?)',
            [title, content, JSON.stringify(tags), important ? 1 : 0]
        );
        
        res.status(201).json({ 
            id: result.insertId,
            title,
            content,
            tags,
            important,
            message: 'Заметка создана' 
        });
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
            'UPDATE notes SET title = ?, content = ?, tags = ?, important = ? WHERE id = ?',
            [title, content, JSON.stringify(tags), important ? 1 : 0, id]
        );
        
        res.json({ 
            id,
            title,
            content,
            tags,
            important,
            message: 'Заметка обновлена' 
        });
    } catch (error) {
        console.error('Ошибка обновления заметки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: Удалить заметку (в корзину)
app.delete('/api/notes/:id', async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notes SET deleted = 1 WHERE id = ?',
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
            'UPDATE notes SET deleted = 0 WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'Заметка восстановлена' });
    } catch (error) {
        console.error('Ошибка восстановления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: Изменить важность
app.patch('/api/notes/:id/important', async (req, res) => {
    try {
        const { important } = req.body;
        await pool.execute(
            'UPDATE notes SET important = ? WHERE id = ?',
            [important ? 1 : 0, req.params.id]
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
});
