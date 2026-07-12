# Visual & Code Examples - Professional Genealogy Viewer

## Visual Examples

### Before and After Comparison

#### BEFORE: Force-Directed Layout
```
Problems:
- Nodes drift randomly ❌
- Generations unclear ❌  
- Lines cross frequently ❌
- Circles look basic ❌
```

#### AFTER: Hierarchical Layout
```
Improvements:
- Stable, deterministic layout ✅
- Clear parent-above-child hierarchy ✅
- Orthogonal routing, no crossings ✅
- Professional genealogy cards ✅
```

### Node Card Design

```
┌─────────────────────────────────┐
│  Family Surname Color (Top 4px) │
├─────────────────────────────────┤
│                                 │
│           [Avatar]              │
│         John Doe                │
│         Doe (colored)           │
│         b. 1950 - d. 2020       │
│                                 │
│  ♂ ● (gender/status badges)     │
│                                 │
│  (if logged-in user: 👤 badge)  │
│                                 │
└─────────────────────────────────┘
```

### Relationship Hierarchy Visual

```
Generation 0:
    ┌─────────┐         ┌─────────┐
    │ John Sr │────❤────│Mary Sr  │
    └─────────┘         └─────────┘
           │
       ────┼────
       │   │   │
       ▼   ▼   ▼
Generation 1:
    ┌─────────┐         ┌─────────┐
    │  John   │────❤────│   Jane  │
    └─────────┘         └─────────┘
        │
        ├──────┬──────┐
        │      │      │
        ▼      ▼      ▼
Generation 2:
    ┌────┐ ┌────┐ ┌────┐
    │Bob │ │Sue │ │Tim │
    └────┘ └────┘ └────┘
```

## Code Examples

### 1. Initialize the Viewer

**HTML:**
```html
{% load static %}
<!DOCTYPE html>
<html>
<head>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/elkjs@0.8.2/lib/elk.bundled.js"></script>
    
    <script src="{% static 'js/genealogy/TreeLayout.js' %}"></script>
    <script src="{% static 'js/genealogy/NodeRenderer.js' %}"></script>
    <script src="{% static 'js/genealogy/EdgeRenderer.js' %}"></script>
    <script src="{% static 'js/genealogy/CameraController.js' %}"></script>
    <script src="{% static 'js/genealogy/AnimationController.js' %}"></script>
    <script src="{% static 'js/genealogy/SearchController.js' %}"></script>
    <script src="{% static 'js/genealogy/ExpandCollapseManager.js' %}"></script>
    <script src="{% static 'js/genealogy/Minimap.js' %}"></script>
    <script src="{% static 'js/genealogy/GenealogyViewer.js' %}"></script>
</head>
<body>
    <svg id="graph-view-canvas"></svg>
    
    <script>
        window.viewerId = {% if viewer %}{{ viewer.id }}{% else %}null{% endif %};
        
        window.addEventListener('DOMContentLoaded', () => {
            window.genealogyViewer = new GenealogyViewer({
                svgSelector: '#graph-view-canvas'
            });
            window.genealogyViewer.initialize();
        });
    </script>
</body>
</html>
```

### 2. Layout Computation

**Input Data:**
```javascript
const graphData = {
    nodes: [
        { id: 1, name: 'John', surname: 'Doe', gender: 'M', dob: '1950-01-15', photo: '/path/to/photo.jpg', generation: 0 },
        { id: 2, name: 'Mary', surname: 'Smith', gender: 'F', dob: '1952-03-20', photo: null, generation: 0 },
        { id: 3, name: 'Jane', surname: 'Doe', gender: 'F', dob: '1975-06-10', photo: '/path/to/photo2.jpg', generation: 1 }
    ],
    links: [
        { source: { id: 1 }, target: { id: 3 }, type: 'father-child' },
        { source: { id: 2 }, target: { id: 3 }, type: 'mother-child' },
        { source: { id: 1 }, target: { id: 2 }, type: 'spouse' }
    ]
};
```

**Layout Code:**
```javascript
const layout = new TreeLayout({
    nodeWidth: 220,
    nodeHeight: 140,
    generationGap: 200,
    siblingGap: 40
});

await layout.compute(graphData);

const positions = layout.getNodePositions();
// Result:
// {
//   'node-1': { x: 100, y: 100, width: 220, height: 140 },
//   'node-2': { x: 350, y: 100, width: 220, height: 140 },
//   'node-3': { x: 225, y: 300, width: 220, height: 140 }
// }
```

### 3. Rendering Nodes

**Code:**
```javascript
const nodeRenderer = new NodeRenderer();
nodeRenderer.buildSurnameColors(graphData.nodes);

graphData.nodes.forEach(node => {
    const nodeElement = nodeRenderer.createNodeElement(
        node,
        node.id === window.viewerId  // Is this the logged-in user?
    );
    
    // Position the node
    nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    
    // Add to SVG
    svg.appendChild(nodeElement);
});
```

**Resulting SVG:**
```xml
<g class="node-card male" id="node-1" data-node-id="1" transform="translate(100, 100)">
    <defs>
        <filter id="shadow-1">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4"/>
        </filter>
        <pattern id="avatar-pattern-1" patternUnits="objectBoundingBox" width="1" height="1">
            <image href="/path/to/photo.jpg" width="60" height="60" preserveAspectRatio="xMidYMid slice"/>
        </pattern>
    </defs>
    <rect class="node-card-bg" width="220" height="140" rx="8" x="-110" y="-70" fill="#1a1a1e" stroke="#3a86ff" stroke-width="2" filter="url(#shadow-1)"/>
    <rect class="node-surname-strip" width="220" height="4" x="-110" y="-70" fill="#7b61ff" rx="8"/>
    <circle cx="0" cy="-30" r="30" fill="url(#avatar-pattern-1)" stroke="#3a86ff" stroke-width="2"/>
    <text class="node-name-text" x="0" y="0" text-anchor="middle" font-size="13" font-weight="bold" fill="#fffffe">John</text>
    <text class="node-surname-text" x="0" y="16" text-anchor="middle" font-size="11" fill="#7b61ff">Doe</text>
    <text class="node-years-text" x="0" y="60" text-anchor="middle" font-size="10" fill="#94a1b2">1950 - 2020</text>
    <!-- Gender/status badges -->
    <circle cx="-17.5" cy="-56" r="8" fill="#3a86ff" opacity="0.8"/>
    <text x="-17.5" y="-56" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#fff">♂</text>
    <circle cx="17.5" cy="-56" r="8" fill="#2cb67d" opacity="0.8"/>
    <text x="17.5" y="-56" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#fff">●</text>
</g>
```

### 4. Edge Routing

**Code:**
```javascript
const edgeRenderer = new EdgeRenderer();

graphData.links.forEach(link => {
    const source = graphData.nodes.find(n => n.id === link.source.id);
    const target = graphData.nodes.find(n => n.id === link.target.id);
    
    const pathData = edgeRenderer.createEdgePath(source, target, link.type);
    const edgeElement = edgeRenderer.createEdgeElement({
        id: `link-${source.id}-${target.id}`,
        pathData: pathData,
        type: link.type
    });
    
    svgGroup.appendChild(edgeElement);
});
```

**Example Paths:**
```xml
<!-- Father-to-Child (blue) -->
<path class="edge edge-father-child"
      d="M 100 100 L 100 150 Q 100 160 120 160 L 230 160 Q 250 160 250 170 L 250 220"
      stroke="#3a86ff"
      stroke-width="2"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.25"/>

<!-- Spouse (red dashed) -->
<path class="edge edge-spouse"
      d="M 100 100 L 225 100"
      stroke="#ef4565"
      stroke-width="2.5"
      stroke-dasharray="5, 4"
      fill="none"
      opacity="0.6"/>
```

### 5. Camera Controls

**Code:**
```javascript
const camera = new CameraController(svg, svgGroup);

// Enable double-click zoom
camera.enableDoubleClickZoom();

// Zoom to 1.5x
camera.zoomTo(1.5);

// Pan to node
camera.panToNode(node);

// Center and zoom
camera.centerAndZoomToNode(node, 1.2);

// Fit entire tree
camera.fitToView(graphData.nodes);

// Get current viewport
const viewport = camera.getViewport();
console.log(viewport);
// { x: -100, y: -50, width: 1200, height: 800, scale: 1.2 }
```

### 6. Search Functionality

**Code:**
```javascript
const searchController = new SearchController(camera, animator);

// Search for members
const results = searchController.search('John', graphData.nodes);
console.log(results);
// [{ id: 1, name: 'John', surname: 'Doe', ... }, { id: 5, name: 'Johnny', ... }]

// Navigate to first result
searchController.goToFirstResult();

// Go to next result
const nextIndex = searchController.goToNextResult(currentIndex);

// Clear search
searchController.clearSearch();
```

### 7. Animation

**Code:**
```javascript
const animator = new AnimationController({
    selectDuration: 200,
    expandDuration: 300,
    fadeDuration: 300
});

// Select node
animator.selectNode(nodeElement);

// Expand branch
animator.expandBranch(nodeElement, childElements);

// Highlight relatives
animator.highlightRelatives(centerNode, relativeNodes);

// Pulse effect
await animator.pulse(element, count = 2);
```

**CSS:**
```css
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}

.node-card.node-selected circle {
    stroke-width: 4 !important;
    filter: drop-shadow(0 0 12px var(--accent, #7f5af0)) !important;
}
```

### 8. Expand/Collapse

**Code:**
```javascript
const expandManager = new ExpandCollapseManager(animator);

// Set focus on logged-in user
expandManager.setFocusedNode(userId);

// Expand a branch
expandManager.expandBranch(nodeId, childElements);

// Toggle branch
expandManager.toggleBranch(nodeId, childElements);

// Save state
expandManager.saveState();

// Restore from localStorage
expandManager.restoreState();

// Check if expanded
if (expandManager.isExpanded(nodeId)) {
    console.log('Node is expanded');
}
```

### 9. Minimap

**Code:**
```javascript
const minimap = new Minimap({
    width: 220,
    height: 180,
    padding: 10
});

// Create and inject into DOM
minimap.create();

// Update with current tree data
minimap.update(
    graphData.nodes,
    graphData.links,
    camera.getViewport()
);

// Toggle visibility
minimap.toggle();

// Show/hide
minimap.show();
minimap.hide();
```

### 10. Selecting a Member

**Code:**
```javascript
function selectMember(node) {
    // Update global state
    selectedNode = node;
    
    // Use viewer API
    window.genealogyViewer.selectNode(node);
}

// Example: Click handler
document.getElementById('node-123').addEventListener('click', () => {
    selectMember(graphData.nodes.find(n => n.id === 123));
});
```

### 11. Relationship Finder

**Code:**
```javascript
async function findRelationship(personId1, personId2) {
    const response = await fetch(`/api/relation/?p1=${personId1}&p2=${personId2}`);
    const data = await response.json();
    
    // data.relations = [
    //   {
    //     relation: "father",
    //     length: 1,
    //     chain: "John Doe (father) → Jane Doe",
    //     path_ids: [1, 3]
    //   },
    //   ...
    // ]
    
    data.relations.forEach(rel => {
        // Animate path traversal
        rel.path_ids.forEach((id, index) => {
            const node = document.getElementById(`node-${id}`);
            if (node) {
                node.style.animation = `pulse 400ms ease-out ${index * 300}ms`;
            }
        });
    });
}
```

## Configuration Examples

### Custom Theme Colors

```javascript
// In CSS
:root {
    --bg-color: #121214;
    --sidebar-bg: #1a1a1e;
    --border-color: #2a2a2e;
    --text-main: #fffffe;
    --text-secondary: #94a1b2;
    --accent: #7f5af0;
    --accent-hover: #9270f2;
    --male-color: #3a86ff;
    --female-color: #ff006e;
    --other-color: #888888;
}
```

### Custom Surname Colors

```javascript
const nodeRenderer = new NodeRenderer();
nodeRenderer.buildSurnameColors(nodes);

// Override specific surnames
nodeRenderer.surnameColors['Smith'] = '#FF5733';
nodeRenderer.surnameColors['Johnson'] = '#33FF57';
nodeRenderer.surnameColors['Williams'] = '#3357FF';
```

### Larger Node Cards

```javascript
const layout = new TreeLayout({
    nodeWidth: 280,      // Wider
    nodeHeight: 160,     // Taller
    generationGap: 250,  // More vertical space
    siblingGap: 60       // More horizontal space
});

const nodeRenderer = new NodeRenderer({
    cardWidth: 280,
    cardHeight: 160,
    avatarSize: 80       // Bigger avatars
});
```

## Performance Tips

### For Large Trees (500+ members)

1. **Load data progressively:**
```javascript
// Load initial focused area
const focusedArea = await loadSubtree(viewerId, maxDepth=3);
window.genealogyViewer.render(focusedArea);

// Load rest in background
const fullTree = await loadFullTree();
```

2. **Use minimap for navigation:**
```javascript
minimap.update(nodes, edges, viewport);
// Clicking minimap jumps to that area
```

3. **Lazy-load profile pictures:**
```javascript
const nodeElement = nodeRenderer.createNodeElement(node, false);
// Download photo only when needed
img.loading = 'lazy';
```

## Integration with Django

### In your Django view:

```python
from django.shortcuts import render
from .models import Person

def home(request):
    viewer = request.user.person if hasattr(request.user, 'person') else None
    all_people = Person.objects.all()
    
    context = {
        'viewer': viewer,
        'all_people': all_people,
    }
    return render(request, 'famtree/home.html', context)
```

### In your template:

```django
{% load static %}

<svg id="graph-view-canvas"></svg>

<script>
    window.viewerId = {% if viewer %}{{ viewer.id }}{% else %}null{% endif %};
    window.allPeople = {{ all_people|safe }};
    
    window.addEventListener('DOMContentLoaded', () => {
        window.genealogyViewer = new GenealogyViewer();
        window.genealogyViewer.initialize();
    });
</script>
```

---

## More Examples & Documentation

For more examples, see:
- `GENEALOGY_VIEWER_README.md` - Full API reference
- `TECHNICAL_ARCHITECTURE.md` - Component internals
- Module JSDoc comments - Detailed function documentation
- HTML inline comments - Implementation details

