import { NodeGraphRuntime } from '../engine/NodeGraph/NodeGraphRuntime.js';
import { generateExportHTML } from './ExportTemplate.generated.js';

export class ExportSystem {
  //#region [Variables/Fields]
  sceneManager = null;
  assetManager = null;
  uiManager = null;
  nodeRuntime = null;
  //#endregion

  //#region [Properties]
  //#endregion

  //#region [Unity Methods]
  constructor(sceneManager, assetManager, uiManager = null, nodeRuntime = null) {
    this.sceneManager = sceneManager;
    this.assetManager = assetManager;
    this.uiManager = uiManager;
    this.nodeRuntime = nodeRuntime;
  }
  //#endregion

  //#region [Public Methods]
  async exportHTML() {
    const sceneData = this.sceneManager.serialize();
    const assetsData = await this.assetManager.serializeAssets();
    const uiData = this.uiManager ? this.uiManager.serialize() : null;
    const nodeGraphData = this._collectAllNodeGraphData(assetsData);

    const html = this._generateHTML(sceneData, assetsData, uiData, nodeGraphData);

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported-scene.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportZip(projectName = 'MyInteractiveProject') {
    if (typeof JSZip === 'undefined') {
      alert('JSZip library is not loaded. Please use Export Standalone HTML or ensure network access to cdn.jsdelivr.net.');
      return;
    }

    const sceneData = this.sceneManager.serialize();
    const assetsData = await this.assetManager.serializeAssets();
    const uiData = this.uiManager ? this.uiManager.serialize() : null;
    const nodeGraphData = this._collectAllNodeGraphData(assetsData);

    const zip = new JSZip();

    const html = this._generateHTML(sceneData, assetsData, uiData, nodeGraphData);
    zip.file('index.html', html);

    const projectConfig = {
      format: 'ThreeJSINT',
      version: 1,
      projectName: projectName,
      createdAt: new Date().toISOString(),
      scene: sceneData,
      uiData: uiData,
      nodeGraphData: nodeGraphData
    };
    zip.file('project.json', JSON.stringify(projectConfig, null, 2));

    const assetsFolder = zip.folder('assets');
    const modelsFolder = assetsFolder.folder('models');
    const texturesFolder = assetsFolder.folder('textures');

    if (this.assetManager && this.assetManager._meshes) {
      for (const [id, m] of this.assetManager._meshes.entries()) {
        if (m.arrayBuffer) {
          const safeName = (m.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
          const filename = safeName.endsWith('.glb') ? safeName : safeName + '.glb';
          modelsFolder.file(filename, m.arrayBuffer);
        }
      }
    }

    if (this.assetManager && this.assetManager._textures) {
      for (const [id, t] of this.assetManager._textures.entries()) {
        if (t.arrayBuffer) {
          const safeName = (t.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
          const filename = safeName.endsWith('.png') ? safeName : safeName + '.png';
          texturesFolder.file(filename, t.arrayBuffer);
        }
      }
    }

    const readme = `ThreeJSINT - Standalone Web Deployment Package
Project: ${projectName}
Date: ${new Date().toLocaleString()}

How to deploy:
1. Extract all files to your web server root or public_html directory.
2. Or drag-and-drop this entire ZIP directly to Netlify Drop (netlify.com/drop) or itch.io HTML5 upload.
3. Open index.html in any modern browser.
`;
    zip.file('README.txt', readme);

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9_\-]/g, '_')}_Deploy.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
  //#endregion

  //#region [Private Methods]
  _collectAllNodeGraphData(assetsData) {
    const combined = {
      nodes: [],
      connections: [],
      variables: {}
    };

    const nodeMap = new Map();
    const connSet = new Set();

    const addGraph = (graph) => {
      if (!graph) return;
      if (graph.variables && typeof graph.variables === 'object') {
        Object.assign(combined.variables, graph.variables);
      }
      if (Array.isArray(graph.nodes)) {
        for (const n of graph.nodes) {
          if (n && n.id && !nodeMap.has(n.id)) {
            nodeMap.set(n.id, JSON.parse(JSON.stringify(n)));
          }
        }
      }
      if (Array.isArray(graph.connections)) {
        for (const c of graph.connections) {
          if (c && c.fromNode && c.toNode) {
            const key = `${c.fromNode}:${c.fromPort}->${c.toNode}:${c.toPort}`;
            if (!connSet.has(key)) {
              connSet.add(key);
              combined.connections.push(JSON.parse(JSON.stringify(c)));
            }
          }
        }
      }
    };

    if (this.nodeRuntime) {
      addGraph(this.nodeRuntime.serialize());
    }

    if (assetsData && assetsData.nodeGraphs) {
      for (const asset of Object.values(assetsData.nodeGraphs)) {
        if (asset && asset.graphData) {
          addGraph(asset.graphData);
        }
      }
    }

    if (this.sceneManager) {
      const allObjs = this.sceneManager.getAllObjects();
      for (const obj of allObjs) {
        if (obj.userData?.nodeGraphData) {
          addGraph(obj.userData.nodeGraphData);
        }
        if (obj.userData?.components?.nodeGraph?.graphData) {
          addGraph(obj.userData.components.nodeGraph.graphData);
        }
      }

      const hasPlayerObj = allObjs.some(o =>
        (o.userData?.type === 'player_controller' || o.userData?.components?.playerController?.enabled) &&
        this.sceneManager.isActiveInHierarchy(o.userData.id)
      );
      const hasPlayerNodes = Array.from(nodeMap.values()).some(n => n.scope === 'player' || n.type === 'CharacterMoveOutput');
      if (hasPlayerObj && !hasPlayerNodes) {
        const nUpdate = { id: crypto.randomUUID(), type: 'OnUpdate', scope: 'player', data: {} };
        const nInput = { id: crypto.randomUUID(), type: 'InputAxis', scope: 'player', data: {} };
        const nMove = { id: crypto.randomUUID(), type: 'MovementDirection', scope: 'player', data: {} };
        const nPhys = { id: crypto.randomUUID(), type: 'CharacterPhysics', scope: 'player', data: { jumpForce: 8, gravity: -15 } };
        const nMoveOut = { id: crypto.randomUUID(), type: 'CharacterMoveOutput', scope: 'player', data: { radius: 0.3, height: 1.7 } };
        const nMouse = { id: crypto.randomUUID(), type: 'MouseLookInput', scope: 'player', data: {} };
        const nChildCam = { id: crypto.randomUUID(), type: 'GetChildComponent', scope: 'player', data: { parentId: 'current', childName: 'MainCamera', componentType: 'camera' } };
        const nRotOut = { id: crypto.randomUUID(), type: 'RotateCameraOutput', scope: 'player', data: { sensitivity: 0.002 } };
        const nParamSpeed = { id: crypto.randomUUID(), type: 'FloatParameter', scope: 'player', data: { name: 'MoveSpeed', value: 6.0 } };

        const presetNodes = [nUpdate, nInput, nMove, nPhys, nMoveOut, nMouse, nChildCam, nRotOut, nParamSpeed];
        for (const n of presetNodes) nodeMap.set(n.id, n);

        const presetConns = [
          { id: crypto.randomUUID(), fromNode: nUpdate.id, fromPort: 'flow', toNode: nInput.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'flow', toNode: nMove.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'horizontal', toNode: nMove.id, toPort: 'horizontal' },
          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'vertical', toNode: nMove.id, toPort: 'vertical' },
          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'sprint', toNode: nMove.id, toPort: 'sprint' },
          { id: crypto.randomUUID(), fromNode: nParamSpeed.id, fromPort: 'val', toNode: nMove.id, toPort: 'speed' },
          { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'flow', toNode: nPhys.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'jump', toNode: nPhys.id, toPort: 'jump' },
          { id: crypto.randomUUID(), fromNode: nPhys.id, fromPort: 'flow', toNode: nMoveOut.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'moveX', toNode: nMoveOut.id, toPort: 'moveX' },
          { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'moveZ', toNode: nMoveOut.id, toPort: 'moveZ' },
          { id: crypto.randomUUID(), fromNode: nPhys.id, fromPort: 'velocityY', toNode: nMoveOut.id, toPort: 'velocityY' },

          { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'flow', toNode: nMouse.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'flow', toNode: nChildCam.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nChildCam.id, fromPort: 'flow', toNode: nRotOut.id, toPort: 'flow' },
          { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'lookX', toNode: nRotOut.id, toPort: 'lookX' },
          { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'lookY', toNode: nRotOut.id, toPort: 'lookY' },
          { id: crypto.randomUUID(), fromNode: nChildCam.id, fromPort: 'child', toNode: nRotOut.id, toPort: 'targetCamera' }
        ];
        combined.connections.push(...presetConns);
      }
    }

    combined.nodes = Array.from(nodeMap.values());
    return combined;
  }

  _generateHTML(sceneData, assetsData, uiData, nodeGraphData) {
    const runtimeClassSource = (this.nodeRuntime?.constructor || NodeGraphRuntime).toString();
    return generateExportHTML(sceneData, assetsData, uiData, nodeGraphData, runtimeClassSource);
  }
  //#endregion
}
