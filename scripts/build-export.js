import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readFile(relPath) {
  const fullPath = path.join(rootDir, relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

function build() {
  const css = readFile('templates/export/export.css');
  const core = readFile('templates/export/runtime-core.js');
  const scene = readFile('templates/export/runtime-scene.js');
  const ui = readFile('templates/export/runtime-ui.js');
  const physics = readFile('templates/export/runtime-physics.js');
  const controllers = readFile('templates/export/runtime-controllers.js');
  const loop = readFile('templates/export/runtime-loop.js');
  const shell = readFile('templates/export/export-shell.html');

  const generated = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Edit source templates in templates/export/ and compile with: node scripts/build-export.js

export const EXPORT_CSS = ${JSON.stringify(css)};
export const RUNTIME_CORE = ${JSON.stringify(core)};
export const RUNTIME_SCENE = ${JSON.stringify(scene)};
export const RUNTIME_UI = ${JSON.stringify(ui)};
export const RUNTIME_PHYSICS = ${JSON.stringify(physics)};
export const RUNTIME_CONTROLLERS = ${JSON.stringify(controllers)};
export const RUNTIME_LOOP = ${JSON.stringify(loop)};
export const EXPORT_SHELL = ${JSON.stringify(shell)};

export function generateExportHTML(sceneData, assetsData, uiData, nodeGraphData, runtimeClassSource) {
  let html = EXPORT_SHELL;
  html = html.replace('/* __EXPORT_CSS__ */', EXPORT_CSS);
  html = html.replace('/* __SCENE_DATA__ */ {}', JSON.stringify(sceneData));
  html = html.replace('/* __ASSETS_DATA__ */ {}', JSON.stringify(assetsData));
  html = html.replace('/* __UI_DATA__ */ {}', JSON.stringify(uiData || {}));
  html = html.replace('/* __NODE_DATA__ */ {}', JSON.stringify(nodeGraphData || {}));
  html = html.replace('/* __EXPORT_RUNTIME_CORE__ */', RUNTIME_CORE);
  html = html.replace('/* __EXPORT_RUNTIME_SCENE__ */', RUNTIME_SCENE);
  html = html.replace('/* __EXPORT_RUNTIME_UI__ */', RUNTIME_UI);
  html = html.replace('/* __RUNTIME_CLASS_SOURCE__ */', runtimeClassSource);
  html = html.replace('/* __EXPORT_RUNTIME_PHYSICS__ */', RUNTIME_PHYSICS);
  html = html.replace('/* __EXPORT_RUNTIME_CONTROLLERS__ */', RUNTIME_CONTROLLERS);
  html = html.replace('/* __EXPORT_RUNTIME_LOOP__ */', RUNTIME_LOOP);
  return html;
}
`;

  const outputPath = path.join(rootDir, 'js/editor/ExportTemplate.generated.js');
  fs.writeFileSync(outputPath, generated, 'utf8');
  console.log('Build succeeded: ' + outputPath);
}

build();
