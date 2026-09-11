# ThreeJSINT — Implementation

Browser-based 3D interactive scene editor powered by Three.js.  
Place objects, import meshes/textures, set collisions & interactions, test in FPS mode, and export standalone HTML.

---

## Quick Start

```
# Serve with any static server:
npx live-server .

# Or load the treasure room demo:
npx live-server . --open="?demo=treasure-room"
```

No install, no build step. Open `index.html` in a browser.

---

## Architecture

```
ThreeJSINT/
├── index.html                     # Entry page + Three.js importmap
├── css/editor.css                 # Unity-dark-theme styling
├── js/
│   ├── app.js                     # Boot editor, load demo
│   ├── engine/                    # Runtime (used in editor + export)
│   │   ├── Renderer.js            # WebGL renderer, no shadows
│   │   ├── SceneManager.js        # Object registry, serialize/deserialize
│   │   ├── AssetManager.js        # Mesh/texture import, override textures
│   │   ├── CollisionSystem.js     # AABB collision + trigger detection
│   │   ├── FPSController.js       # Pointer lock FPS, WASD + mouse
│   │   ├── MobileControls.js      # Virtual joystick + touch look
│   │   ├── InteractionSystem.js   # Raycast interact, E-key / mobile button
│   │   ├── ItemInspector.js       # Focus-inspect overlay with drag-rotate
│   │   └── Primitives.js          # Cube, Sphere, Plane, Cylinder factory
│   └── editor/                    # Editor-only (not included in export)
│       ├── EditorMain.js          # Orchestrator, Edit/Play mode
│       ├── Hierarchy.js           # Scene tree panel
│       ├── Inspector.js           # Properties, textures, collider, interaction
│       ├── Toolbar.js             # Add, Import, Play, Export buttons
│       ├── Gizmo.js               # TransformControls wrapper
│       └── ExportSystem.js        # Export → standalone HTML
└── demo/
    └── treasure-room.json         # Demo scene data
```

---

## Editor Usage

### Layout

```
┌────────────────────────────────────────┐
│               Toolbar                   │
├───────────┬──────────────┬─────────────┤
│ Hierarchy │   Viewport   │  Inspector  │
│  (220px)  │   (flex)     │   (300px)   │
└───────────┴──────────────┴─────────────┘
```

### File & Project Management

- **File → Save Project**: Serializes the scene graph, object properties, colliders, interactions, and base64-encoded assets into a standalone `project.json` file.
- **File → Open Project**: Pick any previously saved `project.json` file to restore the entire project, assets, and hierarchy.
- **File → Demo: Treasure Room**: 1-click loader for the prebuilt treasure room demo scene.

### Adding & Selecting Objects

1. Click **+ Add** in toolbar → choose Cube / Sphere / Plane / Cylinder
2. Object appears at origin and is selected automatically
3. **Select in 3D Viewport**: Click directly on any object in the 3D scene to select it (or select it from the Hierarchy panel)
4. Move with gizmo (W = translate, E = rotate, R = scale)
5. **Colliders**: Toggle wireframe collision boxes (cyan = solid collider, green = trigger)

### Importing Assets

- **Import Mesh**: Toolbar → Import Mesh → select `.glb` or `.gltf` file
- **Import Texture**: Toolbar → Import Texture → select PNG/JPG/WebP
- Or use Inspector "Browse" buttons on individual texture slots

### Setting Up Collisions

1. Select object (via 3D Viewport click or Hierarchy) → Inspector → **Collider** section
2. Enable **Active** checkbox (immediately visualizes as cyan wireframe box when `Colliders` is active)
3. Toggle **Trigger** for trigger zones (overlap detection, no blocking, green wireframe)
   - Trigger OFF = solid wall/floor/box (blocks player movement with multi-pass AABB solver)
   - Trigger ON = detection zone (fires enter/stay/exit events)

### Setting Up Interactions

1. Select object → Inspector → **Interaction** section
2. Enable **Active** checkbox
3. Choose **Type**: `Inspect (Focus & Rotate)` or `None`
4. Set **Prompt** text (e.g., "Press E to inspect Golden Cube")
5. The object MUST also have Collider enabled with isTrigger ON

### Texture System

**No realtime shadows.** Artists bake shadows into textures.

- **Base Texture**: Inspector → Base Texture → Browse → select image
- **Shadow / Overlay Textures**: Multiple transparent PNG layers
  1. Click **+ Add Shadow / Overlay**
  2. Browse for transparent shadow PNG
  3. Adjust **Opacity** slider (0–1)
  4. Select **Blend** mode: Multiply (shadow) or Normal (decal)
  5. Add as many layers as needed

### Play Mode

1. Click **▶ Play** in toolbar
2. Editor panels hide, FPS controller activates
3. Controls:
   - **WASD**: Move
   - **Mouse**: Look around (pointer locked)
   - **E**: Interact with highlighted objects
   - **ESC**: Unlock pointer / close inspect view
4. Click **■ Stop** to return to edit mode

### Mobile Play Mode

When on touch device:
- **Left joystick**: Movement
- **Right area**: Touch-drag to look
- **E button**: Appears when near interactable object

---

## Key Systems

### FPSController

Mirrors Unity's `Cursor.lockState` / `Cursor.visible`:

| State | lockState | cursorVisible | Behavior |
|-------|-----------|---------------|----------|
| Walking | `Locked` | `false` | WASD + mouse look |
| Inspecting | `None` | `true` | Drag to rotate item |
| Menu/Paused | `None` | `true` | Cursor visible |

### Collision System

AABB-based collision with two modes:

- **Solid** (`isTrigger: false`): Pushes player out on overlap. Resolves along smallest overlap axis (slide along walls).
- **Trigger** (`isTrigger: true`): Detects enter/stay/exit without blocking. Used for interaction zones.

### Interaction System

1. Each frame, raycast from screen center
2. Check hit objects within `interactRange` (3 units)
3. Walk through parent chain to find `interaction.enabled` object
4. Show prompt text
5. On E-key or mobile button → dispatch to handler
6. "inspect" type → ItemInspector takes over

### ItemInspector

Separate Three.js scene rendered in overlay:
1. Clone inspected object
2. Center and auto-frame based on bounding box
3. Three-point lighting (ambient + directional + fill)
4. Mouse/touch drag rotates object
5. ESC or ✕ button closes, restores pointer lock

### Override Textures (Shadow Layers)

For each object, multiple transparent texture layers can be stacked:
- Rendered as separate overlay meshes with alpha blending
- `Multiply` blend mode for baked shadows
- `Normal` blend mode for decals/stickers
- Each layer has independent opacity

---

## Export

Click **Export HTML** in toolbar:

1. Scene serialized to JSON (positions, rotations, colors, userData)
2. Assets embedded as base64 data URIs (textures + meshes)
3. All engine code inlined into single HTML file
4. Three.js loaded from CDN
5. Downloaded as `exported-scene.html`

The exported file:
- Shows "Click to Start" screen
- Enters FPS mode on click
- Full collision, interaction, inspect functionality
- Mobile joystick + interact button on touch devices
- Self-contained — serve with any static server

---

## Extending

### Add New Primitive Type

1. Add factory method in `js/engine/Primitives.js`
2. Add case in `createFromType()`
3. Add menu item in `js/editor/Toolbar.js` dropdown
4. Add icon in `js/editor/Hierarchy.js` `_getIcon()`

### Add New Interaction Type

1. Add option in `js/editor/Inspector.js` type dropdown
2. Add handler in `js/engine/InteractionSystem.js` `_tryInteract()`
3. Update export template in `js/editor/ExportSystem.js`

### Custom Materials

Apply custom Three.js materials programmatically via `window.__editor.sceneManager.getObject(id)`.

---

## Browser Support

- Chrome 95+ / Edge 95+ (Pointer Lock API, ES modules, importmap)
- Firefox 108+ (importmap support)
- Safari 16.4+ (importmap support)
- Mobile: iOS Safari 16.4+, Chrome Android 95+
