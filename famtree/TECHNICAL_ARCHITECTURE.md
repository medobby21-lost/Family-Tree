# Technical Architecture: Professional Genealogy Viewer

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GenealogyViewer (Orchestrator)            │
│  - Coordinates all components                                │
│  - Manages lifecycle                                         │
│  - Handles sidebar integration                               │
└──────────┬──────────────────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────┬─────────────┬──────────────┐
    │             │          │             │              │
    ▼             ▼          ▼             ▼              ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│TreeLayout│NodeRenderer EdgeRenderer CameraCtrl AnimCtrl│
│(ELK.js) │  (SVG)     (SVG paths)   (D3 zoom) (CSS)    │
└────────┘ └──────────┘ └─────────┘ └──────────┘ └──────────┘
    │             │          │             │              │
    │             │          │             │              │
├──────────────────────────────────────────────────────┤
│          SearchController                             │
│          ExpandCollapseManager                         │
│          Minimap                                       │
└────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   D3.js (Zoom/Pan)                          │
│                   SVG Canvas                                 │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Django)                               │
│  - /api/graph-data/ → graphData.json                        │
│  - /api/relation/?p1=X&p2=Y → relationship paths           │
│  - Member CRUD operations                                   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initialization

```
DOMContentLoaded
    ↓
new GenealogyViewer()
    ↓
initialize()
    ↓
fetch(/api/graph-data/)
    ├─ Parse JSON
    ├─ Create TreeLayout
    ├─ Call layout.compute()
    │   └─ ELK.js processes hierarchy
    ├─ Get layout positions
    ├─ Create renderers (NodeRenderer, EdgeRenderer)
    ├─ Create controllers (Camera, Animation, Search, etc.)
    ├─ Call render()
    │   ├─ renderEdges()
    │   │   └─ Create SVG paths for each link
    │   ├─ renderNodes()
    │   │   └─ Create SVG groups with card elements
    │   └─ Update minimap
    └─ setupInteractions()
        └─ Add event listeners
```

### User Interaction Flow

#### Click Node
```
Click event
    ↓
Node click handler
    ↓
selectNode(node)
    ├─ Update selectedNode
    ├─ animationController.selectNode() → highlight visually
    ├─ updateSidebar(node) → populate member info
    ├─ highlightRelatives(node) → fade/highlight relatives
    └─ animationController.highlightRelatives()
```

#### Search
```
Input event
    ↓
handleSearch(query)
    ↓
searchController.search(query, nodes)
    ├─ Filter nodes matching query
    ├─ Store results
    └─ highlightResults()
        ├─ Fade non-matching nodes
        ├─ Highlight matching nodes
        └─ cameraController.centerAndZoomToNode()
```

#### Expand/Collapse
```
Click expand button
    ↓
toggleBranch(nodeId)
    ├─ expandManager.toggleBranch()
    ├─ animationController.expandBranch()
    │   └─ CSS transitions + stagger
    └─ expandManager.saveState() → localStorage
```

#### Zoom/Pan
```
Mouse wheel / Click+drag
    ↓
D3 zoom behavior
    ├─ Calculate new transform
    ├─ Apply to SVG group
    ├─ cameraController updates transform state
    └─ minimap.update() with new viewport
```

## Component Details

### TreeLayout (ELK.js)

**Input:**
```javascript
graphData = {
    nodes: [{ id, name, surname, generation, photo, ... }],
    links: [{ source, target, type: 'father-child'|'mother-child'|'spouse'|'sibling' }]
}
```

**Process:**
1. Convert to ELK format
2. Create marriage connector nodes
3. Configure ELK layout options (mrtree algorithm, DOWN direction, etc.)
4. Call `elk.layout(elkGraph)`
5. Extract positioned nodes

**Output:**
```javascript
positions = {
    'node-123': { x: 100, y: 200, width: 220, height: 140 },
    'node-456': { x: 320, y: 200, width: 220, height: 140 },
    ...
}
```

### NodeRenderer (SVG)

**Process:**
1. Build surname color palette
2. For each node:
   - Create SVG `<g>` container
   - Add background rect (card)
   - Add surname color strip (top)
   - Add avatar (circle with image or initials)
   - Add name text
   - Add surname text (colored)
   - Add birth/death years
   - Add gender/status badges
   - Add user badge (if logged-in user)
   - Add shadows and filters

**Output:**
```xml
<g class="node-card male" id="node-123" transform="translate(100, 200)">
    <defs>
        <filter><!-- shadow --></filter>
    </defs>
    <rect class="node-card-bg" width="220" height="140" rx="8" />
    <rect class="node-surname-strip" height="4" fill="#7b61ff" />
    <!-- Avatar, text, badges... -->
</g>
```

### EdgeRenderer (SVG Paths)

**Input:**
```javascript
edge = {
    id: 'link-123-456',
    source: { x, y },
    target: { x, y },
    type: 'father-child'
}
```

**Process:**
1. Generate orthogonal path using `orthoPath()`
   - Path goes: DOWN → RIGHT/LEFT → DOWN
   - Smooth corners using quadratic Bezier curves
2. Create SVG `<path>` element
3. Apply stroke color, width, dash pattern based on type

**Output:**
```xml
<path class="edge edge-father-child" 
      d="M 100 200 L 100 250 Q 100 260 120 260 L 250 260 Q 270 260 270 270 L 270 320"
      stroke="#3a86ff" stroke-width="2" />
```

### CameraController (D3 Zoom)

**State:**
```javascript
currentTransform = {
    x: number,      // Translation X
    y: number,      // Translation Y
    k: number       // Scale factor
}
```

**Methods:**
- `zoomTo(scale)` - Smooth zoom animation
- `panToNode(node)` - Smooth pan to node
- `centerAndZoomToNode(node, scale)` - Combined pan + zoom
- `fitToView(nodes)` - Show all nodes
- `getViewport()` - Return current viewport rect

### AnimationController (CSS Transitions)

**Techniques:**
- CSS transitions for opacity, transform, filter
- CSS animations for pulse, dash
- Staggered animations using setTimeout
- requestAnimationFrame for smooth 60fps

**Examples:**
```css
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}

@keyframes dash {
    to { stroke-dashoffset: -100; }
}
```

### SearchController (Client-side Filtering)

**Algorithm:**
1. Tokenize query (lowercase)
2. For each node:
   - Check if name/surname/phone/location contains query
   - Add matches to results[]
3. Highlight results:
   - Fade non-matching nodes (opacity 0.15)
   - Highlight matching nodes (opacity 1)
   - Apply glow filter
4. Animate camera to first result

### ExpandCollapseManager (State Tracking)

**State:**
```javascript
expandedNodes = Set([123, 456, ...])  // Node IDs
focusedNodeId = 789                    // Currently focused
```

**Persistence:**
```javascript
// Save to localStorage
localStorage.setItem('familyTree_expandedNodes', JSON.stringify([...expandedNodes]))

// Restore from localStorage
const saved = JSON.parse(localStorage.getItem('familyTree_expandedNodes'))
expandedNodes = new Set(saved)
```

### Minimap (Canvas Drawing)

**Rendering:**
1. Calculate tree bounds
2. Scale to canvas size
3. Draw edges with low opacity
4. Draw nodes as small circles
5. Draw viewport rectangle highlight
6. Update on camera changes

**Interaction:**
- Click minimap to navigate to that node
- Find closest node to click position
- Call camera.centerAndZoomToNode()

## Performance Characteristics

### Complexity Analysis

| Operation | Complexity | Time (100 nodes) | Time (1000 nodes) |
|-----------|-----------|-----------------|------------------|
| Layout compute | O(n log n) | 50ms | 200ms |
| Node rendering | O(n) | 20ms | 100ms |
| Edge rendering | O(e) | 15ms | 50ms |
| Search | O(n·q) | 5ms | 20ms |
| Zoom/Pan | O(1) | 2ms | 2ms |
| **Total initial** | **O(e + n log n)** | **~90ms** | **~370ms** |

### Memory Usage

| Structure | Size (100 nodes) | Size (1000 nodes) |
|-----------|-----------------|------------------|
| graphData JSON | ~50KB | ~500KB |
| DOM nodes | ~1.5KB × 100 | ~15KB × 1000 |
| SVG elements | ~15KB | ~150KB |
| **Total** | **~100KB** | **~700KB** |

### Optimization Techniques

1. **ELK.js caching** - Computed layout stored, reused if data unchanged
2. **SVG group transforms** - Only transform top group, not individual nodes
3. **CSS transitions** - GPU-accelerated when possible
4. **Minimap canvas** - Not DOM updates, pure canvas drawing
5. **Event delegation** - Single listener on SVG, not per node

## Integration Points

### Backend API

**GET /api/graph-data/**
```json
{
    "nodes": [
        {
            "id": 1,
            "name": "John",
            "surname": "Doe",
            "gender": "M",
            "dob": "1950-01-15",
            "dod": null,
            "photo": "/media/photos/1.jpg",
            "phone": "555-1234",
            "email": "john@example.com",
            "native_place": "New York",
            "address": "123 Main St",
            "generation": 0
        }
    ],
    "links": [
        {
            "source": { "id": 1 },
            "target": { "id": 2 },
            "type": "father-child"
        }
    ]
}
```

**GET /api/relation/?p1=1&p2=2**
```json
{
    "relations": [
        {
            "relation": "father",
            "length": 1,
            "chain": "Person 1 (father) → Person 2",
            "path_ids": [1, 2]
        }
    ]
}
```

### Django Templates

```django
{% load static %}
<script src="{% static 'js/genealogy/GenealogyViewer.js' %}"></script>
<script>
    window.viewerId = {% if viewer %}{{ viewer.id }}{% else %}null{% endif %};
    window.genealogyViewer = new GeneologyViewer();
    window.genealogyViewer.initialize();
</script>
```

## Error Handling

### Layout Errors
```javascript
try {
    await layout.compute(graphData);
} catch (err) {
    console.error('Layout failed:', err);
    showError('Failed to compute layout. Check browser console.');
}
```

### Rendering Errors
```javascript
try {
    render();
} catch (err) {
    console.error('Rendering failed:', err);
    showError('Failed to render tree.');
}
```

### API Errors
```javascript
try {
    const response = await fetch('/api/graph-data/');
    if (!response.ok) throw new Error('Unauthorized');
    graphData = await response.json();
} catch (err) {
    console.error('API error:', err);
    showError('Failed to load family tree data.');
}
```

## Extensibility

### Adding New Features

**Template:**
```javascript
class NewFeature {
    constructor(config = {}) {
        this.config = config;
    }
    
    initialize(viewer) {
        this.viewer = viewer;
        // Setup
    }
    
    update() {
        // Update logic
    }
}

// In GenealogyViewer.initialize():
this.newFeature = new NewFeature();
this.newFeature.initialize(this);
```

### Custom Renderers

Replace NodeRenderer:
```javascript
class CustomNodeRenderer extends NodeRenderer {
    createNodeElement(node, isLoggedInUser) {
        // Custom implementation
    }
}
```

### Custom Layouts

Replace TreeLayout:
```javascript
class CustomTreeLayout extends TreeLayout {
    async compute(graphData) {
        // Your layout algorithm
    }
}
```

## Testing

### Unit Tests (Example)
```javascript
// Test TreeLayout
const layout = new TreeLayout();
const positions = layout.getNodePositions();
assert(positions['node-1'].x > 0);
assert(positions['node-1'].y > 0);

// Test NodeRenderer colors
const renderer = new NodeRenderer();
renderer.buildSurnameColors(nodes);
assert(renderer.surnameColors['Doe'] !== undefined);

// Test CameraController zoom
const camera = new CameraController(svg, svgGroup);
camera.zoomTo(1.5);
assert(camera.currentTransform.k === 1.5);
```

### E2E Tests (Example)
```javascript
// Load page
open('/family-tree/');

// Search for member
findElement('#search-input').setValue('John');
waitForElement('.search-result');

// Click result
click('.search-result');
waitForElement('.node-selected');

// Verify sidebar updated
assert(findElement('#view-name').textContent.includes('John'));
```

## Deployment Checklist

- [ ] All JS files in `famtree/static/js/genealogy/`
- [ ] `home.html` imports all modules
- [ ] `{% load static %}` tag present
- [ ] ELK.js CDN link verified
- [ ] D3.js v7+ included
- [ ] CSS styles complete
- [ ] Django static files collected: `python manage.py collectstatic`
- [ ] Database migrations run (none needed)
- [ ] Tests pass
- [ ] Performance profiling done
- [ ] Browser compatibility verified
- [ ] Mobile responsiveness checked
- [ ] Documentation updated
- [ ] Rollback plan documented

---

## References

- **ELK.js**: https://www.eclipse.org/elk/documentation.html
- **D3.js**: https://d3js.org/
- **SVG**: https://developer.mozilla.org/en-US/docs/Web/SVG
- **CSS Animations**: https://developer.mozilla.org/en-US/docs/Web/CSS/animation
- **Django Static Files**: https://docs.djangoproject.com/en/stable/howto/static-files/

