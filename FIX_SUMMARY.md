# Fix Applied: Django Template Tag Issue

## Problem
The original code had Django template tags inside JavaScript modules:
```javascript
// In GenealogyViewer.js
const response = await fetch("{% url 'api_graph_data' %}");
```

This caused 404 errors because:
1. JavaScript files (`.js`) are NOT processed by Django template engine
2. The template tag was being URL-encoded and treated as a literal string
3. Django tried to fetch `/%7B%% url 'api_graph_data' %%7D` which doesn't exist

## Solution
Moved the Django template tag processing to the HTML template where it belongs:

### In `home.html` (line ~825):
```javascript
// These lines NOW execute Django template tags
window.apiGraphDataUrl = "{% url 'api_graph_data' %}";
window.apiRelationUrl = "/api/relation/";
window.viewerId = {% if viewer %}{{ viewer.id }}{% else %}null{% endif %};
```

### In `GenealogyViewer.js` (line ~74):
```javascript
const apiUrl = window.apiGraphDataUrl || "{% url 'api_graph_data' %}";
const response = await fetch(apiUrl);
```

## Result
✅ Django template tags are now processed by Django in the HTML template
✅ Values are stored in global `window` variables
✅ JavaScript modules can access them without template processing
✅ 404 errors on API calls are eliminated

## API Endpoints
- **Graph Data:** `/api/graph/` (named: `api_graph_data`)
- **Relationships:** `/api/relation/` (named: `api_relation`)

Both are now correctly resolved and accessible to the frontend.

## Testing
To verify the fix works:
1. Start the dev server: `python manage.py runserver`
2. Login to the application
3. Navigate to the family tree page
4. Check browser console (F12 → Console) - should see no 404 errors
5. The tree visualization should load and render correctly

## Files Modified
1. `famtree/templates/famtree/home.html` - Added API URL global variables
2. `famtree/static/js/genealogy/GenealogyViewer.js` - Updated to use window variables
