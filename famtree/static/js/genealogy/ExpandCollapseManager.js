/**
 * ExpandCollapseManager.js - Manages expand/collapse state for family branches
 * 
 * Features:
 * - Track expanded/collapsed branches
 * - Smooth animations
 * - Remember state
 * - Focused view (show only logged-in user relatives initially)
 */

class ExpandCollapseManager {
    constructor(animationController) {
        this.animation = animationController;
        this.expandedNodes = new Set();
        this.focusedNodeId = null;
    }

    /**
     * Initialize focused view for logged-in user
     */
    setFocusedNode(nodeId) {
        this.focusedNodeId = nodeId;
        this.expandedNodes.clear();
        
        // Always expand the user and their immediate family
        this.expandedNodes.add(nodeId);
    }

    /**
     * Expand a branch
     */
    expandBranch(nodeId, childElements) {
        this.expandedNodes.add(nodeId);
        
        if (this.animation && childElements) {
            this.animation.expandBranch(
                document.getElementById(`node-${nodeId}`),
                Array.from(childElements)
            );
        }
    }

    /**
     * Collapse a branch
     */
    collapseBranch(nodeId, childElements) {
        this.expandedNodes.delete(nodeId);
        
        if (this.animation && childElements) {
            this.animation.collapseBranch(
                document.getElementById(`node-${nodeId}`),
                Array.from(childElements)
            );
        }
    }

    /**
     * Toggle expand/collapse
     */
    toggleBranch(nodeId, childElements) {
        if (this.expandedNodes.has(nodeId)) {
            this.collapseBranch(nodeId, childElements);
        } else {
            this.expandBranch(nodeId, childElements);
        }
    }

    /**
     * Check if node is expanded
     */
    isExpanded(nodeId) {
        return this.expandedNodes.has(nodeId);
    }

    /**
     * Expand all branches
     */
    expandAll() {
        document.querySelectorAll('.node-card').forEach(node => {
            const nodeId = parseInt(node.getAttribute('data-node-id'));
            this.expandedNodes.add(nodeId);
        });
    }

    /**
     * Collapse all branches
     */
    collapseAll() {
        // Keep focused node and its direct relatives
        if (this.focusedNodeId) {
            this.expandedNodes.clear();
            this.expandedNodes.add(this.focusedNodeId);
        } else {
            this.expandedNodes.clear();
        }
    }

    /**
     * Expand to node (show all ancestors)
     */
    expandToNode(nodeId, graphData) {
        // Trace up to ancestors
        const ancestors = this.getAncestors(nodeId, graphData);
        ancestors.forEach(id => this.expandedNodes.add(id));
    }

    /**
     * Get all ancestor nodes
     */
    getAncestors(nodeId, graphData) {
        const ancestors = new Set();
        const visited = new Set();

        const traverse = (id) => {
            if (visited.has(id)) return;
            visited.add(id);

            // Find parent links
            graphData.links.forEach(link => {
                if ((link.type === 'father-child' || link.type === 'mother-child') &&
                    link.target.id === id) {
                    const parentId = link.source.id || link.source;
                    ancestors.add(parentId);
                    traverse(parentId);
                }
            });
        };

        traverse(nodeId);
        return ancestors;
    }

    /**
     * Save expand state to local storage
     */
    saveState() {
        const state = Array.from(this.expandedNodes);
        localStorage.setItem('familyTree_expandedNodes', JSON.stringify(state));
    }

    /**
     * Restore expand state from local storage
     */
    restoreState() {
        const saved = localStorage.getItem('familyTree_expandedNodes');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.expandedNodes = new Set(state);
            } catch (e) {
                console.error('Error restoring expand state:', e);
            }
        }
    }

    /**
     * Clear saved state
     */
    clearSavedState() {
        localStorage.removeItem('familyTree_expandedNodes');
    }
}
