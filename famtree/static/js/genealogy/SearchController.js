/**
 * SearchController.js - Handles member search and filtering
 * 
 * Features:
 * - Live search
 * - Smooth pan/zoom to result
 * - Highlight search results
 * - Fade non-matching members
 */

class SearchController {
    constructor(cameraController, animationController) {
        this.camera = cameraController;
        this.animation = animationController;
        this.searchQuery = '';
        this.results = [];
    }

    /**
     * Search for members by name, surname, or phone
     */
    search(query, allNodes) {
        this.searchQuery = query.toLowerCase().trim();
        this.results = [];

        if (!this.searchQuery) {
            this.clearSearch();
            return [];
        }

        // Find matching nodes
        allNodes.forEach(node => {
            const matches = 
                (node.name && node.name.toLowerCase().includes(this.searchQuery)) ||
                (node.surname && node.surname.toLowerCase().includes(this.searchQuery)) ||
                (node.phone && node.phone.includes(this.searchQuery)) ||
                (node.native_place && node.native_place.toLowerCase().includes(this.searchQuery));
            
            if (matches) {
                this.results.push(node);
            }
        });

        this.highlightResults();
        return this.results;
    }

    /**
     * Highlight search results
     */
    highlightResults() {
        if (this.results.length === 0) {
            this.clearSearch();
            return;
        }

        // Fade non-matching nodes
        const resultIds = this.results.map(r => r.id);
        document.querySelectorAll('.node-card').forEach(node => {
            const nodeId = parseInt(node.getAttribute('data-node-id'));
            
            if (!resultIds.includes(nodeId)) {
                node.style.transition = 'opacity 300ms ease-out';
                node.style.opacity = '0.15';
            } else {
                node.style.opacity = '1';
                node.classList.add('search-result');
            }
        });

        // Fade connecting edges
        document.querySelectorAll('.edge').forEach(edge => {
            edge.style.transition = 'opacity 300ms ease-out';
            edge.style.opacity = '0.05';
        });
    }

    /**
     * Navigate to and zoom on first result
     */
    goToFirstResult() {
        if (this.results.length === 0) return;

        const firstResult = this.results[0];
        this.camera.centerAndZoomToNode(firstResult, 1.5);
    }

    /**
     * Navigate to next result
     */
    goToNextResult(currentIndex = 0) {
        const nextIndex = (currentIndex + 1) % this.results.length;
        const result = this.results[nextIndex];
        this.camera.centerAndZoomToNode(result, 1.5);
        return nextIndex;
    }

    /**
     * Clear search highlighting
     */
    clearSearch() {
        this.searchQuery = '';
        this.results = [];

        document.querySelectorAll('.node-card').forEach(node => {
            node.style.opacity = '1';
            node.classList.remove('search-result');
        });

        document.querySelectorAll('.edge').forEach(edge => {
            const type = edge.getAttribute('class').match(/edge-(\w+)/)?.[1];
            const opacity = ['spouse', 'father-child', 'mother-child', 'sibling'].includes(type) ?
                { 'spouse': 0.6, 'sibling': 0.8, 'father-child': 0.25, 'mother-child': 0.25 }[type] :
                0.3;
            edge.style.opacity = opacity;
        });
    }

    /**
     * Get search results count
     */
    getResultCount() {
        return this.results.length;
    }
}
