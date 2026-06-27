import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { handleExport } from "./library/export_lib.js"; 
import { sortMovies, searchDatabase, filterMoviesByProperty } from "./library/sort&filter_lib.js";
import { saveIndividualEntry, parseBulkText, saveBulkEntries } from "./library/import_lib.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXgJx0FnwRTjPwVc7JtbZC0iNz_p3EFrk",
  authDomain: "myshelf-c6a27.firebaseapp.com",
  projectId: "myshelf-c6a27",
  storageBucket: "myshelf-c6a27.firebasestorage.app",
  messagingSenderId: "262667540714",
  appId: "1:262667540714:web:c4e2711b1f1aee24081f93"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const auth = getAuth(app); 

const yearsArray = [];
for (let y = 2030; y >= 1950; y--) {
  yearsArray.push(y.toString());
}

const singleProps = ["Name", "Rating", "Year", "Language", "status", "Status", "Category"];

const defaultMetadata = {
  categories: {
    movies: { 
        properties: ["Rating", "Genre", "Year", "Language", "Director", "Cast", "Category"], 
        tags: {
            "Rating": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            "Genre": ["Action", "Drama", "Sci-Fi", "Comedy", "Thriller"],
            "Year": yearsArray, 
            "Language": ["English", "Spanish", "Hindi", "French", "Korean"],
            "Director": [],
            "Cast": [],
            "Category": ["Movie", "Series", "Documentary"]
        } 
    },
    songs: { 
        properties: ["Rating", "Artist", "Album", "Year", "Genre", "Language"], 
        tags: { "Year": yearsArray } 
    },
    books: { 
        properties: ["Rating", "Author", "Genre", "Pages"], 
        tags: {} 
    },
    travel: { 
        properties: ["Rating", "Destination", "Country", "Year", "Budget"], 
        tags: { "Year": yearsArray } 
    }
  }
};

const AppState = {
  currentUserUid: null,
  currentCategory: 'movies',
  currentPage: 1,
  itemsPerPage: 50,
  metadata: JSON.parse(JSON.stringify(defaultMetadata)),
  items: [],
  isInitialized: false,
  currentEntryDraft: {},
  bulkEntriesDraft: [],
  activeModalId: null,
  modalDraft: {},
  showingDuplicates: false,
  isBatchMode: false,
  currentDuplicateGroup: [],
  currentDuplicateDraft: {},
  renderModalProps: null
};

const sortAlpha = (arr) => [...arr].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

const sidebar = document.getElementById('sidebar');
const landingPanel = document.getElementById('landing-panel');
const inputPanel = document.getElementById('input-panel');
const databasePanel = document.getElementById('database-panel');
const commitsPanel = document.getElementById('commits-panel');
const comparePanel = document.getElementById('compare-panel');
const sharedFilterBar = document.getElementById('shared-filter-bar');
const deleteBtn = document.getElementById('delete-drafts-btn');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const dbSelect = document.getElementById('db-select');
const actionSelect = document.getElementById('action-select');
const mergeAllDupesBtn = document.getElementById('merge-all-dupes-btn');

const managePropsModal = document.getElementById('manage-props-modal');
const managePropSelect = document.getElementById('manage-prop-select');
const manageTagsBody = document.getElementById('manage-tags-body');
const manageEditBtn = document.getElementById('manage-edit-btn');
const manageSaveBtn = document.getElementById('manage-save-btn');
const manageDeleteBtn = document.getElementById('manage-delete-btn');

const infoModal = document.getElementById('info-modal');
const openInfoBtn = document.getElementById('open-info-btn');
const closeInfoModal = document.getElementById('close-info-modal');

const DOMHelper = {
    setSelectValue: (element, value) => {
        if (!element) return;
        element.value = value;
        element.dispatchEvent(new CustomEvent('sync-custom-select'));
    },
    setSelectDisabled: (element, isDisabled) => {
        if (!element) return;
        element.disabled = isDisabled;
        element.dispatchEvent(new CustomEvent('sync-custom-select'));
    },
    setSelectMultiple: (element, isMultiple) => {
         if (!element) return;
         if (isMultiple) element.setAttribute('multiple', '');
         else element.removeAttribute('multiple');
         element.dispatchEvent(new CustomEvent('sync-custom-select'));
    }
};

function initializeCustomDropdowns() {
  function applyCustomSelect(select) {
      if (select.dataset.customWrapper || select.dataset.customWrapper === "false") return;
      select.dataset.customWrapper = "true";
      select.classList.add('customized-native');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      
      if (select.id === 'sort-select') {
          wrapper.style.cssText = "flex: unset; width: 36px; height: 36px; position: relative;";
      }
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select); 

      const trigger = document.createElement('div');
      
      if (select.id === 'sort-select') {
          trigger.className = 'custom-select-trigger btn btn-outline icon-only-btn';
          trigger.style.cssText = "width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;";
          trigger.innerHTML = `<i class="fa-solid fa-arrow-down-a-z" id="sort-icon"></i>`;
      } else {
          trigger.className = 'custom-select-trigger';
          trigger.innerHTML = `<span class="custom-select-text"></span><i class="fa-solid fa-chevron-down custom-select-icon"></i>`;
      }
      wrapper.appendChild(trigger);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-select-options';
      
      if (select.id === 'sort-select') {
          optionsContainer.style.cssText = "position: absolute; top: calc(100% + 4px); right: 0; left: auto; width: 160px; background-color: var(--surface); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--muted); z-index: 9999; flex-direction: column; padding: 4px 0;";
      }
      
      const hasSearch = !select.dataset.noSearch;
      let searchInputNode = null;

      if (hasSearch) {
          searchInputNode = document.createElement('input');
          searchInputNode.type = 'text';
          searchInputNode.className = 'custom-select-search';
          searchInputNode.placeholder = 'Search...';
          optionsContainer.appendChild(searchInputNode);
      }

      const optionsList = document.createElement('div');
      optionsList.className = 'custom-options-list';
      optionsContainer.appendChild(optionsList);

      wrapper.appendChild(optionsContainer);

      const textEl = trigger.querySelector('.custom-select-text');

      if (hasSearch) {
          searchInputNode.addEventListener('input', (e) => {
              const filter = e.target.value.toLowerCase();
              optionsList.querySelectorAll('.custom-option').forEach(optEl => {
                  optEl.style.display = optEl.innerText.toLowerCase().includes(filter) ? '' : 'none';
              });
          });
      }

      optionsContainer.addEventListener('click', (e) => e.stopPropagation());

      function syncUI() {
          if (select.hasAttribute('multiple')) {
              wrapper.classList.add('is-multiple');
              return;
          } else {
              wrapper.classList.remove('is-multiple');
          }

          if (select.disabled) wrapper.classList.add('disabled');
          else wrapper.classList.remove('disabled');

          optionsList.innerHTML = '';
          const selectedVal = select.value;
          let displayHtml = '';

          Array.from(select.options).forEach(opt => {
              const optEl = document.createElement('div');
              optEl.className = 'custom-option';
              
              if (select.id === 'sort-select') {
                  optEl.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer;";
              }
              
              if (opt.value === selectedVal) {
                  optEl.classList.add('selected');
                  displayHtml = opt.innerHTML;
              }
              optEl.innerHTML = opt.innerHTML;
              optEl.dataset.value = opt.value;
              
              optEl.addEventListener('click', (e) => {
                  e.stopPropagation();
                  if (select.disabled) return;
                  select.value = opt.value;
                  select.dispatchEvent(new Event('change'));
                  wrapper.classList.remove('open');
                  syncUI();
              });
              optionsList.appendChild(optEl);
          });

          if (select.id === 'sort-select') {
              const activeOpt = Array.from(select.options).find(o => o.value === selectedVal);
              if (activeOpt) {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = activeOpt.innerHTML;
                  const iconEl = tempDiv.querySelector('i');
                  trigger.innerHTML = iconEl ? iconEl.outerHTML : '';
                  trigger.title = activeOpt.getAttribute('title') || 'Sort';
                  trigger.className = 'custom-select-trigger btn btn-outline icon-only-btn';
                  trigger.style.cssText = "width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;";
              }
          } else {
              if (!displayHtml && select.options.length > 0) displayHtml = select.options[0].innerHTML;
              if (textEl) textEl.innerHTML = displayHtml || '&nbsp;';
          }
      }

      select.addEventListener('sync-custom-select', syncUI);
      select.addEventListener('change', syncUI);

      const obs = new MutationObserver(syncUI);
      obs.observe(select, { childList: true });

      trigger.addEventListener('click', (e) => {
          if (select.disabled || select.hasAttribute('multiple')) return;
          e.stopPropagation();
          const isOpen = wrapper.classList.contains('open');
          document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
              if (w !== wrapper) w.classList.remove('open');
          });
          if (!isOpen) {
              wrapper.classList.add('open');
              if (hasSearch && searchInputNode) {
                  searchInputNode.value = '';
                  optionsList.querySelectorAll('.custom-option').forEach(opt => opt.style.display = '');
                  setTimeout(() => searchInputNode.focus(), 10);
              }
          } else {
              wrapper.classList.remove('open');
          }
      });

      syncUI();
  }

  document.querySelectorAll('select').forEach(applyCustomSelect);

  const globalObs = new MutationObserver(mutations => {
      mutations.forEach(m => {
          m.addedNodes.forEach(node => {
              if (node.tagName === 'SELECT') applyCustomSelect(node);
              else if (node.querySelectorAll) {
                  node.querySelectorAll('select').forEach(applyCustomSelect);
              }
          });
      });
  });
  
  const targetContainers = [
    document.getElementById('sidebar'),
    document.getElementById('input-panel'),
    document.getElementById('shared-filter-bar'),
    document.getElementById('details-modal'),
    document.getElementById('duplicate-merge-modal'),
    document.getElementById('manage-props-modal')
  ];

  targetContainers.forEach(container => {
    if (container) {
      globalObs.observe(container, { childList: true, subtree: true });
    }
  });

  document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    AppState.currentUserUid = user.uid;
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    await init();
  } else {
    AppState.currentUserUid = null;
    document.getElementById('login-wrapper').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
    AppState.items = [];
    AppState.metadata = JSON.parse(JSON.stringify(defaultMetadata));
  }
});

document.getElementById('login-btn').addEventListener('click', async (e) => {
  e.preventDefault(); 
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  
  const loginBtn = document.getElementById('login-btn');
  loginBtn.innerText = "Logging in...";
  loginBtn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Failed to log in. Check your credentials.");
  } finally {
    loginBtn.innerText = "Login";
    loginBtn.disabled = false;
  }
});

async function init() {
  if (!AppState.isInitialized) {
    setupEventListeners();
    AppState.isInitialized = true;
  }

  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  if(prevBtn) prevBtn.innerText = '<<';
  if(nextBtn) nextBtn.innerText = '>>';

  initializeCustomDropdowns(); 
  
  try {
    await loadPreferencesAndMetadata();
    updateActionDropdown(); 
    renderUI();
    await loadEntries();
  } catch (error) {
    alert("DATABASE ERROR: " + error.message);
  }
}

async function loadPreferencesAndMetadata() {
  if (!AppState.currentUserUid) return;
  
  const metaRef = doc(db, "users", AppState.currentUserUid, "settings", "appMetadata");
  const metaSnap = await getDoc(metaRef);
  
  if (metaSnap.exists()) { 
    let data = metaSnap.data(); 
    if (!data.categories) {
      AppState.metadata = {
        categories: {
          movies: { properties: data.properties || [], tags: data.tags || {} },
          songs: { properties: ["Rating", "Artist", "Album", "Year", "Genre", "Language"], tags: { "Year": yearsArray } },
          books: { properties: ["Rating", "Author", "Genre", "Pages"], tags: {} },
          travel: { properties: ["Rating", "Destination", "Country", "Year", "Budget"], tags: { "Year": yearsArray } }
        }
      };
      await setDoc(metaRef, AppState.metadata);
    } else {
      AppState.metadata = data;
    }
  } else { 
    AppState.metadata = JSON.parse(JSON.stringify(defaultMetadata));
    await setDoc(metaRef, AppState.metadata); 
  }

  const prefRef = doc(db, "users", AppState.currentUserUid, "settings", "preferences");
  const prefSnap = await getDoc(prefRef);
  
  let startView = 'landing';
  if (prefSnap.exists()) {
    const prefs = prefSnap.data();
    if (prefs.theme) {
      document.body.setAttribute('data-theme', prefs.theme);
      DOMHelper.setSelectValue(document.getElementById('theme-select'), prefs.theme);
    }
    if (prefs.view) startView = prefs.view;
    if (prefs.isBatchMode !== undefined) {
        AppState.isBatchMode = prefs.isBatchMode;
        const toggle = document.getElementById('sidebar-import-toggle');
        if(toggle) {
            toggle.checked = AppState.isBatchMode;
            const label = document.getElementById('sidebar-mode-label');
            label.innerText = 'Batch Import';
            label.style.color = AppState.isBatchMode ? 'var(--primary)' : 'var(--text)';
            
            if (AppState.isBatchMode) {
                document.getElementById('individual-title-row').classList.add('hidden');
                document.getElementById('individual-notes-row').classList.add('hidden');
                document.getElementById('individual-actions').classList.add('hidden');
                document.getElementById('batch-header-row').classList.remove('hidden');
                document.getElementById('batch-notes-row').classList.remove('hidden');
                document.getElementById('batch-actions').classList.remove('hidden');
                document.getElementById('batch-table-container').classList.remove('hidden');
                document.getElementById('batch-count').classList.remove('hidden');
            } else {
                document.getElementById('individual-title-row').classList.remove('hidden');
                document.getElementById('individual-notes-row').classList.remove('hidden');
                document.getElementById('individual-actions').classList.add('hidden');
                document.getElementById('batch-header-row').classList.add('hidden');
                document.getElementById('batch-notes-row').classList.add('hidden');
                document.getElementById('batch-actions').classList.add('hidden');
                document.getElementById('batch-table-container').classList.add('hidden');
                document.getElementById('batch-count').classList.add('hidden');
            }
        }
    }
  }
  
  switchView(startView, false); 
}

async function saveMetadata() {
  if (!AppState.currentUserUid) return;
  await setDoc(doc(db, "users", AppState.currentUserUid, "settings", "appMetadata"), AppState.metadata);
}

function updateActionDropdown() {
    actionSelect.innerHTML = '';
    if (dbSelect.value === 'commits') {
        actionSelect.innerHTML = `
            <option value="view">View</option>
            <option value="compare">Compare</option>
            <option value="merge">Merge</option>
        `;
    } else {
        actionSelect.innerHTML = `
            <option value="view">View</option>
            <option value="analysis">Analysis</option>
            <option value="export">Export</option>
        `;
    }
    actionSelect.dispatchEvent(new Event('sync-custom-select'));
}

dbSelect.addEventListener('change', updateActionDropdown);

function renderUI() {
  const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [], tags: {} };
  const prevAddChoice = document.getElementById('add-prop-select').value;
  const prevCustChoice = document.getElementById('customize-prop-select').value;
  const prevFiltChoice = document.getElementById('filter-by-select').value;
  
  const sortedProps = sortAlpha(currentSchema.properties);

  const addPropSelect = document.getElementById('add-prop-select');
  addPropSelect.innerHTML = `<option value="">Properties</option>`;
  sortedProps.forEach(prop => { addPropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  
  if (currentSchema.properties.includes(prevAddChoice)) {
      DOMHelper.setSelectValue(addPropSelect, prevAddChoice);
  } else {
      DOMHelper.setSelectValue(addPropSelect, '');
  }

  const customizePropSelect = document.getElementById('customize-prop-select');
  customizePropSelect.innerHTML = `<option value="Property">Properties</option>`;
  sortedProps.forEach(prop => { customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (prevCustChoice) DOMHelper.setSelectValue(customizePropSelect, prevCustChoice);

  const filterBySelect = document.getElementById('filter-by-select');
  filterBySelect.innerHTML = `<option value="">Filter By</option>`;
  sortedProps.forEach(prop => { filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  
  if (currentSchema.properties.includes(prevFiltChoice)) {
      DOMHelper.setSelectValue(filterBySelect, prevFiltChoice);
  } else {
      DOMHelper.setSelectValue(filterBySelect, '');
  }
}

async function loadEntries() {
  if (!AppState.currentUserUid) return;
  const querySnapshot = await getDocs(collection(db, "users", AppState.currentUserUid, AppState.currentCategory));
  AppState.items = [];
  querySnapshot.forEach((doc) => { AppState.items.push({ id: doc.id, ...doc.data() }); });
  triggerActiveFilter();
}

async function handleCategorySwitch(categoryName) {
    AppState.currentCategory = categoryName;
    
    AppState.currentEntryDraft = {};
    document.getElementById('movie-name').value = '';
    document.getElementById('individual-notes').value = '';
    document.getElementById('input-tags-box').innerHTML = '';
    document.getElementById('input-tags-box').classList.add('hidden');
    DOMHelper.setSelectValue(document.getElementById('add-tag-select'), '');
    DOMHelper.setSelectDisabled(document.getElementById('add-tag-select'), true);

    renderUI();
    await loadEntries();
    switchView('input');
}

function renderTable(dataToRender, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = ''; 
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  const fragment = document.createDocumentFragment();

  dataToRender.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sl++}</td>
      <td><span class="clickable-title" data-id="${item.id}" data-draft="${isDraftTable}">${item.name || '-'}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'}" data-id="${item.id}"></td>
    `;
    
    tr.querySelector('.clickable-title').addEventListener('click', (e) => {
      openModal(e.target.dataset.id, e.target.dataset.draft === "true");
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function renderGroupTable(groups, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = ''; 
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  const fragment = document.createDocumentFragment();

  groups.forEach(group => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sl++}</td>
      <td><span class="clickable-group-title" data-name="${group.realName.replace(/"/g, '&quot;')}" data-draft="${isDraftTable}">${group.name}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'} group-checkbox" data-name="${group.realName.replace(/"/g, '&quot;')}"></td>
    `;

    tr.querySelector('.clickable-group-title').addEventListener('click', (e) => {
      openDuplicateMergeModal(e.target.dataset.name, e.target.dataset.draft === "true");
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function renderBatchPreviewTable() {
  AppState.bulkEntriesDraft.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
  
  const tbody = document.getElementById('batch-preview-body');
  tbody.innerHTML = '';

  const fragment = document.createDocumentFragment();
  
  AppState.bulkEntriesDraft.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.name}</td>
          <td style="text-align:right;"><input type="checkbox" class="batch-preview-checkbox" data-index="${index}"></td>
      `;
      fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
  document.getElementById('select-all-batch').checked = false;
  document.getElementById('batch-count').innerText = `Count: ${AppState.bulkEntriesDraft.length}`;
}

function renderCompareTable() {
  const tbody = document.getElementById('compare-body');
  tbody.innerHTML = '';

  const tempItems = AppState.items.filter(m => m.isMerged === false);
  const mainItems = AppState.items.filter(m => m.isMerged !== false);

  let matches = tempItems.filter(t => mainItems.some(m => m.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

  if(matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No overlapping entries found.</td></tr>';
    return;
  }

  matches.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));

  const hasData = (val) => {
      if (!val || val === '-') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
  };

  const formatTags = (val, itemId, prop) => {
      if (!hasData(val)) return '-';
      let tags = Array.isArray(val) ? val : [val];
      return tags.map(tag => `
          <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
              <input type="checkbox" class="compare-tag-cb" data-movie-id="${itemId}" data-prop="${prop}" data-val="${String(tag).replace(/"/g, '&quot;')}" style="margin-top: 2px;">
              <span style="word-break: break-word; line-height: 1.2;">${tag}</span>
          </div>
      `).join('');
  };

  const fragment = document.createDocumentFragment();
  const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };

  matches.forEach(tItem => {
    const mItem = mainItems.find(m => m.name.toLowerCase().trim() === tItem.name.toLowerCase().trim());
    
    const titleRow = document.createElement('tr');
    titleRow.innerHTML = `<td colspan="3" style="background: var(--secondary); color: var(--text); font-weight: bold; text-align: center; font-size: 1.05rem;">${tItem.name}</td>`;
    fragment.appendChild(titleRow);
    
    currentSchema.properties.forEach(p => {
       if(hasData(mItem[p]) || hasData(tItem[p])) {
         const mValHtml = formatTags(mItem[p], mItem.id, p);
         const tValHtml = formatTags(tItem[p], tItem.id, p);
         const tr = document.createElement('tr');
         tr.innerHTML = `
            <td style="font-weight: 500;">${p}</td>
            <td>${mValHtml}</td>
            <td>${tValHtml}</td>
         `;
         fragment.appendChild(tr);
       }
    });
    
    if (hasData(mItem.notes) || hasData(tItem.notes)) {
        const mNoteHtml = formatTags(mItem.notes, mItem.id, 'notes');
        const tNoteHtml = formatTags(tItem.notes, tItem.id, 'notes');
        const notesTr = document.createElement('tr');
        notesTr.innerHTML = `
            <td style="font-weight: 500;">Notes</td>
            <td>${mNoteHtml}</td>
            <td>${tNoteHtml}</td>
         `;
         fragment.appendChild(notesTr);
    }
  });
  
  tbody.appendChild(fragment);
}

function renderManageTagsTable() {
  const prop = managePropSelect.value;
  manageEditBtn.classList.remove('hidden');
  manageSaveBtn.classList.add('hidden');
  
  const tbody = document.getElementById('manage-tags-body');
  tbody.innerHTML = '';
  
  if (!prop) {
    manageEditBtn.disabled = true;
    manageDeleteBtn.disabled = true;
    document.getElementById('manage-tags-count').innerText = `Count: 0`;
    return;
  }
  
  manageEditBtn.disabled = false;
  manageDeleteBtn.disabled = false;

  const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { tags: {} };
  const sortedTags = sortAlpha(currentSchema.tags[prop] || []);
  document.getElementById('manage-tags-count').innerText = `Count: ${sortedTags.length}`;

  const fragment = document.createDocumentFragment();

  sortedTags.forEach((tag, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="manage-tag-cb" data-idx="${idx}"></td>
      <td><input type="text" class="manage-tag-input" data-idx="${idx}" value="${tag}" disabled></td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}

async function fetchGitInfo() {
  const buildEl = document.getElementById('app-build-val');
  const commitEl = document.getElementById('app-commit-val');
  const dateEl = document.getElementById('app-date-val');
  const timeEl = document.getElementById('app-time-val');
  try {
    const response = await fetch('https://api.github.com/repos/sudhi77/MyShelf/commits?per_page=1');
    if (response.ok) {
      const data = await response.json();
      const latestCommit = data[0];
      const sha = latestCommit.sha.substring(0, 7);
      const date = new Date(latestCommit.commit.author.date);

      const pad = (n) => n.toString().padStart(2, '0');
      const buildNo = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}.${pad(date.getHours())}${pad(date.getMinutes())}`;

      buildEl.innerText = buildNo;
      commitEl.innerText = sha;
      dateEl.innerText = date.toLocaleDateString();
      timeEl.innerText = date.toLocaleTimeString();
    } else {
      buildEl.innerText = "Unavailable";
      commitEl.innerText = "Unavailable";
      dateEl.innerText = "Unavailable";
      timeEl.innerText = "Unavailable";
    }
  } catch (error) {
    buildEl.innerText = "Error";
    commitEl.innerText = "Error";
    dateEl.innerText = "Error";
    timeEl.innerText = "Error";
  }
}

function openModal(itemId, isEditable) {
  const item = AppState.items.find(m => m.id === itemId);
  AppState.activeModalId = itemId;
  AppState.modalDraft = {}; 
  
  const editToggle = document.getElementById('modal-edit-toggle');
  if (editToggle) editToggle.classList.add('hidden');
  
  const modalActions = document.getElementById('modal-actions');
  const editBtn = document.getElementById('modal-edit-btn');
  const updateBtn = document.getElementById('modal-update-btn');
  const titleInput = document.getElementById('modal-title-input');
  const notesInput = document.getElementById('modal-notes-input');
  
  let staticHeading = document.getElementById('details-modal').querySelector('h2, h3');
  if(staticHeading && staticHeading.id !== 'dynamic-modal-heading') {
      staticHeading.style.display = 'none';
  }

  let dynamicHeading = document.getElementById('dynamic-modal-heading');
  if (!dynamicHeading) {
      dynamicHeading = document.createElement('h2');
      dynamicHeading.id = 'dynamic-modal-heading';
      dynamicHeading.style.color = 'var(--primary)';
      dynamicHeading.style.marginBottom = '20px';
      dynamicHeading.style.textAlign = 'center';
      titleInput.parentNode.parentNode.insertBefore(dynamicHeading, titleInput.parentNode);
  }
  dynamicHeading.innerText = item.name;

  titleInput.value = item.name;
  notesInput.value = item.notes || '';
  
  AppState.renderModalProps = function(editable) {
      if (editable) {
          dynamicHeading.style.display = 'none';
          titleInput.style.display = '';
          if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
              titleInput.previousElementSibling.style.display = '';
          }
          titleInput.disabled = false;
          notesInput.disabled = false;
          editBtn.disabled = true;
          updateBtn.disabled = false;
          editBtn.classList.add('hidden');
          updateBtn.classList.remove('hidden');
      } else {
          dynamicHeading.style.display = 'block';
          titleInput.style.display = 'none';
          if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
              titleInput.previousElementSibling.style.display = 'none';
          }
          notesInput.disabled = true;
          editBtn.disabled = false;
          updateBtn.disabled = true;
          editBtn.classList.remove('hidden');
          updateBtn.classList.add('hidden');
      }
      
      const container = document.getElementById('modal-dynamic-props');
      container.innerHTML = "";
      
      const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [], tags: {} };
      const sortedProps = sortAlpha(currentSchema.properties);

      sortedProps.forEach(prop => {
          const hasData = item[prop] && (Array.isArray(item[prop]) ? item[prop].length > 0 : true);
          if (!editable && !hasData) return;
          
          let div = document.createElement('div');
          div.className = 'form-group';
          div.style.alignItems = "flex-start"; 
          
          let label = document.createElement('label');
          label.innerText = prop;
          label.style.marginTop = "8px"; 
          div.appendChild(label);
          
          const sortedTagsForProp = sortAlpha(currentSchema.tags[prop] || []);

          if (singleProps.includes(prop)) {
              let select = document.createElement('select');
              select.id = `modal-prop-${prop.replace(/\s+/g, '-')}`;
              select.disabled = !editable; 
              select.innerHTML = `<option value="">--</option>`;
              
              sortedTagsForProp.forEach(tag => {
                  let isSelected = item[prop] === tag;
                  select.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
              });
              div.appendChild(select);
          } else {
              AppState.modalDraft[prop] = Array.isArray(item[prop]) ? [...item[prop]] : (item[prop] ? [item[prop]] : []);
              
              let wrapper = document.createElement('div');
              wrapper.className = 'modal-multi-prop-wrapper';
              if(editable) wrapper.classList.add('is-editing');
              wrapper.style.width = "100%";

              let tagsBox = document.createElement('div');
              tagsBox.className = 'tags-box';
              tagsBox.style.marginBottom = '0';
              wrapper.appendChild(tagsBox);

              let addSelect = document.createElement('select');
              addSelect.id = `modal-add-prop-${prop.replace(/\s+/g, '-')}`;
              addSelect.className = 'modal-add-prop-select'; 
              addSelect.disabled = !editable; 

              wrapper.appendChild(addSelect);
              div.appendChild(wrapper);

              const renderModalTags = () => {
                  tagsBox.innerHTML = '';
                  AppState.modalDraft[prop].forEach(tag => {
                      let pill = document.createElement('div');
                      pill.className = 'tag-pill';
                      pill.innerHTML = `<span>${tag}</span>${editable ? `<span class="tag-pill-remove" data-tag="${tag}">&times;</span>` : ''}`;
                      
                      if(editable) {
                          pill.querySelector('.tag-pill-remove').addEventListener('click', (e) => {
                              AppState.modalDraft[prop] = AppState.modalDraft[prop].filter(t => t !== tag);
                              renderModalTags();
                          });
                      }
                      tagsBox.appendChild(pill);
                  });

                  addSelect.innerHTML = `<option value="">Add ${prop}...</option>`;
                  sortedTagsForProp.forEach(tag => {
                      if (!AppState.modalDraft[prop].includes(tag)) {
                          addSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
                      }
                  });
                  if(editable && addSelect.dataset.customWrapper) {
                      DOMHelper.setSelectValue(addSelect, '');
                  }
              };

              addSelect.addEventListener('change', (e) => {
                  if (e.target.value) {
                      AppState.modalDraft[prop].push(e.target.value);
                      renderModalTags();
                      DOMHelper.setSelectValue(e.target, '');
                  }
              });
              renderModalTags(); 
          }
          container.appendChild(div);
      });
  };

  AppState.renderModalProps(isEditable);
  modalActions.classList.remove('hidden');
  document.getElementById('details-modal').classList.remove('hidden');
}

function enableEditingMode() {
  if(AppState.renderModalProps) AppState.renderModalProps(true);
}

function disableEditingMode() {
  if(AppState.renderModalProps) AppState.renderModalProps(false);
}

function openDuplicateMergeModal(itemName, isDraftTable) {
    AppState.currentDuplicateGroup = AppState.items.filter(m => 
        (m.name || '').toLowerCase().trim() === itemName.toLowerCase().trim() && 
        (isDraftTable ? m.isMerged === false : m.isMerged !== false)
    );

    document.getElementById('duplicate-modal-heading').innerText = AppState.currentDuplicateGroup[0].name;
    
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";
    AppState.currentDuplicateDraft = {};
    
    const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
    let hasConflicts = false;

    currentSchema.properties.forEach(prop => {
        let allVals = [];
        AppState.currentDuplicateGroup.forEach(m => {
            if (m[prop]) {
                if (Array.isArray(m[prop])) allVals.push(...m[prop]);
                else allVals.push(m[prop]);
            }
        });

        allVals = [...new Set(allVals)];

        if (allVals.length > 0) {
            if (allVals.length === 1) {
                AppState.currentDuplicateDraft[prop] = singleProps.includes(prop) ? allVals[0] : allVals;
            } else {
                hasConflicts = true;
                let div = document.createElement('div');
                div.className = 'form-group';
                
                if (singleProps.includes(prop)) {
                    let html = `<label style="color:var(--primary)">${prop} (Conflict)</label><select id="dupe-conflict-${prop.replace(/\s+/g, '-')}" data-custom-wrapper="false" style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary); background: var(--surface); color: var(--text);">`;
                    allVals.forEach(v => { html += `<option value="${v}">${v}</option>`; });
                    html += `</select>`;
                    div.innerHTML = html;
                } else {
                    AppState.currentDuplicateDraft[prop] = allVals; 
                    div.innerHTML = `<label>${prop} (Merged)</label><div class="tags-box">${allVals.map(v => `<span class="tag-pill">${v}</span>`).join('')}</div>`;
                }
                container.appendChild(div);
            }
        }
    });

    let allNotes = AppState.currentDuplicateGroup.map(m => m.notes).filter(n => n && n.trim());
    allNotes = [...new Set(allNotes)];
    if (allNotes.length > 0) {
        let combinedNotes = allNotes.join('\n---\n');
        AppState.currentDuplicateDraft.notes = combinedNotes;
        if (allNotes.length > 1) {
            hasConflicts = true;
            let div = document.createElement('div');
            div.className = 'form-group full-width';
            div.innerHTML = `<label>Notes (Conflict)</label><textarea id="dupe-merged-notes" rows="4" style="width:100%; border: 1px solid var(--muted); border-radius: 8px; padding: 8px;">${combinedNotes}</textarea>`;
            container.appendChild(div);
        }
    }

    if (!hasConflicts) {
        let div = document.createElement('div');
        div.innerHTML = '<p style="text-align:center; color:var(--muted);">All copies are identical. Click save to consolidate.</p>';
        container.appendChild(div);
    }

    const mergeBtn = document.getElementById('duplicate-merge-btn');
    if(mergeBtn) mergeBtn.classList.add('hidden');
    
    const saveBtn = document.getElementById('duplicate-save-btn');
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = false;
    
    document.getElementById('duplicate-merge-modal').classList.remove('hidden');
}

document.getElementById('duplicate-save-btn').addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    
    const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };

    currentSchema.properties.forEach(prop => {
        if (singleProps.includes(prop)) {
            let sel = document.getElementById(`dupe-conflict-${prop.replace(/\s+/g, '-')}`);
            if (sel) AppState.currentDuplicateDraft[prop] = sel.value;
        }
    });
    
    let notesEl = document.getElementById('dupe-merged-notes');
    if (notesEl) AppState.currentDuplicateDraft.notes = notesEl.value;

    const finalItem = {
        name: AppState.currentDuplicateGroup[0].name,
        isMerged: AppState.currentDuplicateGroup[0].isMerged,
        ...AppState.currentDuplicateDraft
    };

    const batch = writeBatch(db);
    
    AppState.currentDuplicateGroup.forEach(m => {
        batch.delete(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, m.id));
    });

    const newRef = doc(collection(db, "users", AppState.currentUserUid, AppState.currentCategory));
    batch.set(newRef, finalItem);

    try {
        await batch.commit();
        document.getElementById('duplicate-merge-modal').classList.add('hidden');
        loadEntries();
    } catch (e) {
        console.error("Error merging duplicates: ", e);
    }
});

document.getElementById('close-duplicate-modal').addEventListener('click', () => {
  document.getElementById('duplicate-merge-modal').classList.add('hidden');
});

document.getElementById('modal-edit-btn').addEventListener('click', () => { enableEditingMode(); });

document.getElementById('modal-update-btn').addEventListener('click', async () => {
  if(!AppState.activeModalId || !AppState.currentUserUid) return;
  const updatedData = {
    name: document.getElementById('modal-title-input').value,
    notes: document.getElementById('modal-notes-input').value
  };
  
  const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
  
  currentSchema.properties.forEach(prop => {
    if (singleProps.includes(prop)) {
      const select = document.getElementById(`modal-prop-${prop.replace(/\s+/g, '-')}`);
      updatedData[prop] = select.value || null;
    } else {
      updatedData[prop] = AppState.modalDraft[prop].length > 0 ? AppState.modalDraft[prop] : null;
    }
  });

  try {
    await updateDoc(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, AppState.activeModalId), updatedData);
    disableEditingMode(); 
    loadEntries();
  } catch (error) {}
});

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('details-modal').classList.add('hidden');
});

function setupEventListeners() {

  document.getElementById('execute-action-btn').addEventListener('click', async () => {
    const dbName = document.getElementById('db-select').value;
    const action = document.getElementById('action-select').value;
    sidebar.classList.remove('open');
    
    if (action === 'export') {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;backdrop-filter:blur(3px);";
        
        const modal = document.createElement('div');
        modal.className = 'main-card';
        modal.style.cssText = "background:var(--surface);padding:25px;border-radius:12px;display:flex;flex-direction:column;gap:15px;min-height:auto;width:90%;max-width:320px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.3);";
        
        modal.innerHTML = `<h3 style="color:var(--text);margin-bottom:10px;font-family:var(--font-heading);">Select Export Format</h3>`;
        
        const createBtn = (text, format) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.innerText = text;
            btn.onclick = async () => {
                const originalText = btn.innerText;
                btn.innerText = "Processing...";
                const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
                await handleExport(AppState.items, currentSchema.properties, format);
                btn.innerText = originalText;
                document.body.removeChild(overlay);
            };
            return btn;
        };

        const btnTxt = createBtn('Export as .TXT', 'txt');
        const btnPdf = createBtn('Export as .PDF', 'pdf');
        const btnExcel = createBtn('Export as .XLSX', 'xlsx');
        const btnCancel = document.createElement('button');
        
        btnCancel.className = 'btn btn-outline';
        btnCancel.style.marginTop = "10px";
        btnCancel.innerText = 'Cancel';
        btnCancel.onclick = () => document.body.removeChild(overlay);

        modal.append(btnTxt, btnPdf, btnExcel, btnCancel);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

    } else if (action === 'merge') {
        if (!AppState.currentUserUid) return;
        const unmerged = AppState.items.filter(m => m.isMerged === false);
        if(unmerged.length === 0) return; 
        
        const batch = writeBatch(db);
        unmerged.forEach(m => { batch.update(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, m.id), { isMerged: true }); });
        
        await batch.commit();
        loadEntries();
    } else if (action === 'compare') {
        switchView('compare');
        renderCompareTable();
    } else if (action === 'view') {
        AppState.showingDuplicates = false;
        switchView(dbName);
    } else if (action === 'analysis') {
        let targetItems = AppState.items.filter(m => dbName === 'commits' ? m.isMerged === false : m.isMerged !== false);
        const nameCounts = {};
        targetItems.forEach(m => {
            const n = (m.name || '').toLowerCase().trim();
            nameCounts[n] = (nameCounts[n] || 0) + 1;
        });
        
        let dupesCount = 0;
        for(let n in nameCounts) {
            if(nameCounts[n] > 1) dupesCount++;
        }
        
        if (dupesCount === 0) {
            DOMHelper.setSelectValue(document.getElementById('action-select'), "view"); 
            switchView(dbName); 
        } else {
            switchView(dbName); 
            AppState.showingDuplicates = true; 
            triggerActiveFilter(); 
        }
    }
  });

  mergeAllDupesBtn.addEventListener('click', async () => {
      if (!AppState.currentUserUid) return;

      const dbName = document.getElementById('db-select').value;
      const isDraftTable = dbName === 'commits';
      const activeTableBody = isDraftTable ? '#commits-body' : '#table-body';
      const checkedBoxes = document.querySelectorAll(`${activeTableBody} input[type="checkbox"]:checked`);

      if (checkedBoxes.length === 0) return; 

      if (confirm(`Merge ${checkedBoxes.length} selected duplicate groups? Conflicting single properties will auto-select the first available value.`)) {
          const batch = writeBatch(db);
          let mergedCount = 0;
          const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };

          checkedBoxes.forEach(cb => {
              const itemName = cb.dataset.name;
              if (!itemName) return; 

              const duplicateGroup = AppState.items.filter(m =>
                  (m.name || '').toLowerCase().trim() === itemName.toLowerCase().trim() &&
                  (isDraftTable ? m.isMerged === false : m.isMerged !== false)
              );

              if (duplicateGroup.length <= 1) return;

              let draft = {};
              currentSchema.properties.forEach(prop => {
                  let allVals = [];
                  duplicateGroup.forEach(m => {
                      if (m[prop]) {
                          if (Array.isArray(m[prop])) allVals.push(...m[prop]);
                          else allVals.push(m[prop]);
                      }
                  });

                  allVals = [...new Set(allVals)];

                  if (allVals.length > 0) {
                      if (singleProps.includes(prop)) {
                          draft[prop] = allVals[0]; 
                      } else {
                          draft[prop] = allVals;
                      }
                  }
              });

              let allNotes = duplicateGroup.map(m => m.notes).filter(n => n && n.trim());
              if (allNotes.length > 0) {
                  draft.notes = allNotes.join('\n---\n');
              }

              const finalItem = {
                  name: duplicateGroup[0].name,
                  isMerged: duplicateGroup[0].isMerged,
                  ...draft
              };

              duplicateGroup.forEach(m => {
                  batch.delete(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, m.id));
              });

              const newRef = doc(collection(db, "users", AppState.currentUserUid, AppState.currentCategory));
              batch.set(newRef, finalItem);
              mergedCount++;
          });

          if (mergedCount > 0) {
              try {
                  await batch.commit();
                  loadEntries();
              } catch (e) {}
          }
      }
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    const isDatabaseOpen = !databasePanel.classList.contains('hidden');
    const isCommitsOpen = !commitsPanel.classList.contains('hidden');
    const isInputOpen = !inputPanel.classList.contains('hidden');
    const isCompareOpen = !comparePanel.classList.contains('hidden');
    if (isDatabaseOpen || isCommitsOpen || isCompareOpen) switchView('input');
    else if (isInputOpen) switchView('landing');
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {}
  });

  document.getElementById('nav-movies').addEventListener('click', () => handleCategorySwitch('movies'));
  document.getElementById('nav-songs').addEventListener('click', () => handleCategorySwitch('songs'));
  document.getElementById('nav-books').addEventListener('click', () => handleCategorySwitch('books'));
  document.getElementById('nav-travel').addEventListener('click', () => handleCategorySwitch('travel'));
  
  document.getElementById('open-sidebar').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('close-sidebar').addEventListener('click', () => sidebar.classList.remove('open'));
  
  document.getElementById('theme-select').addEventListener('change', async (e) => {
    const newTheme = e.target.value;
    document.body.setAttribute('data-theme', newTheme);
    if(AppState.currentUserUid) {
      await setDoc(doc(db, "users", AppState.currentUserUid, "settings", "preferences"), { theme: newTheme }, { merge: true });
    }
  });

  openInfoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
    sidebar.classList.remove('open'); 
    fetchGitInfo();
  });
  closeInfoModal.addEventListener('click', () => infoModal.classList.add('hidden'));

  document.getElementById('prev-page-btn').addEventListener('click', () => {
      if (AppState.currentPage > 1) {
          AppState.currentPage--;
          triggerActiveFilter();
      }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
      AppState.currentPage++;
      triggerActiveFilter();
  });

  document.getElementById('sort-select').addEventListener('change', () => {
      AppState.currentPage = 1;
      triggerActiveFilter();
  });

  document.getElementById('sidebar-import-toggle').addEventListener('change', (e) => {
      AppState.isBatchMode = e.target.checked;
      
      const label = document.getElementById('sidebar-mode-label');
      label.innerText = 'Batch Import';
      label.style.color = AppState.isBatchMode ? 'var(--primary)' : 'var(--text)';

      if (AppState.isBatchMode) {
          document.getElementById('individual-title-row').classList.add('hidden');
          document.getElementById('individual-notes-row').classList.add('hidden');
          document.getElementById('individual-actions').classList.add('hidden');
          document.getElementById('batch-header-row').classList.remove('hidden');
          document.getElementById('batch-notes-row').classList.remove('hidden');
          document.getElementById('batch-actions').classList.remove('hidden');
          document.getElementById('batch-table-container').classList.remove('hidden');
          document.getElementById('batch-count').classList.remove('hidden');
      } else {
          document.getElementById('individual-title-row').classList.remove('hidden');
          document.getElementById('individual-notes-row').classList.remove('hidden');
          document.getElementById('individual-actions').classList.add('hidden');
          document.getElementById('batch-header-row').classList.add('hidden');
          document.getElementById('batch-notes-row').classList.add('hidden');
          document.getElementById('batch-actions').classList.add('hidden');
          document.getElementById('batch-table-container').classList.add('hidden');
          document.getElementById('batch-count').classList.add('hidden');
      }
      
      if (AppState.currentUserUid) {
          setDoc(doc(db, "users", AppState.currentUserUid, "settings", "preferences"), { isBatchMode: AppState.isBatchMode }, { merge: true });
      }
  });

  document.getElementById('open-bulk-btn').addEventListener('click', () => {
    document.getElementById('bulk-input-text').value = '';
    document.getElementById('bulk-modal').classList.remove('hidden');
  });

  document.getElementById('close-bulk-modal').addEventListener('click', () => {
    document.getElementById('bulk-modal').classList.add('hidden');
  });

  document.getElementById('bulk-clear-btn').addEventListener('click', () => {
    document.getElementById('bulk-input-text').value = '';
  });

  document.getElementById('bulk-save-btn').addEventListener('click', () => {
    const text = document.getElementById('bulk-input-text').value;
    
    AppState.bulkEntriesDraft = parseBulkText(text);

    if(AppState.bulkEntriesDraft.length > 0) {
      document.getElementById('bulk-modal').classList.add('hidden');
      document.getElementById('bulk-input-text').value = '';
      renderBatchPreviewTable();
    }
  });

  document.getElementById('select-all-batch').addEventListener('change', (e) => {
    document.querySelectorAll('.batch-preview-checkbox').forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById('update-selected-btn').addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.batch-preview-checkbox:checked');
      if (checkedBoxes.length === 0) return; 

      const notesVal = document.getElementById('batch-notes').value.trim();

      checkedBoxes.forEach(cb => {
          const idx = parseInt(cb.dataset.index);
          
          Object.keys(AppState.currentEntryDraft).forEach(prop => {
              if (Array.isArray(AppState.currentEntryDraft[prop])) {
                  AppState.bulkEntriesDraft[idx][prop] = [...AppState.currentEntryDraft[prop]];
              } else {
                  AppState.bulkEntriesDraft[idx][prop] = AppState.currentEntryDraft[prop];
              }
          });
          
          if (notesVal) {
              AppState.bulkEntriesDraft[idx].notes = notesVal;
          }
      });
  });

  document.getElementById('add-prop-select').addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    const tagSelect = document.getElementById('add-tag-select');
    const tagsBox = document.getElementById('input-tags-box');
    
    if (selectedProp) {
      DOMHelper.setSelectDisabled(tagSelect, false);
      const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { tags: {} };
      const sortedTagsForProp = sortAlpha(currentSchema.tags[selectedProp] || []);

      if (singleProps.includes(selectedProp)) {
        tagsBox.classList.add('hidden');
        DOMHelper.setSelectMultiple(tagSelect, false);
        tagSelect.innerHTML = `<option value="">Tag</option>`;
        
        sortedTagsForProp.forEach(tag => {
          let isSelected = AppState.currentEntryDraft[selectedProp] === tag;
          tagSelect.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
        });
      } else {
        tagsBox.classList.remove('hidden');
        DOMHelper.setSelectMultiple(tagSelect, false);
        tagSelect.innerHTML = `<option value="">Add Tag...</option>`;
        
        if (!AppState.currentEntryDraft[selectedProp]) AppState.currentEntryDraft[selectedProp] = [];
        if (!Array.isArray(AppState.currentEntryDraft[selectedProp])) {
           AppState.currentEntryDraft[selectedProp] = [AppState.currentEntryDraft[selectedProp]];
        }

        sortedTagsForProp.forEach(tag => {
          if (!AppState.currentEntryDraft[selectedProp].includes(tag)) {
            tagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
          }
        });
        
        renderInputTags(selectedProp);
      }
    } else { 
      tagSelect.innerHTML = `<option value="">Tag</option>`;
      DOMHelper.setSelectDisabled(tagSelect, true);
      tagsBox.classList.add('hidden');
    }
  });

  function renderInputTags(prop) {
      const tagsBox = document.getElementById('input-tags-box');
      tagsBox.innerHTML = '';
      const tags = AppState.currentEntryDraft[prop] || [];
      
      tags.forEach(tag => {
          const pill = document.createElement('div');
          pill.className = 'tag-pill';
          pill.innerHTML = `<span>${tag}</span><span class="tag-pill-remove" data-tag="${tag}">&times;</span>`;
          tagsBox.appendChild(pill);
      });
      
      tagsBox.querySelectorAll('.tag-pill-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const tagToRemove = e.target.getAttribute('data-tag');
              AppState.currentEntryDraft[prop] = AppState.currentEntryDraft[prop].filter(t => t !== tagToRemove);
              document.getElementById('add-prop-select').dispatchEvent(new Event('change')); 
          });
      });
  }

  document.getElementById('add-tag-select').addEventListener('change', (e) => {
    const prop = document.getElementById('add-prop-select').value;
    if (!prop) return;
    
    if (singleProps.includes(prop)) {
      const tag = e.target.value;
      if (tag) AppState.currentEntryDraft[prop] = tag;
      else delete AppState.currentEntryDraft[prop]; 
    } else {
      const tag = e.target.value;
      if (tag) {
          if (!AppState.currentEntryDraft[prop]) AppState.currentEntryDraft[prop] = [];
          if (!AppState.currentEntryDraft[prop].includes(tag)) {
            AppState.currentEntryDraft[prop].push(tag);
          }
          document.getElementById('add-prop-select').dispatchEvent(new Event('change'));
      }
    }
  });

  document.getElementById('save-movie-btn').addEventListener('click', async () => {
      if (!AppState.currentUserUid) return;

      const name = document.getElementById('movie-name').value.trim();
      if (!name) return;

      const entryData = {
          name: name,
          notes: document.getElementById('individual-notes').value.trim(),
          ...AppState.currentEntryDraft 
      };

      try {
          await saveIndividualEntry(db, AppState.currentUserUid, AppState.currentCategory, entryData);
          
          document.getElementById('movie-name').value = '';
          document.getElementById('individual-notes').value = '';
          DOMHelper.setSelectValue(document.getElementById('add-prop-select'), '');
          const tagSelect = document.getElementById('add-tag-select');
          tagSelect.innerHTML = `<option value="">Tag</option>`;
          DOMHelper.setSelectDisabled(tagSelect, true);
          document.getElementById('input-tags-box').classList.add('hidden');
          document.getElementById('input-tags-box').innerHTML = '';
          
          AppState.currentEntryDraft = {}; 
          loadEntries(); 
      } catch (e) {}
  });

  document.getElementById('save-batch-btn').addEventListener('click', async () => {
      try {
          await saveBulkEntries(db, AppState.currentUserUid, AppState.currentCategory, AppState.bulkEntriesDraft);
          
          document.getElementById('batch-notes').value = '';
          DOMHelper.setSelectValue(document.getElementById('add-prop-select'), '');
          const tagSelect = document.getElementById('add-tag-select');
          tagSelect.innerHTML = `<option value="">Tag</option>`;
          DOMHelper.setSelectDisabled(tagSelect, true);
          document.getElementById('input-tags-box').classList.add('hidden');
          document.getElementById('input-tags-box').innerHTML = '';
          
          AppState.currentEntryDraft = {}; 
          AppState.bulkEntriesDraft = []; 
          renderBatchPreviewTable();
          await loadEntries(); 

          DOMHelper.setSelectValue(document.getElementById('db-select'), 'commits');
          updateActionDropdown();
          AppState.showingDuplicates = true;
          switchView('commits', false);
          triggerActiveFilter();
      } catch(e) {}
  });

  document.getElementById('compare-delete-btn').addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const checkedBoxes = document.querySelectorAll('.compare-tag-cb:checked');
    if (checkedBoxes.length === 0) return;

    if (confirm(`Delete ${checkedBoxes.length} selected tag(s)?`)) {
        const batch = writeBatch(db);
        const updates = {};

        checkedBoxes.forEach(cb => {
            const itemId = cb.dataset.movieId;
            const prop = cb.dataset.prop;
            const valToRemove = cb.dataset.val;

            if (!updates[itemId]) {
                const item = AppState.items.find(m => m.id === itemId);
                if (item) updates[itemId] = { ...item };
            }

            if (updates[itemId]) {
                let currentVal = updates[itemId][prop];
                if (Array.isArray(currentVal)) {
                    updates[itemId][prop] = currentVal.filter(v => v !== valToRemove);
                    if (updates[itemId][prop].length === 0) updates[itemId][prop] = null;
                } else if (currentVal === valToRemove) {
                    updates[itemId][prop] = null;
                }
            }
        });

        let updateCount = 0;
        Object.keys(updates).forEach(itemId => {
            const dataToUpdate = { ...updates[itemId] };
            delete dataToUpdate.id; 
            batch.update(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, itemId), dataToUpdate);
            updateCount++;
        });

        if (updateCount > 0) {
            try {
                await batch.commit();
                loadEntries(); 
                document.getElementById('execute-action-btn').click(); 
            } catch(e) {}
        }
    }
  });

  document.getElementById('select-all-commits').addEventListener('change', (e) => {
    document.querySelectorAll('#commits-body .draft-checkbox').forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById('select-all-main').addEventListener('change', (e) => {
    document.querySelectorAll('#table-body .main-checkbox').forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById('delete-drafts-btn').addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const activeTableBody = commitsPanel.classList.contains('hidden') ? '#table-body' : '#commits-body';
    const checkedBoxes = document.querySelectorAll(`${activeTableBody} input[type="checkbox"]:checked`);
    
    if(checkedBoxes.length === 0) return;
    
    if(confirm(`Delete ${checkedBoxes.length} selected entries?`)) {
      const batch = writeBatch(db);
      let hasDeletions = false;

      checkedBoxes.forEach(cb => { 
        if (AppState.showingDuplicates && cb.classList.contains('group-checkbox')) {
            const itemName = cb.dataset.name;
            const isDraftTable = activeTableBody === '#commits-body';
            const duplicateGroup = AppState.items.filter(m =>
                (m.name || '').toLowerCase().trim() === itemName.toLowerCase().trim() &&
                (isDraftTable ? m.isMerged === false : m.isMerged !== false)
            );
            duplicateGroup.forEach(m => {
                batch.delete(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, m.id));
                hasDeletions = true;
            });
        } else if (cb.dataset.id) {
            batch.delete(doc(db, "users", AppState.currentUserUid, AppState.currentCategory, cb.dataset.id)); 
            hasDeletions = true;
        }
      });

      if (hasDeletions) {
          await batch.commit();
          loadEntries();
      }
    }
  });

  const customTagInput = document.getElementById('customize-tag-input');
  const customAddBtn = document.getElementById('add-custom-btn');
  
  customTagInput.addEventListener('input', (e) => {
    customAddBtn.disabled = e.target.value.trim().length === 0;
  });

  document.getElementById('view-props-btn').addEventListener('click', () => {
    managePropSelect.innerHTML = `<option value="">Select Property</option>`;
    const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
    const sortedProps = sortAlpha(currentSchema.properties);
    sortedProps.forEach(prop => {
       managePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`;
    });
    manageTagsBody.innerHTML = '';
    document.getElementById('manage-tags-count').innerText = 'Count: 0'; 
    managePropsModal.classList.remove('hidden');
    manageEditBtn.disabled = true;
    manageDeleteBtn.disabled = true;
    manageSaveBtn.classList.add('hidden');
    manageEditBtn.classList.remove('hidden');
  });

  document.getElementById('close-manage-props-modal').addEventListener('click', () => {
    managePropsModal.classList.add('hidden');
  });

  managePropSelect.addEventListener('change', renderManageTagsTable);

  manageEditBtn.addEventListener('click', () => {
    document.querySelectorAll('.manage-tag-input').forEach(input => {
      input.disabled = false;
      input.classList.add('editable');
    });
    manageEditBtn.classList.add('hidden');
    manageSaveBtn.classList.remove('hidden');
  });

  manageSaveBtn.addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const prop = managePropSelect.value;
    if (!prop) return;

    const newTags = [];
    document.querySelectorAll('.manage-tag-input').forEach(input => {
      const val = input.value.trim();
      if (val && !newTags.includes(val)) newTags.push(val);
    });
    
    if (AppState.metadata.categories[AppState.currentCategory]) {
        AppState.metadata.categories[AppState.currentCategory].tags[prop] = newTags;
        await saveMetadata();
        renderUI(); 
        renderManageTagsTable(); 
    }
  });

  manageDeleteBtn.addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const prop = managePropSelect.value;
    if (!prop) return;

    const checked = document.querySelectorAll('.manage-tag-cb:checked');
    if (checked.length === 0) return;

    if (confirm(`Delete ${checked.length} tags?`)) {
      const indicesToRemove = Array.from(checked).map(cb => parseInt(cb.dataset.idx));
      if (AppState.metadata.categories[AppState.currentCategory]) {
          AppState.metadata.categories[AppState.currentCategory].tags[prop] = AppState.metadata.categories[AppState.currentCategory].tags[prop].filter((_, idx) => !indicesToRemove.includes(idx));
          await saveMetadata();
          renderUI();
          renderManageTagsTable();
      }
    }
  });

  customAddBtn.addEventListener('click', async () => {
    const propChoice = document.getElementById('customize-prop-select').value;
    const tagStringRaw = customTagInput.value;
    if (!tagStringRaw.trim()) return;

    const tagsToAdd = tagStringRaw.split(/,|\n/).map(t => t.trim()).filter(t => t);
    if (tagsToAdd.length === 0) return;

    let updated = false;
    const catMeta = AppState.metadata.categories[AppState.currentCategory];

    if (propChoice === "Property") {
      tagsToAdd.forEach(tagString => {
        if (!catMeta.properties.includes(tagString)) {
          catMeta.properties.push(tagString);
          catMeta.tags[tagString] = [];
          updated = true;
        }
      });
    } else {
      if (!catMeta.tags[propChoice]) catMeta.tags[propChoice] = [];
      tagsToAdd.forEach(tagString => {
        if (!catMeta.tags[propChoice].includes(tagString)) {
          catMeta.tags[propChoice].push(tagString);
          updated = true;
        }
      });
    }
    
    if (updated) {
      customTagInput.value = '';
      customAddBtn.disabled = true; 
      await saveMetadata();
      renderUI();
      DOMHelper.setSelectValue(document.getElementById('customize-prop-select'), propChoice);
    }
  });

  const filterBySelect = document.getElementById('filter-by-select');
  const filterTagSelect = document.getElementById('filter-tag-select');

  filterBySelect.addEventListener('change', (e) => {
    AppState.currentPage = 1; 
    const selectedProp = e.target.value;
    filterTagSelect.innerHTML = `<option value="">Tag</option>`;
    if (selectedProp) {
      DOMHelper.setSelectDisabled(filterTagSelect, false);
      const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { tags: {} };
      const sortedTagsForProp = sortAlpha(currentSchema.tags[selectedProp] || []);
      sortedTagsForProp.forEach(tag => {
        filterTagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
      });
    } else { 
      DOMHelper.setSelectDisabled(filterTagSelect, true); 
    }
    triggerActiveFilter();
  });

  filterTagSelect.addEventListener('change', () => { AppState.currentPage = 1; triggerActiveFilter(); });

  document.getElementById('search-btn').addEventListener('click', () => { AppState.currentPage = 1; triggerActiveFilter(); });
  
  document.getElementById('search-input').addEventListener('input', debounce(() => {
    AppState.currentPage = 1;
    triggerActiveFilter();
  }, 250));

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    DOMHelper.setSelectValue(filterBySelect, '');
    filterTagSelect.innerHTML = `<option value="">Tag</option>`;
    DOMHelper.setSelectDisabled(filterTagSelect, true);
    searchInput.value = '';
    AppState.showingDuplicates = false; 
    
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        DOMHelper.setSelectValue(sortSelect, 'name-asc');
    }
    
    AppState.currentPage = 1;
    triggerActiveFilter();
  });
}

function switchView(viewName, saveToDb = true) {
  AppState.showingDuplicates = false; 
  AppState.currentPage = 1; 
  landingPanel.classList.add('hidden');
  inputPanel.classList.add('hidden');
  databasePanel.classList.add('hidden');
  commitsPanel.classList.add('hidden');
  comparePanel.classList.add('hidden');
  sharedFilterBar.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  document.getElementById('home-btn').classList.add('hidden');
  document.getElementById('pagination-controls').classList.add('hidden');
  mergeAllDupesBtn.classList.remove('hidden'); 
  deleteBtn.classList.add('hidden'); 

  if(viewName === 'landing') {
    landingPanel.classList.remove('hidden');
    logoutBtn.classList.remove('hidden'); 
  } else {
    document.getElementById('home-btn').classList.remove('hidden');
    
    if(viewName === 'input') {
      inputPanel.classList.remove('hidden');
    } else if(viewName === 'database') {
      sharedFilterBar.classList.remove('hidden');
      databasePanel.classList.remove('hidden');
      document.getElementById('pagination-controls').classList.remove('hidden');
      deleteBtn.classList.remove('hidden');
      triggerActiveFilter();
    } else if(viewName === 'commits') {
      sharedFilterBar.classList.remove('hidden');
      commitsPanel.classList.remove('hidden');
      document.getElementById('pagination-controls').classList.remove('hidden');
      deleteBtn.classList.remove('hidden');
      triggerActiveFilter();
    } else if (viewName === 'compare') {
      comparePanel.classList.remove('hidden');
    }
  }

  if (saveToDb && AppState.currentUserUid) {
    setDoc(doc(db, "users", AppState.currentUserUid, "settings", "preferences"), { view: viewName }, { merge: true });
  }
}

function triggerActiveFilter() {
  const filterBy = document.getElementById('filter-by-select').value;
  const filterTag = document.getElementById('filter-tag-select').value;
  const searchQuery = searchInput.value.toLowerCase().trim();
  const dbName = document.getElementById('db-select').value;
  
  if (AppState.showingDuplicates) {
      mergeAllDupesBtn.classList.remove('hidden');
  } else {
      mergeAllDupesBtn.classList.add('hidden');
  }
  
  const isCommitsOpen = !commitsPanel.classList.contains('hidden');
  const isDatabaseOpen = !databasePanel.classList.contains('hidden');

  if (isCommitsOpen || isDatabaseOpen) {
      
      if (AppState.showingDuplicates) {
          let targetDbItems = isCommitsOpen ? AppState.items.filter(m => m.isMerged === false) : AppState.items.filter(m => m.isMerged !== false);

          const sortSelectNode = document.getElementById('sort-select');
          const sortBy = sortSelectNode ? sortSelectNode.value : 'name-asc';
          
          const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
          targetDbItems = sortMovies(targetDbItems, sortBy, currentSchema.properties);

          const nameCounts = {};
          const nameToItems = {};
          const orderedNames = []; 

          targetDbItems.forEach(m => {
              const n = (m.name || '').toLowerCase().trim();
              if(!nameCounts[n]) { 
                  nameCounts[n] = 0; 
                  nameToItems[n] = []; 
                  orderedNames.push(n);
              }
              nameCounts[n]++;
              nameToItems[n].push(m);
          });
          
          const groupList = [];
          const orderedLen = orderedNames.length;
          for (let i = 0; i < orderedLen; i++) {
              const n = orderedNames[i];
              if (nameCounts[n] > 1) {
                  groupList.push({
                      id: `group_${n}`,
                      name: `${nameToItems[n][0].name} (${nameCounts[n]})`,
                      realName: nameToItems[n][0].name
                  });
              }
          }
          
          const totalPages = Math.ceil(groupList.length / AppState.itemsPerPage) || 1;
          if (AppState.currentPage > totalPages) AppState.currentPage = totalPages;
          const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
          const pagedGroups = groupList.slice(startIndex, startIndex + AppState.itemsPerPage);

          document.getElementById('prev-page-btn').disabled = AppState.currentPage === 1;
          document.getElementById('next-page-btn').disabled = AppState.currentPage === totalPages;
          document.getElementById('page-indicator').innerText = `${AppState.currentPage}/${totalPages}`;

          if (isCommitsOpen) {
              document.getElementById('commits-count').innerText = `${groupList.length}`;
              renderGroupTable(pagedGroups, "commits-body", true, startIndex);
          } else {
              document.getElementById('main-count').innerText = `${groupList.length}`;
              renderGroupTable(pagedGroups, "table-body", false, startIndex);
          }
          return;
      }

      let subsetItems = isCommitsOpen ? AppState.items.filter(m => m.isMerged === false) : AppState.items.filter(m => m.isMerged !== false);

      const targetFields = ["name"];
      subsetItems = searchDatabase(searchQuery, subsetItems, targetFields);
      subsetItems = filterMoviesByProperty(subsetItems, filterBy, filterTag);

      const sortSelectNode = document.getElementById('sort-select');
      const sortBy = sortSelectNode ? sortSelectNode.value : 'name-asc';
      
      const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
      subsetItems = sortMovies(subsetItems, sortBy, currentSchema.properties);

      const totalPages = Math.ceil(subsetItems.length / AppState.itemsPerPage) || 1;
      if (AppState.currentPage > totalPages) AppState.currentPage = totalPages;

      const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
      const pagedItems = subsetItems.slice(startIndex, startIndex + AppState.itemsPerPage);

      document.getElementById('prev-page-btn').disabled = AppState.currentPage === 1;
      document.getElementById('next-page-btn').disabled = AppState.currentPage === totalPages;
      document.getElementById('page-indicator').innerText = `${AppState.currentPage}/${totalPages}`;

      if (isCommitsOpen) {
          document.getElementById('commits-count').innerText = `${subsetItems.length}`;
          renderTable(pagedItems, "commits-body", true, startIndex);
      } else {
          document.getElementById('main-count').innerText = `${subsetItems.length}`;
          renderTable(pagedItems, "table-body", false, startIndex);
      }
  }
}
