const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Отдаем файлы из текущей папки

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/notes', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const noteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    tags: [{ type: String }],
    is_important: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// ========== API ENDPOINTS ==========

// 1. Получить все заметки
app.get('/api/notes', async (req, res) => {
    try {
        const { filter, search, sort } = req.query;
        let query = {};
        
        if (filter === 'important') {
            query.is_important = true;
            query.is_deleted = false;
        } else if (filter === 'deleted') {
            query.is_deleted = true;
        } else {
            query.is_deleted = false;
        }
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }
        
        const notes = await Note.find(query);
        
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Получить одну заметку
app.get('/api/notes/:id', async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json(note);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Создать заметку
app.post('/api/notes', async (req, res) => {
    try {
        const { title, content, tags, important } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const note = new Note({
            title,
            content,
            tags: tags || [],
            is_important: important || false,
            created_at: Date.now(),
            updated_at: Date.now()
        });
        
        await note.save();
        res.status(201).json(note);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 4. Обновить заметку
app.put('/api/notes/:id', async (req, res) => {
    try {
        const { title, content, tags, important } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            {
                title,
                content,
                tags: tags || [],
                is_important: important || false,
                updated_at: Date.now()
            },
            { new: true }
        );
        
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        res.json(note);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 5. Удалить заметку (soft delete - в корзину)
app.delete('/api/notes/:id', async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { 
                is_deleted: true, 
                updated_at: Date.now() 
            },
            { new: true }
        );
        
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        res.json({ 
            message: 'Note moved to trash', 
            note 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Восстановить заметку
app.patch('/api/notes/:id/restore', async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { 
                is_deleted: false, 
                updated_at: Date.now() 
            },
            { new: true }
        );
        
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        res.json({ 
            message: 'Note restored from trash', 
            note 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Изменить важность
app.patch('/api/notes/:id/important', async (req, res) => {
    try {
        const { important } = req.body;
        
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { 
                is_important: important, 
                updated_at: Date.now() 
            },
            { new: true }
        );
        
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        res.json({ 
            message: 'Importance updated', 
            note 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Для всех остальных запросов отдаем index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте: http://localhost:${PORT}`);
});
