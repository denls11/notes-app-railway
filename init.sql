CREATE DATABASE IF NOT EXISTS notes_app;
USE notes_app;

CREATE TABLE IF NOT EXISTS notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSON,
    is_important BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_deleted (is_deleted),
    INDEX idx_important (is_important),
    FULLTEXT idx_search (title, content)
);

-- Тестовые данные (опционально)
INSERT INTO notes (title, content, tags, is_important) VALUES
('Добро пожаловать!', 'Это ваша первая заметка. Вы можете редактировать её или создать новую.', '["приветствие", "инструкция"]', TRUE),
('Список покупок', 'Молоко, хлеб, яйца, фрукты, овощи, кофе', '["покупки", "продукты"]', FALSE),
('Идеи для проекта', '1. Создать мобильное приложение\n2. Изучить новый фреймворк\n3. Оптимизировать производительность', '["работа", "идеи", "проект"]', TRUE);