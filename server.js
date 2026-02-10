const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Подключение к базе данных Railway
console.log('🚀 Запуск сервера заметок...');

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;
let pool;

if (databaseUrl) {
    try {
        const dbUrl = new URL(databaseUrl);
        const config = {
            host: dbUrl.hostname,
            port: parseInt(dbUrl.port) || 3306,
            user: dbUrl.username || 'root',
            password: dbUrl.password || '',
            database: dbUrl.pathname.replace('/', '') || 'railway',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        
        console.log('🔗 Подключение к MySQL:', config.host);
        pool = mysql.createPool(config);
        
    } catch (error) {
        console.error('❌ Ошибка парсинга URL:', error.message);
        pool = null;
    }
} else {
    pool = mysql.createPool({
        host: process.env.MYSQLHOST || 'localhost',
        user: process.env.MYSQLUSER || 'root',
        password: process.env.MYSQLPASSWORD || '',
        database: process.env.MYSQLDATABASE || 'railway',
        port: parseInt(process.env.MYSQLPORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

// Проверка подключения к БД
async function checkDatabaseConnection() {
    if (!pool) {
        console.error('❌ Пул соединений не создан');
        return false;
    }
    
    try {
        const connection = await pool.getConnection();
        console.log('✅ Успешное подключение к MySQL!');
        
        // Создаем таблицу если её нет
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                tags JSON,
                is_important BOOLEAN DEFAULT FALSE,
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        console.log('✅ Таблица notes проверена/создана');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к БД:', error.message);
        return false;
    }
}

// Проверяем подключение при старте
setTimeout(() => {
    checkDatabaseConnection();
}, 2000);

// ==================== API ENDPOINTS ====================

// API: Получить все заметки с фильтрацией
app.get('/api/notes', async (req, res) => {
    console.log('📥 Получение заметок с фильтрами:', req.query);
    
    try {
        if (!pool) {
            return res.status(500).json({ 
                success: false,
                error: 'База данных недоступна' 
            });
        }
        
        const { filter = 'all', search = '', sort = 'newest' } = req.query;
        
        let query = `
            SELECT 
                id, 
                title, 
                content, 
                tags,
                is_important as important,
                is_deleted as deleted,
                created_at,
                updated_at
            FROM notes 
            WHERE 1=1
        `;
        let params = [];
        
        // Фильтр по статусу
        if (filter === 'important') {
            query += ' AND is_important = 1 AND is_deleted = 0';
        } else if (filter === 'deleted') {
            query += ' AND is_deleted = 1';
        } else if (filter === 'all') {
            query += ' AND is_deleted = 0';
        }
        
        // Поиск
        if (search) {
            query += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        // Сортировка
        switch(sort) {
            case 'newest':
                query += ' ORDER BY updated_at DESC';
                break;
            case 'oldest':
                query += ' ORDER BY updated_at ASC';
                break;
            case 'alpha-asc':
                query += ' ORDER BY title ASC';
                break;
            case 'alpha-desc':
                query += ' ORDER BY title DESC';
                break;
            default:
                query += ' ORDER BY updated_at DESC';
        }
        
        const [notes] = await pool.execute(query, params);
        
        console.log(`✅ Отправлено ${notes.length} заметок`);
        res.json(notes);
        
    } catch (error) {
        console.error('❌ Ошибка получения заметок:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Получить одну заметку по ID
app.get('/api/notes/:id', async (req, res) => {
    console.log('📄 Получение заметки:', req.params.id);
    
    try {
        const [rows] = await pool.execute(`
            SELECT 
                id, 
                title, 
                content, 
                tags,
                is_important as important,
                is_deleted as deleted,
                created_at,
                updated_at
            FROM notes WHERE id = ?
        `, [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Заметка не найдена' 
            });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Ошибка получения заметки:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера' 
        });
    }
});

// API: Создать заметку
app.post('/api/notes', async (req, res) => {
    console.log('📝 Создание заметки:', req.body);
    
    try {
        const { title, content, tags = [], important = false } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false,
                error: 'Заголовок и текст обязательны' 
            });
        }
        
        const [result] = await pool.execute(
            'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
            [title, content, JSON.stringify(tags), important ? 1 : 0]
        );
        
        console.log('✅ Заметка создана, ID:', result.insertId);
        
        // Получаем созданную заметку
        const [rows] = await pool.execute(`
            SELECT 
                id, 
                title, 
                content, 
                tags,
                is_important as important,
                is_deleted as deleted,
                created_at,
                updated_at
            FROM notes WHERE id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            note: rows[0],
            message: 'Заметка создана'
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания заметки:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка базы данных',
            details: error.message 
        });
    }
});

// API: Обновить заметку
app.put('/api/notes/:id', async (req, res) => {
    console.log('✏️ Обновление заметки:', req.params.id, req.body);
    
    try {
        const { title, content, tags = [], important = false } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false,
                error: 'Заголовок и текст обязательны' 
            });
        }
        
        await pool.execute(
            'UPDATE notes SET title = ?, content = ?, tags = ?, is_important = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, JSON.stringify(tags), important ? 1 : 0, req.params.id]
        );
        
        console.log('✅ Заметка обновлена');
        
        // Получаем обновлённую заметку
        const [rows] = await pool.execute(`
            SELECT 
                id, 
                title, 
                content, 
                tags,
                is_important as important,
                is_deleted as deleted,
                created_at,
                updated_at
            FROM notes WHERE id = ?
        `, [req.params.id]);
        
        res.json({
            success: true,
            note: rows[0],
            message: 'Заметка обновлена'
        });
    } catch (error) {
        console.error('❌ Ошибка обновления заметки:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Изменить важность заметки
app.patch('/api/notes/:id/important', async (req, res) => {
    console.log('⭐ Изменение важности:', req.params.id, req.body);
    
    try {
        const { important } = req.body;
        
        if (typeof important !== 'boolean') {
            return res.status(400).json({ 
                success: false,
                error: 'Поле important должно быть boolean' 
            });
        }
        
        await pool.execute(
            'UPDATE notes SET is_important = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [important ? 1 : 0, req.params.id]
        );
        
        console.log(`✅ Заметка ${important ? 'отмечена важной' : 'снята с важных'}`);
        
        res.json({ 
            success: true,
            message: `Заметка ${important ? 'важная' : 'не важная'}` 
        });
    } catch (error) {
        console.error('❌ Ошибка изменения важности:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Удалить заметку (в корзину)
app.delete('/api/notes/:id', async (req, res) => {
    console.log('🗑️ Удаление заметки в корзину:', req.params.id);
    
    try {
        await pool.execute(
            'UPDATE notes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [req.params.id]
        );
        
        console.log('✅ Заметка перемещена в корзину');
        
        res.json({ 
            success: true,
            message: 'Заметка перемещена в корзину' 
        });
    } catch (error) {
        console.error('❌ Ошибка удаления:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Удалить заметку навсегда
app.delete('/api/notes/:id/permanent', async (req, res) => {
    console.log('🔥 Удаление заметки навсегда:', req.params.id);
    
    try {
        await pool.execute('DELETE FROM notes WHERE id = ?', [req.params.id]);
        
        console.log('✅ Заметка удалена навсегда');
        
        res.json({ 
            success: true,
            message: 'Заметка удалена навсегда' 
        });
    } catch (error) {
        console.error('❌ Ошибка удаления:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Очистить ВСЕ заметки (обычные + корзина)
app.delete('/api/notes/clear-all', async (req, res) => {
    console.log('🔥🔥 Очистка ВСЕХ заметок');
    
    try {
        if (!pool) {
            return res.status(500).json({ 
                success: false,
                error: 'База данных недоступна' 
            });
        }
        
        const [result] = await pool.execute('DELETE FROM notes');
        
        console.log(`✅ Все заметки удалены, удалено ${result.affectedRows} записей`);
        
        res.json({ 
            success: true,
            message: 'Все заметки удалены',
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('❌ Ошибка очистки:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Восстановить заметку из корзины
app.patch('/api/notes/:id/restore', async (req, res) => {
    console.log('♻️ Восстановление заметки:', req.params.id);
    
    try {
        await pool.execute(
            'UPDATE notes SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [req.params.id]
        );
        
        console.log('✅ Заметка восстановлена');
        
        res.json({ 
            success: true,
            message: 'Заметка восстановлена' 
        });
    } catch (error) {
        console.error('❌ Ошибка восстановления:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Получить корзину
app.get('/api/trash', async (req, res) => {
    console.log('🗑️ Получение корзины');
    
    try {
        const [notes] = await pool.execute(`
            SELECT 
                id, 
                title, 
                content, 
                tags,
                is_important as important,
                is_deleted as deleted,
                created_at,
                updated_at
            FROM notes 
            WHERE is_deleted = 1 
            ORDER BY updated_at DESC
        `);
        
        console.log(`✅ В корзине ${notes.length} заметок`);
        res.json(notes);
    } catch (error) {
        console.error('❌ Ошибка получения корзины:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Очистить корзину (удалить навсегда)
app.delete('/api/trash/clear', async (req, res) => {
    console.log('🔥 Очистка корзины');
    
    try {
        await pool.execute('DELETE FROM notes WHERE is_deleted = 1');
        
        console.log('✅ Корзина очищена');
        
        res.json({ 
            success: true,
            message: 'Корзина очищена' 
        });
    } catch (error) {
        console.error('❌ Ошибка очистки корзины:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка сервера',
            details: error.message 
        });
    }
});

// API: Получить информацию о БД
app.get('/api/db-info', async (req, res) => {
    try {
        if (!pool) {
            return res.json({ 
                status: 'no_pool',
                message: 'Пул соединений не создан'
            });
        }
        
        const [tables] = await pool.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        let notesStructure = [];
        let notesCount = 0;
        
        if (tableNames.includes('notes')) {
            const [structure] = await pool.query("DESCRIBE notes");
            notesStructure = structure;
            
            const [countResult] = await pool.query("SELECT COUNT(*) as count FROM notes");
            notesCount = countResult[0].count;
        }
        
        res.json({
            status: 'connected',
            tables: tableNames,
            notes: {
                exists: tableNames.includes('notes'),
                structure: notesStructure,
                count: notesCount
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message
        });
    }
});

// API: Тест операций
app.get('/api/test-operations/:id', async (req, res) => {
    const noteId = req.params.id;
    console.log('🧪 Тест операций для заметки:', noteId);
    
    try {
        // Получаем текущее состояние
        const [note] = await pool.query('SELECT * FROM notes WHERE id = ?', [noteId]);
        
        if (note.length === 0) {
            return res.json({ 
                success: false,
                error: 'Заметка не найдена' 
            });
        }
        
        const currentNote = note[0];
        
        // Тест изменения важности
        const newImportant = currentNote.is_important === 0 ? 1 : 0;
        await pool.query('UPDATE notes SET is_important = ? WHERE id = ?', [newImportant, noteId]);
        
        // Тест удаления/восстановления
        const newDeleted = currentNote.is_deleted === 0 ? 1 : 0;
        await pool.query('UPDATE notes SET is_deleted = ? WHERE id = ?', [newDeleted, noteId]);
        
        // Получаем обновлённую заметку
        const [updatedNote] = await pool.query('SELECT * FROM notes WHERE id = ?', [noteId]);
        
        res.json({
            success: true,
            message: 'Тест операций выполнен',
            original: {
                important: currentNote.is_important,
                deleted: currentNote.is_deleted
            },
            updated: {
                important: updatedNote[0].is_important,
                deleted: updatedNote[0].is_deleted
            },
            operations: {
                important_toggled: newImportant !== currentNote.is_important,
                deleted_toggled: newDeleted !== currentNote.is_deleted
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка теста операций:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API: Проверка здоровья
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        server: 'running',
        timestamp: new Date().toISOString(),
        database: pool ? 'connected' : 'disconnected',
        endpoints: {
            clearAll: 'DELETE /api/notes/clear-all',
            deletePermanent: 'DELETE /api/notes/:id/permanent',
            deleteToTrash: 'DELETE /api/notes/:id',
            restore: 'PATCH /api/notes/:id/restore'
        }
    });
});

// API: Тест очистки
app.get('/api/test-clear', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Нет подключения к БД' });
        }
        
        const [result] = await pool.execute('DELETE FROM notes');
        res.json({ 
            success: true, 
            message: `Удалено ${result.affectedRows} заметок`,
            details: 'Тестовый endpoint для проверки очистки'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Все остальные запросы - отдаём index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт доступен по вашему Railway домену`);
    console.log(`🔧 API Endpoints:`);
    console.log(`   • GET    /api/notes          - все заметки`);
    console.log(`   • POST   /api/notes          - создать заметку`);
    console.log(`   • PUT    /api/notes/:id      - обновить заметку`);
    console.log(`   • PATCH  /api/notes/:id/important - изменить важность`);
    console.log(`   • DELETE /api/notes/:id      - удалить в корзину`);
    console.log(`   • DELETE /api/notes/:id/permanent - удалить навсегда`);
    console.log(`   • PATCH  /api/notes/:id/restore - восстановить`);
    console.log(`   • DELETE /api/notes/clear-all - очистить всё`);
    console.log(`   • DELETE /api/trash/clear    - очистить корзину`);
    console.log(`   • GET    /api/health         - проверка здоровья`);
    console.log(`   • GET    /api/test-clear     - тест очистки`);
});
