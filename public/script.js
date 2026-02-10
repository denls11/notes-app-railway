document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    
    const saveBtn = document.getElementById('saveBtn');
    const notesContainer = document.getElementById('notesContainer');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const noteModal = document.getElementById('noteModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const noteForm = document.getElementById('noteForm');
    const noteTitle = document.getElementById('noteTitle');
    const noteText = document.getElementById('noteText');
    const noteTags = document.getElementById('noteTags');
    const noteImportant = document.getElementById('noteImportant');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const clearAllModal = document.getElementById('clearAllModal');
    const confirmClearAllBtn = document.getElementById('confirmClearAllBtn');
    const cancelClearAllBtn = document.getElementById('cancelClearAllBtn');
    const themeToggle = document.getElementById('themeToggle');

    let notes = [];
    let currentNoteId = null;
    let currentFilter = 'all';
    let currentSort = '';
    let currentSearch = '';
    let selectedNoteId = null;

    loadNotes();
    setupEventListeners();

    // Загрузка заметок с сервера
    async function loadNotes() {
    console.log('🔄 Начало загрузки заметок...');
    console.log('Текущий фильтр:', currentFilter);
    console.log('Текущий поиск:', currentSearch);
    
    try {
        showNotification('Загрузка заметок...', 'info');
        
        // Формируем URL с параметрами
        let url = `${API_URL}/notes`;
        const params = new URLSearchParams();
        
        // Добавляем фильтр только если он не 'all'
        if (currentFilter && currentFilter !== 'all') {
            params.append('filter', currentFilter);
        }
        
        // Добавляем поиск если есть
        if (currentSearch) {
            params.append('search', currentSearch);
        }
        
        // Добавляем сортировку если есть
        if (currentSort) {
            params.append('sort', currentSort);
        }
        
        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
        
        console.log('📡 Запрос к:', url);
        
        const startTime = Date.now();
        const response = await fetch(url);
        const endTime = Date.now();
        
        console.log(`⏱️ Запрос выполнен за ${endTime - startTime}ms`);
        console.log('📊 Статус ответа:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка HTTP:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Получено ${data.length} заметок`);
        
        // Конвертируем поля для совместимости
        notes = data.map(note => {
            // Проверяем оба варианта названия поля
            const isImportant = note.is_important !== undefined 
                ? note.is_important 
                : note.important || false;
            
            const isDeleted = note.is_deleted !== undefined 
                ? note.is_deleted 
                : note.deleted || false;
            
            return {
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags || [],
                important: isImportant,
                deleted: isDeleted,
                createdAt: note.created_at || note.createdAt,
                updatedAt: note.updated_at || note.updatedAt
            };
        });
        
        console.log('📝 Конвертированные заметки:', notes);
        renderNotes();
        
    } catch (error) {
        console.error('❌ Ошибка при загрузке заметок:', error);
        console.error('Стек ошибки:', error.stack);
        showNotification('Не удалось загрузить заметки', 'error');
        
        // Fallback на localStorage, если сервер недоступен
        loadNotesFromLocalStorage();
    }
}
            
            renderNotes();
        } catch (error) {
            console.error('Ошибка при загрузке заметок:', error);
            showNotification('Не удалось загрузить заметки', 'error');
            // Fallback на localStorage, если сервер недоступен
            loadNotesFromLocalStorage();
        }
    }

    function loadNotesFromLocalStorage() {
        const savedNotes = localStorage.getItem('notes');
        if (savedNotes) {
            notes = JSON.parse(savedNotes);
            renderNotes();
            showNotification('Используются локальные данные', 'info');
        }
    }

    function renderNotes() {
        notesContainer.innerHTML = '';
        
        // Фильтруем на клиенте только если нужно (для поиска)
        let filteredNotes = [...notes];
        
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filteredNotes = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(searchLower) ||
                note.content.toLowerCase().includes(searchLower) ||
                (note.tags && note.tags.some(tag => 
                    tag.toLowerCase().includes(searchLower)
                ))
            );
        }
        
        if (filteredNotes.length === 0) {
            const emptyMessage = currentFilter === 'deleted' 
                ? 'Корзина пуста'
                : currentSearch 
                ? 'По вашему запросу ничего не найдено'
                : 'Нет заметок';
            
            notesContainer.innerHTML = `
                <div class="empty">
                    <i class="fas fa-${currentFilter === 'deleted' ? 'trash' : 'sticky-note'}"></i>
                    <h3>${emptyMessage}</h3>
                    <p>${currentFilter === 'deleted' ? 'Удаленные заметки появятся здесь' : 'Создайте первую заметку!'}</p>
                </div>
            `;
            return;
        }
        
        // Применяем сортировку
        if (currentSort) {
            filteredNotes.sort((a, b) => {
                switch (currentSort) {
                    case 'newest':
                        return new Date(b.updatedAt) - new Date(a.updatedAt);
                    case 'oldest':
                        return new Date(a.updatedAt) - new Date(b.updatedAt);
                    case 'alpha-asc':
                        return a.title.localeCompare(b.title);
                    case 'alpha-desc':
                        return b.title.localeCompare(a.title);
                    case 'important':
                        return (b.important ? 1 : 0) - (a.important ? 1 : 0);
                    default:
                        return 0;
                }
            });
        }
        
        filteredNotes.forEach(note => {
            const noteElement = createNoteElement(note);
            notesContainer.appendChild(noteElement);
        });
    }

    function createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = `note ${note.important ? 'important' : ''} ${note.deleted ? 'deleted' : ''} ${selectedNoteId === note.id ? 'active' : ''}`;
        noteDiv.dataset.id = note.id;
        
        const date = new Date(note.updatedAt);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        noteDiv.innerHTML = `
            <div class="note-header">
                <div class="note-title">
                    ${note.important ? '<i class="fas fa-star note-important"></i>' : ''}
                    ${escapeHtml(note.title)}
                </div>
            </div>
            <div class="note-content">${escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
            ${note.tags && note.tags.length > 0 ? `
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="note-date">
                <i class="far fa-clock"></i> ${formattedDate}
            </div>
            <div class="note-actions">
                ${!note.deleted ? `
                    <button class="note-btn edit" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="note-btn important-btn" title="${note.important ? 'Снять важность' : 'Пометить важной'}">
                        <i class="${note.important ? 'fas fa-star' : 'far fa-star'}"></i>
                    </button>
                    <button class="note-btn delete" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <button class="note-btn restore" title="Восстановить">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="note-btn delete" title="Удалить навсегда">
                        <i class="fas fa-trash"></i>
                    </button>
                `}
            </div>
        `;
        
        // Обработчики событий
        noteDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.note-actions')) {
                if (selectedNoteId === note.id) {
                    selectedNoteId = null;
                    noteDiv.classList.remove('active');
                } else {
                    selectedNoteId = note.id;
                    document.querySelectorAll('.note').forEach(n => n.classList.remove('active'));
                    noteDiv.classList.add('active');
                }
            }
        });
        
        const editBtn = noteDiv.querySelector('.edit');
        const importantBtn = noteDiv.querySelector('.important-btn');
        const deleteBtn = noteDiv.querySelector('.delete');
        const restoreBtn = noteDiv.querySelector('.restore');
        
        if (editBtn) editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editNote(note.id);
        });
        
        if (importantBtn) importantBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImportant(note.id, importantBtn);
        });
        
        if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (note.deleted) {
                showConfirmModal('Вы уверены, что хотите удалить эту заметку навсегда?', () => {
                    deleteNotePermanently(note.id);
                });
            } else {
                showConfirmModal('Вы уверены, что хотите удалить эту заметку?', () => {
                    deleteNote(note.id);
                });
            }
        });
        
        if (restoreBtn) restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreNote(note.id);
        });
        
        return noteDiv;
    }

    function openNewNoteModal() {
        currentNoteId = null;
        document.getElementById('modalTitle').textContent = 'Новая заметка';
        noteForm.reset();
        noteModal.classList.add('active');
        noteTitle.focus();
    }

    async function editNote(id) {
    try {
        const response = await fetch(`${API_URL}/notes/${id}`);
        const note = await response.json();
        
        currentNoteId = id;
        document.getElementById('modalTitle').textContent = 'Редактировать заметку';
        noteTitle.value = note.title;
        noteText.value = note.content;
        noteTags.value = note.tags ? note.tags.join(', ') : '';
        
        // Используем правильное поле для важности
        const isImportant = note.is_important !== undefined 
            ? note.is_important 
            : note.important || false;
        
        console.log(`Загрузка заметки ${id}: is_important = ${isImportant}`);
        console.log('Все поля заметки:', note);
        
        noteImportant.checked = isImportant;
        
        noteModal.classList.add('active');
        noteTitle.focus();
    } catch (error) {
        console.error('Ошибка при загрузке заметки:', error);
        showNotification('Не удалось загрузить заметку', 'error');
    }
}

    async function saveNote(e) {
    e.preventDefault();
    
    const title = noteTitle.value.trim();
    const content = noteText.value.trim();
    const tags = noteTags.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const isImportant = noteImportant.checked;
    
    if (!title || !content) {
        showNotification('Заголовок и текст заметки обязательны', 'error');
        return;
    }
    
    try {
        // Подготавливаем данные в формате, который ожидает сервер
        const noteData = {
            title,
            content,
            tags,
            is_important: isImportant,
            important: isImportant  // Добавляем оба поля для совместимости
        };
        
        console.log('Сохранение заметки с данными:', noteData);
        
        if (currentNoteId) {
            // Обновление существующей заметки
            const response = await fetch(`${API_URL}/notes/${currentNoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка обновления:', errorText);
                throw new Error('Ошибка обновления');
            }
            
            showNotification('Заметка обновлена', 'success');
        } else {
            // Создание новой заметки
            const response = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка создания:', errorText);
                throw new Error('Ошибка создания');
            }
            
            showNotification('Заметка создана', 'success');
        }
        
        await loadNotes();
        noteModal.classList.remove('active');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showNotification('Ошибка при сохранении заметки', 'error');
    }
}
    async function deleteNote(id) {
        try {
            const response = await fetch(`${API_URL}/notes/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Ошибка удаления');
            
            showNotification('Заметка перемещена в корзину', 'info');
            await loadNotes();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            showNotification('Ошибка при удалении заметки', 'error');
        }
    }

    async function deleteNotePermanently(id) {
        try {
            const response = await fetch(`${API_URL}/notes/${id}/permanent`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Ошибка удаления');
            
            showNotification('Заметка удалена навсегда', 'success');
            await loadNotes();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            showNotification('Ошибка при удалении заметки', 'error');
        }
    }

    async function restoreNote(id) {
        try {
            const response = await fetch(`${API_URL}/notes/${id}/restore`, {
                method: 'PATCH'
            });
            
            if (!response.ok) throw new Error('Ошибка восстановления');
            
            showNotification('Заметка восстановлена', 'success');
            await loadNotes();
        } catch (error) {
            console.error('Ошибка восстановления:', error);
            showNotification('Ошибка при восстановлении заметки', 'error');
        }
    }

    async function toggleImportant(id, buttonElement = null) {
        try {
            const note = notes.find(n => n.id === id);
            if (!note) return;
            
            const newImportantStatus = !note.important;
            
            // Пробуем разные варианты endpoint'ов и форматов данных
            let response;
            
            // Вариант 1: Специальный endpoint для важности
            try {
                response = await fetch(`${API_URL}/notes/${id}/important`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        is_important: newImportantStatus,
                        important: newImportantStatus 
                    })
                });
                
                if (!response.ok) throw new Error('Endpoint /important не сработал');
            } catch (error1) {
                console.log('Пробуем вариант 2:', error1);
                
                // Вариант 2: Обновление через основной endpoint
                response = await fetch(`${API_URL}/notes/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        is_important: newImportantStatus 
                    })
                });
                
                if (!response.ok) {
                    // Вариант 3: Пробуем PUT
                    response = await fetch(`${API_URL}/notes/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            ...note,
                            is_important: newImportantStatus 
                        })
                    });
                    
                    if (!response.ok) throw new Error('Все варианты не сработали');
                }
            }
            
            // Обновляем локальное состояние
            note.important = newImportantStatus;
            
            // Обновляем UI кнопки
            if (buttonElement) {
                const icon = buttonElement.querySelector('i');
                const title = buttonElement.getAttribute('title');
                
                if (newImportantStatus) {
                    icon.className = 'fas fa-star';
                    buttonElement.setAttribute('title', 'Снять важность');
                } else {
                    icon.className = 'far fa-star';
                    buttonElement.setAttribute('title', 'Пометить важной');
                }
            }
            
            // Обновляем отображение заметки
            const noteElement = document.querySelector(`.note[data-id="${id}"]`);
            if (noteElement) {
                if (newImportantStatus) {
                    noteElement.classList.add('important');
                    const titleElement = noteElement.querySelector('.note-title');
                    if (!titleElement.querySelector('.note-important')) {
                        const starIcon = document.createElement('i');
                        starIcon.className = 'fas fa-star note-important';
                        titleElement.insertBefore(starIcon, titleElement.firstChild);
                    }
                } else {
                    noteElement.classList.remove('important');
                    const starIcon = noteElement.querySelector('.note-title .note-important');
                    if (starIcon) {
                        starIcon.remove();
                    }
                }
            }
            
            showNotification(
                newImportantStatus 
                    ? 'Заметка помечена как важная' 
                    : 'Снята отметка важности', 
                'info'
            );
            
            // Перезагружаем заметки для синхронизации
            await loadNotes();
            
        } catch (error) {
            console.error('Ошибка обновления важности:', error);
            showNotification('Ошибка при обновлении заметки', 'error');
        }
    }

    async function clearAllNotes() {
        try {
            console.log('Отправка запроса на очистку всех заметок...');
            
            // Используем НОВЫЙ endpoint /api/clear-all
            const response = await fetch(`${API_URL}/clear-all`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Текст ошибки:', errorText);
                throw new Error(`Ошибка сервера: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Результат:', result);
            
            showNotification(`Все заметки удалены (${result.deletedCount} шт.)`, 'success');
            
            // Обновляем список заметок
            setTimeout(() => {
                loadNotes();
            }, 500);
            
        } catch (error) {
            console.error('Ошибка очистки:', error);
            showNotification(`Ошибка при очистке заметок: ${error.message}`, 'error');
        }
    }

    async function exportNotes() {
        try {
            const response = await fetch(`${API_URL}/notes`);
            const data = await response.json();
            
            const dataStr = JSON.stringify(data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `notes_${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            showNotification('Заметки экспортированы', 'success');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            showNotification('Ошибка при экспорте заметок', 'error');
        }
    }

    async function importNotes() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const importedNotes = JSON.parse(text);
                
                if (!Array.isArray(importedNotes)) {
                    throw new Error('Неверный формат файла');
                }
                
                // Показываем одно уведомление о начале импорта
                showNotification(`Импорт ${importedNotes.length} заметок...`, 'info');
                
                let importedCount = 0;
                let errorCount = 0;
                
                for (const note of importedNotes) {
                    try {
                        const isImportant = note.is_important !== undefined 
                            ? note.is_important 
                            : note.important || false;
                        
                        const response = await fetch(`${API_URL}/notes`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: note.title || note.Title,
                                content: note.content || note.Content,
                                tags: note.tags || note.Tags || [],
                                is_important: isImportant
                            })
                        });
                        
                        if (response.ok) {
                            importedCount++;
                        } else {
                            errorCount++;
                        }
                        
                        // Не показываем уведомление для каждой заметки
                        
                    } catch (noteError) {
                        errorCount++;
                    }
                }
                
                // Показываем итоговое уведомление
                let message = `Импортировано ${importedCount} заметок`;
                if (errorCount > 0) {
                    message += ` (ошибок: ${errorCount})`;
                }
                
                showNotification(message, importedCount > 0 ? 'success' : 'error');
                await loadNotes();
            } catch (error) {
                console.error('Ошибка импорта:', error);
                showNotification('Ошибка при импорте файла', 'error');
            }
        };
        
        input.click();
    }

    function showConfirmModal(message, confirmCallback) {
        document.getElementById('confirmMessage').textContent = message;
        confirmModal.classList.add('active');
        
        const handleConfirm = () => {
            confirmCallback();
            confirmModal.classList.remove('active');
            cleanupListeners();
        };
        
        const handleCancel = () => {
            confirmModal.classList.remove('active');
            cleanupListeners();
        };
        
        function cleanupListeners() {
            confirmDeleteBtn.removeEventListener('click', handleConfirm);
            cancelDeleteBtn.removeEventListener('click', handleCancel);
        }
        
        confirmDeleteBtn.addEventListener('click', handleConfirm);
        cancelDeleteBtn.addEventListener('click', handleCancel);
    }

    // Массив активных уведомлений
    const activeNotifications = [];
    const MAX_NOTIFICATIONS = 3;

    function showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notificationArea');
        
        // Проверяем, не превышен ли лимит уведомлений
        if (activeNotifications.length >= MAX_NOTIFICATIONS) {
            // Удаляем самое старое уведомление
            const oldestNotification = activeNotifications.shift();
            if (oldestNotification && oldestNotification.element) {
                removeNotification(oldestNotification.element);
            }
        }
        
        const notificationId = 'notification-' + Date.now();
        
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;
        
        notificationArea.appendChild(notification);
        
        // Добавляем уведомление в активный список
        const notificationObj = {
            id: notificationId,
            element: notification,
            timeout: null
        };
        
        activeNotifications.push(notificationObj);
        
        // Автоматическое скрытие через 5 секунд
        notificationObj.timeout = setTimeout(() => {
            removeNotification(notification);
        }, 5000);
        
        // Обработчик закрытия по кнопке
        notification.querySelector('.close-notification').addEventListener('click', () => {
            removeNotification(notification);
        });
        
        return notificationId;
    }
    
    function removeNotification(notificationElement) {
        if (!notificationElement || !notificationElement.parentNode) return;
        
        // Находим объект уведомления в массиве
        const index = activeNotifications.findIndex(n => n.element === notificationElement);
        if (index !== -1) {
            // Очищаем таймер
            if (activeNotifications[index].timeout) {
                clearTimeout(activeNotifications[index].timeout);
            }
            // Удаляем из массива
            activeNotifications.splice(index, 1);
        }
        
        // Анимация скрытия
        notificationElement.style.opacity = '0';
        notificationElement.style.transform = 'translateX(100%)';
        
        // Удаляем из DOM после анимации
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setupEventListeners() {
        newNoteBtn.addEventListener('click', openNewNoteModal);
        
        closeModal.addEventListener('click', () => noteModal.classList.remove('active'));
        cancelBtn.addEventListener('click', () => noteModal.classList.remove('active'));
        
        noteForm.addEventListener('submit', saveNote);
        
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderNotes();
        });

        noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveNote(e);
        });

        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveNote(e);
        });
        
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderNotes();
        });
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                loadNotes();
            });
        });
        
        exportBtn.addEventListener('click', exportNotes);
        
        importBtn.addEventListener('click', importNotes);
        
        clearAllBtn.addEventListener('click', () => {
            clearAllModal.classList.add('active');
        });
        
        confirmClearAllBtn.addEventListener('click', async () => {
            try {
                clearAllModal.classList.remove('active');
                await clearAllNotes();
            } catch (error) {
                console.error('Ошибка при очистке:', error);
            }
        });
        
        cancelClearAllBtn.addEventListener('click', () => {
            clearAllModal.classList.remove('active');
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                openNewNoteModal(); 
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
                if (noteModal.classList.contains('active')) {
                    e.preventDefault();
                    saveBtn.click();
                }
            }
            
            if (e.key === 'Escape') {
                if (noteModal.classList.contains('active')) {
                    noteModal.classList.remove('active');
                }
                if (confirmModal.classList.contains('active')) {
                    confirmModal.classList.remove('active');
                }
                if (clearAllModal.classList.contains('active')) {
                    clearAllModal.classList.remove('active');
                }
            }
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === noteModal) {
                noteModal.classList.remove('active');
            }
            if (e.target === confirmModal) {
                confirmModal.classList.remove('active');
            }
            if (e.target === clearAllModal) {
                clearAllModal.classList.remove('active');
            }
        });
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            themeToggle.innerHTML = newTheme === 'dark' 
                ? '<i class="fas fa-sun"></i> Тема' 
                : '<i class="fas fa-moon"></i> Тема';
        });
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' 
            ? '<i class="fas fa-sun"></i> Тема' 
            : '<i class="fas fa-moon"></i> Тема';
    }
});
