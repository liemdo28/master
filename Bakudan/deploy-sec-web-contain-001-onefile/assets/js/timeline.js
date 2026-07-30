/**
 * TaskFlow - Timeline View
 * Simple Gantt-like visualization
 */

(function() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    // Add today line
    const header = container.querySelector('.timeline-header');
    if (header) {
        const todayCol = header.querySelector('.day.today');
        if (todayCol) {
            const rect = todayCol.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const left = rect.left - containerRect.left + rect.width / 2;

            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                left: ${left}px;
                top: 0;
                bottom: 0;
                width: 2px;
                background: var(--red-400);
                opacity: 0.5;
                z-index: 1;
                pointer-events: none;
            `;
            container.style.position = 'relative';
            container.appendChild(line);
        }
    }

    // Tooltip on hover for timeline bars
    const bars = container.querySelectorAll('.timeline-bar');
    bars.forEach(bar => {
        bar.addEventListener('mouseenter', function(e) {
            this.style.opacity = '0.85';
            this.style.zIndex = '10';
            this.style.transform = 'scaleY(1.1)';
        });
        bar.addEventListener('mouseleave', function() {
            this.style.opacity = '';
            this.style.zIndex = '';
            this.style.transform = '';
        });
    });
})();
