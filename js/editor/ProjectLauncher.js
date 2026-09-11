export class ProjectLauncher {
  //#region [Variables/Fields]
  _container = null;
  _projectFS = null;
  _callbacks = null;
  _modalEl = null;
  _activeTab = 'projects';
  _selectedDirHandle = null;
  _selectedTemplate = 'blank';
  //#endregion

  //#region [Properties]
  get isVisible() {
    return this._modalEl && this._modalEl.style.display !== 'none';
  }
  //#endregion

  //#region [Unity Methods]
  constructor(container, projectFS, callbacks = {}) {
    this._container = container;
    this._projectFS = projectFS;
    this._callbacks = callbacks;
    this._build();
  }
  //#endregion

  //#region [Public Methods]
  show(canClose = true) {
    if (!this._modalEl) return;
    this._modalEl.style.display = 'flex';
    this._closeBtn.style.display = canClose ? 'block' : 'none';
    this._switchTab(this._activeTab);
  }

  hide() {
    if (!this._modalEl) return;
    this._modalEl.style.display = 'none';
  }
  //#endregion

  //#region [Private Methods]
  _build() {
    this._modalEl = document.createElement('div');
    this._modalEl.className = 'launcher-modal-overlay';
    this._modalEl.style.display = 'none';

    const windowEl = document.createElement('div');
    windowEl.className = 'launcher-window';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'launcher-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'launcher-title-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'launcher-title';
    titleEl.textContent = 'ThreeJSINT';

    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'launcher-subtitle';
    subtitleEl.textContent = 'Project Manager';

    titleGroup.appendChild(titleEl);
    titleGroup.appendChild(subtitleEl);
    headerEl.appendChild(titleGroup);

    this._closeBtn = document.createElement('button');
    this._closeBtn.className = 'launcher-close-btn';
    this._closeBtn.textContent = '✕';
    this._closeBtn.addEventListener('click', () => this.hide());
    headerEl.appendChild(this._closeBtn);

    windowEl.appendChild(headerEl);

    // Body: Sidebar + Main Area
    const bodyEl = document.createElement('div');
    bodyEl.className = 'launcher-body';

    // Sidebar
    const sidebarEl = document.createElement('div');
    sidebarEl.className = 'launcher-sidebar';

    const tabs = [
      { id: 'projects', label: 'Projects' },
      { id: 'new', label: 'New Project' },
      { id: 'open', label: 'Open' },
      { id: 'demos', label: 'Samples' }
    ];

    this._tabBtns = new Map();
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'launcher-tab-btn';
      btn.textContent = t.label;
      btn.addEventListener('click', () => this._switchTab(t.id));
      sidebarEl.appendChild(btn);
      this._tabBtns.set(t.id, btn);
    });

    bodyEl.appendChild(sidebarEl);

    // Main Content
    this._contentEl = document.createElement('div');
    this._contentEl.className = 'launcher-content';
    bodyEl.appendChild(this._contentEl);

    windowEl.appendChild(bodyEl);
    this._modalEl.appendChild(windowEl);
    this._container.appendChild(this._modalEl);
  }

  _switchTab(tabId) {
    this._activeTab = tabId;
    for (const [id, btn] of this._tabBtns.entries()) {
      btn.classList.toggle('active', id === tabId);
    }

    this._contentEl.innerHTML = '';
    switch (tabId) {
      case 'projects':
        this._renderProjectsTab();
        break;
      case 'new':
        this._renderNewTab();
        break;
      case 'open':
        this._renderOpenTab();
        break;
      case 'demos':
        this._renderDemosTab();
        break;
    }
  }

  async _renderProjectsTab() {
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Recent Projects</h3>
      <span class="launcher-panel-desc">Stored locally on your disk</span>
    `;
    wrap.appendChild(header);

    const listWrap = document.createElement('div');
    listWrap.className = 'launcher-project-list';

    const recent = await this._projectFS.getRecentProjects();
    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'launcher-empty-state';
      empty.innerHTML = `
        <p>No recent projects found</p>
        <button class="launcher-primary-btn" id="go-new-btn">Create New Project</button>
      `;
      empty.querySelector('#go-new-btn').addEventListener('click', () => this._switchTab('new'));
      listWrap.appendChild(empty);
    } else {
      recent.forEach(r => {
        const item = document.createElement('div');
        item.className = 'launcher-project-item';

        const info = document.createElement('div');
        info.className = 'launcher-project-info';

        const name = document.createElement('div');
        name.className = 'launcher-project-name';
        name.textContent = r.name || 'Untitled';

        const path = document.createElement('div');
        path.className = 'launcher-project-path';
        path.textContent = `Folder: ${r.pathName || r.name}`;

        const date = document.createElement('div');
        date.className = 'launcher-project-date';
        date.textContent = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';

        info.appendChild(name);
        info.appendChild(path);
        info.appendChild(date);

        const actions = document.createElement('div');
        actions.className = 'launcher-project-actions';

        const openBtn = document.createElement('button');
        openBtn.className = 'launcher-action-btn open-btn';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', async () => {
          try {
            if (r.handle) {
              const data = await this._projectFS.openProjectFromDirectory(r.handle);
              this.hide();
              if (this._callbacks.onProjectLoaded) this._callbacks.onProjectLoaded(data);
            } else {
              this._switchTab('open');
            }
          } catch (err) {
            alert(`Could not open project: ${err.message}`);
          }
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'launcher-action-btn del-btn';
        delBtn.textContent = '✕';
        delBtn.title = 'Remove from list';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this._projectFS.removeRecentProject(r.name);
          this._renderProjectsTab();
        });

        actions.appendChild(openBtn);
        actions.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(actions);
        listWrap.appendChild(item);
      });
    }

    wrap.appendChild(listWrap);
    this._contentEl.appendChild(wrap);
  }

  _renderNewTab() {
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Create New Project</h3>
      <span class="launcher-panel-desc">Creates project.json and assets subfolder directly on your disk</span>
    `;
    wrap.appendChild(header);

    const form = document.createElement('div');
    form.className = 'launcher-form';

    // Project Name
    const nameGroup = document.createElement('div');
    nameGroup.className = 'launcher-form-group';
    nameGroup.innerHTML = `<label>Project Name</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'launcher-input';
    nameInput.value = 'MyInteractiveScene';
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    // Folder Picker
    const folderGroup = document.createElement('div');
    folderGroup.className = 'launcher-form-group';
    folderGroup.innerHTML = `<label>Project Folder on Disk</label>`;

    const folderRow = document.createElement('div');
    folderRow.className = 'launcher-folder-row';

    const folderDisplay = document.createElement('div');
    folderDisplay.className = 'launcher-folder-display';
    folderDisplay.textContent = this._selectedDirHandle
      ? this._selectedDirHandle.name
      : (this._projectFS.isSupported ? 'No folder selected' : 'Sandbox Mode (Browser Memory)');
    if (!this._projectFS.isSupported && !this._selectedDirHandle) {
      folderDisplay.style.color = '#38bdf8';
    }

    const browseBtn = document.createElement('button');
    browseBtn.className = 'launcher-secondary-btn';
    browseBtn.textContent = 'Choose Folder...';
    browseBtn.addEventListener('click', async () => {
      try {
        if (!this._projectFS.isSupported) {
          alert('Direct disk folder sync requires Chrome, Edge, or Brave on HTTPS/localhost. In this browser, your project will run in Sandbox Mode (save as .json or export .zip).');
          return;
        }
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        this._selectedDirHandle = handle;
        folderDisplay.textContent = handle.name;
        folderDisplay.style.color = '';
        if (nameInput.value === 'MyInteractiveScene' && handle.name) {
          nameInput.value = handle.name;
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Folder selection aborted or failed', err);
        }
      }
    });




    folderRow.appendChild(folderDisplay);
    folderRow.appendChild(browseBtn);
    folderGroup.appendChild(folderRow);
    form.appendChild(folderGroup);

    // Template Selector
    const templateGroup = document.createElement('div');
    templateGroup.className = 'launcher-form-group';
    templateGroup.innerHTML = `<label>Template</label>`;

    const tplRow = document.createElement('div');
    tplRow.className = 'launcher-template-row';

    const tpls = [
      { id: 'blank', title: 'Blank Scene', desc: 'Empty canvas with floor and ambient lighting' },
      { id: 'demo', title: 'Treasure Room Demo', desc: 'Preconfigured interactive room with key, chest, and lights' }
    ];

    tpls.forEach(t => {
      const card = document.createElement('div');
      card.className = `launcher-template-card ${this._selectedTemplate === t.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="template-title">${t.title}</div>
        <div class="template-desc">${t.desc}</div>
      `;
      card.addEventListener('click', () => {
        this._selectedTemplate = t.id;
        tplRow.querySelectorAll('.launcher-template-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
      tplRow.appendChild(card);
    });

    templateGroup.appendChild(tplRow);
    form.appendChild(templateGroup);

    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.className = 'launcher-primary-btn create-btn';
    submitBtn.textContent = 'Create Project';
    submitBtn.addEventListener('click', async () => {
      const pName = nameInput.value.trim() || 'MyInteractiveScene';
      try {
        if (!this._selectedDirHandle) {
          if (!this._projectFS.isSupported) {
            this.hide();
            if (this._callbacks.onQuickSandbox) this._callbacks.onQuickSandbox(pName, this._selectedTemplate);
            return;
          }
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          this._selectedDirHandle = handle;
        }

        let initialData = null;
        if (this._selectedTemplate === 'demo') {
          try {
            const resp = await fetch('demo/treasure-room.json');
            initialData = await resp.json();
          } catch {
            initialData = null;
          }
        }

        const projectData = await this._projectFS.createProjectInDirectory(this._selectedDirHandle, pName, initialData);
        this.hide();
        if (this._callbacks.onProjectCreated) {
          this._callbacks.onProjectCreated(projectData, this._selectedDirHandle);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          alert(`Failed to create project: ${err.message}`);
        }
      }
    });

    form.appendChild(submitBtn);
    wrap.appendChild(form);
    this._contentEl.appendChild(wrap);
  }

  _renderOpenTab() {
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Open Existing Project</h3>
      <span class="launcher-panel-desc">Load project from local folder or JSON backup</span>
    `;
    wrap.appendChild(header);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'launcher-open-options';

    // Option 1: Folder
    const folderCard = document.createElement('div');
    folderCard.className = 'launcher-open-card';
    folderCard.innerHTML = `
      <h4>Open Project Folder (Recommended)</h4>
      <p>Select a local project directory containing project.json and assets folder.</p>
      <button class="launcher-primary-btn" id="open-folder-btn">Select Folder...</button>
    `;
    folderCard.querySelector('#open-folder-btn').addEventListener('click', async () => {
      try {
        if (!this._projectFS.isSupported) {
          const dirInput = document.createElement('input');
          dirInput.type = 'file';
          dirInput.webkitdirectory = true;
          dirInput.multiple = true;
          dirInput.addEventListener('change', async () => {
            const files = Array.from(dirInput.files);
            const projectFile = files.find(f => f.name === 'project.json');
            if (!projectFile) {
              alert('No project.json found in the selected folder. Please select a valid project folder.');
              return;
            }
            try {
              const text = await projectFile.text();
              const data = JSON.parse(text);
              this.hide();
              if (this._callbacks.onProjectLoaded) this._callbacks.onProjectLoaded(data);
            } catch (err) {
              alert(`Failed to parse project.json: ${err.message}`);
            }
          });
          dirInput.click();
          return;
        }
        const data = await this._projectFS.promptOpenProject();
        this.hide();
        if (this._callbacks.onProjectLoaded) this._callbacks.onProjectLoaded(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          alert(`Failed to open project folder: ${err.message}`);
        }
      }
    });

    optionsWrap.appendChild(folderCard);

    // Option 2: Single JSON file
    const fileCard = document.createElement('div');
    fileCard.className = 'launcher-open-card';
    fileCard.innerHTML = `
      <h4>Open Project File (.json)</h4>
      <p>Load from an exported or standalone project.json file.</p>
      <button class="launcher-secondary-btn" id="open-file-btn">Choose File...</button>
    `;
    fileCard.querySelector('#open-file-btn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          this.hide();
          if (this._callbacks.onLegacyFileLoaded) this._callbacks.onLegacyFileLoaded(data);
        } catch (err) {
          alert(`Invalid project JSON file: ${err.message}`);
        }
      });
      input.click();
    });
    optionsWrap.appendChild(fileCard);

    wrap.appendChild(optionsWrap);
    this._contentEl.appendChild(wrap);
  }

  _renderDemosTab() {
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Samples & Templates</h3>
      <span class="launcher-panel-desc">Explore prebuilt interactive 3D scenes</span>
    `;
    wrap.appendChild(header);

    const demosGrid = document.createElement('div');
    demosGrid.className = 'launcher-demos-grid';

    const demoItems = [
      {
        id: 'treasure-room',
        title: 'Treasure Room',
        desc: 'Interactive 3D puzzle with keys, locked chests, dynamic point lights, inspectable artifacts, and condition logic.',
        badge: 'Interactive Puzzle'
      },
      {
        id: 'sandbox',
        title: 'Quick Sandbox',
        desc: 'Start immediately in a clean 3D scene without saving to a folder yet.',
        badge: 'Scratchpad'
      }
    ];

    demoItems.forEach(d => {
      const card = document.createElement('div');
      card.className = 'launcher-demo-card';
      card.innerHTML = `
        <div class="demo-card-badge">${d.badge}</div>
        <div class="demo-card-title">${d.title}</div>
        <div class="demo-card-desc">${d.desc}</div>
        <button class="launcher-primary-btn demo-launch-btn">Launch Scene</button>
      `;
      card.querySelector('.demo-launch-btn').addEventListener('click', () => {
        this.hide();
        if (d.id === 'sandbox') {
          if (this._callbacks.onQuickSandbox) this._callbacks.onQuickSandbox();
        } else {
          if (this._callbacks.onLoadDemo) this._callbacks.onLoadDemo(d.id);
        }
      });
      demosGrid.appendChild(card);
    });

    wrap.appendChild(demosGrid);
    this._contentEl.appendChild(wrap);
  }
  //#endregion
}
