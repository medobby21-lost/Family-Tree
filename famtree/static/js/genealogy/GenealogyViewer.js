/**
 * GenealogyViewer.js - Main orchestrator for the professional genealogy visualization
 * 
 * Coordinates:
 * - Layout computation (ELK.js)
 * - Node rendering
 * - Edge rendering
 * - Camera controls
 * - Animations
 * - Search
 * - Expand/collapse
 * - Minimap
 */

class GenealogyViewer {
    constructor(config = {}) {
        this.config = {
            svgSelector: '#graph-view-canvas',
            sidebarSelector: '.sidebar',
            ...config
        };

        // Core components
        this.layout = null;
        this.nodeRenderer = null;
        this.edgeRenderer = null;
        this.cameraController = null;
        this.animationController = null;
        this.searchController = null;
        this.expandManager = null;
        this.minimap = null;

        // Data
        this.graphData = null;
        this.selectedNode = null;
        this.layoutedPositions = null;

        // DOM elements
        this.svg = null;
        this.svgGroup = null;
    }

    /**
     * Initialize the viewer
     */
    async initialize() {
        try {
            // Get graph data from backend
            const apiUrl = window.apiGraphDataUrl || "{% url 'api_graph_data' %}";
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Unauthorized");
            this.graphData = await response.json();

            if (this.graphData.nodes.length === 0) {
                this.showEmptyState();
                return;
            }

            // Initialize DOM
            this.setupDOM();

            // Initialize controllers
            this.animationController = new AnimationController();
            this.layout = new TreeLayout();
            this.nodeRenderer = new NodeRenderer();
            this.edgeRenderer = new EdgeRenderer();
            this.cameraController = new CameraController(this.svg, this.svgGroup);
            this.searchController = new SearchController(this.cameraController, this.animationController);
            this.expandManager = new ExpandCollapseManager(this.animationController);
            this.minimap = new Minimap();

            // Build surname colors
            this.nodeRenderer.buildSurnameColors(this.graphData.nodes);

            // Compute layout
            await this.computeLayout();

            // Render tree
            this.render();

            // Setup interactions
            this.setupInteractions();

            // Create minimap
            this.minimap.create();

            // Set up search input
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            }

            // Select logged-in viewer or first node
            const viewerId = window.viewerId;
            let initialNode = this.graphData.nodes.find(n => n.id === viewerId);
            if (!initialNode) {
                initialNode = this.graphData.nodes[0];
            }
            
            if (initialNode) {
                this.selectNode(initialNode);
                this.expandManager.setFocusedNode(initialNode.id);
                this.cameraController.centerAndZoomToNode(initialNode, 1.2);
            }

        } catch (err) {
            console.error('Failed to initialize genealogy viewer:', err);
            this.showError(err.message);
        }
    }

    /**
     * Setup DOM elements
     */
    setupDOM() {
        this.svg = document.querySelector(this.config.svgSelector);
        if (!this.svg) {
            throw new Error('SVG canvas not found');
        }

        // Clear existing content
        this.svg.innerHTML = '';

        // Set dimensions
        const parent = this.svg.parentElement;
        this.svg.setAttribute('width', parent.clientWidth);
        this.svg.setAttribute('height', parent.clientHeight);

        // Create main group for zoom/pan
        this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svgGroup.setAttribute('id', 'svg-main-group');
        this.svg.appendChild(this.svgGroup);

        // Add styling
        this.addStyles();
    }

    /**
     * Add CSS styles for visualization
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .node-card {
                cursor: pointer;
                transition: none;
            }

            .node-card.node-selected circle {
                stroke-width: 4 !important;
                filter: drop-shadow(0 0 12px var(--accent, #7f5af0)) !important;
            }

            .node-card.node-hover circle {
                stroke-width: 3;
                filter: drop-shadow(0 0 8px rgba(127, 90, 240, 0.7));
            }

            .edge {
                transition: all 200ms ease-out;
            }

            .edge.edge-highlight {
                stroke-width: 4 !important;
                opacity: 0.95 !important;
                filter: drop-shadow(0 0 6px var(--accent-hover, #9270f2));
            }

            .search-result circle {
                filter: drop-shadow(0 0 8px rgba(255, 201, 0, 0.8));
            }

            .highlight-center circle {
                stroke-width: 4;
                filter: drop-shadow(0 0 12px var(--accent, #7f5af0));
            }

            .highlight-relative circle {
                stroke-width: 3;
                filter: drop-shadow(0 0 8px rgba(127, 90, 240, 0.6));
            }

            @keyframes dash {
                to {
                    stroke-dashoffset: -100;
                }
            }

            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }

            .node-card.path-step-active circle {
                stroke-width: 4;
                filter: drop-shadow(0 0 10px var(--accent, #7f5af0));
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Compute hierarchical layout
     */
    async computeLayout() {
        await this.layout.compute(this.graphData);
        this.layoutedPositions = this.layout.getNodePositions();
        
        // Update node positions in graphData
        Object.entries(this.layoutedPositions).forEach(([nodeId, pos]) => {
            const node = this.graphData.nodes.find(n => `node-${n.id}` === nodeId);
            if (node) {
                node.x = pos.x;
                node.y = pos.y;
                node.width = pos.width;
                node.height = pos.height;
            }
        });
        
        // Apply any saved overrides from localStorage (user-moved positions)
        const saved = this.loadSavedPositions();
        if (saved) {
            Object.entries(saved).forEach(([id, p]) => {
                const node = this.graphData.nodes.find(n => n.id === parseInt(id));
                if (node && typeof p.x !== 'undefined' && typeof p.y !== 'undefined') {
                    node.x = p.x;
                    node.y = p.y;
                }
            });
        }
    }

    /**
     * Render the entire tree
     */
    render() {
        // Clear previous rendering
        this.svgGroup.innerHTML = '';

        // Draw edges first (so they're behind nodes)
        this.renderEdges();

        // Draw nodes
        this.renderNodes();

        // Update minimap
        this.minimap.update(this.graphData.nodes, this.graphData.links, 
                           this.cameraController.getViewport());
    }

    /**
     * Render all edges
     */
    renderEdges() {
        const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgesGroup.setAttribute('id', 'edges-group');
        edgesGroup.setAttribute('pointer-events', 'none');

        this.graphData.links.forEach(link => {
            const source = this.graphData.nodes.find(n => n.id === (link.source.id || link.source));
            const target = this.graphData.nodes.find(n => n.id === (link.target.id || link.target));

            if (!source || !target) return;

            const pathData = this.edgeRenderer.createEdgePath(source, target, link.type);
            const edgeElement = this.edgeRenderer.createEdgeElement({
                id: `link-${source.id}-${target.id}`,
                pathData: pathData,
                type: link.type,
                source: source.id,
                target: target.id
            });

            edgesGroup.appendChild(edgeElement);
        });

        this.svgGroup.appendChild(edgesGroup);
    }

    /**
     * Render all nodes
     */
    renderNodes() {
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.setAttribute('id', 'nodes-group');

        this.graphData.nodes.forEach(node => {
            const nodeElement = this.nodeRenderer.createNodeElement(node, 
                node.id === window.viewerId);
            
            // Position the node
            nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);

            // Append first so ownerSVGElement exists for pointer coordinate transforms
            nodesGroup.appendChild(nodeElement);

            // Add interaction (enables dragging and emits 'node:moved')
            this.nodeRenderer.addInteraction(nodeElement, node);
            nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectNode(node);
            });
        });

        this.svgGroup.appendChild(nodesGroup);
    }

    /**
     * Select a node and update sidebar
     */
    selectNode(node) {
        this.selectedNode = node;

        // Remove previous selection
        document.querySelectorAll('.node-card.node-selected').forEach(n => {
            this.animationController.deselectNode(n);
        });

        // Select new node
        const nodeElement = document.getElementById(`node-${node.id}`);
        if (nodeElement) {
            this.animationController.selectNode(nodeElement);

            // Update sidebar
            this.updateSidebar(node);

            // Highlight relatives
            this.highlightRelatives(node);
        }
    }

    /**
     * Update sidebar with node details
     */
    updateSidebar(node) {
        const noSelectionMsg = document.getElementById('no-selection-msg');
        const selectionDetails = document.getElementById('selection-details');

        if (noSelectionMsg) noSelectionMsg.style.display = 'none';
        if (selectionDetails) selectionDetails.style.display = 'block';

        // Set profile details
        const avatar = document.getElementById('view-avatar');
        if (avatar) {
            avatar.className = 'member-avatar';
            if (node.photo) {
                avatar.innerHTML = `<img src="${node.photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                avatar.innerHTML = node.name[0];
                if (node.gender === 'M') avatar.classList.add('male');
                if (node.gender === 'F') avatar.classList.add('female');
            }
        }

        const nameEl = document.getElementById('view-name');
        if (nameEl) nameEl.textContent = node.name + ' ' + (node.surname || '');

        const datesEl = document.getElementById('view-dates');
        if (datesEl) datesEl.textContent = (node.dob || "Unknown") + " - " + (node.dod || "Present");

        // Populate relatives
        this.populateRelativesList(node);
    }

    /**
     * Populate relatives list in sidebar
     */
    populateRelativesList(node) {
        const list = document.getElementById('view-relatives-list');
        if (!list) return;
        list.innerHTML = '';

        const relatives = [];

        // Find all relatives
        this.graphData.nodes.forEach(n => {
            if (n.id === node.id) return;

            // Father
            const fatherLink = this.graphData.links.find(l => 
                l.type === 'father-child' && l.source.id === n.id && l.target.id === node.id);
            if (fatherLink) relatives.push({ node: n, rel: 'Father' });

            // Mother
            const motherLink = this.graphData.links.find(l => 
                l.type === 'mother-child' && l.source.id === n.id && l.target.id === node.id);
            if (motherLink) relatives.push({ node: n, rel: 'Mother' });

            // Child
            const childLink = this.graphData.links.find(l => 
                (l.type === 'father-child' || l.type === 'mother-child') && 
                l.source.id === node.id && l.target.id === n.id);
            if (childLink) relatives.push({ node: n, rel: n.gender === 'M' ? 'Son' : 'Daughter' });

            // Spouse
            const spouseLink = this.graphData.links.find(l => 
                l.type === 'spouse' && 
                ((l.source.id === node.id && l.target.id === n.id) || 
                 (l.source.id === n.id && l.target.id === node.id)));
            if (spouseLink) relatives.push({ node: n, rel: n.gender === 'M' ? 'Husband' : 'Wife' });
        });

        if (relatives.length === 0) {
            list.innerHTML = `<div style="font-size:0.85rem; color:var(--text-secondary); padding:8px 0;">No direct kin registered.</div>`;
            return;
        }

        relatives.forEach(item => {
            const card = document.createElement('div');
            card.className = 'rel-card';
            card.onclick = () => this.selectNode(item.node);

            const genderClass = item.node.gender === 'M' ? 'male' : item.node.gender === 'F' ? 'female' : '';
            card.innerHTML = `
                <div class="rel-info">
                    <div class="rel-mini-avatar ${genderClass}">
                        ${item.node.photo ? `<img src="${item.node.photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (item.node.name || '')[0]}
                    </div>
                    <div class="rel-name">${item.node.name} ${item.node.surname || ''}</div>
                </div>
                <span class="rel-label">${item.rel}</span>
            `;
            list.appendChild(card);
        });
    }

    /**
     * Highlight relatives of selected node
     */
    highlightRelatives(node) {
        const relativesIds = new Set();

        // Find father
        const father = this.graphData.nodes.find(n => 
            this.graphData.links.find(l => 
                l.type === 'father-child' && l.source.id === n.id && l.target.id === node.id));
        if (father) relativesIds.add(father.id);

        // Find mother
        const mother = this.graphData.nodes.find(n => 
            this.graphData.links.find(l => 
                l.type === 'mother-child' && l.source.id === n.id && l.target.id === node.id));
        if (mother) relativesIds.add(mother.id);

        // Find children
        this.graphData.nodes.forEach(n => {
            if (this.graphData.links.find(l => 
                (l.type === 'father-child' || l.type === 'mother-child') && 
                l.source.id === node.id && l.target.id === n.id)) {
                relativesIds.add(n.id);
            }
        });

        // Find spouse
        const spouse = this.graphData.nodes.find(n => 
            this.graphData.links.find(l => 
                l.type === 'spouse' && 
                ((l.source.id === node.id && l.target.id === n.id) || 
                 (l.source.id === n.id && l.target.id === node.id))));
        if (spouse) relativesIds.add(spouse.id);

        // Highlight
        const relElements = Array.from(document.querySelectorAll('.node-card'))
            .filter(el => relativesIds.has(parseInt(el.getAttribute('data-node-id'))));
        
        this.animationController.highlightRelatives(
            document.getElementById(`node-${node.id}`),
            relElements
        );
    }

    /**
     * Handle search input
     */
    handleSearch(query) {
        const results = this.searchController.search(query, this.graphData.nodes);
        
        if (results.length > 0) {
            this.searchController.goToFirstResult();
        }
    }

    /**
     * Setup user interactions
     */
    setupInteractions() {
        // Double-click zoom
        this.cameraController.enableDoubleClickZoom();

        // Center on me button
        const centerMeBtn = document.createElement('button');
        centerMeBtn.textContent = '🎯 Center on Me';
        centerMeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 130px;
            padding: 10px 16px;
            background: var(--accent, #7f5af0);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 90;
            transition: all 200ms;
        `;

        centerMeBtn.addEventListener('click', () => {
            const viewerNode = this.graphData.nodes.find(n => n.id === window.viewerId);
            if (viewerNode) {
                this.selectNode(viewerNode);
                this.cameraController.centerAndZoomToNode(viewerNode, 1.2);
            }
        });

        centerMeBtn.addEventListener('mouseenter', function() {
            this.style.background = 'var(--accent-hover, #9270f2)';
            this.style.transform = 'scale(1.05)';
        });

        centerMeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'var(--accent, #7f5af0)';
            this.style.transform = 'scale(1)';
        });

        document.querySelector('.main-container').appendChild(centerMeBtn);

        // Listen for node move events emitted by NodeRenderer and persist positions
        document.addEventListener('node:moved', (evt) => {
            try {
                const d = evt.detail;
                if (!d || typeof d.id === 'undefined') return;

                // Update graphData node
                const node = this.graphData.nodes.find(n => n.id === d.id);
                if (node) {
                    node.x = d.x;
                    node.y = d.y;
                    // Persist
                    this.savePosition(node.id, node.x, node.y);

                    // Re-render edges and minimap since node moved
                    this.render();
                }
            } catch (e) {
                console.warn('Error handling node:moved', e);
            }
        });
    }

    getPositionsStorageKey() {
        return 'fam_node_positions_v1';
    }

    loadSavedPositions() {
        try {
            const raw = localStorage.getItem(this.getPositionsStorageKey());
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('Failed to load saved node positions', e);
            return {};
        }
    }

    savePosition(id, x, y) {
        try {
            const key = this.getPositionsStorageKey();
            const all = this.loadSavedPositions() || {};
            all[id] = { x: x, y: y };
            localStorage.setItem(key, JSON.stringify(all));
        } catch (e) {
            console.warn('Failed to save node position', e);
        }
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        const svg = document.querySelector(this.config.svgSelector);
        if (svg) {
            svg.innerHTML = `
                <foreignObject width="100%" height="100%">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; 
                            height: 100%; color: var(--text-secondary); font-size: 1.1rem;">
                        <p style="font-size: 3rem; margin-bottom: 15px;">🌳</p>
                        <p>No members in the family tree yet.</p>
                    </div>
                </foreignObject>
            `;
        }
    }

    /**
     * Show error state
     */
    showError(message) {
        const svg = document.querySelector(this.config.svgSelector);
        if (svg) {
            svg.innerHTML = `
                <foreignObject width="100%" height="100%">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; 
                            height: 100%; color: var(--text-secondary); font-size: 1.1rem;">
                        <p style="font-size: 3rem; margin-bottom: 15px;">⚠️</p>
                        <p>${message}</p>
                    </div>
                </foreignObject>
            `;
        }
    }
}

// Global instance
window.genealogyViewer = null;
