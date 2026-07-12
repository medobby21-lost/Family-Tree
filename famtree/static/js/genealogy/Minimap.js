/**
 * Minimap.js - Displays minimap showing current viewport and tree outline
 * 
 * Features:
 * - Shows full tree overview
 * - Highlights current viewport
 * - Click to navigate
 * - Toggle visibility
 */

class Minimap {
    constructor(config = {}) {
        this.config = {
            width: 220,
            height: 180,
            padding: 10,
            containerSelector: '.main-container',
            ...config
        };

        this.minimapCanvas = null;
        this.minimapContext = null;
        this.viewport = null;
        this.treeNodes = null;
        this.isVisible = true;
    }

    /**
     * Create minimap UI
     */
    create() {
        const container = document.querySelector(this.config.containerSelector);
        if (!container) return;

        // Create minimap container
        const minimapDiv = document.createElement('div');
        minimapDiv.className = 'minimap-container';
        minimapDiv.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            width: ${this.config.width}px;
            height: ${this.config.height}px;
            background: rgba(26, 26, 30, 0.9);
            border: 1px solid var(--border-color, #2a2a2e);
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            z-index: 50;
            cursor: pointer;
            transition: opacity 200ms;
        `;

        // Create canvas
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = this.config.width;
        this.minimapCanvas.height = this.config.height;
        this.minimapCanvas.style.cssText = 'display: block; width: 100%; height: 100%;';
        
        this.minimapContext = this.minimapCanvas.getContext('2d');

        // Add click handler
        this.minimapCanvas.addEventListener('click', (e) => this.onMinimapClick(e));

        minimapDiv.appendChild(this.minimapCanvas);
        container.appendChild(minimapDiv);

        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '🗺';
        toggleBtn.style.cssText = `
            position: absolute;
            bottom: ${20 + this.config.height + 20}px;
            left: 20px;
            width: 40px;
            height: 40px;
            background: rgba(26, 26, 30, 0.85);
            border: 1px solid var(--border-color, #2a2a2e);
            border-radius: 8px;
            color: var(--text-main, #fffffe);
            font-size: 18px;
            cursor: pointer;
            z-index: 50;
            transition: all 200ms;
        `;
        
        toggleBtn.addEventListener('click', () => this.toggle());
        toggleBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(127, 90, 240, 0.2)';
            this.style.borderColor = 'var(--accent, #7f5af0)';
        });
        toggleBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(26, 26, 30, 0.85)';
            this.style.borderColor = 'var(--border-color, #2a2a2e)';
        });

        container.appendChild(toggleBtn);

        return minimapDiv;
    }

    /**
     * Update minimap with current data
     */
    update(nodes, edges, viewport) {
        if (!this.minimapContext) return;

        this.treeNodes = nodes;
        this.viewport = viewport;

        // Clear canvas
        this.minimapContext.fillStyle = 'rgba(26, 26, 30, 0.5)';
        this.minimapContext.fillRect(0, 0, this.config.width, this.config.height);

        if (!nodes || nodes.length === 0) return;

        // Calculate bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x - node.width / 2);
            maxX = Math.max(maxX, node.x + node.width / 2);
            minY = Math.min(minY, node.y - node.height / 2);
            maxY = Math.max(maxY, node.y + node.height / 2);
        });

        const padding = this.config.padding;
        const scale = {
            x: (this.config.width - padding * 2) / (maxX - minX + 1),
            y: (this.config.height - padding * 2) / (maxY - minY + 1)
        };

        // Draw tree outline
        this.minimapContext.strokeStyle = 'rgba(127, 90, 240, 0.3)';
        this.minimapContext.lineWidth = 1;
        
        edges?.forEach(edge => {
            const x1 = (edge.source.x - minX) * scale.x + padding;
            const y1 = (edge.source.y - minY) * scale.y + padding;
            const x2 = (edge.target.x - minX) * scale.x + padding;
            const y2 = (edge.target.y - minY) * scale.y + padding;

            this.minimapContext.beginPath();
            this.minimapContext.moveTo(x1, y1);
            this.minimapContext.lineTo(x2, y2);
            this.minimapContext.stroke();
        });

        // Draw nodes
        nodes.forEach(node => {
            const x = (node.x - minX) * scale.x + padding;
            const y = (node.y - minY) * scale.y + padding;
            const size = 3;

            this.minimapContext.fillStyle = '#7f5af0';
            this.minimapContext.fillRect(x - size / 2, y - size / 2, size, size);
        });

        // Draw viewport rectangle
        if (viewport) {
            const vpX = (viewport.x - minX) * scale.x + padding;
            const vpY = (viewport.y - minY) * scale.y + padding;
            const vpW = viewport.width * scale.x;
            const vpH = viewport.height * scale.y;

            this.minimapContext.strokeStyle = 'var(--accent, #7f5af0)';
            this.minimapContext.lineWidth = 2;
            this.minimapContext.strokeRect(vpX, vpY, vpW, vpH);

            // Highlight viewport
            this.minimapContext.fillStyle = 'rgba(127, 90, 240, 0.1)';
            this.minimapContext.fillRect(vpX, vpY, vpW, vpH);
        }
    }

    /**
     * Handle minimap click to navigate
     */
    onMinimapClick(event) {
        if (!this.treeNodes || this.treeNodes.length === 0) return;

        const rect = this.minimapCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Find closest node
        let closestNode = null;
        let closestDist = Infinity;

        this.treeNodes.forEach(node => {
            // Scale node position to minimap
            const padding = this.config.padding;
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            this.treeNodes.forEach(n => {
                minX = Math.min(minX, n.x - n.width / 2);
                maxX = Math.max(maxX, n.x + n.width / 2);
                minY = Math.min(minY, n.y - n.height / 2);
                maxY = Math.max(maxY, n.y + n.height / 2);
            });

            const scale = {
                x: (this.config.width - padding * 2) / (maxX - minX + 1),
                y: (this.config.height - padding * 2) / (maxY - minY + 1)
            };

            const nodeX = (node.x - minX) * scale.x + padding;
            const nodeY = (node.y - minY) * scale.y + padding;
            const dist = Math.hypot(nodeX - x, nodeY - y);

            if (dist < closestDist) {
                closestDist = dist;
                closestNode = node;
            }
        });

        if (closestNode && window.genealogyViewer) {
            window.genealogyViewer.cameraController.centerAndZoomToNode(closestNode, 1.2);
        }
    }

    /**
     * Toggle minimap visibility
     */
    toggle() {
        this.isVisible = !this.isVisible;
        const minimap = document.querySelector('.minimap-container');
        if (minimap) {
            minimap.style.opacity = this.isVisible ? '1' : '0';
            minimap.style.pointerEvents = this.isVisible ? 'auto' : 'none';
        }
    }

    /**
     * Show minimap
     */
    show() {
        this.isVisible = true;
        const minimap = document.querySelector('.minimap-container');
        if (minimap) {
            minimap.style.opacity = '1';
            minimap.style.pointerEvents = 'auto';
        }
    }

    /**
     * Hide minimap
     */
    hide() {
        this.isVisible = false;
        const minimap = document.querySelector('.minimap-container');
        if (minimap) {
            minimap.style.opacity = '0';
            minimap.style.pointerEvents = 'none';
        }
    }
}
