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
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение запущено');
    loadNotes();
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка сохранения
    saveBtn.addEventListener('click', function() {
        if (editingNoteId) {
            updateNote(editingNoteId);
        } else {
            saveNote();
        }
    });
    
    // Кнопка отмены
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            cancelEdit();
        });
    }
    
    // Фильтры
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('🎯 Фильтр изменен:', this.dataset.filter);
            
            // Убираем активный класс у всех кнопок
            filterButtons.forEach(b => b.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке
            this.classList.add('active');
            
            // Устанавливаем текущий фильтр
            currentFilter = this.dataset.filter;
            
            // Загружаем заметки с новым фильтром
            loadNotes();
        });
    });
    
    // Поиск
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            console.log('🔍 Поиск:', this.value);
            // Используем debounce для избежания частых запросов
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                loadNotes();
            }, 500);
        });
    }
    
    // Сортировка
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            console.log('📊 Сортировка изменена:', this.value);
            loadNotes();
        });
    }
}

// Загрузить заметки
async function loadNotes() {
    try {
        console.log('📥 Загрузка заметок с фильтром:', currentFilter);
        
        // Показываем индикатор загрузки
        if (notesList) {
            notesList.innerHTML = '<div class="empty-state">Загрузка...</div>';
        }
        
        // Собираем параметры запроса
        const params = new URLSearchParams();
        params.append('filter', currentFilter);
        
        if (searchInput && searchInput.value) {
            params.append('search', searchInput.value);
        }
        
        if (sortSelect && sortSelect.value) {
            params.append('sort', sortSelect.value);
        }
        
        const url = `${API_BASE}/api/notes?${params.toString()}`;
        console.log('📡 Запрос:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        notes = await response.json();
        console.log(`✅ Загружено ${notes.length} заметок`);
        
        // Отображаем заметки
        renderNotes();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки заметок:', error);
        if (notesList) {
            notesList.innerHTML = '<div class="empty-state">Ошибка загрузки заметок</div>';
        }
        showMessage('Не удалось загрузить заметки', 'error');
    }
}

// Отобразить заметки
function renderNotes() {
    if (!notesList) return;
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state">Нет заметок</div>';
        return;
    }
    
    // Создаем HTML для каждой заметки
    notesList.innerHTML = notes.map(note => `
        <div class="note-card ${note.important ? 'important' : ''}" data-id="${note.id}">
            <div class="note-header">
                <h3 class="note-title">${escapeHtml(note.title)}</h3>
                <div class="note-actions">
                    <button class="btn-icon toggle-important" title="${note.important ? 'Снять важность' : 'Отметить важной'}" data-id="${note.id}">
                        <i class="fas fa-star ${note.important ? 'active' : ''}"></i>
                    </button>
                    <button class="btn-icon edit-note" title="Редактировать" data-id="${note.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-note" title="В корзину" data-id="${note.id}">
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
                <small>Обновлено: ${formatDate(note.updated_at || note.updatedAt)}</small>
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики событий к заметкам
    addNoteEventListeners();
}

// Добавить обработчики к заметкам
function addNoteEventListeners() {
    // 1. Кнопка "Важная"
    document.querySelectorAll('.toggle-important').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const noteId = this.dataset.id;
            const note = notes.find(n => n.id == noteId);
            
            if (!note) return;
            
            try {
                console.log(`⭐ Изменение важности для заметки ${noteId}`);
                
                const response = await fetch(`${API_BASE}/api/notes/${noteId}/important`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        important: !note.important
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ошибка ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                console.log('✅ Результат:', result);
                
                // Перезагружаем заметки
                loadNotes();
                
                showMessage(`Заметка ${!note.important ? 'отмечена важной' : 'больше не важна'}`, 'success');
                
            } catch (error) {
                console.error('❌ Ошибка:', error);
                showMessage('Не удалось изменить важность', 'error');
            }
        });
    });
    
    // 2. Кнопка "Редактировать"
    document.querySelectorAll('.edit-note').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const noteId = this.dataset.id;
            const note = notes.find(n => n.id == noteId);
            
            if (note) {
                // Заполняем форму
                noteTitle.value = note.title;
                noteContent.value = note.content;
                
                // Устанавливаем режим редактирования
                editingNoteId = noteId;
                saveBtn.textContent = 'Обновить';
                
                if (cancelBtn) {
                    cancelBtn.style.display = 'inline-block';
                }
                
                // Прокручиваем к форме
                document.querySelector('.note-form')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    // 3. Кнопка "Удалить"
    document.querySelectorAll('.delete-note').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const noteId = this.dataset.id;
            
            if (confirm('Переместить заметку в корзину?')) {
                try {
                    console.log(`🗑️ Удаление заметки ${noteId}`);
                    
                    const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Ошибка ${response.status}: ${errorText}`);
                    }
                    
                    const result = await response.json();
                    console.log('✅ Результат:', result);
                    
                    // Перезагружаем заметки
                    loadNotes();
                    
                    showMessage('Заметка перемещена в корзину', 'success');
                    
                } catch (error) {
                    console.error('❌ Ошибка:', error);
                    showMessage('Не удалось удалить заметку', 'error');
                }
            }
        });
    });
    
    // 4. Клик по карточке (просмотр)
    document.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Игнорируем клики по кнопкам
            if (!e.target.closest('.note-actions')) {
                const noteId = this.dataset.id;
                const note = notes.find(n => n.id == noteId);
                if (note) {
                    alert(`${note.title}\n\n${note.content}`);
                }
            }
        });
    });
}

// Сохранить новую заметку
async function saveNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    
    if (!title || !content) {
        showMessage('Заполните заголовок и текст', 'error');
        return;
    }
    
    try {
        console.log('💾 Создание заметки...');
        
        const response = await fetch(`${API_BASE}/api/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content,
                tags: [],
                important: false
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ Заметка создана:', result);
        
        // Очищаем форму
        cancelEdit();
        
        // Перезагружаем заметки
        loadNotes();
        
        showMessage('Заметка создана', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showMessage('Не удалось создать заметку', 'error');
    }
}

// Обновить заметку
async function updateNote(noteId) {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    
    if (!title || !content) {
        showMessage('Заполните заголовок и текст', 'error');
        return;
    }
    
    try {
        console.log(`✏️ Обновление заметки ${noteId}...`);
        
        const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content,
                tags: [],
                important: false
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ Заметка обновлена:', result);
        
        // Возвращаем форму в исходное состояние
        cancelEdit();
        
        // Перезагружаем заметки
        loadNotes();
        
        showMessage('Заметка обновлена', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showMessage('Не удалось обновить заметку', 'error');
    }
}

// Отменить редактирование
function cancelEdit() {
    noteTitle.value = '';
    noteContent.value = '';
    editingNoteId = null;
    saveBtn.textContent = 'Сохранить';
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
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

function showMessage(message, type) {
    console.log(`💬 ${type}: ${message}`);
    
    // Создаем уведомление
    const alertDiv = document.createElement('div');
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(alertDiv);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимаций
if (!document.querySelector('#alert-styles')) {
    const style = document.createElement('style');
    style.id = 'alert-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Экспортируем функции для отладки
window.app = {
    loadNotes,
    cancelEdit,
    getNotes: () => notes,
    getCurrentFilter: () => currentFilter
};
