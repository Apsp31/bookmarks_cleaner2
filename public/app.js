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
 * @param {{ reviewMode?: boolean, mergeCandidates?: object[], duplicateSubtrees?: object[], onMerge?: Function, onKeep?: Function, onRemoveDupe?: Function, onKeepDupe?: Function }} options
 */
function renderTree(node, container, depth = 0, options = {}) {
  if (!node) return;

  if (node.type === 'folder') {
    // Skip the synthetic root wrapper — render its children as top-level folders
    if (depth === 0 && node.children) {
      for (const child of node.children) {
        renderTree(child, container, 1, options);
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

    if (node.children) {
      for (const child of node.children) {
        renderTree(child, childrenEl, depth + 1, options);
      }
    }

    wrapper.appendChild(header);
    wrapper.appendChild(childrenEl);
    container.appendChild(wrapper);

  } else if (node.type === 'link') {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node tree-link';

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
    /** 'idle' | 'loading' | 'loaded' | 'cleaning' | 'cleaned' | 'error' */
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

          // Render tree once Alpine has updated the DOM
          this.$nextTick(() => {
            const container = this.$refs.treeContainer;
            if (container) {
              container.innerHTML = '';
              renderTree(this.tree, container, 0);
            }
          });
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

    /** Re-render the tree container with current state (review mode if candidates exist) */
    rerenderTree() {
      this.$nextTick(() => {
        const container = this.$refs.treeContainer;
        if (!container) return;
        container.innerHTML = '';
        const tree = this.cleanTree || this.tree;
        const hasReviewItems = this.mergeCandidates.length > 0 || this.duplicateSubtrees.length > 0;
        renderTree(tree, container, 0, hasReviewItems ? {
          reviewMode: true,
          mergeCandidates: this.mergeCandidates,
          duplicateSubtrees: this.duplicateSubtrees,
          onMerge: (c) => this.approveMerge(c),
          onKeep: (c) => this.keepSeparate(c),
          onRemoveDupe: (d) => this.removeDuplicateSubtree(d),
          onKeepDupe: (d) => {
            this.duplicateSubtrees = this.duplicateSubtrees.filter(
              e => !(e.keepId === d.keepId && e.removeId === d.removeId)
            );
          },
        } : {});
      });
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

      // Clear tree container if it still exists in DOM
      const container = this.$refs.treeContainer;
      if (container) container.innerHTML = '';
    },

    /** Alpine init hook — nothing needed at startup */
    init() {},
  }));
});
