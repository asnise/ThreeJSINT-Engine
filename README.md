# ThreeJSINT

A browser-native 3D scene builder and interactive runtime built on Three.js.

ThreeJSINT feels like a lightweight web hybrid of Unity and Blender. You can import `.glb` models, assign materials, paint collision boxes, wire up game logic with visual nodes, playtest in first-person mode with WASD, and export the entire project into a self-contained `.html` file that runs offline without a server.

Zero build steps. Zero `npm install`. No Electron overhead. Just standard ES modules and an HTML file.

---

## Previews

### Editor Layout
![Editor Overview](screenshots/editor_overview.png)
*Viewport with transform gizmos, hierarchy, material slots, inspector, and asset browser.*

### First-Person Runtime
![Gameplay Runtime](screenshots/demo_runtime.webp)
*Exported standalone player with collision physics, crosshair, and raycast interaction.*

### Project Launcher
![Project Launcher](screenshots/launcher_overview.png)
*Local project manager with browser-cached saves, template presets, and package imports.*

---

## Why build this?

Most web 3D tools fall into two extremes:
1. Full game engines (Unity / Unreal WebGL exports) that produce massive 50MB+ WebAssembly blobs and take minutes to load.
2. Code-only Three.js setups where you manually hardcode camera positions, tweak collision coordinates in JavaScript, and reload the browser fifty times.

ThreeJSINT sits in the middle: a fast, visual editor for building 3D walkthroughs, museum exhibits, point-and-click escape rooms, and interactive product showcases. When you're done, hit export and you get a single `.html` file with all 3D assets, textures, and runtime logic baked right in.

---

## Quick Start

Serve the project folder using any local static file server:

```bash
# Node.js
npx serve .

# Or Python
python -m http.server 8080

# Or PHP
php -S localhost:8080
```

Open `http://localhost:8080` in Chrome, Edge, or Firefox.

To jump straight into the included demo scene without opening the launcher:
```
http://localhost:8080/?demo=treasure-room
```

---

## Editor Workflow

### 1. Project Storage & Saving
ThreeJSINT treats your browser storage as a local drive:
- **Ctrl + S (Save Project)**: Saves the entire scene, assets, and node graph into your browser's IndexedDB storage immediately. It does not spam your Downloads folder with files.
- **Ctrl + Shift + S (Save As)**: Packs your project into a `.threeint` archive (ZIP format with a manifest and raw binaries) and downloads it to your hard drive so you can share or back it up.
- **Rename Project**: Click the project name in the top right toolbar or the folder badge in the bottom panel to rename it on the spot.
- **Open Project**: Load any `.threeint` package, `.zip`, or legacy `.json` file back into the editor at any time.

### 2. Scene Building & Assets
- **Primitives**: Use the `+ Add` menu to drop in cubes, planes, spheres, or cylinders for quick prototyping or grayboxing.
- **Import Models**: Drag-and-drop `.glb` or `.gltf` files into the editor, or use `Import Mesh`. Imported models are stored in the bottom Project panel and can be dragged into the viewport multiple times.
- **Hierarchy & Parenting**: Drag items inside the Hierarchy panel to nest child objects under parents.
- **Gizmo Shortcuts**:
  - `W`: Translate (Move)
  - `E`: Rotate
  - `R`: Scale
  - `F`: Focus viewport camera on selected object
  - `Delete` / `Backspace`: Remove selected object

### 3. Materials & Textures
- **Material Slots**: Blender-style slot list on the Inspector panel. Click `+` to add a new slot or `-` to delete one.
- **Submesh Preservation**: Multi-mesh models retain their distinct parts and individual materials.
- **Texture Overrides**: Swap out Diffuse, Normal, Roughness, and Metalness maps on any slot using imported image files (`.png`, `.jpg`, `.webp`).

### 4. Collisions & Trigger Volumes
Every object can have an Axis-Aligned Bounding Box (AABB) collider:
- **Solid Collider** (`Trigger: OFF`): Blocks player movement. Use this for floors, walls, tables, and barriers.
- **Trigger Zone** (`Trigger: ON`): The player can walk through it, but entering or leaving fires events into the logic system. Use this for doors, quest markers, and proximity detection.
- **Collider Wireframes**: Toggle the `Colliders` button in the toolbar to see solid boxes in cyan and trigger volumes in green.

### 5. Interaction & Item Inspection
Objects can react when the player looks at them:
- Enable **Interaction** in the Inspector.
- Set an on-screen prompt (e.g. `Press E to examine ancient idol`).
- **Inspect Mode**: Choosing `Inspect (Focus & Rotate)` lets the player click `E` to open a 360-degree inspection view where they can rotate the 3D model with their mouse.

### 6. Visual Logic (Node Graph)
Click `Node Graph` in the toolbar to open the logic canvas:
- **Event Nodes**: `On Start`, `On Interact`, `On Trigger Enter`, `On Trigger Exit`, `On Key Pressed`.
- **Condition Nodes**: Compare variables, check player distance, evaluate flags.
- **Action Nodes**: Toggle objects, play sounds, change UI elements, set variables, teleport the player.
Connect ports by dragging wires. No build step or script compilation needed.

### 7. In-Game HUD (UI Layout Designer)
Click `UI Layout` in the toolbar to visually design your 2D game interface:
- Add text labels, status cards, health counters, or custom crosshairs.
- Pin elements using percentage or pixel offsets.
- Control visibility and values directly from Node Graph actions.

### 8. Testing in Play Mode
- Hit the **Play** button on the floating HUD at the top center of the viewport (or press `F5`).
- Click inside the viewport to lock the mouse cursor.
- Controls:
  - `WASD`: Walk
  - `Shift`: Sprint
  - `Space`: Jump
  - `Mouse`: Look around
  - `E`: Interact with items
  - `ESC`: Unlock cursor / exit play mode
- Toggle `Maximize` on the HUD to expand the game view to full window size while testing.
- On mobile devices or touchscreens, virtual analog sticks automatically show up.

### 9. Export Options
When your scene is ready, open `File`:
- **Export Standalone HTML**: Produces a single `.html` file with Three.js, all 3D meshes, textures, UI, and logic scripts bundled directly inside as Base64. You can double-click this file from your Desktop and play it offline in any browser.
- **Export Deployable Package (.zip)**: Produces a clean `index.html` plus an `assets/` folder containing the raw `.glb` files and textures. Ready to upload to GitHub Pages, Netlify, Vercel, or any web server.

---

## Keyboard Reference

| Key | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + S` | Global | Save project to browser cache (IndexedDB) |
| `Ctrl + Shift + S` | Global | Save As (download portable `.threeint` file) |
| `W` | Edit Mode | Translate Gizmo |
| `E` | Edit Mode | Rotate Gizmo |
| `R` | Edit Mode | Scale Gizmo |
| `F` | Edit Mode | Frame / Focus Selected Object |
| `Delete` / `Backspace` | Edit Mode | Delete Selected Object |
| `F5` / Play HUD | Viewport | Toggle Play / Edit Mode |
| `WASD` | Play Mode | Move |
| `Shift` | Play Mode | Sprint |
| `Space` | Play Mode | Jump |
| `E` | Play Mode | Interact with targeted object |
| `ESC` | Play Mode | Unlock mouse cursor |

---

## Project Structure

```
ThreeJSINT/
├── index.html                 # Main editor entry point
├── Demo.html                  # Sample exported standalone game
├── README.md                  # Documentation and user guide
├── css/
│   └── editor.css             # Engine UI styles and layout
├── js/
│   ├── app.js                 # Editor bootstrap
│   ├── engine/                # Shared engine core (used by both editor and export)
│   │   ├── Renderer.js        # Three.js WebGL canvas setup and resizing
│   │   ├── SceneManager.js    # Scene graph, hierarchy, and serialization
│   │   ├── AssetManager.js    # Mesh and texture loading, Base64 conversion
│   │   ├── CollisionSystem.js # AABB collision solver and triggers
│   │   ├── FPSController.js   # First-person pointer lock controller
│   │   ├── MobileControls.js  # Virtual joystick for touch devices
│   │   ├── InteractionSystem.js # Raycast detection and prompt display
│   │   ├── ItemInspector.js   # 360-degree item viewer overlay
│   │   ├── Primitives.js      # Procedural shapes (Cube, Sphere, etc.)
│   │   ├── ProjectFileSystem.js # IndexedDB storage and .threeint packager
│   │   ├── UIManager.js       # Runtime 2D HUD renderer
│   │   └── NodeGraph/         # Node logic execution engine
│   └── editor/                # Authoring panels (excluded from exported games)
│       ├── EditorMain.js      # Main editor state and mode switcher
│       ├── Toolbar.js         # Top toolbar and floating play bar
│       ├── Hierarchy.js       # Scene tree view
│       ├── Inspector.js       # Object inspector and material slot editor
│       ├── ProjectPanel.js    # Asset manager panel
│       ├── ProjectLauncher.js # Recent projects and template launcher
│       ├── Gizmo.js           # TransformControls wrapper
│       ├── NodeGraphEditor.js # Visual logic graph editor
│       ├── UIPanel.js         # 2D HUD designer
│       └── ExportSystem.js    # HTML and ZIP bundle exporter
├── demo/
│   └── treasure-room.json     # Prebuilt demo project
└── screenshots/
    ├── editor_overview.png    # Editor screenshot
    ├── demo_runtime.webp      # Animated gameplay preview
    └── launcher_overview.png  # Project launcher screenshot
```

---

## Tech Stack & Compatibility

- **Core**: Three.js (via browser import maps)
- **Physics**: Discrete AABB sliding plane collision solver
- **Asset Formats**: Binary glTF (`.glb`), standard glTF (`.gltf`), PNG, JPEG, WebP
- **Packaging**: JSZip for `.threeint` and deployable `.zip` exports
- **Browser Requirements**: Any modern browser supporting WebGL 2.0 and Pointer Lock API (Chrome, Edge, Firefox, Safari, mobile browsers). No Node.js runtime or build step needed.
