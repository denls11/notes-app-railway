// Конфигурация
const API_BASE = window.location.origin;
let currentFilter = 'all';
let notes = [];
let editingNoteId = null;

// DOM элементы
const notesList = document.getElementById('notesList');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const filterButtons = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Приложение запущено');
    loadNotes();
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    saveBtn.addEventListener('click', saveOrUpdateNote);
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelEdit);
    }
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            setFilter(filter);
        });
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadNotes, 300));
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', loadNotes);
    }
}

// Загрузить заметки
async function loadNotes() {
    try {
        showLoading(true);
        
        const filter = currentFilter;
        const search = searchInput ? searchInput.value : '';
        const sort = sortSelect ? sortSelect.value : 'newest';
        
        let url = `${API_BASE}/api/notes`;
        
        // Добавляем параметры если есть соответствующие элементы
        const params = new URLSearchParams();
        params.append('filter', filter);
        if (search) params.append('search', search);
        params.append('sort', sort);
        
        url += '?' + params.toString();
        
        console.log('📥 Загрузка заметок:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        notes = await response.json();
        console.log(`✅ Загружено ${notes.length} заметок`);
        renderNotes();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки заметок:', error);
        showMessage('Не удалось загрузить заметки', 'error');
    } finally {
        showLoading(false);
    }
}

// Отобразить заметки
function renderNotes() {
    if (!notesList) return;
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state">Нет заметок</div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-card ${note.important ? 'important' : ''}" data-id="${note.id}">
            <div class="note-header">
                <h3 class="note-title">${escapeHtml(note.title)}</h3>
                <div class="note-actions">
                    <button class="btn-icon important-btn" title="${note.important ? 'Снять важность' : 'Отметить важной'}" data-id="${note.id}">
                        <i class="fas fa-star ${note.important ? 'active' : ''}"></i>
                    </button>
                    <button class="btn-icon edit-btn" title="Редактировать" data-id="${note.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" title="В корзину" data-id="${note.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="note-content">${escapeHtml(note.content)}</div>
            ${note.tags && note.tags.length > 0 ? `
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="note-footer">
                <small>Обновлено: ${formatDate(note.updatedAt || note.created_at)}</small>
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики событий для кнопок
    addNoteEventListeners();
}

// Добавить обработчики для кнопок заметок
function addNoteEventListeners() {
    // Кнопка "Важная"
    document.querySelectorAll('.important-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const noteId = btn.dataset.id;
            const note = notes.find(n => n.id == noteId);
            
            if (note) {
                try {
                    console.log(`⭐ Изменение важности заметки ${noteId} на ${!note.important}`);
                    
                    const response = await fetch(`${API_BASE}/api/notes/${noteId}/important`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ important: !note.important })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log('✅ Результат:', result);
                    
                    // Обновляем локальные данные
                    note.important = !note.important;
                    // Перерисовываем одну карточку
                    updateNoteCard(noteId);
                    
                    showMessage(`Заметка ${note.important ? 'отмечена важной' : 'больше не важна'}`, 'success');
                    
                } catch (error) {
                    console.error('❌ Ошибка изменения важности:', error);
                    showMessage('Не удалось изменить важность', 'error');
                }
            }
        });
    });
    
    // Кнопка "Редактировать"
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = btn.dataset.id;
            startEditNote(noteId);
        });
    });
    
    // Кнопка "Удалить"
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const noteId = btn.dataset.id;
            
            if (confirm('Переместить заметку в корзину?')) {
                try {
                    console.log(`🗑️ Удаление заметки ${noteId} в корзину`);
                    
                    const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log('✅ Результат:', result);
                    
                    // Удаляем из локального списка
                    notes = notes.filter(n => n.id != noteId);
                    renderNotes();
                    
                    showMessage('Заметка перемещена в корзину', 'success');
                    
                } catch (error) {
                    console.error('❌ Ошибка удаления:', error);
                    showMessage('Не удалось удалить заметку', 'error');
                }
            }
        });
    });
    
    // Клик по карточке для просмотра
    document.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.note-actions')) {
                const noteId = card.dataset.id;
                const note = notes.find(n => n.id == noteId);
                if (note) {
                    alert(`Заголовок: ${note.title}\n\n${note.content}`);
                }
            }
        });
    });
}

// Обновить одну карточку заметки
function updateNoteCard(noteId) {
    const note = notes.find(n => n.id == noteId);
    if (!note) return;
    
    const card = document.querySelector(`.note-card[data-id="${noteId}"]`);
    if (!card) return;
    
    // Обновляем класс важности
    if (note.important) {
        card.classList.add('important');
    } else {
        card.classList.remove('important');
    }
    
    // Обновляем иконку звезды
    const starIcon = card.querySelector('.fa-star');
    if (starIcon) {
        if (note.important) {
            starIcon.classList.add('active');
            starIcon.parentElement.title = 'Снять важность';
        } else {
            starIcon.classList.remove('active');
            starIcon.parentElement.title = 'Отметить важной';
        }
    }
}

// Начать редактирование заметки
function startEditNote(noteId) {
    const note = notes.find(n => n.id == noteId);
    if (!note) return;
    
    editingNoteId = noteId;
    noteTitle.value = note.title;
    noteContent.value = note.content;
    
    saveBtn.textContent = 'Обновить';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    
    // Прокручиваем к форме
    document.querySelector('.note-form')?.scrollIntoView({ behavior: 'smooth' });
}

// Сохранить или обновить заметку
async function saveOrUpdateNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    
    if (!title || !content) {
        showMessage('Заполните заголовок и текст', 'error');
        return;
    }
    
    try {
        if (editingNoteId) {
            // Обновление существующей заметки
            await updateNote(editingNoteId, title, content);
        } else {
            // Создание новой заметки
            await createNote(title, content);
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        showMessage('Не удалось сохранить заметку', 'error');
    }
}

// Создать заметку
async function createNote(title, content) {
    console.log('💾 Создание новой заметки...');
    
    const noteData = {
        title,
        content,
        tags: [],
        important: false
    };
    
    const response = await fetch(`${API_BASE}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Заметка создана:', result);
    
    cancelEdit();
    loadNotes();
    showMessage('Заметка создана', 'success');
}

// Обновить заметку
async function updateNote(noteId, title, content) {
    console.log(`✏️ Обновление заметки ${noteId}...`);
    
    const noteData = {
        title,
        content,
        tags: [],
        important: false
    };
    
    const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Заметка обновлена:', result);
    
    cancelEdit();
    loadNotes();
    showMessage('Заметка обновлена', 'success');
}

// Отменить редактирование
function cancelEdit() {
    noteTitle.value = '';
    noteContent.value = '';
    editingNoteId = null;
    saveBtn.textContent = 'Сохранить';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Установить фильтр
function setFilter(filter) {
    currentFilter = filter;
    
    // Обновляем активную кнопку
    filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    loadNotes();
}

// Вспомогательные функции
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(show) {
    // Простая реализация - можно улучшить
    if (show) {
        console.log('⏳ Загрузка...');
    }
}

function showMessage(message, type = 'info') {
    // Простая реализация - можно заменить на toast
    const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue';
    console.log(`%c${message}`, `color: ${color}; font-weight: bold;`);
    alert(message);
}

// Корзина (дополнительные функции)
async function loadTrash() {
    try {
        const response = await fetch(`${API_BASE}/api/trash`);
        if (response.ok) {
            const trashNotes = await response.json();
            console.log(`🗑️ Заметок в корзине: ${trashNotes.length}`);
            return trashNotes;
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки корзины:', error);
    }
    return [];
}

async function restoreNote(noteId) {
    try {
        const response = await fetch(`${API_BASE}/api/notes/${noteId}/restore`, {
            method: 'PATCH'
        });
        
        if (response.ok) {
            console.log(`✅ Заметка ${noteId} восстановлена`);
            return true;
        }
    } catch (error) {
        console.error('❌ Ошибка восстановления:', error);
    }
    return false;
}

// Экспортируем функции для глобального использования
window.app = {
    loadNotes,
    loadTrash,
    restoreNote,
    startEditNote,
    cancelEdit,
    setFilter
};
