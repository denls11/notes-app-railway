const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/notes', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Схема заметки
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

// 1. Получить все заметки (с фильтрацией)
app.get('/api/notes', async (req, res) => {
    try {
        const { filter, search, sort } = req.query;
        let query = {};
        
        // Фильтрация
        if (filter === 'important') {
            query.is_important = true;
            query.is_deleted = false;
        } else if (filter === 'deleted') {
            query.is_deleted = true;
        } else if (filter === 'all') {
            // Все заметки, включая удаленные
        } else {
            query.is_deleted = false; // По умолчанию только активные
        }
        
        // Поиск
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }
        
        let notes = await Note.find(query);
        
        // Сортировка
        if (sort) {
            switch (sort) {
                case 'newest':
                    notes = notes.sort((a, b) => b.updated_at - a.updated_at);
                    break;
                case 'oldest':
                    notes = notes.sort((a, b) => a.updated_at - b.updated_at);
                    break;
                case 'alpha-asc':
                    notes = notes.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'alpha-desc':
                    notes = notes.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case 'important':
                    notes = notes.sort((a, b) => (b.is_important ? 1 : 0) - (a.is_important ? 1 : 0));
                    break;
            }
        }
        
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
        const { title, content, tags, is_important } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const note = new Note({
            title,
            content,
            tags: tags || [],
            is_important: is_important || false,
            is_deleted: false,
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
        const { title, content, tags, is_important } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            {
                title,
                content,
                tags: tags || [],
                is_important: is_important || false,
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

// 5. Удалить в корзину (SOFT DELETE)
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

// 6. ПОЛНОЕ УДАЛЕНИЕ из БД (HARD DELETE) - НОВЫЙ!
app.delete('/api/notes/:id/permanent', async (req, res) => {
    try {
        const note = await Note.findByIdAndDelete(req.params.id);
        
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        res.json({ 
            message: 'Note permanently deleted from database',
            deletedNote: note
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Восстановить из корзины
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

// 8. Установить/снять важность
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
            message: important ? 'Note marked as important' : 'Note unmarked as important',
            note 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. ОЧИСТИТЬ ВСЮ КОРЗИНУ (удалить все удаленные заметки) - НОВЫЙ!
app.delete('/api/notes/trash/empty', async (req, res) => {
    try {
        const result = await Note.deleteMany({ is_deleted: true });
        
        res.json({ 
            message: 'Trash emptied successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. УДАЛИТЬ ВСЕ ЗАМЕТКИ (активные + удаленные) - НОВЫЙ!
app.delete('/api/notes', async (req, res) => {
    try {
        const { confirm } = req.query;
        
        if (confirm !== 'true') {
            return res.status(400).json({ 
                error: 'Confirmation required. Add ?confirm=true to delete all notes' 
            });
        }
        
        const result = await Note.deleteMany({});
        
        res.json({ 
            message: 'All notes deleted permanently',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET    /api/notes');
    console.log('  GET    /api/notes/:id');
    console.log('  POST   /api/notes');
    console.log('  PUT    /api/notes/:id');
    console.log('  DELETE /api/notes/:id (soft delete)');
    console.log('  DELETE /api/notes/:id/permanent (HARD DELETE)');
    console.log('  PATCH  /api/notes/:id/restore');
    console.log('  PATCH  /api/notes/:id/important');
    console.log('  DELETE /api/notes/trash/empty');
    console.log('  DELETE /api/notes?confirm=true (delete ALL)');
});
