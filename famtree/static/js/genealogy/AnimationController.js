/**
 * AnimationController.js - Handles smooth transitions and animations
 * 
 * Features:
 * - Expand/collapse animations
 * - Node selection animations
 * - Path traversal animations
 * - Fade/highlight effects
 */

class AnimationController {
    constructor(config = {}) {
        this.config = {
            expandDuration: 300,
            collapseDuration: 300,
            selectDuration: 200,
            fadeDuration: 300,
            ...config
        };
    }

    /**
     * Animate node selection
     */
    selectNode(nodeElement) {
        // Add pulse animation
        nodeElement.classList.add('node-selected');
        
        // Glow effect
        const circles = nodeElement.querySelectorAll('circle');
        circles.forEach(circle => {
            circle.style.transition = `stroke-width ${this.config.selectDuration}ms ease-out`;
            circle.setAttribute('stroke-width', '4');
            circle.style.filter = 'drop-shadow(0 0 12px var(--accent, #7f5af0))';
        });
    }

    /**
     * Deselect node
     */
    deselectNode(nodeElement) {
        nodeElement.classList.remove('node-selected');
        
        const circles = nodeElement.querySelectorAll('circle');
        circles.forEach(circle => {
            circle.style.transition = `stroke-width ${this.config.selectDuration}ms ease-out`;
            circle.setAttribute('stroke-width', '2');
            circle.style.filter = 'none';
        });
    }

    /**
     * Expand branch with smooth animation
     */
    expandBranch(branchElement, childrenElements) {
        branchElement.classList.add('expanded');
        
        childrenElements.forEach((child, index) => {
            setTimeout(() => {
                child.style.opacity = '0';
                child.style.display = 'block';
                
                // Trigger reflow to enable transition
                child.offsetHeight;
                
                child.style.transition = `opacity ${this.config.expandDuration}ms ease-out`;
                child.style.opacity = '1';
            }, index * 50); // Stagger effect
        });
    }

    /**
     * Collapse branch with smooth animation
     */
    collapseBranch(branchElement, childrenElements) {
        branchElement.classList.remove('expanded');
        
        childrenElements.forEach((child, index) => {
            setTimeout(() => {
                child.style.transition = `opacity ${this.config.collapseDuration}ms ease-out`;
                child.style.opacity = '0';
                
                setTimeout(() => {
                    child.style.display = 'none';
                }, this.config.collapseDuration);
            }, index * 50);
        });
    }

    /**
     * Fade nodes (for search/filter effects)
     */
    fadeNodes(nodes, isFaded = true) {
        nodes.forEach(node => {
            node.style.transition = `opacity ${this.config.fadeDuration}ms ease-out`;
            node.style.opacity = isFaded ? '0.1' : '1';
        });
    }

    /**
     * Highlight immediate relatives
     */
    highlightRelatives(centerNode, relativeNodes) {
        centerNode.classList.add('highlight-center');
        
        relativeNodes.forEach((node, index) => {
            setTimeout(() => {
                node.classList.add('highlight-relative');
                const circles = node.querySelectorAll('circle');
                circles.forEach(circle => {
                    circle.style.filter = 'drop-shadow(0 0 8px rgba(127, 90, 240, 0.5))';
                });
            }, index * 50);
        });
    }

    /**
     * Remove relative highlights
     */
    clearHighlights() {
        document.querySelectorAll('.highlight-center, .highlight-relative').forEach(node => {
            node.classList.remove('highlight-center', 'highlight-relative');
            const circles = node.querySelectorAll('circle');
            circles.forEach(circle => {
                circle.style.filter = 'none';
            });
        });
    }

    /**
     * Animate path traversal step by step
     */
    async animatePathStep(fromNode, toNode, stepDuration = 300) {
        // Highlight from node
        fromNode.classList.add('path-step-active');
        
        // Create animation line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'path-animation-line');
        line.setAttribute('x1', fromNode.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
        line.setAttribute('y1', fromNode.getAttribute('transform').match(/translate\([^,]+,([^)]+)/)[1]);
        line.setAttribute('x2', toNode.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
        line.setAttribute('y2', toNode.getAttribute('transform').match(/translate\([^,]+,([^)]+)/)[1]);
        line.setAttribute('stroke', 'var(--accent, #7f5af0)');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '5, 5');
        
        // Animate path
        line.style.animation = `dash ${stepDuration}ms linear forwards`;
        document.querySelector('#graph-view-canvas svg g').appendChild(line);
        
        await new Promise(resolve => setTimeout(resolve, stepDuration));
        
        // Highlight to node
        toNode.classList.add('path-step-active');
    }

    /**
     * Pulse animation for emphasis
     */
    pulse(element, count = 2) {
        return new Promise((resolve) => {
            let pulsed = 0;
            
            const pulseFn = () => {
                element.style.animation = `pulse 400ms ease-out`;
                pulsed++;
                
                setTimeout(() => {
                    if (pulsed < count) {
                        pulseFn();
                    } else {
                        element.style.animation = 'none';
                        resolve();
                    }
                }, 400);
            };
            
            pulseFn();
        });
    }
}
