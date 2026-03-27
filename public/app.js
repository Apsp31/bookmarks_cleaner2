/**
 * Bookmark Cleaner — Alpine.js component
 *
 * Handles file upload, backup download, stats display, and read-only tree rendering.
 */

/**
 * Recursively render a BookmarkNode tree into a DOM container.
 *
 * @param {{ id: string, type: 'folder'|'link', title: string, url?: string, children?: object[] }} node
 * @param {HTMLElement} container
 * @param {number} depth
 * @param {{ reviewMode?: boolean, mergeCandidates?: object[], duplicateSubtrees?: object[], onMerge?: Function, onKeep?: Function, onRemoveDupe?: Function, onKeepDupe?: Function, onToggleReclassify?: Function, reclassifyFolders?: Set }} options
 */
function renderTree(node, container, depth = 0, options = {}, parentId = null) {
  if (!node) return;

  if (node.type === 'folder') {
    // Skip the synthetic root wrapper — render its children as top-level folders
    if (depth === 0 && node.children) {
      for (const child of node.children) {
        renderTree(child, container, 1, options, node.id);
      }
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';

    const header = document.createElement('div');
    header.className = 'tree-folder-header';

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = '\u25B6'; // right-pointing triangle

    const folderIcon = document.createElement('span');
    folderIcon.className = 'tree-folder-icon';
    folderIcon.textContent = '\uD83D\uDCC1'; // folder emoji

    const label = document.createElement('span');
    label.textContent = node.title || '(untitled folder)';

    header.appendChild(toggle);
    header.appendChild(folderIcon);
    header.appendChild(label);

    // Hyphen-prefix folder reclassify toggle (per D-09)
    if (options.onToggleReclassify && node.title && node.title.startsWith('-')) {
      const reclassifyBtn = document.createElement('button');
      reclassifyBtn.className = 'btn-reclassify';
      const isOptedIn = options.reclassifyFolders && options.reclassifyFolders.has(node.title);
      reclassifyBtn.textContent = isOptedIn ? '\u2715 keep' : '\u21ba reclassify';
      reclassifyBtn.title = isOptedIn
        ? 'Keep this folder preserved (do not reclassify contents)'
        : 'Reclassify contents of this folder into categories';
      reclassifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onToggleReclassify(node.title);
      });
      header.appendChild(reclassifyBtn);
    }

    if (options.reviewMode) {
      // Check merge candidates
      const mergeCandidate = (options.mergeCandidates || []).find(
        c => c.aId === node.id || c.bId === node.id
      );
      if (mergeCandidate) {
        const targetName = mergeCandidate.aId === node.id ? mergeCandidate.bName : mergeCandidate.aName;
        const targetId = mergeCandidate.aId === node.id ? mergeCandidate.bId : mergeCandidate.aId;

        const badge = document.createElement('span');
        badge.className = 'merge-badge';
        badge.textContent = '\u26a0\ufe0f Similar folder';

        const btnMerge = document.createElement('button');
        btnMerge.className = 'btn-merge';
        // Merge direction: always merge INTO the first (aId) folder
        const mergeTargetName = mergeCandidate.aId === node.id ? node.title : mergeCandidate.aName;
        btnMerge.textContent = '\u2192 Merge into "' + mergeTargetName + '"';
        btnMerge.addEventListener('click', (e) => {
          e.stopPropagation();
          if (options.onMerge) options.onMerge(mergeCandidate);
        });

        const btnKeep = document.createElement('button');
        btnKeep.className = 'btn-keep';
        btnKeep.textContent = 'Keep separate';
        btnKeep.addEventListener('click', (e) => {
          e.stopPropagation();
          // Remove badge+buttons from this row (client-side only, no API call per UI-SPEC)
          badge.remove();
          btnMerge.remove();
          btnKeep.remove();
          if (options.onKeep) options.onKeep(mergeCandidate);
        });

        header.appendChild(badge);
        header.appendChild(btnMerge);
        header.appendChild(btnKeep);
      }

      // Check duplicate subtrees
      const dupeEntry = (options.duplicateSubtrees || []).find(
        d => d.removeId === node.id
      );
      if (dupeEntry) {
        const badge = document.createElement('span');
        badge.className = 'merge-badge';
        badge.textContent = '\u26a0\ufe0f Duplicate subtree';

        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-merge';
        btnRemove.textContent = 'Remove duplicate subtree';
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          if (options.onRemoveDupe) options.onRemoveDupe(dupeEntry);
        });

        const btnKeepBoth = document.createElement('button');
        btnKeepBoth.className = 'btn-keep';
        btnKeepBoth.textContent = 'Keep both';
        btnKeepBoth.addEventListener('click', (e) => {
          e.stopPropagation();
          badge.remove();
          btnRemove.remove();
          btnKeepBoth.remove();
          if (options.onKeepDupe) options.onKeepDupe(dupeEntry);
        });

        header.appendChild(badge);
        header.appendChild(btnRemove);
        header.appendChild(btnKeepBoth);
      }
    }

    const childrenEl = document.createElement('div');
    childrenEl.className = 'tree-children';
    childrenEl.style.display = 'none'; // start collapsed

    header.addEventListener('click', () => {
      const isOpen = childrenEl.style.display !== 'none';
      childrenEl.style.display = isOpen ? 'none' : 'block';
      toggle.classList.toggle('open', !isOpen);
    });

    if (options.onContextMenu) {
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        options.onContextMenu(node, e);
      });
    }

    // Drag-and-drop wiring — per D-01, D-03, D-07
    if (options.onDragStart) {
      header.setAttribute('draggable', 'true');
      header.dataset.nodeId = node.id;

      header.addEventListener('dragstart', (e) => {
        options.onDragStart(node, parentId, e);
      });
      header.addEventListener('dragover', (e) => {
        options.onDragOver(node, parentId, e, header);
      });
      header.addEventListener('drop', (e) => {
        options.onDrop(node, e);
      });
      header.addEventListener('dragend', () => {
        options.onDragEnd();
      });
    }

    if (node.children) {
      for (const child of node.children) {
        renderTree(child, childrenEl, depth + 1, options, node.id);
      }
    }

    wrapper.appendChild(header);
    wrapper.appendChild(childrenEl);
    container.appendChild(wrapper);

  } else if (node.type === 'link') {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node tree-link';

    if (options.onContextMenu) {
      wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        options.onContextMenu(node, e);
      });
    }

    // Add kept indicator
    if (node.kept) {
      const keptSpan = document.createElement('span');
      keptSpan.className = 'kept-indicator';
      keptSpan.textContent = '\u2713'; // checkmark
      wrapper.appendChild(keptSpan);
    }

    const title = document.createElement('span');
    title.className = 'link-title';
    title.textContent = node.title || '(untitled)';

    wrapper.appendChild(title);

    if (node.url) {
      const url = document.createElement('span');
      url.className = 'link-url';
      url.textContent = node.url;
      wrapper.appendChild(url);
    }

    container.appendChild(wrapper);
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.data('bookmarkApp', () => ({
    /** 'idle' | 'loading' | 'loaded' | 'cleaning' | 'cleaned' | 'checking' | 'checked' | 'classifying' | 'classified' | 'error' */
    status: 'idle',

    /** { bookmarkCount: number, folderCount: number } | null */
    stats: null,

    /** BookmarkNode root | null */
    tree: null,

    /** Filename of the auto-downloaded backup */
    backupName: '',

    /** Error message to display */
    errorMsg: '',

    /** Drag-over highlight flag */
    isDragging: false,

    /** { dupesRemoved: number, duplicateSubtreesFound: number } | null */
    cleanupStats: null,

    /** Array of merge candidates from /api/cleanup */
    mergeCandidates: [],

    /** Array of duplicate subtree entries from /api/cleanup */
    duplicateSubtrees: [],

    /** The cleaned tree (separate from this.tree) */
    cleanTree: null,

    /** Whether a link check is in progress */
    isChecking: false,

    /** Whether classification is in progress */
    isClassifying: false,

    /** The classified tree from POST /api/classify */
    classifiedTree: null,

    /** Context menu state */
    contextMenu: { visible: false, x: 0, y: 0, node: null },

    /** Whether the move sub-menu is shown */
    showMoveMenu: false,

    /** Cached count of remaining links (updated after edits) */
    remainingCount: 0,

    /** Set of hyphen-prefixed folder names opted in for reclassification */
    reclassifyFolders: new Set(),

    /** Count of merged folders (snapshot from cleanup phase) */
    mergedCount: 0,

    /** ID of the folder currently being dragged (null when no drag active) — per D-04 */
    draggingNodeId: null,

    /** Parent folder ID of the node being dragged — for same-parent constraint per D-07 */
    draggingParentId: null,

    /** ID of the folder row currently under the cursor during drag */
    dropTargetNodeId: null,

    /** true = insert before target, false = insert after — per D-02 midpoint logic */
    dropInsertBefore: null,

    /** Live progress from the SSE stream */
    checkProgress: { checked: 0, total: 0, currentUrl: '', eta: null },

    /** Dead link count from last check */
    deadCount: 0,

    /** Uncertain link count from last check (rate-limited 429s) */
    uncertainCount: 0,

    /**
     * Core file handler — validates, triggers backup download, then POSTs to server.
     *
     * IMPORTANT: the backup download (createObjectURL + anchor click) MUST happen
     * synchronously before any await, so it fires within the original user-gesture
     * context and the browser allows the programmatic download.
     *
     * @param {File|null|undefined} file
     */
    handleFile(file) {
      if (!file) return;

      // Validate extension
      if (!file.name.toLowerCase().endsWith('.html')) {
        this.errorMsg = 'Please select a Chrome bookmark export (.html file).';
        this.status = 'error';
        return;
      }

      this.status = 'loading';
      this.errorMsg = '';

      // --- Backup download (synchronous, within user gesture) ---
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      this.backupName = 'bookmarks-backup-' + today + '.html';

      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = this.backupName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      // --- Async upload to server ---
      const formData = new FormData();
      formData.append('bookmarks', file);

      fetch('/api/upload', { method: 'POST', body: formData })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Upload failed (' + res.status + ')');
          }
          return res.json();
        })
        .then((data) => {
          this.tree = data.tree;
          this.stats = data.stats;
          this.status = 'loaded';
          // Tree rendered via x-init on the treeContainer element
        })
        .catch((err) => {
          this.errorMsg = err.message || 'An unexpected error occurred.';
          this.status = 'error';
        });
    },

    /** Drop handler */
    onDrop(e) {
      this.isDragging = false;
      this.handleFile(e.dataTransfer.files[0]);
    },

    /** File input fallback handler */
    handleFileInput(e) {
      this.handleFile(e.target.files[0]);
    },

    /** Trigger export file download */
    exportBookmarks() {
      this.contextMenu.visible = false;
      window.location.href = '/api/export';
    },

    /** Run cleanup pipeline — dedup, find merge candidates, find duplicate subtrees */
    async runCleanup() {
      this.status = 'cleaning';
      this.errorMsg = '';
      try {
        const res = await fetch('/api/cleanup', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Cleanup failed');
        }
        const data = await res.json();
        this.cleanTree = data.cleanTree;
        this.cleanupStats = data.stats;
        this.mergeCandidates = data.mergeCandidates || [];
        this.duplicateSubtrees = data.duplicateSubtrees || [];
        this.status = 'cleaned';
        this.rerenderTree();
      } catch (err) {
        this.errorMsg = 'Cleanup failed \u2014 ' + (err.message || 'unknown error') + '. Your original bookmarks are unchanged.';
        this.status = 'error';
      }
    },

    /** Approve a single merge candidate */
    async approveMerge(candidate) {
      try {
        const res = await fetch('/api/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairs: [{ aId: candidate.aId, bId: candidate.bId }] }),
        });
        if (!res.ok) throw new Error('Merge failed');
        const data = await res.json();
        this.cleanTree = data.cleanTree;
        this.mergeCandidates = data.mergeCandidates || [];
        this.duplicateSubtrees = data.duplicateSubtrees || [];
        this.rerenderTree();
      } catch (err) {
        this.errorMsg = 'Could not apply merge \u2014 please try again.';
      }
    },

    /** Approve all merge candidates and duplicate subtrees at once */
    async approveAllMerges() {
      try {
        const res = await fetch('/api/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approveAll: true }),
        });
        if (!res.ok) throw new Error('Merge failed');
        const data = await res.json();
        this.cleanTree = data.cleanTree;
        this.mergeCandidates = data.mergeCandidates || [];
        this.duplicateSubtrees = data.duplicateSubtrees || [];
        this.rerenderTree();
      } catch (err) {
        this.errorMsg = 'Could not apply merge \u2014 please try again.';
      }
    },

    /** Dismiss a merge candidate (client-side only — no API call) */
    keepSeparate(candidate) {
      this.mergeCandidates = this.mergeCandidates.filter(
        c => !(c.aId === candidate.aId && c.bId === candidate.bId)
      );
      // DOM elements already removed by the click handler in renderTree
    },

    /** Remove a duplicate subtree via /api/merge */
    async removeDuplicateSubtree(dupeEntry) {
      try {
        const res = await fetch('/api/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairs: [{ aId: dupeEntry.keepId, bId: dupeEntry.removeId }] }),
        });
        if (!res.ok) throw new Error('Remove failed');
        const data = await res.json();
        this.cleanTree = data.cleanTree;
        this.mergeCandidates = data.mergeCandidates || [];
        this.duplicateSubtrees = data.duplicateSubtrees || [];
        this.rerenderTree();
      } catch (err) {
        this.errorMsg = 'Could not apply merge \u2014 please try again.';
      }
    },

    /** Build renderTree options object for the current review state */
    getTreeOptions() {
      const opts = {};
      const hasReview = this.mergeCandidates.length > 0 || this.duplicateSubtrees.length > 0;
      if (hasReview) {
        opts.reviewMode = true;
        opts.mergeCandidates = this.mergeCandidates;
        opts.duplicateSubtrees = this.duplicateSubtrees;
        opts.onMerge = (c) => this.approveMerge(c);
        opts.onKeep = (c) => this.keepSeparate(c);
        opts.onRemoveDupe = (d) => this.removeDuplicateSubtree(d);
        opts.onKeepDupe = (d) => {
          this.duplicateSubtrees = this.duplicateSubtrees.filter(
            e => !(e.keepId === d.keepId && e.removeId === d.removeId)
          );
        };
      }
      opts.onToggleReclassify = (folderName) => {
        const next = new Set(this.reclassifyFolders);
        if (next.has(folderName)) {
          next.delete(folderName);
        } else {
          next.add(folderName);
        }
        this.reclassifyFolders = next;  // Reassign for Alpine reactivity (Pitfall 3)
        this.rerenderTree();  // Re-render to update badge state
      };
      opts.reclassifyFolders = this.reclassifyFolders;
      return opts;
    },

    /** Re-render the tree container with current state (review mode if candidates exist) */
    rerenderTree() {
      this.$nextTick(() => {
        const container = this.$refs.treeContainer;
        if (!container) return;
        container.innerHTML = '';
        renderTree(this.cleanTree || this.tree, container, 0, this.getTreeOptions());
      });
    },

    /** Start live link checking via SSE stream */
    runLinkCheck() {
      this.isChecking = true;
      this.status = 'checking';
      this.checkProgress = { checked: 0, total: 0, currentUrl: '', eta: null };
      this.errorMsg = '';
      const es = new EventSource('/api/check-links');
      es.addEventListener('progress', (e) => {
        this.checkProgress = JSON.parse(e.data);
      });
      es.addEventListener('done', (e) => {
        const d = JSON.parse(e.data);
        this.deadCount = d.deadCount;
        this.uncertainCount = d.uncertainCount;
        this.isChecking = false;
        this.status = 'checked';
        es.close();
        this.fetchCheckedTree();
      });
      es.addEventListener('error', (e) => {
        this.errorMsg = 'Link check failed. Please try again.';
        this.isChecking = false;
        this.status = 'cleaned';
        es.close();
      });
    },

    /** Fetch the checked tree from /api/check-result and re-render */
    async fetchCheckedTree() {
      try {
        const res = await fetch('/api/check-result');
        if (!res.ok) throw new Error('Failed to fetch results');
        const data = await res.json();
        this.cleanTree = data.tree;
        this.rerenderTree();
      } catch (err) {
        this.errorMsg = 'Could not load check results.';
      }
    },

    /** Run classification pipeline via POST /api/classify */
    async classifyBookmarks() {
      this.isClassifying = true;
      this.status = 'classifying';
      this.errorMsg = '';
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reclassifyFolders: Array.from(this.reclassifyFolders),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Classification failed');
        }
        const data = await res.json();
        this.classifiedTree = data.classifiedTree;
        this.status = 'classified';
        this.remainingCount = this.countLinks(this.classifiedTree);
        this.mergedCount = this.mergeCandidates.length;
      } catch (err) {
        this.errorMsg = 'Classification failed \u2014 ' + (err.message || 'unknown error');
        this.status = 'checked';
      } finally {
        this.isClassifying = false;
      }
    },

    /** Count link nodes in a tree */
    countLinks(node) {
      if (!node) return 0;
      if (node.type === 'link') return 1;
      return (node.children ?? []).reduce((sum, child) => sum + this.countLinks(child), 0);
    },

    /** Open the floating context menu at click position */
    openContextMenu(node, event) {
      if (this.draggingNodeId !== null) return; // Suppress during active drag per D-04
      event.preventDefault();
      this.showMoveMenu = false;
      this.contextMenu = { visible: true, x: event.clientX, y: event.clientY, node };
    },

    /** Execute an edit operation via POST /api/edit */
    async editOp(op, targetFolderId = undefined) {
      this.contextMenu.visible = false;
      this.showMoveMenu = false;
      const body = { op, nodeId: this.contextMenu.node.id };
      if (targetFolderId) body.targetFolderId = targetFolderId;
      try {
        const res = await fetch('/api/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          this.errorMsg = data.error || 'Edit failed';
          return;
        }
        const data = await res.json();
        this.classifiedTree = data.classifiedTree;
        this.remainingCount = this.countLinks(this.classifiedTree);
        this.$nextTick(() => {
          const container = this.$refs.rightPanel;
          if (!container) return;
          container.innerHTML = '';
          renderTree(this.classifiedTree, container, 0, this.getRightPanelOptions());
        });
      } catch (err) {
        this.errorMsg = 'Edit failed — ' + (err.message || 'unknown error');
      }
    },

    /** Get flat list of all folders in classifiedTree for the move sub-menu */
    getFolderList() {
      const folders = [];
      function walk(node) {
        if (node.type === 'folder' && node.title !== 'root') folders.push(node);
        if (node.children) node.children.forEach(walk);
      }
      if (this.classifiedTree) walk(this.classifiedTree);
      return folders;
    },

    /** Reset all state back to idle */
    resetApp() {
      this.status = 'idle';
      this.stats = null;
      this.tree = null;
      this.backupName = '';
      this.errorMsg = '';
      this.isDragging = false;
      this.cleanupStats = null;
      this.mergeCandidates = [];
      this.duplicateSubtrees = [];
      this.cleanTree = null;
      this.isChecking = false;
      this.checkProgress = { checked: 0, total: 0, currentUrl: '', eta: null };
      this.deadCount = 0;
      this.uncertainCount = 0;
      this.classifiedTree = null;
      this.isClassifying = false;
      this.contextMenu = { visible: false, x: 0, y: 0, node: null };
      this.showMoveMenu = false;
      this.remainingCount = 0;
      this.reclassifyFolders = new Set();
      this.mergedCount = 0;
      this.draggingNodeId = null;
      this.draggingParentId = null;
      this.dropTargetNodeId = null;
      this.dropInsertBefore = null;
      if (this._dropIndicator) this._dropIndicator.style.display = 'none';

      // Clear tree container if it still exists in DOM
      const container = this.$refs.treeContainer;
      if (container) container.innerHTML = '';
    },

    /** Alpine init hook — create the shared drop indicator element */
    init() {
      this._dropIndicator = document.createElement('div');
      this._dropIndicator.id = 'drop-indicator';
      this._dropIndicator.style.cssText =
        'position:fixed;height:2px;background:#4a90d9;pointer-events:none;display:none;z-index:1000';
      document.body.appendChild(this._dropIndicator);
    },

    /** Handle dragstart on a folder header — per D-01, D-03 */
    handleDragStart(node, parentId, e) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.id);
      this.draggingNodeId = node.id;
      this.draggingParentId = parentId;
    },

    /** Handle dragover on a folder header — per D-02 midpoint insertion line */
    handleDragOver(node, parentId, e, headerEl) {
      // Same-parent constraint per D-07 — only accept drops within same parent
      if (!this.draggingNodeId || this.draggingParentId !== parentId) return;
      // Don't allow drop on self
      if (node.id === this.draggingNodeId) return;

      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      // Midpoint calculation for insertion line position — per D-02
      const rect = headerEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      this.dropInsertBefore = e.clientY < midY;
      this.dropTargetNodeId = node.id;

      const lineY = this.dropInsertBefore ? rect.top : rect.bottom;
      this._dropIndicator.style.top = lineY + 'px';
      this._dropIndicator.style.left = rect.left + 'px';
      this._dropIndicator.style.width = rect.width + 'px';
      this._dropIndicator.style.display = 'block';
    },

    /** Handle drop on a folder header — compute newIndex and call reorder API per D-05 */
    handleDrop(node, e) {
      e.preventDefault();
      e.stopPropagation();
      this._dropIndicator.style.display = 'none';

      if (!this.draggingNodeId || !this.draggingParentId) return;
      if (node.id === this.draggingNodeId) { this.handleDragEnd(); return; }

      // Find parent folder in classifiedTree to get children order
      const parentFolder = this.findNode(this.classifiedTree, this.draggingParentId);
      if (!parentFolder || parentFolder.type !== 'folder') { this.handleDragEnd(); return; }

      const children = parentFolder.children ?? [];
      const fromIndex = children.findIndex(c => c.id === this.draggingNodeId);
      const targetIndex = children.findIndex(c => c.id === node.id);
      if (fromIndex === -1 || targetIndex === -1) { this.handleDragEnd(); return; }

      // Compute newIndex in post-removal array (per RESEARCH.md Pitfall 4)
      let intendedIndex = this.dropInsertBefore ? targetIndex : targetIndex + 1;
      const newIndex = intendedIndex > fromIndex ? intendedIndex - 1 : intendedIndex;

      this.reorderOp(this.draggingNodeId, this.draggingParentId, newIndex);
      this.handleDragEnd();
    },

    /** Clean up drag state — always fires even on cancelled drags per RESEARCH.md Pitfall 3 */
    handleDragEnd() {
      this.draggingNodeId = null;
      this.draggingParentId = null;
      this.dropTargetNodeId = null;
      this.dropInsertBefore = null;
      if (this._dropIndicator) this._dropIndicator.style.display = 'none';
    },

    /** Find a node by ID in a tree (recursive) */
    findNode(node, targetId) {
      if (!node) return null;
      if (node.id === targetId) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = this.findNode(child, targetId);
          if (found) return found;
        }
      }
      return null;
    },

    /** Execute a reorder operation via POST /api/edit — per D-05, D-06 */
    async reorderOp(nodeId, parentFolderId, newIndex) {
      try {
        const res = await fetch('/api/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'reorder', nodeId, parentFolderId, newIndex }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          this.errorMsg = data.error || 'Reorder failed';
          return;
        }
        const data = await res.json();
        this.classifiedTree = data.classifiedTree;
        this.$nextTick(() => {
          const container = this.$refs.rightPanel;
          if (!container) return;
          container.innerHTML = '';
          renderTree(this.classifiedTree, container, 0, this.getRightPanelOptions());
        });
      } catch (err) {
        this.errorMsg = 'Reorder failed — ' + (err.message || 'unknown error');
      }
    },

    /** Build options for the right (classified) panel — includes edit + drag callbacks */
    getRightPanelOptions() {
      return {
        editMode: true,
        onContextMenu: (n, e) => this.openContextMenu(n, e),
        onDragStart: (node, parentId, e) => this.handleDragStart(node, parentId, e),
        onDragOver: (node, parentId, e, el) => this.handleDragOver(node, parentId, e, el),
        onDrop: (node, e) => this.handleDrop(node, e),
        onDragEnd: () => this.handleDragEnd(),
      };
    },
  }));
});
