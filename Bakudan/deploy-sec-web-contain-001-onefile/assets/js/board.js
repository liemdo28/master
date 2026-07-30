/**
 * TaskFlow - Board View (Kanban Drag & Drop)
 * Pure JS implementation - no library needed
 */

(function() {
    let draggedCard = null;
    let draggedFromSection = null;
    let placeholder = null;

    // Create placeholder element
    function createPlaceholder() {
        const el = document.createElement('div');
        el.className = 'task-card';
        el.style.border = '2px dashed var(--gray-300)';
        el.style.background = 'var(--gray-100)';
        el.style.height = '60px';
        el.style.opacity = '0.5';
        el.id = 'drag-placeholder';
        return el;
    }

    // Initialize drag events on all task cards
    function initDragDrop() {
        const cards = document.querySelectorAll('.task-card[draggable="true"]');
        const columns = document.querySelectorAll('.column-tasks');

        cards.forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        columns.forEach(col => {
            col.addEventListener('dragover', handleDragOver);
            col.addEventListener('dragenter', handleDragEnter);
            col.addEventListener('dragleave', handleDragLeave);
            col.addEventListener('drop', handleDrop);
        });
    }

    function handleDragStart(e) {
        draggedCard = this;
        draggedFromSection = this.closest('.column-tasks').dataset.sectionId;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.taskId);

        placeholder = createPlaceholder();

        // Delay hiding to allow drag image
        setTimeout(() => {
            this.style.display = 'none';
        }, 0);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        this.style.display = '';

        // Remove placeholder
        const ph = document.getElementById('drag-placeholder');
        if (ph) ph.remove();

        // Remove any drag-over styles
        document.querySelectorAll('.column-tasks').forEach(col => {
            col.style.background = '';
        });

        draggedCard = null;
        placeholder = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const column = this;
        const afterElement = getDragAfterElement(column, e.clientY);

        const ph = document.getElementById('drag-placeholder');
        if (!ph && placeholder) {
            if (afterElement) {
                column.insertBefore(placeholder, afterElement);
            } else {
                column.appendChild(placeholder);
            }
        } else if (ph) {
            if (afterElement) {
                column.insertBefore(ph, afterElement);
            } else {
                column.appendChild(ph);
            }
        }
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.style.background = 'var(--red-50)';
    }

    function handleDragLeave(e) {
        // Only remove style if actually leaving the column
        const rect = this.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
            this.style.background = '';
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        this.style.background = '';

        if (!draggedCard) return;

        const taskId = draggedCard.dataset.taskId;
        const newSectionId = this.dataset.sectionId;
        const newStatus = this.dataset.status; // status-based board

        // Remove placeholder
        const ph = document.getElementById('drag-placeholder');

        // Insert card at placeholder position
        if (ph) {
            this.insertBefore(draggedCard, ph);
            ph.remove();
        } else {
            this.appendChild(draggedCard);
        }

        draggedCard.style.display = '';

        // Calculate new position
        const cards = this.querySelectorAll('.task-card[data-task-id]');
        let position = 0;
        cards.forEach((card, index) => {
            if (card.dataset.taskId === taskId) {
                position = index;
            }
        });

        // Send update to server — status board uses /status endpoint, person board uses /move
        const url = newStatus
            ? APP_URL + '/api/tasks/' + taskId + '/status'
            : APP_URL + '/api/tasks/' + taskId + '/move';
        const payload = newStatus
            ? { status: newStatus }
            : { section_id: parseInt(newSectionId), position: position };

        apiRequest(url, 'POST', payload).then(() => {
            updateColumnCounts();
            // Update status badge on card visually
            if (newStatus) {
                const badge = draggedCard.querySelector('.badge');
                if (badge) {
                    const labels = { todo:'To Do', in_progress:'In Progress', review:'Review', done:'Done' };
                    badge.textContent = labels[newStatus] || newStatus;
                    badge.className = 'badge badge-' + (newStatus === 'in_progress' ? 'inprog' : newStatus === 'review' ? 'review' : newStatus === 'done' ? 'done' : 'member');
                }
                // Mark as done visually
                if (newStatus === 'done') draggedCard.classList.add('task-card-done');
                else draggedCard.classList.remove('task-card-done');
            }
        }).catch(err => {
            console.error('Move failed:', err);
            location.reload();
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging):not(#drag-placeholder)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateColumnCounts() {
        document.querySelectorAll('.board-column').forEach(col => {
            const tasks = col.querySelectorAll('.column-tasks .task-card[data-task-id]');
            const countEl = col.querySelector('.column-header .count');
            if (countEl) {
                countEl.textContent = tasks.length;
            }
        });
    }

    // Init when DOM ready
    if (document.querySelector('.board-container')) {
        initDragDrop();
    }
})();
