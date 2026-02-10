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

// **ВАЖНО: Используем DATABASE_URL или MYSQL_URL из Railway**
const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;

console.log('🔧 Настройка подключения к MySQL...');
console.log('   Используется URL:', databaseUrl ? 'Да (скрыт)' : 'Нет');

let pool;

if (databaseUrl) {
    // Парсим URL подключения от Railway
    try {
        const dbUrl = new URL(databaseUrl);
        const auth = dbUrl.username ? `${dbUrl.username}:${dbUrl.password}` : '';
        
        const config = {
            host: dbUrl.hostname,
            port: parseInt(dbUrl.port) || 3306,
            user: dbUrl.username || 'root',
            password: dbUrl.password || '',
            database: dbUrl.pathname.replace('/', '') || 'railway',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
        };
        
        console.log('📊 Конфигурация из URL:');
        console.log('   Хост:', config.host);
        console.log('   Порт:', config.port);
        console.log('   База:', config.database);
        console.log('   Пользователь:', config.user);
        
        pool = mysql.createPool(config);
        
    } catch (error) {
        console.error('❌ Ошибка парсинга DATABASE_URL:', error.message);
    }
} else {
    // Fallback на отдельные переменные (для обратной совместимости)
    console.log('⚠️ DATABASE_URL не найден, использую отдельные переменные...');
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
        
        // Проверяем таблицу notes
        const [tables] = await connection.query("SHOW TABLES LIKE 'notes'");
        
        if (tables.length === 0) {
            console.log('📝 Таблица notes не существует, создаём...');
            await connection.query(`
                CREATE TABLE notes (
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
            console.log('✅ Таблица notes создана');
        } else {
            console.log('✅ Таблица notes уже существует');
        }
        
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к БД:', error.message);
        console.error('   Код ошибки:', error.code);
        return false;
    }
}

// Проверяем подключение при старте
setTimeout(() => {
    checkDatabaseConnection();
}, 2000);

// API: Получить все заметки (НЕ УДАЛЕННЫЕ)
app.get('/api/notes', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
        const [notes] = await pool.query(`
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
            WHERE is_deleted = 0 
            ORDER BY created_at DESC
        `);
        
        res.json(notes);
    } catch (error) {
        console.error('Ошибка получения заметок:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// API: Создать заметку
app.post('/api/notes', async (req, res) => {
    console.log('📝 Запрос на создание заметки:', req.body);
    
    try {
        if (!pool) {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
        const { title, content, tags = [], important = false } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Заголовок и текст обязательны' });
        }
        
        const [result] = await pool.execute(
            'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
            [title, content, JSON.stringify(tags), important ? 1 : 0]
        );
        
        console.log('✅ Заметка сохранена, ID:', result.insertId);
        
        // Получаем созданную заметку
        const [rows] = await pool.query(`
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
        console.error('   SQL:', error.sql);
        res.status(500).json({ 
            error: 'Ошибка базы данных',
            details: error.message,
            sql: error.sql
        });
    }
});

// API: Получить информацию о БД
app.get('/api/db-info', async (req, res) => {
    try {
        if (!pool) {
            return res.json({ 
                status: 'no_pool',
                message: 'Пул соединений не создан',
                variables: {
                    DATABASE_URL: !!process.env.DATABASE_URL,
                    MYSQL_URL: !!process.env.MYSQL_URL,
                    MYSQL_PUBLIC_URL: !!process.env.MYSQL_PUBLIC_URL,
                    MYSQLHOST: process.env.MYSQLHOST,
                    MYSQLDATABASE: process.env.MYSQLDATABASE
                }
            });
        }
        
        // Проверяем таблицы
        const [tables] = await pool.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        // Проверяем таблицу notes
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
            database: process.env.MYSQLDATABASE || 'railway',
            tables: tableNames,
            notes_table: {
                exists: tableNames.includes('notes'),
                structure: notesStructure,
                count: notesCount
            },
            connection: {
                using_url: !!databaseUrl,
                host: pool.pool.config.connectionConfig.host,
                port: pool.pool.config.connectionConfig.port
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message,
            code: error.code
        });
    }
});

// API: Тест создания заметки
app.post('/api/test-note', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Нет подключения к БД' });
        }
        
        const testNote = {
            title: 'Тестовая заметка ' + new Date().toLocaleTimeString(),
            content: 'Это тест из API /api/test-note',
            tags: JSON.stringify(['test', 'api']),
            is_important: 1
        };
        
        const [result] = await pool.execute(
            'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
            [testNote.title, testNote.content, testNote.tags, testNote.is_important]
        );
        
        res.json({
            success: true,
            message: 'Тестовая заметка создана',
            id: result.insertId,
            note: testNote
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            sql: error.sql
        });
    }
});

// Остальные маршруты (удаление, восстановление, важность) остаются как были
// API: Удалить заметку
app.delete('/api/notes/:id', async (req, res) => {
    try {
        await pool.execute('UPDATE notes SET is_deleted = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Заметка перемещена в корзину' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Восстановить заметку
app.patch('/api/notes/:id/restore', async (req, res) => {
    try {
        await pool.execute('UPDATE notes SET is_deleted = 0 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Заметка восстановлена' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Изменить важность
app.patch('/api/notes/:id/important', async (req, res) => {
    try {
        const { important } = req.body;
        await pool.execute('UPDATE notes SET is_important = ? WHERE id = ?', [important ? 1 : 0, req.params.id]);
        res.json({ message: `Заметка ${important ? 'важная' : 'не важная'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Старт сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 Проверьте работоспособность:`);
    console.log(`   • https://ваш-проект.railway.app/api/db-info`);
    console.log(`   • https://ваш-проект.railway.app/api/notes`);
    console.log(`   • Создайте заметку через интерфейс`);
});
