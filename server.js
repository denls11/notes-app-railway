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

// **ВАЖНО: Выводим переменные окружения для отладки**
console.log('🔍 Проверка переменных окружения:');
console.log(`   MYSQLHOST: ${process.env.MYSQLHOST || 'НЕ УСТАНОВЛЕН'}`);
console.log(`   MYSQLUSER: ${process.env.MYSQLUSER || 'НЕ УСТАНОВЛЕН'}`);
console.log(`   MYSQLPASSWORD: ${process.env.MYSQLPASSWORD ? '******' : 'НЕ УСТАНОВЛЕН'}`);
console.log(`   MYSQLDATABASE: ${process.env.MYSQLDATABASE || 'НЕ УСТАНОВЛЕН'}`);
console.log(`   MYSQLPORT: ${process.env.MYSQLPORT || '3306 (по умолчанию)'}`);

// **ИСПРАВЛЕННО: Правильное создание пула соединений**
let pool;

try {
    // В Railway переменные окружения называются именно так
    const dbConfig = {
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        port: process.env.MYSQLPORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
    
    console.log('🔧 Конфигурация БД:', {
        ...dbConfig,
        password: dbConfig.password ? '******' : 'отсутствует'
    });
    
    pool = mysql.createPool(dbConfig);
    console.log('✅ Пул соединений создан');
} catch (error) {
    console.error('❌ Ошибка создания пула:', error.message);
    // Временно создаем "заглушку" для тестирования
    pool = null;
}

// **ШАГ 2: Проверка подключения (диагностика)**
app.get('/api/debug', (req, res) => {
    const envVars = {
        MYSQLHOST: process.env.MYSQLHOST || 'Не установлен',
        MYSQLUSER: process.env.MYSQLUSER || 'Не установлен',
        MYSQLPASSWORD: process.env.MYSQLPASSWORD ? 'Установлен' : 'Не установлен',
        MYSQLDATABASE: process.env.MYSQLDATABASE || 'Не установлен',
        MYSQLPORT: process.env.MYSQLPORT || '3306',
        PORT: process.env.PORT || '3000',
        NODE_ENV: process.env.NODE_ENV || 'development'
    };
    
    res.json({
        success: true,
        message: 'Сервер работает',
        environment: envVars,
        timestamp: new Date().toISOString(),
        pool: pool ? 'Создан' : 'Не создан'
    });
});

// **ШАГ 3: Простая проверка БД**
app.get('/api/test-db', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ 
            success: false, 
            error: 'Пул соединений не создан',
            suggestion: 'Проверьте переменные окружения в Railway'
        });
    }
    
    try {
        const [rows] = await pool.query('SELECT NOW() as current_time');
        res.json({ 
            success: true, 
            message: 'База данных подключена',
            current_time: rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            code: error.code,
            errno: error.errno
        });
    }
});

// **ШАГ 4: Простая таблица**
async function initDatabase() {
    if (!pool) {
        console.log('❌ Пропускаем инициализацию БД: пул не создан');
        return;
    }
    
    try {
        const connection = await pool.getConnection();
        console.log('✅ Получено соединение с БД');
        
        // Максимально простая таблица
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        console.log('✅ Таблица notes готова');
        connection.release();
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error.message);
        console.error('   Код ошибки:', error.code);
        console.error('   Номер ошибки:', error.errno);
    }
}

// Инициализация
initDatabase();

// **ШАГ 5: Упрощенный API для заметок**
app.get('/api/notes', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ 
            error: 'База данных недоступна',
            details: 'Проверьте подключение к MySQL'
        });
    }
    
    try {
        const [notes] = await pool.query('SELECT * FROM notes ORDER BY created_at DESC');
        res.json(notes);
    } catch (error) {
        console.error('Ошибка получения заметок:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notes', async (req, res) => {
    console.log('📝 Получен запрос на создание заметки');
    console.log('   Данные:', req.body);
    
    if (!pool) {
        return res.status(500).json({ 
            error: 'База данных недоступна',
            debug: 'Проверьте /api/debug'
        });
    }
    
    try {
        const { title, content } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                error: 'Заголовок и текст обязательны' 
            });
        }
        
        const [result] = await pool.query(
            'INSERT INTO notes (title, content) VALUES (?, ?)',
            [title, content]
        );
        
        console.log('✅ Заметка создана, ID:', result.insertId);
        
        res.status(201).json({
            success: true,
            id: result.insertId,
            title,
            content,
            message: 'Заметка создана'
        });
    } catch (error) {
        console.error('❌ Ошибка создания заметки:', error.message);
        console.error('   Полная ошибка:', error);
        res.status(500).json({ 
            error: 'Ошибка базы данных',
            details: error.message,
            code: error.code
        });
    }
});

// **ШАГ 6: Альтернативный маршрут с заглушкой (на случай проблем)**
let fakeNotes = []; // Временное хранилище в памяти

app.post('/api/notes-fallback', async (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Заголовок и текст обязательны' });
    }
    
    const note = {
        id: Date.now(),
        title,
        content,
        created_at: new Date().toISOString()
    };
    
    fakeNotes.push(note);
    console.log('📝 Заметка сохранена в памяти (заглушка)');
    
    res.status(201).json({
        success: true,
        note,
        message: 'Заметка сохранена в памяти (режим заглушки)'
    });
});

app.get('/api/notes-fallback', (req, res) => {
    res.json(fakeNotes);
});

// **ШАГ 7: Проверка работоспособности без БД**
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        server: 'running',
        database: pool ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте в браузере: http://localhost:${PORT}`);
    console.log(`🔧 Проверка переменных окружения выполнена`);
});
