/**
 * TreeLayout.js - Hierarchical genealogy layout engine using ELK.js
 * 
 * Arranges family tree with:
 * - Parents always above children (deterministic)
 * - One generation per row
 * - Spouses adjacent
 * - Children centered beneath both parents
 * - No overlapping nodes
 * - Orthogonal edge routing
 */

class TreeLayout {
    constructor(config = {}) {
        this.config = {
            nodeWidth: 220,
            nodeHeight: 140,
            generationGap: 200,
            siblingGap: 40,
            spouseGap: 20,
            parentChildGap: 80,
            ...config
        };
        
        this.elkGraphData = null;
        this.layoutComplete = false;
    }

    /**
     * Convert internal graph format to ELK.js format
     * Handles marriage connector nodes
     */
    prepareELKGraph(graphData) {
        const elkNodes = [];
        const elkEdges = [];
        let edgeId = 0;

        // Track marriage groups to create connector nodes
        const marriageConnectors = {};
        
        // First pass: create all person nodes
        graphData.nodes.forEach(node => {
            elkNodes.push({
                id: `node-${node.id}`,
                width: this.config.nodeWidth,
                height: this.config.nodeHeight,
                data: node,
                type: 'person'
            });
        });

        // Second pass: create marriage connectors and edges
        const spouses = new Map();
        graphData.links.forEach(link => {
            if (link.type === 'spouse') {
                const sourceId = link.source.id || link.source;
                const targetId = link.target.id || link.target;
                const key = [sourceId, targetId].sort().join('-');
                
                if (!spouses.has(key)) {
                    spouses.set(key, { source: sourceId, target: targetId });
                    
                    // Create marriage connector node
                    const connectorId = `marriage-${key}`;
                    elkNodes.push({
                        id: connectorId,
                        width: 20,
                        height: 20,
                        type: 'marriage',
                        data: { sourceId, targetId }
                    });
                    
                    marriageConnectors[key] = connectorId;
                    
                    // Connect spouses to marriage connector
                    elkEdges.push({
                        id: `edge-${edgeId++}`,
                        sources: [`node-${sourceId}`],
                        targets: [connectorId],
                        type: 'spouse'
                    });
                    
                    elkEdges.push({
                        id: `edge-${edgeId++}`,
                        sources: [connectorId],
                        targets: [`node-${targetId}`],
                        type: 'spouse'
                    });
                }
            }
        });

        // Third pass: parent-child edges through marriage connectors
        graphData.links.forEach(link => {
            if (link.type === 'father-child' || link.type === 'mother-child') {
                const parentId = link.source.id || link.source;
                const childId = link.target.id || link.target;
                
                // Find spouse of parent
                const spouseLink = graphData.links.find(l => 
                    l.type === 'spouse' && 
                    ((l.source.id === parentId || l.source === parentId) ||
                     (l.target.id === parentId || l.target === parentId))
                );
                
                let sourceId;
                if (spouseLink) {
                    const otherSpouseId = spouseLink.source.id === parentId ? 
                        spouseLink.target.id : spouseLink.source.id;
                    const key = [parentId, otherSpouseId].sort().join('-');
                    sourceId = marriageConnectors[key] || `node-${parentId}`;
                } else {
                    sourceId = `node-${parentId}`;
                }
                
                elkEdges.push({
                    id: `edge-${edgeId++}`,
                    sources: [sourceId],
                    targets: [`node-${childId}`],
                    type: link.type
                });
            }
        });

        // Sibling edges
        graphData.links.forEach(link => {
            if (link.type === 'sibling') {
                const sourceId = link.source.id || link.source;
                const targetId = link.target.id || link.target;
                
                elkEdges.push({
                    id: `edge-${edgeId++}`,
                    sources: [`node-${sourceId}`],
                    targets: [`node-${targetId}`],
                    type: 'sibling'
                });
            }
        });

        return {
            id: 'root',
            layoutOptions: {
                'elk.algorithm': 'mrtree',
                'elk.direction': 'DOWN',
                'elk.spacing.nodeNode': this.config.siblingGap,
                'elk.layered.spacing.baseValue': this.config.generationGap,
                'elk.mrtree.compacting': 'true',
                'elk.edgeRouting': 'ORTHOGONAL',
                'elk.mrtree.ignoreExternalPorts': 'true'
            },
            children: elkNodes,
            edges: elkEdges
        };
    }

    /**
     * Run layout computation
     * Returns promise that resolves when ELK.js completes
     */
    async compute(graphData) {
        return new Promise((resolve, reject) => {
            const elkGraph = this.prepareELKGraph(graphData);
            
            // ELK is loaded globally from CDN
            if (!window.ELK) {
                reject(new Error('ELK.js library not loaded. Check CDN link.'));
                return;
            }
            
            const elk = new window.ELK();
            
            elk.layout(elkGraph).then(layoutedGraph => {
                // Post-process: align spouses on the same horizontal line
                try {
                    const children = layoutedGraph.children || [];
                    const childMap = {};
                    children.forEach(c => { if (c && c.id) childMap[c.id] = c; });

                    children.forEach(c => {
                        if (c && c.type === 'marriage' && c.data && c.data.sourceId && c.data.targetId) {
                            const sourceNode = childMap[`node-${c.data.sourceId}`];
                            const targetNode = childMap[`node-${c.data.targetId}`];
                            if (sourceNode && targetNode && typeof c.y !== 'undefined') {
                                // Force both spouses to have the same y as the marriage connector
                                sourceNode.y = c.y;
                                targetNode.y = c.y;
                            }
                        }
                    });
                } catch (e) {
                    // Non-fatal: proceed with original layout if post-process fails
                    console.warn('Spouse alignment post-process failed', e);
                }

                this.elkGraphData = layoutedGraph;
                this.layoutComplete = true;
                resolve(layoutedGraph);
            }).catch(reject);
        });
    }

    /**
     * Get positioned node data
     * Returns mapping of node ID to {x, y, width, height}
     */
    getNodePositions() {
        if (!this.elkGraphData) return {};
        
        const positions = {};
        
        const traverse = (node) => {
            if (node.type !== 'marriage') {
                positions[node.id] = {
                    x: node.x || 0,
                    y: node.y || 0,
                    width: node.width || this.config.nodeWidth,
                    height: node.height || this.config.nodeHeight,
                    isMale: false
                };
            }
        };
        
        if (this.elkGraphData.children) {
            this.elkGraphData.children.forEach(traverse);
        }
        
        return positions;
    }

    /**
     * Get edge routing data
     * Returns array of {source, target, points} for SVG path generation
     */
    getEdgeRouting() {
        if (!this.elkGraphData) return [];
        
        const routing = [];
        
        if (this.elkGraphData.edges) {
            this.elkGraphData.edges.forEach(edge => {
                routing.push({
                    id: edge.id,
                    source: edge.sources ? edge.sources[0] : null,
                    target: edge.targets ? edge.targets[0] : null,
                    points: edge.sections ? edge.sections[0].bendPoints || [] : [],
                    type: edge.type
                });
            });
        }
        
        return routing;
    }

    /**
     * Check if layout is ready
     */
    isReady() {
        return this.layoutComplete;
    }
}
