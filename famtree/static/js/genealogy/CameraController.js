/**
 * CameraController.js - Manages viewport, zoom, pan, and navigation
 * 
 * Features:
 * - Smooth zoom (mouse wheel)
 * - Smooth pan (click and drag)
 * - Double-click to center
 * - Animate to node
 * - "Center on Me" button
 * - Minimap support
 */

class CameraController {
    constructor(svgElement, svgGroup, config = {}) {
        this.svg = svgElement;
        this.svgGroup = svgGroup;
        
        this.config = {
            minZoom: 0.1,
            maxZoom: 3,
            zoomDuration: 300,
            panDuration: 500,
            ...config
        };

        this.currentTransform = {
            x: 0,
            y: 0,
            k: 1
        };

        this.setupZoomBehavior();
    }

    /**
     * Setup D3 zoom behavior
     */
    setupZoomBehavior() {
        const zoom = d3.zoom()
            .scaleExtent([this.config.minZoom, this.config.maxZoom])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.applyTransform(event.transform);
            });
        
        d3.select(this.svg).call(zoom);
    }

    /**
     * Apply SVG transform
     */
    applyTransform(transform) {
        if (transform) {
            this.svgGroup.setAttribute('transform', 
                `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
        }
    }

    /**
     * Smoothly zoom to a specific level
     */
    zoomTo(targetScale) {
        const transition = d3.transition().duration(this.config.zoomDuration);
        
        const newTransform = d3.zoomIdentity
            .translate(this.currentTransform.x, this.currentTransform.y)
            .scale(targetScale);
        
        d3.select(this.svg)
            .transition(transition)
            .call(d3.zoom().transform, newTransform);
    }

    /**
     * Smoothly pan to node
     */
    panToNode(node) {
        if (!node) return;

        const svgWidth = this.svg.getBoundingClientRect().width;
        const svgHeight = this.svg.getBoundingClientRect().height;

        // Calculate translation to center node
        const tx = svgWidth / 2 - node.x * this.currentTransform.k;
        const ty = svgHeight / 2 - node.y * this.currentTransform.k;

        const newTransform = d3.zoomIdentity
            .translate(tx, ty)
            .scale(this.currentTransform.k);

        const transition = d3.transition().duration(this.config.panDuration);
        
        d3.select(this.svg)
            .transition(transition)
            .call(d3.zoom().transform, newTransform);
    }

    /**
     * Smoothly center and zoom to node
     */
    centerAndZoomToNode(node, targetScale = 1.2) {
        if (!node) return;

        const svgWidth = this.svg.getBoundingClientRect().width;
        const svgHeight = this.svg.getBoundingClientRect().height;

        const tx = svgWidth / 2 - node.x * targetScale;
        const ty = svgHeight / 2 - node.y * targetScale;

        const newTransform = d3.zoomIdentity
            .translate(tx, ty)
            .scale(targetScale);

        const transition = d3.transition().duration(this.config.panDuration);
        
        d3.select(this.svg)
            .transition(transition)
            .call(d3.zoom().transform, newTransform);
    }

    /**
     * Fit all nodes in view
     */
    fitToView(nodes, padding = 50) {
        if (!nodes || nodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            const x = node.x - node.width / 2;
            const y = node.y - node.height / 2;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + node.width);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + node.height);
        });

        const svgWidth = this.svg.getBoundingClientRect().width;
        const svgHeight = this.svg.getBoundingClientRect().height;

        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        const scale = Math.min(svgWidth / width, svgHeight / height, this.config.maxZoom);
        const tx = svgWidth / 2 - (minX + width / 2) * scale;
        const ty = svgHeight / 2 - (minY + height / 2) * scale;

        const newTransform = d3.zoomIdentity
            .translate(tx, ty)
            .scale(scale);

        const transition = d3.transition().duration(this.config.panDuration);
        
        d3.select(this.svg)
            .transition(transition)
            .call(d3.zoom().transform, newTransform);
    }

    /**
     * Reset to default view
     */
    reset() {
        const transition = d3.transition().duration(this.config.panDuration);
        
        d3.select(this.svg)
            .transition(transition)
            .call(d3.zoom().transform, d3.zoomIdentity);
    }

    /**
     * Get current viewport rectangle
     */
    getViewport() {
        return {
            x: -this.currentTransform.x / this.currentTransform.k,
            y: -this.currentTransform.y / this.currentTransform.k,
            width: this.svg.getBoundingClientRect().width / this.currentTransform.k,
            height: this.svg.getBoundingClientRect().height / this.currentTransform.k,
            scale: this.currentTransform.k
        };
    }

    /**
     * Enable double-click zoom
     */
    enableDoubleClickZoom() {
        d3.select(this.svg).on('dblclick', (event) => {
            const svgCoords = d3.pointer(event, this.svg);
            const worldCoords = [
                (svgCoords[0] - this.currentTransform.x) / this.currentTransform.k,
                (svgCoords[1] - this.currentTransform.y) / this.currentTransform.k
            ];

            const newScale = this.currentTransform.k >= 1.5 ? 1 : 2;
            const newX = (this.svg.getBoundingClientRect().width / 2) - worldCoords[0] * newScale;
            const newY = (this.svg.getBoundingClientRect().height / 2) - worldCoords[1] * newScale;

            const newTransform = d3.zoomIdentity
                .translate(newX, newY)
                .scale(newScale);

            const transition = d3.transition().duration(this.config.zoomDuration);
            
            d3.select(this.svg)
                .transition(transition)
                .call(d3.zoom().transform, newTransform);
        });
    }
}
