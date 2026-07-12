/**
 * NodeRenderer.js - Renders professional genealogy cards
 * 
 * Displays:
 * - Profile picture
 * - Name and surname
 * - Birth/death years
 * - Gender indicator
 * - Logged-in user badge
 * - Family surname color strip
 */

class NodeRenderer {
    constructor(config = {}) {
        this.config = {
            cardWidth: 220,
            cardHeight: 140,
            avatarSize: 60,
            ...config
        };
        
        this.surnameColors = {};
    }

    /**
     * Build surname color map
     */
    buildSurnameColors(nodes) {
        const surnameSet = [...new Set(nodes.map(n => n.surname).filter(Boolean))];
        const palette = [
            '#7b61ff', '#2cb67d', '#e16162', '#ff8906', '#3da9fc',
            '#ef4565', '#f9bc60', '#72757e', '#e45858', '#7f5af0',
            '#00d9ff', '#26de81', '#feed4d', '#fc5a8d', '#a29bfe'
        ];
        
        surnameSet.forEach((surname, i) => {
            this.surnameColors[surname] = palette[i % palette.length];
        });
        
        return this.surnameColors;
    }

    /**
     * Create SVG group for node card
     */
    createNodeElement(node, isLoggedInUser = false) {
        // Simplified: render only a circle node (no card)
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `node-card ${node.gender === 'M' ? 'male' : node.gender === 'F' ? 'female' : 'other'}`);
        g.setAttribute('id', `node-${node.id}`);
        g.setAttribute('data-node-id', node.id);

        const radius = this.config.avatarSize ? Math.max(12, this.config.avatarSize / 3) : 18;

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', 'var(--node-fill, #1a1a1e)');
        circle.setAttribute('stroke', node.gender === 'M' ? 'var(--male-color, #3a86ff)' : node.gender === 'F' ? 'var(--female-color, #ff006e)' : 'var(--other-color, #888)');
        circle.setAttribute('stroke-width', '3');
        circle.setAttribute('class', 'node-circle');
        g.appendChild(circle);

        // Optional small initials inside circle
        const initials = (node.name ? node.name[0] : '?') + (node.surname ? node.surname[0] : '');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', Math.max(10, radius - 6));
        text.setAttribute('fill', 'var(--text-main, #fffffe)');
        text.setAttribute('pointer-events', 'none');
        text.textContent = initials.trim();
        g.appendChild(text);

        return g;
    }

    /**
     * Create small badge
     */
    createBadge(x, y, text, color) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 8);
        circle.setAttribute('fill', color);
        circle.setAttribute('opacity', '0.8');
        g.appendChild(circle);

        const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badgeText.setAttribute('x', x);
        badgeText.setAttribute('y', y);
        badgeText.setAttribute('text-anchor', 'middle');
        badgeText.setAttribute('dominant-baseline', 'central');
        badgeText.setAttribute('font-size', '10');
        badgeText.setAttribute('fill', '#fff');
        badgeText.setAttribute('font-weight', 'bold');
        badgeText.textContent = text;
        g.appendChild(badgeText);

        return g;
    }

    /**
     * Add hover animations
     */
    addInteraction(element, node) {
        element.style.cursor = 'pointer';

        element.addEventListener('mouseenter', () => {
            element.classList.add('node-hover');
        });
        element.addEventListener('mouseleave', () => {
            element.classList.remove('node-hover');
        });

        // Enable pointer drag on node to reposition it.
        // Emits a document-level CustomEvent 'node:moved' with detail {id, x, y} on drag end.
        let dragging = false;
        let startPoint = null;
        let startX = 0, startY = 0;

        const svg = element.ownerSVGElement;
        if (!svg) return;

        const toSVGPoint = (evt) => {
            const p = svg.createSVGPoint();
            p.x = evt.clientX;
            p.y = evt.clientY;
            return p.matrixTransform(svg.getScreenCTM().inverse());
        };

        element.addEventListener('pointerdown', (evt) => {
            evt.stopPropagation();
            element.setPointerCapture(evt.pointerId);
            dragging = true;
            startPoint = toSVGPoint(evt);

            // read current transform translate
            const tr = element.getAttribute('transform') || 'translate(0, 0)';
            const m = tr.match(/translate\(([-0-9.]+)\s*,?\s*([-0-9.]+)\)/);
            if (m) {
                startX = parseFloat(m[1]);
                startY = parseFloat(m[2]);
            } else {
                startX = 0; startY = 0;
            }
        });

        element.addEventListener('pointermove', (evt) => {
            if (!dragging) return;
            evt.preventDefault();
            const pt = toSVGPoint(evt);
            const dx = pt.x - startPoint.x;
            const dy = pt.y - startPoint.y;
            const newX = startX + dx;
            const newY = startY + dy;
            element.setAttribute('transform', `translate(${newX}, ${newY})`);
        });

        element.addEventListener('pointerup', (evt) => {
            if (!dragging) return;
            dragging = false;
            try { element.releasePointerCapture(evt.pointerId); } catch (e) {}

            // read final transform
            const tr = element.getAttribute('transform') || 'translate(0, 0)';
            const m = tr.match(/translate\(([-0-9.]+)\s*,?\s*([-0-9.]+)\)/);
            let finalX = 0, finalY = 0;
            if (m) {
                finalX = parseFloat(m[1]);
                finalY = parseFloat(m[2]);
            }

            // Dispatch move event so viewer can persist and re-render edges
            const detail = { id: node ? node.id : parseInt(element.getAttribute('data-node-id')), x: finalX, y: finalY };
            document.dispatchEvent(new CustomEvent('node:moved', { detail }));
        });
    }
}
