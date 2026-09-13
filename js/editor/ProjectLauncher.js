export class ProjectLauncher {
  //#region [Variables/Fields]
  _container = null;
  _projectFS = null;
  _callbacks = null;
  _modalEl = null;
  _activeTab = 'projects';
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
    this._closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    this._closeBtn.title = 'Close';
    this._closeBtn.addEventListener('click', () => this.hide());
    headerEl.appendChild(this._closeBtn);

    windowEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'launcher-body';

    const sidebarEl = document.createElement('div');
    sidebarEl.className = 'launcher-sidebar';

    const tabs = [
      { id: 'projects', label: 'Projects' },
      { id: 'new', label: 'New Project' },
      { id: 'open', label: 'Open' },
      { id: 'demos', label: 'Templates' }
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

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'launcher-content';
    bodyEl.appendChild(this._contentEl);

    windowEl.appendChild(bodyEl);
    this._modalEl.appendChild(windowEl);
    this._container.appendChild(this._modalEl);
  }

  async _switchTab(tabId) {
    this._activeTab = tabId;
    for (const [id, btn] of this._tabBtns.entries()) {
      btn.classList.toggle('active', id === tabId);
    }

    this._contentEl.innerHTML = '';
    switch (tabId) {
      case 'projects':
        await this._renderProjectsTab();
        break;
      case 'new':
        await this._renderNewTab();
        break;
      case 'open':
        this._renderOpenTab();
        break;
      case 'demos':
        await this._renderDemosTab();
        break;
    }
  }

  async _fetchAvailableTemplates() {
    try {
      const resp = await fetch('demo/manifest.json', { cache: 'no-cache' });
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list)) {
          return list.map(item => {
            if (typeof item === 'string') {
              const name = item.replace(/\.threeint$/i, '').replace(/[_-]+/g, ' ');
              return { file: item, title: name, desc: `Project package template (${item})` };
            }
            return {
              file: item.file || item.filename,
              title: item.title || item.name || (item.file || '').replace(/\.threeint$/i, ''),
              desc: item.desc || item.description || `Project package template (${item.file || ''})`
            };
          }).filter(item => item.file && item.file.toLowerCase().endsWith('.threeint'));
        }
      }
    } catch {
      // Manifest not found or fetch failure
    }
    return [];
  }

  async _renderProjectsTab() {
    this._contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Recent Projects</h3>
      <span class="launcher-panel-desc">Cached in browser storage for instant access</span>
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
        path.textContent = `Package: ${(r.name || 'project').replace(/[^a-zA-Z0-9_\-]/g, '_')}.threeint`;

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
            if (r.data) {
              this.hide();
              if (this._callbacks.onProjectLoaded) this._callbacks.onProjectLoaded(r.data);
            } else {
              this._switchTab('open');
            }
          } catch (err) {
            alert(`Could not open project: ${err.message}`);
          }
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'launcher-action-btn del-btn';
        delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.title = 'Remove from list';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this._projectFS.removeRecentProject(r.name);
          await this._renderProjectsTab();
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

  async _renderNewTab() {
    this._contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Create New Project</h3>
      <span class="launcher-panel-desc">Start building your 3D interactive scene</span>
    `;
    wrap.appendChild(header);

    const form = document.createElement('div');
    form.className = 'launcher-form';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'launcher-form-group';
    nameGroup.innerHTML = `<label>Project Name</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'launcher-input';
    nameInput.value = 'MyInteractiveScene';
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    const templateGroup = document.createElement('div');
    templateGroup.className = 'launcher-form-group';
    templateGroup.innerHTML = `<label>Template</label>`;

    const tplRow = document.createElement('div');
    tplRow.className = 'launcher-template-row';

    const demoTemplates = await this._fetchAvailableTemplates();
    const tpls = [
      { id: 'blank', title: 'Blank Scene', desc: 'Empty canvas with floor and ambient lighting' },
      ...demoTemplates.map(d => ({
        id: `demo_${d.file}`,
        title: d.title,
        desc: d.desc,
        file: d.file
      }))
    ];

    if (!tpls.some(t => t.id === this._selectedTemplate)) {
      this._selectedTemplate = 'blank';
    }

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

    const submitBtn = document.createElement('button');
    submitBtn.className = 'launcher-primary-btn create-btn';
    submitBtn.textContent = 'Create Project';
    submitBtn.addEventListener('click', async () => {
      const pName = nameInput.value.trim() || 'MyInteractiveScene';
      try {
        let initialData = null;
        if (this._selectedTemplate && this._selectedTemplate !== 'blank') {
          const matched = tpls.find(t => t.id === this._selectedTemplate);
          if (matched && matched.file) {
            const resp = await fetch(`demo/${matched.file}`);
            if (!resp.ok) throw new Error(`Could not load template file: demo/${matched.file}`);
            const blob = await resp.blob();
            initialData = await this._projectFS.parseProjectPackage(blob);
          }
        }

        const projectData = await this._projectFS.createProject(pName, initialData);
        this.hide();
        if (this._callbacks.onProjectCreated) {
          this._callbacks.onProjectCreated(projectData);
        }
      } catch (err) {
        alert(`Failed to create project: ${err.message}`);
      }
    });

    form.appendChild(submitBtn);
    wrap.appendChild(form);
    this._contentEl.appendChild(wrap);
  }

  _renderOpenTab() {
    this._contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Open Existing Project</h3>
      <span class="launcher-panel-desc">Load a project package (.threeint / .zip) or JSON scene</span>
    `;
    wrap.appendChild(header);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'launcher-open-options';

    const packageCard = document.createElement('div');
    packageCard.className = 'launcher-open-card';
    packageCard.innerHTML = `
      <h4>Open Project Package (.threeint / .zip / .json)</h4>
      <p>Select a packaged <b>.threeint</b> bundle, exported <b>.zip</b>, or <b>.json</b> file with all assets bundled inside.</p>
      <button class="launcher-primary-btn" id="open-pkg-btn">Select File...</button>
    `;
    packageCard.querySelector('#open-pkg-btn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.threeint,.zip,.json';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const data = await this._projectFS.parseProjectPackage(file);
          this.hide();
          if (this._callbacks.onProjectLoaded) this._callbacks.onProjectLoaded(data);
        } catch (err) {
          alert(`Failed to open project package: ${err.message}`);
        }
      });
      input.click();
    });

    optionsWrap.appendChild(packageCard);
    wrap.appendChild(optionsWrap);
    this._contentEl.appendChild(wrap);
  }

  async _renderDemosTab() {
    this._contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'launcher-tab-panel';

    const header = document.createElement('div');
    header.className = 'launcher-panel-header';
    header.innerHTML = `
      <h3>Templates & Samples</h3>
      <span class="launcher-panel-desc">Prebuilt .threeint project packages located in the demo/ folder</span>
    `;
    wrap.appendChild(header);

    const demoItems = await this._fetchAvailableTemplates();
    if (demoItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'launcher-empty-state';
      empty.innerHTML = `
        <p>No .threeint template packages found in demo/</p>
        <span class="launcher-panel-desc" style="margin-bottom: 16px; display: block;">
          Save or place any .threeint project package into the <code>demo/</code> directory to use it as a template.
        </span>
        <button class="launcher-primary-btn" id="go-blank-btn">Create Blank Scene</button>
      `;
      empty.querySelector('#go-blank-btn').addEventListener('click', () => {
        this._selectedTemplate = 'blank';
        this._switchTab('new');
      });
      wrap.appendChild(empty);
    } else {
      const demosGrid = document.createElement('div');
      demosGrid.className = 'launcher-demos-grid';

      demoItems.forEach(d => {
        const card = document.createElement('div');
        card.className = 'launcher-demo-card';
        card.innerHTML = `
          <div class="demo-card-badge">.threeint</div>
          <div class="demo-card-title">${d.title}</div>
          <div class="demo-card-desc">${d.desc}</div>
          <button class="launcher-primary-btn demo-launch-btn">Use Template</button>
        `;
        card.querySelector('.demo-launch-btn').addEventListener('click', async () => {
          try {
            const resp = await fetch(`demo/${d.file}`);
            if (!resp.ok) throw new Error(`Could not load template file: demo/${d.file}`);
            const blob = await resp.blob();
            const data = await this._projectFS.parseProjectPackage(blob);
            this.hide();
            if (this._callbacks.onProjectLoaded) {
              this._callbacks.onProjectLoaded(data);
            }
          } catch (err) {
            alert(`Could not launch template: ${err.message}`);
          }
        });
        demosGrid.appendChild(card);
      });

      wrap.appendChild(demosGrid);
    }

    this._contentEl.appendChild(wrap);
  }
  //#endregion
}
