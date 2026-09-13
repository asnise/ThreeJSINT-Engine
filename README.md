# ThreeJSINT

A browser-native 3D interactive scene builder and game runtime built on Three.js.

ThreeJSINT combines visual world building, hierarchy management, physical collisions, node graph visual scripting, and a 2D HUD designer into a lightweight web environment. You can import 3D models (`.glb` / `.gltf`), assign material slots, paint collision volumes, wire up gameplay logic without code, test first-person character gameplay in the editor, and export self-contained standalone `.html` games that run completely offline without servers or build tools.

Zero build steps. Zero `npm install`. No Electron overhead. Standard ES modules running directly in modern web browsers.

---

## Previews

### Editor Layout
![Editor Overview](screenshots/editor_overview.png)
*Viewport with transform gizmos, scene hierarchy, material slot inspector, virtual file system, and node graph.*

### First-Person Runtime
![Gameplay Runtime](screenshots/demo_runtime.webp)
*Exported standalone player with collision physics, character controller, crosshair, and raycast interaction.*

### Project Launcher
![Project Launcher](screenshots/launcher_overview.png)
*Local project manager with browser-cached IndexedDB storage, starter templates, and `.threeint` package imports.*

---

## Core Capabilities

- **Lightweight & Instant**: Loads in seconds with no heavy runtime engine downloads or WebAssembly compilation delays.
- **Virtual File System & Project Folders**: Full folder hierarchy support with subfolders, asset categorization (Meshes, Textures, Audio, Scenes, Scripts), and drag-and-drop file organization.
- **True Transform Hierarchy**: Parent-child nesting with robust multi-level world matrix synchronization, preserving submesh structures, orientations, and scale.
- **Blender-Style Material Slots**: Multi-material editing with texture overrides (Base Color, Roughness, Metalness, Opacity, Wireframe) and texture flipping controls.
- **Dual Physics Engine**: Discrete AABB sliding plane collision solver for solid obstacles, combined with trigger volumes for event detection.
- **3D Item Inspection & Raycast Interaction**: Built-in interaction prompts with distance limits, custom event hooks, and 360-degree item inspection overlays available in both Play mode ('E' key) and Edit mode ("Preview Inspect Focus").
- **Visual Scripting (Node Graph)**: Full dataflow and execution graph system featuring box selection, margin-based auto-alignment, typed parameter nodes (Float, Int, String, Bool, Vector3, Color, List, Dictionary), and child component targeting.
- **2D UI Layout Designer**: Canvas-based HUD designer for authoring game overlays, health bars, inventory labels, and dialogue boxes with runtime Node Graph bindings.
- **Modular Export Compiler**: Standalone single-file HTML exporter and deployable ZIP package exporter powered by modular template sources (`templates/export/`) and an automated build tool (`scripts/build-export.js`).

---

## Quick Start

Serve the project folder using any local static file server:

```bash
# Node.js
npx serve .

# Python
python -m http.server 8080

# PHP
php -S localhost:8080
```

Open `http://localhost:8080` in any modern browser (Chrome, Edge, Firefox, Safari).

To bypass the launcher and open a specific template package from the demo folder directly:
```
http://localhost:8080/?demo=MyTemplate
```

---

## Editor Workflow

### 1. Project Management & Storage
- **Browser Drive (IndexedDB)**: `Ctrl + S` instantly persists your complete project state (scene hierarchy, materials, virtual folders, asset binaries, node graphs, and custom UI) directly into browser storage without prompting file downloads.
- **Portable Packages (`.threeint`)**: `Ctrl + Shift + S` packages the entire project into a compressed ZIP containing an `index.json` manifest and raw asset binaries. Share or transfer projects across devices effortlessly.
- **Project Launcher**: Create projects from Blank Scene or custom `.threeint` templates stored in `demo/`, rename projects inline, clone existing scenes, or load local archive files.

### 2. Project Panel & Virtual File System
- **Folder Organization**: Create, rename, and nest custom directories inside the Project Panel.
- **Drag-and-Drop Organization**: Drag textures, meshes, and script assets between folders to maintain clean asset organization.
- **Asset Filtering**: Filter project contents by type tabs: `All`, `Meshes`, `Textures`, `Audio`, `Scenes`, and `Scripts`.
- **Breadcrumb Navigation**: Seamlessly navigate deep folder structures with folder path tracking and direct root access.

### 3. Scene Hierarchy & 3D Prototyping
- **Primitives**: Drop in procedural cubes, spheres, cylinders, planes, empty transform groups, or pre-rigged Player Controllers.
- **GLTF / GLB Import**: Drag `.glb` or `.gltf` files directly onto the viewport or into the Project Panel. Multi-mesh hierarchies and submesh part identities are maintained throughout edits and exports.
- **Parent-Child Hierarchy**: Drag and nest items within the Hierarchy panel. Child items maintain relative transforms and local matrix offsets.
- **Viewport Navigation & Gizmos**:
  - `W`: Translate mode
  - `E`: Rotate mode
  - `R`: Scale mode
  - `F`: Focus camera on selected object
  - `Delete` / `Backspace`: Remove selected object

### 4. Materials & Texture Mapping
- **Material Slots**: Inspect every submesh material independently. Add or remove slots dynamically.
- **PBR Parameters**: Fine-tune Diffuse color, Roughness, Metalness, Opacity, Wireframe rendering, and Face Culling (DoubleSide, FrontSide, BackSide).
- **Texture Overrides**: Assign imported image assets as diffuse base color maps with automated `flipY` correction for imported 3D models.

### 5. Colliders & Trigger Volumes
- **Solid Colliders** (`Trigger: OFF`): Solid AABB collision boxes that prevent the player from walking through walls, floors, pillars, and props.
- **Trigger Volumes** (`Trigger: ON`): Pass-through bounding volumes that detect character entry and exit, firing `OnTriggerEnter` and `OnTriggerExit` events in the Node Graph.
- **Debug Visualizer**: Toggle the `Colliders` button on the top toolbar to display solid boundaries in cyan and trigger volumes in green.

### 6. Interaction & 3D Item Inspection (Focus & Rotate)
- **Raycast Targeting**: Targeted raycasting tracks objects with active interaction components within customizable range thresholds (`maxDistance`).
- **Prompt Display**: Customizable on-screen prompt (e.g. `Press E to examine`).
- **Inspect Mode (Focus & Rotate)**:
  - **In Play Mode**: Approaching an interactable object and pressing `E` pauses world movement, frees the cursor, and displays a 360-degree focused 3D inspection modal. Click and drag or touch to inspect the model. Press `ESC` or click the close button (`X`) to return smoothly to first-person play.
  - **In Edit Mode**: Select any object with an Interaction component and click `Preview Inspect Focus` in the Inspector card to immediately test the 3D inspection overlay without leaving the editor.
- **Event Trigger Mode**: Alternatively, route interactions directly into Node Graph custom logic via the `OnInteract` event.

### 7. Node Graph Visual Scripting
Open the `Node Graph` from the toolbar to program interactive logic visually:
- **Box Multi-Selection**: Click and drag on the graph canvas background to draw a selection marquee over multiple nodes simultaneously.
- **Auto-Alignment**: Click `Align Nodes` to neatly organize selected nodes horizontally and vertically with customizable spacing margins.
- **Typed Parameter Nodes**: Create and expose parameters for clean architecture:
  - `FloatParameter`
  - `IntParameter`
  - `StringParameter`
  - `BoolParameter`
  - `Vector3Parameter`
  - `ColorParameter`
  - `ListParameter`
  - `DictionaryParameter`
- **Child Component Queries**: Use `GetChildComponent` to target nested objects (e.g., retrieving `MainCamera` under a `PlayerController`) without hardcoding absolute scene paths.
- **Events & Flow**: Connect execution flow ports between `OnStart`, `OnUpdate`, `OnInteract`, `OnTriggerEnter`, `InputAxis`, `MouseLookInput`, and action nodes (`CharacterMoveOutput`, `RotateCameraOutput`, `SetVariable`, `Compare`).

### 8. In-Game 2D HUD Designer
Open the `UI Layout` designer to build HUDs:
- Visual drag, drop, and resize positioning with anchor presets.
- Text labels, numeric meters, health bars, inventory panels, and notification boxes.
- Direct runtime bindings connecting Node Graph variable outputs to UI elements.

### 9. Play Mode Testing
- Click **Play** on the floating viewport bar or press `F5`.
- First-person controls:
  - `WASD`: Movement
  - `Shift`: Sprint
  - `Space`: Jump
  - `Mouse`: Look around (Pointer Lock)
  - `E`: Interact / 3D Item Inspection
  - `ESC`: Unlock cursor / close inspection
- Responsive touch controls: On mobile devices or touchscreens, dual on-screen joysticks and touch interaction buttons automatically activate.

### 10. Modular Standalone Export
Export production-ready interactive applications from the `File` menu:
- **Export Standalone HTML**: Compiles the entire project into a single `.html` file. All 3D models, textures, styles, and logic are embedded as base64 data. Runs offline directly from local disk.
- **Export Deployable Package (.zip)**: Generates a web-standard directory with `index.html` and an `assets/` subfolder holding raw `.glb` files and textures. Ready for deployment to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or Apache/Nginx servers.

---

## Keyboard Reference

| Key | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + S` | Global | Save project to browser IndexedDB |
| `Ctrl + Shift + S` | Global | Save As (Download portable `.threeint` package) |
| `Ctrl + Z` | Edit Mode | Undo scene modification |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Edit Mode | Redo scene modification |
| `Ctrl + D` | Edit Mode | Duplicate selected object |
| `W` | Edit Mode | Translate Gizmo |
| `E` | Edit Mode | Rotate Gizmo |
| `R` | Edit Mode | Scale Gizmo |
| `F` | Edit Mode | Focus viewport camera on selected object |
| `Delete` / `Backspace` | Edit Mode | Delete selected object |
| `F5` / Play HUD | Viewport | Toggle Play / Edit Mode |
| `WASD` | Play Mode | Move character |
| `Shift` | Play Mode | Sprint |
| `Space` | Play Mode | Jump |
| `E` | Play Mode | Interact with object / Open 3D Item Inspection |
| `ESC` | Play Mode | Close Item Inspection / Release pointer lock |

---

## Project Architecture

```
ThreeJSINT/
├── index.html                     # Editor entry point
├── Demo.html                      # Pre-compiled standalone demo player
├── README.md                      # Engine documentation
├── css/
│   └── editor.css                 # Engine theme and layout styling
├── js/
│   ├── app.js                     # Editor bootstrap
│   ├── engine/                    # Core runtime shared between editor and exports
│   │   ├── Renderer.js            # Three.js WebGL canvas setup and viewport sizing
│   │   ├── SceneManager.js        # Scene graph, hierarchy, and serialization
│   │   ├── AssetManager.js        # Mesh/texture loading and base64 packaging
│   │   ├── CollisionSystem.js     # Discrete AABB collision solver and triggers
│   │   ├── FPSController.js       # First-person pointer lock controller
│   │   ├── MobileControls.js      # Virtual joystick and touch controls
│   │   ├── InteractionSystem.js   # Raycast targeting and prompt controller
│   │   ├── ItemInspector.js       # 360-degree 3D item inspection overlay
│   │   ├── Primitives.js          # Procedural shapes and component attachment
│   │   ├── ProjectFileSystem.js   # IndexedDB browser storage and .threeint packager
│   │   ├── UIManager.js           # 2D HUD layout runtime renderer
│   │   └── NodeGraph/             # Visual logic graph runtime
│   │       ├── NodeGraphRuntime.js # Flow execution, math, and physics nodes
│   │       └── NodeDefinitions.js # Node type catalogue and port metadata
│   └── editor/                    # Editor authoring tools
│       ├── EditorMain.js          # Editor controller and mode coordinator
│       ├── Toolbar.js             # Top toolbar and floating play bar
│       ├── Hierarchy.js           # Tree view hierarchy manager
│       ├── Inspector.js           # Object properties and material slot inspector
│       ├── ProjectPanel.js        # Virtual file system and asset browser
│       ├── ProjectLauncher.js     # Project manager and template presets
│       ├── Gizmo.js               # TransformControls wrapper
│       ├── NodeGraphEditor.js     # Visual node graph authoring interface
│       ├── UIPanel.js             # Visual 2D HUD layout designer
│       ├── ExportSystem.js        # HTML and ZIP bundle packager
│       └── ExportTemplate.generated.js # Precompiled standalone runtime bundle
├── templates/
│   └── export/                    # Modular export runtime source components
│       ├── export-shell.html      # Standalone HTML shell
│       ├── export.css             # Standalone player styles
│       ├── runtime-core.js        # Three.js bootstrap and asset loaders
│       ├── runtime-scene.js       # Scene hierarchy and material reconstruction
│       ├── runtime-ui.js          # Standalone 2D HUD renderer
│       ├── runtime-physics.js     # Collision and trigger solver adapter
│       ├── runtime-controllers.js # Player controller and 3D item inspection
│       └── runtime-loop.js        # Game loop and input listeners
├── scripts/
│   ├── build-export.js            # Automated compiler for ExportTemplate.generated.js
│   └── build-templates.js         # Automated discovery tool for demo/*.threeint templates
├── demo/
│   └── manifest.json              # Auto-generated template registry for demo packages
└── screenshots/
    ├── editor_overview.png        # Viewport and editor layout preview
    ├── demo_runtime.webp          # Animated gameplay preview
    └── launcher_overview.png      # Project launcher preview
```

---

## Technical Specifications

- **Graphics Core**: Three.js (ES module via browser import maps)
- **Physics**: Discrete Axis-Aligned Bounding Box (AABB) sliding plane solver with trigger intersection checks
- **Asset Formats**: glTF 2.0 Binary (`.glb`), glTF (`.gltf`), PNG, JPEG, WebP
- **Package Format**: `.threeint` (ZIP container with `index.json` manifest and raw binary assets)
- **Browser Compatibility**: Any modern browser supporting WebGL 2.0 and the Pointer Lock API (Chrome, Chromium Edge, Firefox, Safari). Runs entirely client-side with zero local server dependencies.
