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
 */
function renderTree(node, container, depth = 0) {
  if (!node) return;

  if (node.type === 'folder') {
    // Skip the synthetic root wrapper — render its children directly at depth 0
    if (depth === 0 && node.children) {
      for (const child of node.children) {
        renderTree(child, container, 0);
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
        renderTree(child, childrenEl, depth + 1);
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
    /** 'idle' | 'loading' | 'loaded' | 'error' */
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

    /** Reset all state back to idle */
    resetApp() {
      this.status = 'idle';
      this.stats = null;
      this.tree = null;
      this.backupName = '';
      this.errorMsg = '';
      this.isDragging = false;

      // Clear tree container if it still exists in DOM
      const container = this.$refs.treeContainer;
      if (container) container.innerHTML = '';
    },

    /** Alpine init hook — nothing needed at startup */
    init() {},
  }));
});
