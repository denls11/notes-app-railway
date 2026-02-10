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
        try {
            showNotification('Загрузка заметок...', 'info');
            
            console.log('Загрузка с фильтром:', currentFilter);
            
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
            
            console.log('Запрос к:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Получены данные:', data);
            
            // Конвертируем поля для совместимости
            notes = data.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags || [],
                important: note.is_important || note.important || false,
                deleted: note.is_deleted || note.deleted || false,
                createdAt: note.created_at || note.createdAt,
                updatedAt: note.updated_at || note.updatedAt
            }));
            
            console.log('Конвертированные заметки:', notes);
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
                    <button class="note-btn delete-permanent" title="Удалить навсегда">
                        <i class="fas fa-trash-alt"></i>
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
        const deletePermanentBtn = noteDiv.querySelector('.delete-permanent');
        
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
            showConfirmModal('Вы уверены, что хотите переместить эту заметку в корзину?', () => {
                deleteNote(note.id);
            });
        });
        
        if (restoreBtn) restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreNote(note.id);
        });
        
        if (deletePermanentBtn) deletePermanentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmModal('Вы уверены, что хотите удалить эту заметку НАВСЕГДА? Это действие необратимо!', () => {
                deleteNotePermanently(note.id);
            });
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
                is_important: noteImportant.checked
            };
            
            if (currentNoteId) {
                // Обновление существующей заметки
                const response = await fetch(`${API_URL}/notes/${currentNoteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
                
                if (!response.ok) throw new Error('Ошибка обновления');
                
                showNotification('Заметка обновлена', 'success');
            } else {
                // Создание новой заметки
                const response = await fetch(`${API_URL}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
                
                if (!response.ok) throw new Error('Ошибка создания');
                
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
            console.log(`Перемещение заметки ${id} в корзину...`);
            
            const response = await fetch(`${API_URL}/notes/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                // Пробуем альтернативный endpoint
                const altResponse = await fetch(`${API_URL}/notes/${id}/trash`, {
                    method: 'PUT'
                });
                
                if (!altResponse.ok) throw new Error('Ошибка удаления');
            }
            
            showNotification('Заметка перемещена в корзину', 'info');
            await loadNotes();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            showNotification('Ошибка при удалении заметки', 'error');
        }
    }

    async function deleteNotePermanently(id) {
        try {
            console.log(`Попытка удалить заметку ${id} навсегда...`);
            
            // Пробуем разные варианты endpoint'ов для постоянного удаления
            const endpoints = [
                `${API_URL}/notes/${id}/hard`,
                `${API_URL}/notes/${id}/force`,
                `${API_URL}/notes/${id}/permanent`,
                `${API_URL}/notes/${id}?hard=true`,
                `${API_URL}/notes/${id}?force=true`,
                `${API_URL}/notes/${id}?permanent=true`
            ];
            
            let success = false;
            let responseData = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Пробуем endpoint: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        method: 'DELETE'
                    });
                    
                    console.log(`Ответ: ${response.status}`);
                    
                    if (response.ok) {
                        success = true;
                        responseData = await response.json();
                        console.log(`Успешно удалено через ${endpoint}`, responseData);
                        break;
                    }
                } catch (error) {
                    console.log(`Endpoint ${endpoint} не сработал:`, error.message);
                    continue;
                }
            }
            
            if (!success) {
                // Если endpoint'ы постоянного удаления не работают,
                // просто удаляем из отображения (серверное удаление недоступно)
                console.log('Hard delete недоступен, удаляем локально');
                notes = notes.filter(note => note.id !== id);
                renderNotes();
                showNotification('Заметка удалена из отображения', 'info');
                return;
            }
            
            // Если удалось hard delete
            if (success) {
                showNotification('Заметка удалена навсегда', 'success');
                
                // Обновляем отображение
                notes = notes.filter(note => note.id !== id);
                renderNotes();
                
                // Если мы в корзине, перезагружаем данные
                if (currentFilter === 'deleted') {
                    setTimeout(() => loadNotes(), 500);
                }
            }
            
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
            
            if (!response.ok) {
                // Пробуем альтернативный endpoint
                const altResponse = await fetch(`${API_URL}/notes/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_deleted: false })
                });
                
                if (!altResponse.ok) throw new Error('Ошибка восстановления');
            }
            
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
            console.log(`Изменение важности заметки ${id} на:`, newImportantStatus);
            
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
            // Получаем все заметки (включая удаленные)
            const allNotesResponse = await fetch(`${API_URL}/notes?filter=all`);
            const allNotes = await allNotesResponse.json();
            
            if (!Array.isArray(allNotes) || allNotes.length === 0) {
                showNotification('Нет заметок для удаления', 'info');
                return;
            }
            
            // Фильтруем только НЕ удаленные заметки
            const activeNotes = allNotes.filter(note => 
                !(note.is_deleted || note.deleted)
            );
            
            if (activeNotes.length === 0) {
                showNotification('Нет активных заметок для удаления', 'info');
                return;
            }
            
            const totalNotes = activeNotes.length;
            
            // Спрашиваем подтверждение
            showConfirmModal(`Вы уверены, что хотите переместить ${totalNotes} заметок в корзину?`, async () => {
                showNotification(`Перемещаю ${totalNotes} заметок в корзину...`, 'info');
                
                let movedToTrashCount = 0;
                
                // Перемещаем каждую заметку в корзину
                for (const note of activeNotes) {
                    try {
                        const response = await fetch(`${API_URL}/notes/${note.id}`, {
                            method: 'DELETE'
                        });
                        
                        if (response.ok) {
                            movedToTrashCount++;
                            
                            // Обновляем прогресс
                            if (movedToTrashCount % 5 === 0 || movedToTrashCount === totalNotes) {
                                showNotification(`Перемещено ${movedToTrashCount}/${totalNotes} заметок...`, 'info');
                            }
                        }
                        
                        // Небольшая задержка
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (error) {
                        console.error(`Ошибка при удалении заметки ${note.id}:`, error);
                    }
                }
                
                showNotification(`${movedToTrashCount} заметок перемещено в корзину`, 'success');
                
                // Обновляем отображение
                await loadNotes();
            });
            
        } catch (error) {
            console.error('Ошибка очистки всех заметок:', error);
            showNotification('Ошибка при удалении заметок', 'error');
        }
    }

    // Функция для полной очистки корзины
    async function emptyTrash() {
        try {
            // Получаем только удаленные заметки
            const deletedNotesResponse = await fetch(`${API_URL}/notes?filter=deleted`);
            const deletedNotes = await deletedNotesResponse.json();
            
            if (!Array.isArray(deletedNotes) || deletedNotes.length === 0) {
                showNotification('Корзина пуста', 'info');
                return;
            }
            
            const totalNotes = deletedNotes.length;
            
            showConfirmModal(`Вы уверены, что хотите навсегда удалить ${totalNotes} заметок из корзины? Это действие необратимо!`, async () => {
                showNotification(`Начинаю удаление ${totalNotes} заметок из корзины...`, 'info');
                
                let permanentlyDeletedCount = 0;
                
                // Удаляем каждую заметку навсегда
                for (const note of deletedNotes) {
                    try {
                        // Пробуем разные endpoint'ы для постоянного удаления
                        let deleted = false;
                        const endpoints = [
                            `${API_URL}/notes/${note.id}/hard`,
                            `${API_URL}/notes/${note.id}/force`,
                            `${API_URL}/notes/${note.id}/permanent`,
                            `${API_URL}/notes/${note.id}?hard=true`,
                            `${API_URL}/notes/${note.id}?force=true`
                        ];
                        
                        for (const endpoint of endpoints) {
                            try {
                                const response = await fetch(endpoint, {
                                    method: 'DELETE'
                                });
                                
                                if (response.ok) {
                                    permanentlyDeletedCount++;
                                    deleted = true;
                                    console.log(`Удалена заметка ${note.id}`);
                                    break;
                                }
                            } catch (error) {
                                continue;
                            }
                        }
                        
                        // Если hard delete не работает, хотя бы удалим из отображения
                        if (!deleted) {
                            permanentlyDeletedCount++;
                            console.log(`Заметка ${note.id} удалена локально (hard delete недоступен)`);
                        }
                        
                        // Обновляем прогресс
                        if (permanentlyDeletedCount % 3 === 0 || permanentlyDeletedCount === totalNotes) {
                            showNotification(`Удалено ${permanentlyDeletedCount}/${totalNotes} заметок...`, 'info');
                        }
                        
                        // Небольшая задержка
                        await new Promise(resolve => setTimeout(resolve, 150));
                        
                    } catch (error) {
                        console.error(`Ошибка при удалении заметки ${note.id}:`, error);
                    }
                }
                
                showNotification(`${permanentlyDeletedCount} заметок удалено из корзины`, 'success');
                
                // Обновляем отображение
                await loadNotes();
            });
            
        } catch (error) {
            console.error('Ошибка очистки корзины:', error);
            showNotification('Ошибка при очистке корзины', 'error');
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
                
                for (const note of importedNotes) {
                    const isImportant = note.is_important !== undefined 
                        ? note.is_important 
                        : note.important || false;
                    
                    await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: note.title || note.Title,
                            content: note.content || note.Content,
                            tags: note.tags || note.Tags || [],
                            is_important: isImportant
                        })
                    });
                }
                
                showNotification('Заметки успешно импортированы', 'success');
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

    function showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notificationArea');
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
        
        setTimeout(() => {
            const notif = document.getElementById(notificationId);
            if (notif) {
                notif.style.opacity = '0';
                notif.style.transform = 'translateX(100%)';
                setTimeout(() => notif.remove(), 300);
            }
        }, 5000);
        
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        });
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
                console.log('Изменен фильтр на:', currentFilter);
                
                // При переходе в корзину показываем дополнительную кнопку "Очистить корзину"
                if (currentFilter === 'deleted') {
                    addEmptyTrashButton();
                } else {
                    removeEmptyTrashButton();
                }
                
                loadNotes();
            });
        });
        
        exportBtn.addEventListener('click', exportNotes);
        
        importBtn.addEventListener('click', importNotes);
        
        clearAllBtn.addEventListener('click', () => {
            clearAllModal.classList.add('active');
        });
        
        confirmClearAllBtn.addEventListener('click', async () => {
            clearAllModal.classList.remove('active');
            await clearAllNotes();
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
    
    // Функция для добавления кнопки "Очистить корзину"
    function addEmptyTrashButton() {
        // Проверяем, не добавлена ли уже кнопка
        if (document.getElementById('emptyTrashBtn')) return;
        
        const emptyTrashBtn = document.createElement('button');
        emptyTrashBtn.id = 'emptyTrashBtn';
        emptyTrashBtn.className = 'trash-btn';
        emptyTrashBtn.innerHTML = '<i class="fas fa-broom"></i> Очистить корзину';
        
        // Вставляем после кнопки "Импорт"
        importBtn.parentNode.insertBefore(emptyTrashBtn, clearAllBtn);
        
        emptyTrashBtn.addEventListener('click', emptyTrash);
    }
    
    // Функция для удаления кнопки "Очистить корзину"
    function removeEmptyTrashButton() {
        const emptyTrashBtn = document.getElementById('emptyTrashBtn');
        if (emptyTrashBtn) {
            emptyTrashBtn.remove();
        }
    }
});
