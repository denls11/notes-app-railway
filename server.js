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
console.log('🚀 Запуск приложения...');

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

// Автоматическое исправление таблицы при запуске
async function fixTableStructure() {
    if (!pool) {
        console.log('❌ Пул не создан, пропускаем исправление таблицы');
        return false;
    }
    
    try {
        console.log('🛠️ Проверяем структуру таблицы notes...');
        
        // Сначала проверим, существует ли таблица
        const [tables] = await pool.query("SHOW TABLES LIKE 'notes'");
        
        if (tables.length === 0) {
            console.log('📝 Таблица notes не существует, создаём...');
            await pool.query(`
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
            return true;
        }
        
        // Таблица существует, проверяем структуру
        const [columns] = await pool.query("DESCRIBE notes");
        const idColumn = columns.find(col => col.Field === 'id');
        
        if (!idColumn) {
            console.log('⚠️ Поле id не найдено, пересоздаём таблицу...');
            await pool.query("DROP TABLE notes");
            await pool.query(`
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
            console.log('✅ Таблица пересоздана');
            return true;
        }
        
        // Проверяем AUTO_INCREMENT
        if (!idColumn.Extra || !idColumn.Extra.includes('auto_increment')) {
            console.log('⚠️ Исправляем поле id...');
            
            // Попробуем добавить AUTO_INCREMENT
            try {
                await pool.query("ALTER TABLE notes MODIFY id INT AUTO_INCREMENT PRIMARY KEY");
                console.log('✅ AUTO_INCREMENT добавлен к полю id');
            } catch (alterError) {
                console.log('🔄 Не удалось изменить существующее поле, пересоздаём таблицу...');
                await pool.query("DROP TABLE notes");
                await pool.query(`
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
                console.log('✅ Таблица пересоздана с AUTO_INCREMENT');
            }
        } else {
            console.log('✅ Структура таблицы в порядке');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка проверки структуры:', error.message);
        
        // Если ошибка "таблица не существует", создаём её
        if (error.message.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
            console.log('🔄 Создаём таблицу notes...');
            try {
                await pool.query(`
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
                return true;
            } catch (createError) {
                console.error('❌ Не удалось создать таблицу:', createError.message);
                return false;
            }
        }
        
        return false;
    }
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
        connection.release();
        
        // Исправляем структуру таблицы
        await fixTableStructure();
        
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
        console.error('❌ Ошибка получения заметок:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// API: Создать заметку (С АВТОМАТИЧЕСКИМ ИСПРАВЛЕНИЕМ ОШИБОК)
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
        
        // Пытаемся создать заметку
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
        
        // Ошибка "нет значения по умолчанию для id" - исправляем таблицу
        if (error.message.includes("doesn't have a default value") || error.code === 'ER_NO_DEFAULT_FOR_FIELD') {
            console.log('🔄 Исправляем структуру таблицы...');
            
            try {
                // Сначала попробуем добавить AUTO_INCREMENT
                await pool.query("ALTER TABLE notes MODIFY id INT AUTO_INCREMENT PRIMARY KEY");
                console.log('✅ AUTO_INCREMENT добавлен');
                
                // Пробуем создать заметку снова
                const [result] = await pool.execute(
                    'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
                    [title, content, JSON.stringify(tags), important ? 1 : 0]
                );
                
                console.log('✅ Заметка сохранена после исправления, ID:', result.insertId);
                
                res.status(201).json({
                    success: true,
                    id: result.insertId,
                    message: 'Заметка создана (таблица была исправлена)'
                });
                
            } catch (fixError) {
                console.error('❌ Не удалось исправить таблицу:', fixError.message);
                
                // Экстренный вариант: создаём таблицу заново
                try {
                    await pool.query("DROP TABLE IF EXISTS notes");
                    await pool.query(`
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
                    
                    // Создаём заметку в новой таблице
                    const [result] = await pool.execute(
                        'INSERT INTO notes (title, content, tags, is_important) VALUES (?, ?, ?, ?)',
                        [title, content, JSON.stringify(tags), important ? 1 : 0]
                    );
                    
                    console.log('✅ Таблица пересоздана и заметка сохранена, ID:', result.insertId);
                    
                    res.status(201).json({
                        success: true,
                        id: result.insertId,
                        message: 'Заметка создана (таблица была пересоздана)'
                    });
                    
                } catch (finalError) {
                    res.status(500).json({
                        success: false,
                        error: 'Не удалось исправить базу данных',
                        details: finalError.message
                    });
                }
            }
        } else {
            // Другие ошибки
            res.status(500).json({ 
                error: 'Ошибка базы данных',
                details: error.message,
                code: error.code
            });
        }
    }
});

// API: Принудительное исправление таблицы
app.post('/api/fix-database', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
        await fixTableStructure();
        
        // Тестовый INSERT
        const [result] = await pool.query(
            "INSERT INTO notes (title, content) VALUES (?, ?)",
            ["Таблица исправлена", "Теперь всё должно работать!"]
        );
        
        res.json({
            success: true,
            message: 'Таблица notes проверена и исправлена',
            test_id: result.insertId,
            note: 'Попробуйте создать заметку на сайте'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
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
                message: 'Пул соединений не создан'
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
            tables: tableNames,
            notes: {
                exists: tableNames.includes('notes'),
                structure: notesStructure,
                count: notesCount,
                id_column: notesStructure.find(col => col.Field === 'id')
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message
        });
    }
});

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
    console.log(`📡 Ссылка: https://ваш-проект.railway.app`);
    console.log(`🔧 Проверка БД: https://ваш-проект.railway.app/api/db-info`);
    console.log(`🔧 Исправление БД: https://ваш-проект.railway.app/api/fix-database`);
});
