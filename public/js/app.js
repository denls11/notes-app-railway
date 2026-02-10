// Конфигурация
const API_BASE = window.location.origin;
let currentFilter = 'all';
let notes = [];

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

// Настройка обработчиков
function setupEventListeners() {
    saveBtn.addEventListener('click', saveNote);
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            noteTitle.value = '';
            noteContent.value = '';
            saveBtn.textContent = 'Сохранить';
            saveBtn.onclick = saveNote;
            cancelBtn.style.display = 'none';
        });
    }
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadNotes();
        });
    });
    
    // Поиск
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            setTimeout(() => loadNotes(), 300);
        });
    }
    
    // Сортировка
    if (sortSelect) {
        sortSelect.addEventListener('change', loadNotes);
    }
}

// Загрузить заметки
async function loadNotes() {
    try {
        console.log('📥 Загрузка заметок...');
        
        const params = new URLSearchParams({
            filter: currentFilter,
            sort: sortSelect ? sortSelect.value : 'newest'
        });
        
        if (searchInput && searchInput.value) {
            params.append('search', searchInput.value);
        }
        
        const response = await fetch(`${API_BASE}/api/notes?${params}`);
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        notes = await response.json();
        console.log(`✅ Загружено ${notes.length} заметок`);
        renderNotes();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Не удалось загрузить заметки');
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
                <small>Обновлено: ${formatDate(note.updatedAt)}</small>
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики СРАЗУ
    addEventListenersToNotes();
}

// Добавить обработчики к заметкам
function addEventListenersToNotes() {
    // Важность
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
                
                // Обновляем данные и перерисовываем
                note.important = !note.important;
                renderNotes();
                
                showMessage(`Заметка ${note.important ? 'отмечена важной' : 'больше не важна'}`, 'success');
                
            } catch (error) {
                console.error('❌ Ошибка:', error);
                showMessage('Не удалось изменить важность', 'error');
            }
        });
    });
    
    // Редактирование
    document.querySelectorAll('.edit-note').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const noteId = this.dataset.id;
            const note = notes.find(n => n.id == noteId);
            
            if (note) {
                noteTitle.value = note.title;
                noteContent.value = note.content;
                
                saveBtn.textContent = 'Обновить';
                saveBtn.onclick = function() {
                    updateNote(noteId);
                };
                
                if (cancelBtn) {
                    cancelBtn.style.display = 'inline-block';
                }
                
                // Прокрутка к форме
                document.querySelector('.note-form')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    // Удаление
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
    
    // Клик по карточке
    document.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', function(e) {
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
        noteTitle.value = '';
        noteContent.value = '';
        
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
        noteTitle.value = '';
        noteContent.value = '';
        saveBtn.textContent = 'Сохранить';
        saveBtn.onclick = saveNote;
        
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
        // Перезагружаем заметки
        loadNotes();
        
        showMessage('Заметка обновлена', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showMessage('Не удалось обновить заметку', 'error');
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
    // Простое уведомление
    const color = type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3';
    console.log(`%c${message}`, `color: ${color}; font-weight: bold;`);
    
    // Создаем временное уведомление
    const alertDiv = document.createElement('div');
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(alertDiv);
    
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
