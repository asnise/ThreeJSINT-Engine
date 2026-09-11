import { EditorMain } from './editor/EditorMain.js';

const root = document.getElementById('editor-root');
const editor = new EditorMain(root);

const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');
if (demo) {
  editor.loadDemo(demo);
}

window.__editor = editor;
