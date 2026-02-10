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

// **ФИКС: Прямая проверка и установка переменных окружения Railway**
console.log('🚨 ЗАПУСК СЕРВЕРА В RAILWAY 🚨');

// В Railway MySQL переменные называются именно так:
const DB_CONFIG = {
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'railway',
    port: parseInt(process.env.MYSQLPORT) || 3306
};

console.log('📊 КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ:');
console.log('   Хост:', DB_CONFIG.host);
console.log('   Пользователь:', DB_CONFIG.user);
console.log('   Пароль:', DB_CONFIG.password ? '***УСТАНОВЛЕН***' : 'НЕТ');
console.log('   База данных:', DB_CONFIG.database);
console.log('   Порт:', DB_CONFIG.port);

let pool;

// **ФИКС 2: Явное создание пула с таймаутами**
try {
    pool = mysql.createPool({
        ...DB_CONFIG,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000, // 10 секунд таймаут
        acquireTimeout: 10000
    });
    
    console.log('✅ Пул соединений MySQL создан');
    
    // Тестируем подключение сразу
    pool.getConnection()
        .then(conn => {
            console.log('✅ Успешное подключение к MySQL!');
            conn.release();
        })
        .catch(err => {
            console.error('❌ НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ К MYSQL:', err.message);
            console.error('   Проверьте:');
            console.error('   1. Переменные окружения в Railway → Variables');
            console.error('   2. Что база данных запущена (Railway → MySQL)');
            console.error('   3. Что хост не localhost');
        });
} catch (error) {
    console.error('❌ Ошибка создания пула:', error.message);
}

// **ЭКСТРЕННАЯ ПРОВЕРКА: Тестовый маршрут для проверки переменных**
app.get('/api/env-check', (req, res) => {
    const envVars = {};
    
    // Собираем все переменные, связанные с MySQL
    Object.keys(process.env).forEach(key => {
        if (key.includes('MYSQL') || key.includes('DATABASE') || key.includes('DB')) {
            envVars[key] = key.includes('PASS') ? '***HIDDEN***' : process.env[key];
        }
    });
    
    res.json({
        status: 'env_check',
        railway: true,
        mysql_variables: envVars,
        db_config_used: {
            host: DB_CONFIG.host,
            user: DB_CONFIG.user,
            database: DB_CONFIG.database,
            port: DB_CONFIG.port,
            has_password: !!DB_CONFIG.password
        },
        pool_created: !!pool,
        timestamp: new Date().toISOString()
    });
});

// **ФИКС 3: Используем временное хранилище, если БД не работает**
let tempStorage = [];
let useDatabase = false;

// Проверяем подключение к БД при старте
if (pool) {
    pool.query('SELECT 1')
        .then(() => {
            useDatabase = true;
            console.log('🎉 БАЗА ДАННЫХ РАБОТАЕТ! Используем MySQL');
            initDatabase();
        })
        .catch(err => {
            console.error('⚠️ MySQL не доступен, используем временное хранилище');
            console.error('   Ошибка:', err.message);
            useDatabase = false;
        });
}

async function initDatabase() {
    if (!useDatabase || !pool) return;
    
    try {
        // Создаем таблицу если её нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                tags JSON,
                important BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица notes готова');
    } catch (error) {
        console.error('❌ Ошибка создания таблицы:', error.message);
    }
}

// **УНИВЕРСАЛЬНЫЙ API: Работает и с БД, и без неё**
app.get('/api/notes', async (req, res) => {
    try {
        if (useDatabase && pool) {
            const [notes] = await pool.query('SELECT * FROM notes ORDER BY created_at DESC');
            return res.json(notes);
        } else {
            // Временное хранилище
            return res.json(tempStorage);
        }
    } catch (error) {
        console.error('Ошибка получения заметок:', error.message);
        res.json(tempStorage); // Fallback
    }
});

app.post('/api/notes', async (req, res) => {
    console.log('📝 Создание заметки:', req.body);
    
    const { title, content, tags = [], important = false } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Заголовок и текст обязательны' });
    }
    
    const note = {
        id: Date.now(),
        title,
        content,
        tags,
        important,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    try {
        if (useDatabase && pool) {
            // Сохраняем в MySQL
            const [result] = await pool.query(
                'INSERT INTO notes (title, content, tags, important) VALUES (?, ?, ?, ?)',
                [title, content, JSON.stringify(tags), important]
            );
            
            note.id = result.insertId;
            console.log('✅ Заметка сохранена в MySQL, ID:', note.id);
        } else {
            // Сохраняем во временное хранилище
            tempStorage.unshift(note);
            console.log('💾 Заметка сохранена во временное хранилище');
        }
        
        res.status(201).json({
            success: true,
            note,
            storage: useDatabase ? 'mysql' : 'memory',
            message: 'Заметка создана'
        });
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error.message);
        
        // Fallback на временное хранилище
        tempStorage.unshift(note);
        
        res.status(201).json({
            success: true,
            note,
            storage: 'memory_fallback',
            warning: 'MySQL недоступен, заметка сохранена в памяти',
            error_details: error.message
        });
    }
});

// **ФИКС 4: Простой тест создания заметки**
app.post('/api/test-create', async (req, res) => {
    const testNote = {
        title: 'Тестовая заметка ' + Date.now(),
        content: 'Это тест из Railway',
        tags: ['тест', 'railway'],
        important: true
    };
    
    console.log('🧪 Тестовое создание:', testNote);
    
    try {
        // Пробуем прямое подключение
        const connection = await mysql.createConnection({
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            port: process.env.MYSQLPORT
        });
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS test_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const [result] = await connection.query(
            'INSERT INTO test_notes (title) VALUES (?)',
            [testNote.title]
        );
        
        await connection.end();
        
        res.json({
            success: true,
            message: 'Тестовая заметка создана в MySQL',
            id: result.insertId,
            used_config: {
                host: process.env.MYSQLHOST,
                database: process.env.MYSQLDATABASE
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            error_code: error.code,
            env_check: {
                MYSQLHOST: process.env.MYSQLHOST,
                MYSQLDATABASE: process.env.MYSQLDATABASE,
                MYSQLUSER: process.env.MYSQLUSER,
                MYSQLPORT: process.env.MYSQLPORT
            }
        });
    }
});

// **ФИКС 5: Принудительная проверка переменных в Railway**
app.get('/api/force-check', (req, res) => {
    // Получаем все переменные окружения
    const allEnv = {};
    for (const key in process.env) {
        allEnv[key] = key.includes('PASS') || key.includes('SECRET') ? '***HIDDEN***' : process.env[key];
    }
    
    res.json({
        message: 'Полный список переменных окружения Railway',
        environment: allEnv,
        server_time: new Date().toISOString(),
        node_version: process.version,
        platform: process.platform
    });
});

// Статические файлы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// **ФИКС 6: Проверка здоровья с деталями**
app.get('/api/health', (req, res) => {
    res.json({
        status: 'running',
        server_time: new Date().toISOString(),
        database: useDatabase ? 'mysql_connected' : 'memory_storage',
        storage_mode: useDatabase ? 'production' : 'fallback',
        notes_count: useDatabase ? 'check_db' : tempStorage.length,
        pool_available: !!pool,
        railway_environment: !!process.env.RAILWAY_ENVIRONMENT,
        port: PORT
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту: ${PORT}`);
    console.log(`🔗 Домен Railway должен быть автоматически назначен`);
    console.log(`📡 Проверьте работу по ссылке из Railway Dashboard`);
});
