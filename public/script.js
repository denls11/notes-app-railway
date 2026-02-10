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

    async function loadNotes() {
        try {
            let url = `${API_URL}/notes`;
            const params = new URLSearchParams();
            
            if (currentFilter && currentFilter !== 'all') {
                params.append('filter', currentFilter);
            }
            
            if (currentSearch) {
                params.append('search', currentSearch);
            }
            
            if (currentSort) {
                params.append('sort', currentSort);
            }
            
            const queryString = params.toString();
            if (queryString) {
                url += `?${queryString}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            notes = data.map(note => ({
                id: note._id || note.id,
                title: note.title,
                content: note.content,
                tags: note.tags || [],
                important: note.is_important || false,
                deleted: note.is_deleted || false,
                createdAt: note.created_at,
                updatedAt: note.updated_at
            }));
            
            renderNotes();
        } catch (error) {
            console.error('Ошибка при загрузке заметок:', error);
            showNotification('Не удалось загрузить заметки', 'error');
        }
    }

    function renderNotes() {
        notesContainer.innerHTML = '';
        
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
        noteDiv.className = `note ${note.important ? 'important' : ''} ${note.deleted ? 'deleted' : ''}`;
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
                    <button class="note-btn delete" title="Удалить в корзину">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <button class="note-btn restore" title="Восстановить">
                        <i class="fas fa-undo"></i>
                    </button>
                `}
            </div>
        `;
        
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
            toggleImportant(note.id);
        });
        
        if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmModal('Переместить заметку в корзину?', () => {
                deleteNote(note.id);
            });
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
            noteImportant.checked = note.is_important || false;
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
            const noteData = {
                title,
                content,
                tags,
                important: noteImportant.checked
            };
            
            if (currentNoteId) {
                const response = await fetch(`${API_URL}/notes/${currentNoteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
                
                if (!response.ok) throw new Error('Ошибка обновления');
                showNotification('Заметка обновлена', 'success');
            } else {
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

    async function toggleImportant(id) {
        try {
            const note = notes.find(n => n.id === id);
            if (!note) return;
            
            const newImportantStatus = !note.important;
            
            const response = await fetch(`${API_URL}/notes/${id}/important`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ important: newImportantStatus })
            });
            
            if (!response.ok) throw new Error('Ошибка обновления');
            
            showNotification(
                newImportantStatus 
                    ? 'Заметка помечена как важная' 
                    : 'Снята отметка важности', 
                'info'
            );
            
            await loadNotes();
            
        } catch (error) {
            console.error('Ошибка обновления важности:', error);
            showNotification('Ошибка при обновлении заметки', 'error');
        }
    }

    async function clearAllNotes() {
        try {
            // Получаем все активные заметки
            const allNotesResponse = await fetch(`${API_URL}/notes?filter=all`);
            const allNotes = await allNotesResponse.json();
            
            const activeNotes = allNotes.filter(note => !note.is_deleted);
            
            if (activeNotes.length === 0) {
                showNotification('Нет активных заметок для удаления', 'info');
                return;
            }
            
            showConfirmModal(`Переместить ${activeNotes.length} заметок в корзину?`, async () => {
                showNotification(`Перемещаю ${activeNotes.length} заметок в корзину...`, 'info');
                
                let movedCount = 0;
                
                for (const note of activeNotes) {
                    try {
                        await fetch(`${API_URL}/notes/${note._id || note.id}`, {
                            method: 'DELETE'
                        });
                        movedCount++;
                        
                        if (movedCount % 5 === 0) {
                            showNotification(`Перемещено ${movedCount}/${activeNotes.length}...`, 'info');
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (error) {
                        console.error(`Ошибка удаления заметки:`, error);
                    }
                }
                
                showNotification(`${movedCount} заметок перемещено в корзину`, 'success');
                await loadNotes();
            });
            
        } catch (error) {
            console.error('Ошибка очистки всех заметок:', error);
            showNotification('Ошибка при удалении заметок', 'error');
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
                    await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: note.title,
                            content: note.content,
                            tags: note.tags || [],
                            important: note.is_important || false
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
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveNote(e);
        });
        
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderNotes();
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
});
