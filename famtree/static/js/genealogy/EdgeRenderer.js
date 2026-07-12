/**
 * EdgeRenderer.js - Renders orthogonal family relationship edges
 * 
 * Features:
 * - Orthogonal routing (no diagonals)
 * - Smooth rounded corners
 * - Different styles for different relationships
 * - Marriage connector nodes (invisible)
 * - Path highlighting support
 */

class EdgeRenderer {
    constructor(config = {}) {
        this.config = {
            strokeWidth: 2.5,
            cornerRadius: 8,
            ...config
        };
        
        this.edgeColors = {
            'father-child': 'var(--male-color, #3a86ff)',
            'mother-child': 'var(--female-color, #ff006e)',
            'spouse': '#ef4565',
            'sibling': '#00ffcc'
        };
        
        this.edgeStyles = {
            'father-child': { 'stroke-width': 2, 'stroke-dasharray': 'none' },
            'mother-child': { 'stroke-width': 2, 'stroke-dasharray': 'none' },
            'spouse': { 'stroke-width': 2.5, 'stroke-dasharray': '5, 4' },
            'sibling': { 'stroke-width': 2.5, 'stroke-dasharray': '6, 4' }
        };
    }

    /**
     * Create SVG path with orthogonal routing and smooth corners
     */
    createEdgePath(source, target, type = 'father-child') {
        const startX = source.x;
        const startY = source.y;
        const endX = target.x;
        const endY = target.y;

        // Generate orthogonal path with rounded corners
        return this.orthoPath(startX, startY, endX, endY, this.config.cornerRadius);
    }

    /**
     * Orthogonal path generator with smooth curves
     */
    orthoPath(x1, y1, x2, y2, radius = 8) {
        // Determine routing direction
        const dx = x2 - x1;
        const dy = y2 - y1;

        // Path points for L-shape or Z-shape
        const mid = y1 + dy / 2;

        // Create smooth orthogonal path
        // Start -> Down -> Right -> Down -> End
        const path = `M ${x1} ${y1}
                     L ${x1} ${mid - radius}
                     Q ${x1} ${mid} ${x1 + (x2 > x1 ? radius : -radius)} ${mid}
                     L ${x2 - (x2 > x1 ? radius : -radius)} ${mid}
                     Q ${x2} ${mid} ${x2} ${mid + radius}
                     L ${x2} ${y2}`;

        return path;
    }

    /**
     * Create SVG line element for edge
     */
    createEdgeElement(edge) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `edge edge-${edge.type || 'unknown'}`);
        path.setAttribute('id', `edge-${edge.id || Math.random()}`);
        path.setAttribute('d', edge.pathData || '');
        
        const color = this.edgeColors[edge.type] || '#666';
        path.setAttribute('stroke', color);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        
        const style = this.edgeStyles[edge.type] || {};
        path.setAttribute('stroke-width', style['stroke-width'] || this.config.strokeWidth);
        if (style['stroke-dasharray']) {
            path.setAttribute('stroke-dasharray', style['stroke-dasharray']);
        }
        
        path.setAttribute('opacity', this.getEdgeOpacity(edge.type));
        
        return path;
    }

    /**
     * Get default opacity for edge type
     */
    getEdgeOpacity(type) {
        const opacities = {
            'spouse': 0.6,
            'sibling': 0.8,
            'father-child': 0.25,
            'mother-child': 0.25,
            'marriage': 0.0 // Invisible marriage connector
        };
        return opacities[type] || 0.3;
    }

    /**
     * Add path highlighting effect
     */
    addPathHighlight(edge, isHighlighted = true) {
        const edgeElement = document.getElementById(`edge-${edge.id}`);
        if (!edgeElement) return;

        if (isHighlighted) {
            edgeElement.classList.add('edge-highlight');
            edgeElement.setAttribute('stroke', 'var(--accent-hover, #9270f2)');
            edgeElement.setAttribute('stroke-width', '4');
            edgeElement.setAttribute('opacity', '0.95');
            edgeElement.setAttribute('filter', 'drop-shadow(0 0 6px var(--accent-hover, #9270f2))');
        } else {
            edgeElement.classList.remove('edge-highlight');
            const color = this.edgeColors[edge.type] || '#666';
            edgeElement.setAttribute('stroke', color);
            const style = this.edgeStyles[edge.type] || {};
            edgeElement.setAttribute('stroke-width', style['stroke-width'] || this.config.strokeWidth);
            edgeElement.setAttribute('opacity', this.getEdgeOpacity(edge.type));
            edgeElement.removeAttribute('filter');
        }
    }

    /**
     * Animate edge path traversal for relationship finder
     */
    async animatePathTraversal(pathIds, edges) {
        for (let i = 0; i < pathIds.length - 1; i++) {
            const sourceId = pathIds[i];
            const targetId = pathIds[i + 1];
            
            // Find edge between these nodes
            const edge = edges.find(e => 
                (e.source === sourceId && e.target === targetId) ||
                (e.source === targetId && e.target === sourceId)
            );
            
            if (edge) {
                this.addPathHighlight(edge, true);
                await this.sleep(300); // Hold for 300ms
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset all edge highlights
     */
    resetHighlights() {
        document.querySelectorAll('.edge-highlight').forEach(edge => {
            edge.classList.remove('edge-highlight');
            const type = edge.getAttribute('class').match(/edge-(\w+)/)?.[1];
            const color = this.edgeColors[type] || '#666';
            edge.setAttribute('stroke', color);
            const style = this.edgeStyles[type] || {};
            edge.setAttribute('stroke-width', style['stroke-width'] || this.config.strokeWidth);
            edge.setAttribute('opacity', this.getEdgeOpacity(type));
            edge.removeAttribute('filter');
        });
    }
}
