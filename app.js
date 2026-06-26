import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { handleExport } from "./library/export_lib.js"; 
import { sortMovies, searchDatabase, filterMoviesByProperty } from "./library/sort&filter_lib.js";
import { saveIndividualMovie, parseBulkText, saveBulkMovies } from "./library/importmovie_lib.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXgJx0FnwRTjPwVc7JtbZC0iNz_p3EFrk",
  authDomain: "myshelf-c6a27.firebaseapp.com",
  projectId: "myshelf-c6a27",
  storageBucket: "myshelf-c6a27.firebasestorage.app",
  messagingSenderId: "262667540714",
  appId: "1:262667540714:web:c4e2711b1f1aee24081f93"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// Dynamic Year Array Generation (2030 down to 1950)
const yearsArray = [];
for (let y = 2030; y >= 1950; y--) {
  yearsArray.push(y.toString());
}

// Data Handling Constants
const singleProps = ["Name", "Rating", "Year", "Language", "status", "Status", "Category"];

const defaultMetadata = {
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
};

// ==========================================================================
// STATE MANAGEMENT: Centralized Application State Object
// ==========================================================================
const AppState = {
  currentUserUid: null,
  currentPage: 1,
  itemsPerPage: 50,
  metadata: JSON.parse(JSON.stringify(defaultMetadata)),
  movies: [],
  isInitialized: false,
  currentMovieDraft: {},
  bulkMoviesDraft: [],
  activeModalMovieId: null,
  modalDraft: {},
  showingDuplicates: false,
  isBatchMode: false,
  currentDuplicateGroup: [],
  currentDuplicateDraft: {}
};

// Universal Alphabetical Sorter
const sortAlpha = (arr) => [...arr].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

// DOM Elements
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

// Property Manager Modal Elements
const managePropsModal = document.getElementById('manage-props-modal');
const managePropSelect = document.getElementById('manage-prop-select');
const manageTagsBody = document.getElementById('manage-tags-body');
const manageEditBtn = document.getElementById('manage-edit-btn');
const manageSaveBtn = document.getElementById('manage-save-btn');
const manageDeleteBtn = document.getElementById('manage-delete-btn');

// Info Modal Elements
const infoModal = document.getElementById('info-modal');
const openInfoBtn = document.getElementById('open-info-btn');
const closeInfoModal = document.getElementById('close-info-modal');


// ==========================================================================
// DOM HELPER: Safe DOM Manipulation Utility (Replaces Monkey Patching)
// ==========================================================================
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


// ==========================================================================
// INITIALIZER: Custom Interactive Dropdown UI Wrapper Injection
// ==========================================================================
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
  globalObs.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
  });
}

// ==========================================================================
// FIREBASE AUTH: Secure State Synchronizer Loop Listener
// ==========================================================================
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
    AppState.movies = [];
    AppState.metadata = JSON.parse(JSON.stringify(defaultMetadata));
  }
});

// ==========================================================================
// CORE CONTROLLER: Main Bootstrapper & Local Storage Setup Pipeline
// ==========================================================================
async function init() {
  initializeCustomDropdowns(); 
  await loadPreferencesAndMetadata();
  updateActionDropdown(); 
  renderUI();
  await loadMovies();
  if (!AppState.isInitialized) {
    setupEventListeners();
    AppState.isInitialized = true;
  }
}

// ==========================================================================
// CLOUD STORAGE: Load User Settings, Themes, and Schema Metadata
// ==========================================================================
async function loadPreferencesAndMetadata() {
  if (!AppState.currentUserUid) return;
  
  const metaRef = doc(db, "users", AppState.currentUserUid, "settings", "appMetadata");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) { 
    AppState.metadata = metaSnap.data(); 
    
    let forceSave = false;
    if (AppState.metadata.properties.includes("Watch Status")) {
      AppState.metadata.properties = AppState.metadata.properties.filter(p => p !== "Watch Status");
      delete AppState.metadata.tags["Watch Status"];
      forceSave = true;
    }

    if (!AppState.metadata.tags["Year"] || AppState.metadata.tags["Year"].length < 80) {
      AppState.metadata.tags["Year"] = yearsArray;
      forceSave = true;
    }
    
    if (forceSave) await setDoc(metaRef, AppState.metadata, { merge: true });

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
  }
  
  switchView(startView, false); 
}

// ==========================================================================
// CLOUD STORAGE: Save Structural Properties Schema State Definitions
// ==========================================================================
async function saveMetadata() {
  if (!AppState.currentUserUid) return;
  await setDoc(doc(db, "users", AppState.currentUserUid, "settings", "appMetadata"), AppState.metadata);
}

// ==========================================================================
// UI VIEWS: Dynamically Update Sidebar Context Subaction Select Options
// ==========================================================================
function updateActionDropdown() {
    actionSelect.innerHTML = '';
    if (dbSelect.value === 'commits') {
        actionSelect.innerHTML = `
            <option value="view">View</option>
            <option value="duplicates">Duplicates</option>
            <option value="compare">Compare</option>
            <option value="merge">Merge</option>
        `;
    } else {
        actionSelect.innerHTML = `
            <option value="view">View</option>
            <option value="duplicates">Duplicates</option>
            <option value="export">Export</option>
        `;
    }
    actionSelect.dispatchEvent(new Event('sync-custom-select'));
}

dbSelect.addEventListener('change', updateActionDropdown);

// ==========================================================================
// UI VIEWS: Populate Core Dropdown Controls from Schema Properties
// ==========================================================================
function renderUI() {
  const prevAddChoice = document.getElementById('add-prop-select').value;
  const prevCustChoice = document.getElementById('customize-prop-select').value;
  const prevFiltChoice = document.getElementById('filter-by-select').value;
  
  const sortedProps = sortAlpha(AppState.metadata.properties);

  const addPropSelect = document.getElementById('add-prop-select');
  addPropSelect.innerHTML = `<option value="">Properties</option>`;
  sortedProps.forEach(prop => { addPropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (AppState.metadata.properties.includes(prevAddChoice)) DOMHelper.setSelectValue(addPropSelect, prevAddChoice);

  const customizePropSelect = document.getElementById('customize-prop-select');
  customizePropSelect.innerHTML = `<option value="Property">Properties</option>`;
  sortedProps.forEach(prop => { customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (prevCustChoice) DOMHelper.setSelectValue(customizePropSelect, prevCustChoice);

  const filterBySelect = document.getElementById('filter-by-select');
  filterBySelect.innerHTML = `<option value="">Filter By</option>`;
  sortedProps.forEach(prop => { filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (AppState.metadata.properties.includes(prevFiltChoice)) DOMHelper.setSelectValue(filterBySelect, prevFiltChoice);
}

// ==========================================================================
// CLOUD STORAGE: Pull and Localize Full User Entry Registry Collection
// ==========================================================================
async function loadMovies() {
  if (!AppState.currentUserUid) return;
  const querySnapshot = await getDocs(collection(db, "users", AppState.currentUserUid, "movies"));
  AppState.movies = [];
  querySnapshot.forEach((doc) => { AppState.movies.push({ id: doc.id, ...doc.data() }); });
  triggerActiveFilter();
}

// ==========================================================================
// DOM RENDERING: Standard Entry Data Grid Row Builder Engine
// ==========================================================================
function renderTable(dataToRender, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  let rowsHtml = "";
  dataToRender.forEach(movie => {
    rowsHtml += `<tr>
      <td>${sl++}</td>
      <td><span class="clickable-title" data-id="${movie.id}" data-draft="${isDraftTable}">${movie.name || '-'}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'}" data-id="${movie.id}"></td>
    </tr>`;
  });

  tbody.innerHTML = rowsHtml;

  document.querySelectorAll(`#${tbodyId} .clickable-title`).forEach(el => {
    el.addEventListener('click', (e) => {
      openModal(e.target.dataset.id, e.target.dataset.draft === "true");
    });
  });
}

// ==========================================================================
// DOM RENDERING: Duplicate Conflicts Data Grid Group Row Builder Engine
// ==========================================================================
function renderGroupTable(groups, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  let rowsHtml = "";
  groups.forEach(group => {
    rowsHtml += `<tr>
      <td>${sl++}</td>
      <td><span class="clickable-group-title" data-name="${group.realName.replace(/"/g, '&quot;')}" data-draft="${isDraftTable}">${group.name}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'} group-checkbox" data-name="${group.realName.replace(/"/g, '&quot;')}"></td>
    </tr>`;
  });

  tbody.innerHTML = rowsHtml;

  document.querySelectorAll(`#${tbodyId} .clickable-group-title`).forEach(el => {
    el.addEventListener('click', (e) => {
      openDuplicateMergeModal(e.target.dataset.name, e.target.dataset.draft === "true");
    });
  });
}

// ==========================================================================
// DOM RENDERING: Bulk Update Queue Preview Grid Row Builder Engine
// ==========================================================================
function renderBatchPreviewTable() {
  AppState.bulkMoviesDraft.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
  
  const tbody = document.getElementById('batch-preview-body');
  
  let rowsHtml = "";
  AppState.bulkMoviesDraft.forEach((movie, index) => {
      rowsHtml += `
      <tr>
          <td>${index + 1}</td>
          <td>${movie.name}</td>
          <td style="text-align:right;"><input type="checkbox" class="batch-preview-checkbox" data-index="${index}"></td>
      </tr>`;
  });
  
  tbody.innerHTML = rowsHtml;
  document.getElementById('select-all-batch').checked = false;
  document.getElementById('batch-count').innerText = `Count: ${AppState.bulkMoviesDraft.length}`;
}

// ==========================================================================
// DOM RENDERING: Side-by-Side Overlap Comparison Table Builder Engine
// ==========================================================================
function renderCompareTable() {
  const tbody = document.getElementById('compare-body');
  const tempMovies = AppState.movies.filter(m => m.isMerged === false);
  const mainMovies = AppState.movies.filter(m => m.isMerged !== false);

  let matches = tempMovies.filter(t => mainMovies.some(m => m.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

  if(matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No overlapping movies found.</td></tr>';
    return;
  }

  matches.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));

  const hasData = (val) => {
      if (!val || val === '-') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
  };

  const formatTags = (val, movieId, prop) => {
      if (!hasData(val)) return '-';
      let tags = Array.isArray(val) ? val : [val];
      return tags.map(tag => `
          <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
              <input type="checkbox" class="compare-tag-cb" data-movie-id="${movieId}" data-prop="${prop}" data-val="${String(tag).replace(/"/g, '&quot;')}" style="margin-top: 2px;">
              <span style="word-break: break-word; line-height: 1.2;">${tag}</span>
          </div>
      `).join('');
  };

  let allRowsHtml = "";
  matches.forEach(tMovie => {
    const mMovie = mainMovies.find(m => m.name.toLowerCase().trim() === tMovie.name.toLowerCase().trim());
    
    let rowsHtml = `<tr><td colspan="3" style="background: var(--secondary); color: var(--text); font-weight: bold; text-align: center; font-size: 1.05rem;">${tMovie.name}</td></tr>`;
    
    AppState.metadata.properties.forEach(p => {
       if(hasData(mMovie[p]) || hasData(tMovie[p])) {
         const mValHtml = formatTags(mMovie[p], mMovie.id, p);
         const tValHtml = formatTags(tMovie[p], tMovie.id, p);
         rowsHtml += `<tr>
            <td style="font-weight: 500;">${p}</td>
            <td>${mValHtml}</td>
            <td>${tValHtml}</td>
         </tr>`;
       }
    });
    
    if (hasData(mMovie.notes) || hasData(tMovie.notes)) {
        const mNoteHtml = formatTags(mMovie.notes, mMovie.id, 'notes');
        const tNoteHtml = formatTags(tMovie.notes, tMovie.id, 'notes');
        rowsHtml += `<tr>
            <td style="font-weight: 500;">Notes</td>
            <td>${mNoteHtml}</td>
            <td>${tNoteHtml}</td>
         </tr>`;
    }
    
    allRowsHtml += rowsHtml;
  });
  
  tbody.innerHTML = allRowsHtml;
}

// ==========================================================================
// DOM RENDERING: Tag Category Schema Editor Grid Builder Engine
// ==========================================================================
function renderManageTagsTable() {
  const prop = managePropSelect.value;
  manageEditBtn.classList.remove('hidden');
  manageSaveBtn.classList.add('hidden');
  
  if (!prop) {
    manageTagsBody.innerHTML = '';
    manageEditBtn.disabled = true;
    manageDeleteBtn.disabled = true;
    document.getElementById('manage-tags-count').innerText = `Count: 0`;
    return;
  }
  
  manageEditBtn.disabled = false;
  manageDeleteBtn.disabled = false;

  const sortedTags = sortAlpha(AppState.metadata.tags[prop] || []);
  document.getElementById('manage-tags-count').innerText = `Count: ${sortedTags.length}`;

  let rowsHtml = "";
  sortedTags.forEach((tag, idx) => {
    rowsHtml += `<tr>
      <td style="text-align:center;"><input type="checkbox" class="manage-tag-cb" data-idx="${idx}"></td>
      <td><input type="text" class="manage-tag-input" data-idx="${idx}" value="${tag}" disabled></td>
    </tr>`;
  });
  
  manageTagsBody.innerHTML = rowsHtml;
}

// ==========================================================================
// GITHUB API: Dynamic Live Application Build Hash Deployment Fetcher
// ==========================================================================
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

// ==========================================================================
// MODAL UI: Dynamic Item Metadata Parameter Panel Details Populator
// ==========================================================================
function openModal(movieId, isEditable) {
  const movie = AppState.movies.find(m => m.id === movieId);
  AppState.activeModalMovieId = movieId;
  AppState.modalDraft = {}; 
  
  const editToggle = document.getElementById('modal-edit-toggle');
  const modalActions = document.getElementById('modal-actions');
  const editBtn = document.getElementById('modal-edit-btn');
  const updateBtn = document.getElementById('modal-update-btn');
  
  if (isEditable) {
    editToggle.classList.remove('hidden');
    editToggle.className = "fa-solid fa-pen-slash icon-btn"; 
    modalActions.classList.remove('hidden');
    editBtn.disabled = false;
    updateBtn.disabled = true; 
  } else {
    editToggle.classList.add('hidden'); 
    modalActions.classList.add('hidden');
  }
  
  document.getElementById('modal-title-input').value = movie.name;
  document.getElementById('modal-title-input').disabled = true;
  document.getElementById('modal-notes-input').value = movie.notes || '';
  document.getElementById('modal-notes-input').disabled = true;
  
  const container = document.getElementById('modal-dynamic-props');
  container.innerHTML = "";
  
  const sortedProps = sortAlpha(AppState.metadata.properties);

  sortedProps.forEach(prop => {
    let div = document.createElement('div');
    div.className = 'form-group';
    div.style.alignItems = "flex-start"; 
    
    let label = document.createElement('label');
    label.innerText = prop;
    label.style.marginTop = "8px"; 
    div.appendChild(label);
    
    const sortedTagsForProp = sortAlpha(AppState.metadata.tags[prop] || []);

    if (singleProps.includes(prop)) {
      let select = document.createElement('select');
      select.id = `modal-prop-${prop.replace(/\s+/g, '-')}`;
      select.disabled = true; 
      select.innerHTML = `<option value="">--</option>`;
      
      sortedTagsForProp.forEach(tag => {
        let isSelected = movie[prop] === tag;
        select.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
      });
      div.appendChild(select);
    } else {
      AppState.modalDraft[prop] = Array.isArray(movie[prop]) ? [...movie[prop]] : (movie[prop] ? [movie[prop]] : []);
      
      let wrapper = document.createElement('div');
      wrapper.className = 'modal-multi-prop-wrapper';
      wrapper.style.width = "100%";

      let tagsBox = document.createElement('div');
      tagsBox.className = 'tags-box';
      tagsBox.style.marginBottom = '0';
      wrapper.appendChild(tagsBox);

      let addSelect = document.createElement('select');
      addSelect.id = `modal-add-prop-${prop.replace(/\s+/g, '-')}`;
      addSelect.className = 'modal-add-prop-select'; 
      addSelect.disabled = true; 

      wrapper.appendChild(addSelect);
      div.appendChild(wrapper);

      const renderModalTags = () => {
          tagsBox.innerHTML = '';
          AppState.modalDraft[prop].forEach(tag => {
              let pill = document.createElement('div');
              pill.className = 'tag-pill';
              pill.innerHTML = `<span>${tag}</span><span class="tag-pill-remove" data-tag="${tag}">&times;</span>`;
              
              pill.querySelector('.tag-pill-remove').addEventListener('click', (e) => {
                  AppState.modalDraft[prop] = AppState.modalDraft[prop].filter(t => t !== tag);
                  renderModalTags();
              });
              tagsBox.appendChild(pill);
          });

          addSelect.innerHTML = `<option value="">Add ${prop}...</option>`;
          sortedTagsForProp.forEach(tag => {
              if (!AppState.modalDraft[prop].includes(tag)) {
                  addSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
              }
          });
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

  document.getElementById('details-modal').classList.remove('hidden');
}

// ==========================================================================
// OVERLAP RESOLUTION: Duplicate Record Detail Inspection Modal Populator
// ==========================================================================
function openDuplicateMergeModal(movieName, isDraftTable) {
    AppState.currentDuplicateGroup = AppState.movies.filter(m => 
        (m.name || '').toLowerCase().trim() === movieName.toLowerCase().trim() && 
        (isDraftTable ? m.isMerged === false : m.isMerged !== false)
    );

    document.getElementById('duplicate-modal-heading').innerText = AppState.currentDuplicateGroup[0].name;
    
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";

    AppState.currentDuplicateGroup.forEach((movie, idx) => {
        let div = document.createElement('div');
        div.style.marginBottom = "15px";
        div.style.padding = "10px";
        div.style.background = "var(--secondary)";
        div.style.borderRadius = "8px";
        
        let html = `<strong style="color: var(--primary);">Copy ${idx + 1}</strong><br>`;
        AppState.metadata.properties.forEach(prop => {
            if (movie[prop] && (!Array.isArray(movie[prop]) || movie[prop].length > 0)) {
                html += `<em style="font-weight: 500;">${prop}:</em> ${Array.isArray(movie[prop]) ? movie[prop].join(', ') : movie[prop]}<br>`;
            }
        });
        if(movie.notes) html += `<em style="font-weight: 500;">Notes:</em> ${movie.notes}<br>`;
        
        div.innerHTML = html;
        container.appendChild(div);
    });

    document.getElementById('duplicate-merge-btn').classList.remove('hidden');
    document.getElementById('duplicate-save-btn').classList.remove('hidden');
    document.getElementById('duplicate-save-btn').disabled = true; 
    document.getElementById('duplicate-merge-modal').classList.remove('hidden');
}

// ==========================================================================
// ACTIONS PIPELINE: Manual Conflict Aggregation & Input Builder Stage
// ==========================================================================
document.getElementById('duplicate-merge-btn').addEventListener('click', () => {
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";
    AppState.currentDuplicateDraft = {};

    AppState.metadata.properties.forEach(prop => {
        let allVals = [];
        AppState.currentDuplicateGroup.forEach(m => {
            if (m[prop]) {
                if (Array.isArray(m[prop])) allVals.push(...m[prop]);
                else allVals.push(m[prop]);
            }
        });

        allVals = [...new Set(allVals)];

        if (allVals.length > 0) {
            let div = document.createElement('div');
            div.className = 'form-group';
            
            if (singleProps.includes(prop)) {
                if (allVals.length === 1) {
                    AppState.currentDuplicateDraft[prop] = allVals[0];
                    div.innerHTML = `<label>${prop}</label><input type="text" value="${allVals[0]}" disabled>`;
                } else {
                    let html = `<label style="color:var(--primary)">${prop} (Choose one)</label><select id="dupe-conflict-${prop.replace(/\s+/g, '-')}" data-custom-wrapper="false" style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary); background: var(--surface); color: var(--text);">`;
                    allVals.forEach(v => { html += `<option value="${v}">${v}</option>`; });
                    html += `</select>`;
                    div.innerHTML = html;
                }
            } else {
                AppState.currentDuplicateDraft[prop] = allVals;
                div.innerHTML = `<label>${prop}</label><div class="tags-box">${allVals.map(v => `<span class="tag-pill">${v}</span>`).join('')}</div>`;
            }
            container.appendChild(div);
        }
    });

    let allNotes = AppState.currentDuplicateGroup.map(m => m.notes).filter(n => n && n.trim());
    if (allNotes.length > 0) {
        let combinedNotes = allNotes.join('\n---\n');
        AppState.currentDuplicateDraft.notes = combinedNotes;
        let div = document.createElement('div');
        div.className = 'form-group full-width';
        div.innerHTML = `<label>Notes</label><textarea id="dupe-merged-notes" rows="4" style="width:100%; border: 1px solid var(--muted); border-radius: 8px; padding: 8px;">${combinedNotes}</textarea>`;
        container.appendChild(div);
    }

    document.getElementById('duplicate-merge-btn').classList.add('hidden');
    document.getElementById('duplicate-save-btn').disabled = false;
});

// ==========================================================================
// CLOUD STORAGE: Commit Consolidated Conflict Resolution Object State
// ==========================================================================
document.getElementById('duplicate-save-btn').addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;

    AppState.metadata.properties.forEach(prop => {
        if (singleProps.includes(prop)) {
            let sel = document.getElementById(`dupe-conflict-${prop.replace(/\s+/g, '-')}`);
            if (sel) AppState.currentDuplicateDraft[prop] = sel.value;
        }
    });
    
    let notesEl = document.getElementById('dupe-merged-notes');
    if (notesEl) AppState.currentDuplicateDraft.notes = notesEl.value;

    const finalMovie = {
        name: AppState.currentDuplicateGroup[0].name,
        isMerged: AppState.currentDuplicateGroup[0].isMerged,
        ...AppState.currentDuplicateDraft
    };

    const batch = writeBatch(db);
    
    AppState.currentDuplicateGroup.forEach(m => {
        batch.delete(doc(db, "users", AppState.currentUserUid, "movies", m.id));
    });

    const newRef = doc(collection(db, "users", AppState.currentUserUid, "movies"));
    batch.set(newRef, finalMovie);

    try {
        await batch.commit();
        document.getElementById('duplicate-merge-modal').classList.add('hidden');
        loadMovies();
        alert("Duplicates successfully merged!");
    } catch (e) {
        console.error("Error merging duplicates: ", e);
    }
});

document.getElementById('close-duplicate-modal').addEventListener('click', () => {
  document.getElementById('duplicate-merge-modal').classList.add('hidden');
});

// ==========================================================================
// MODAL UI: Toggle Input Read-Only Status States (Unlock Edit Engine)
// ==========================================================================
function enableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen icon-btn"; 
  document.getElementById('modal-title-input').disabled = false;
  document.getElementById('modal-notes-input').disabled = false;
  
  document.querySelectorAll('#modal-dynamic-props select:not(.modal-add-prop-select)').forEach(s => DOMHelper.setSelectDisabled(s, false));
  document.querySelectorAll('.modal-multi-prop-wrapper').forEach(w => w.classList.add('is-editing'));
  document.querySelectorAll('.modal-add-prop-select').forEach(s => DOMHelper.setSelectDisabled(s, false));

  document.getElementById('modal-edit-btn').disabled = true;
  document.getElementById('modal-update-btn').disabled = false;
}

function disableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen-slash icon-btn"; 
  document.getElementById('modal-title-input').disabled = true;
  document.getElementById('modal-notes-input').disabled = true;
  
  document.querySelectorAll('#modal-dynamic-props select:not(.modal-add-prop-select)').forEach(s => DOMHelper.setSelectDisabled(s, true));
  document.querySelectorAll('.modal-multi-prop-wrapper').forEach(w => w.classList.remove('is-editing'));
  document.querySelectorAll('.modal-add-prop-select').forEach(s => DOMHelper.setSelectDisabled(s, true));

  document.getElementById('modal-edit-btn').disabled = false;
  document.getElementById('modal-update-btn').disabled = true;
}

document.getElementById('modal-edit-toggle').addEventListener('click', (e) => {
  if (e.target.classList.contains("fa-pen-slash")) enableEditingMode();
  else disableEditingMode();
});

document.getElementById('modal-edit-btn').addEventListener('click', () => { enableEditingMode(); });

// ==========================================================================
// CLOUD STORAGE: Update Specific Record Modification Element Mappings
// ==========================================================================
document.getElementById('modal-update-btn').addEventListener('click', async () => {
  if(!AppState.activeModalMovieId || !AppState.currentUserUid) return;
  const updatedData = {
    name: document.getElementById('modal-title-input').value,
    notes: document.getElementById('modal-notes-input').value
  };
  
  AppState.metadata.properties.forEach(prop => {
    if (singleProps.includes(prop)) {
      const select = document.getElementById(`modal-prop-${prop.replace(/\s+/g, '-')}`);
      updatedData[prop] = select.value || null;
    } else {
      updatedData[prop] = AppState.modalDraft[prop].length > 0 ? AppState.modalDraft[prop] : null;
    }
  });

  try {
    await updateDoc(doc(db, "users", AppState.currentUserUid, "movies", AppState.activeModalMovieId), updatedData);
    disableEditingMode(); 
    loadMovies();
  } catch (error) { console.error("Update error: ", error); }
});

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('details-modal').classList.add('hidden');
});

// ==========================================================================
// EVENTS PIPELINE: Bind UI Interactive Elements Click Listeners
// ==========================================================================
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
                await handleExport(AppState.movies, AppState.metadata.properties, format);
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
        const unmerged = AppState.movies.filter(m => m.isMerged === false);
        if(unmerged.length === 0) { alert("No user added movies to merge."); return; }
        
        const batch = writeBatch(db);
        unmerged.forEach(m => { batch.update(doc(db, "users", AppState.currentUserUid, "movies", m.id), { isMerged: true }); });
        
        await batch.commit();
        alert(`Successfully merged ${unmerged.length} movies!`);
        loadMovies();
    } else if (action === 'compare') {
        switchView('compare');
        renderCompareTable();
    } else if (action === 'view') {
        AppState.showingDuplicates = false;
        switchView(dbName);
    } else if (action === 'duplicates') {
        let targetMovies = AppState.movies.filter(m => dbName === 'commits' ? m.isMerged === false : m.isMerged !== false);
        const nameCounts = {};
        targetMovies.forEach(m => {
            const n = (m.name || '').toLowerCase().trim();
            nameCounts[n] = (nameCounts[n] || 0) + 1;
        });
        
        let dupesCount = 0;
        for(let n in nameCounts) {
            if(nameCounts[n] > 1) dupesCount++;
        }
        
        if (dupesCount === 0) {
            alert("No matches found.");
            DOMHelper.setSelectValue(document.getElementById('action-select'), "view"); 
            switchView(dbName); 
        } else {
            alert(`Found duplicates for ${dupesCount} movie(s).`);
            switchView(dbName); 
            AppState.showingDuplicates = true; 
            triggerActiveFilter(); 
        }
    }
  });

  // Bulk Automatic Duplicate Resolver Merging Loop Block
  mergeAllDupesBtn.addEventListener('click', async () => {
      if (!AppState.currentUserUid) return;

      const dbName = document.getElementById('db-select').value;
      const isDraftTable = dbName === 'commits';
      const activeTableBody = isDraftTable ? '#commits-body' : '#table-body';
      const checkedBoxes = document.querySelectorAll(`${activeTableBody} input[type="checkbox"]:checked`);

      if (checkedBoxes.length === 0) {
          alert("Please select movies to merge.");
          return;
      }

      if (confirm(`Merge ${checkedBoxes.length} selected duplicate groups? Conflicting single properties will auto-select the first available value.`)) {
          const batch = writeBatch(db);
          let mergedCount = 0;

          checkedBoxes.forEach(cb => {
              const movieName = cb.dataset.name;
              if (!movieName) return; 

              const duplicateGroup = AppState.movies.filter(m =>
                  (m.name || '').toLowerCase().trim() === movieName.toLowerCase().trim() &&
                  (isDraftTable ? m.isMerged === false : m.isMerged !== false)
              );

              if (duplicateGroup.length <= 1) return;

              let draft = {};
              AppState.metadata.properties.forEach(prop => {
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

              const finalMovie = {
                  name: duplicateGroup[0].name,
                  isMerged: duplicateGroup[0].isMerged,
                  ...draft
              };

              duplicateGroup.forEach(m => {
                  batch.delete(doc(db, "users", AppState.currentUserUid, "movies", m.id));
              });

              const newRef = doc(collection(db, "users", AppState.currentUserUid, "movies"));
              batch.set(newRef, finalMovie);
              mergedCount++;
          });

          if (mergedCount > 0) {
              try {
                  await batch.commit();
                  alert(`Successfully merged ${mergedCount} movie groups!`);
                  loadMovies();
              } catch (e) {
                  console.error("Batch merge error:", e);
              }
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

  // LOGOUT BUTTON HANDLER
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      alert("Failed to log out. Please try again.");
    }
  });

  document.getElementById('nav-movies').addEventListener('click', () => switchView('input'));
  document.getElementById('nav-songs').addEventListener('click', () => alert('Songs Feature Coming Soon!'));
  document.getElementById('nav-books').addEventListener('click', () => alert('Books Feature Coming Soon!'));
  document.getElementById('nav-travel').addEventListener('click', () => alert('Travel Feature Coming Soon!'));
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
      label.innerText = AppState.isBatchMode ? 'Batch Import' : 'Individual Update';
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
    
    AppState.bulkMoviesDraft = parseBulkText(text);

    if(AppState.bulkMoviesDraft.length > 0) {
      document.getElementById('bulk-modal').classList.add('hidden');
      document.getElementById('bulk-input-text').value = '';
      renderBatchPreviewTable();
    } else { 
      alert("No valid lines to process."); 
    }
  });

  document.getElementById('select-all-batch').addEventListener('change', (e) => {
    document.querySelectorAll('.batch-preview-checkbox').forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById('update-selected-btn').addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.batch-preview-checkbox:checked');
      if (checkedBoxes.length === 0) { alert("Please select movies from the table to update."); return; }

      const notesVal = document.getElementById('batch-notes').value.trim();

      checkedBoxes.forEach(cb => {
          const idx = parseInt(cb.dataset.index);
          
          Object.keys(AppState.currentMovieDraft).forEach(prop => {
              if (Array.isArray(AppState.currentMovieDraft[prop])) {
                  AppState.bulkMoviesDraft[idx][prop] = [...AppState.currentMovieDraft[prop]];
              } else {
                  AppState.bulkMoviesDraft[idx][prop] = AppState.currentMovieDraft[prop];
              }
          });
          
          if (notesVal) {
              AppState.bulkMoviesDraft[idx].notes = notesVal;
          }
      });

      alert(`Updated tags and notes for ${checkedBoxes.length} selected movies.`);
  });


  document.getElementById('add-prop-select').addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    const tagSelect = document.getElementById('add-tag-select');
    const tagsBox = document.getElementById('input-tags-box');
    
    if (selectedProp) {
      DOMHelper.setSelectDisabled(tagSelect, false);
      const sortedTagsForProp = sortAlpha(AppState.metadata.tags[selectedProp] || []);

      if (singleProps.includes(selectedProp)) {
        tagsBox.classList.add('hidden');
        DOMHelper.setSelectMultiple(tagSelect, false);
        tagSelect.innerHTML = `<option value="">Tag</option>`;
        
        sortedTagsForProp.forEach(tag => {
          let isSelected = AppState.currentMovieDraft[selectedProp] === tag;
          tagSelect.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
        });
      } else {
        tagsBox.classList.remove('hidden');
        DOMHelper.setSelectMultiple(tagSelect, false);
        tagSelect.innerHTML = `<option value="">Add Tag...</option>`;
        
        if (!AppState.currentMovieDraft[selectedProp]) AppState.currentMovieDraft[selectedProp] = [];
        if (!Array.isArray(AppState.currentMovieDraft[selectedProp])) {
           AppState.currentMovieDraft[selectedProp] = [AppState.currentMovieDraft[selectedProp]];
        }

        sortedTagsForProp.forEach(tag => {
          if (!AppState.currentMovieDraft[selectedProp].includes(tag)) {
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
      const tags = AppState.currentMovieDraft[prop] || [];
      
      tags.forEach(tag => {
          const pill = document.createElement('div');
          pill.className = 'tag-pill';
          pill.innerHTML = `<span>${tag}</span><span class="tag-pill-remove" data-tag="${tag}">&times;</span>`;
          tagsBox.appendChild(pill);
      });
      
      tagsBox.querySelectorAll('.tag-pill-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const tagToRemove = e.target.getAttribute('data-tag');
              AppState.currentMovieDraft[prop] = AppState.currentMovieDraft[prop].filter(t => t !== tagToRemove);
              document.getElementById('add-prop-select').dispatchEvent(new Event('change')); 
          });
      });
  }

  document.getElementById('add-tag-select').addEventListener('change', (e) => {
    const prop = document.getElementById('add-prop-select').value;
    if (!prop) return;
    
    if (singleProps.includes(prop)) {
      const tag = e.target.value;
      if (tag) AppState.currentMovieDraft[prop] = tag;
      else delete AppState.currentMovieDraft[prop]; 
    } else {
      const tag = e.target.value;
      if (tag) {
          if (!AppState.currentMovieDraft[prop]) AppState.currentMovieDraft[prop] = [];
          if (!AppState.currentMovieDraft[prop].includes(tag)) {
            AppState.currentMovieDraft[prop].push(tag);
          }
          document.getElementById('add-prop-select').dispatchEvent(new Event('change'));
      }
    }
  });

  document.getElementById('save-movie-btn').addEventListener('click', async () => {
      if (!AppState.currentUserUid) return;

      const movieData = {
          name: document.getElementById('movie-name').value.trim(),
          notes: document.getElementById('individual-notes').value.trim(),
          ...AppState.currentMovieDraft 
      };

      try {
          await saveIndividualMovie(db, AppState.currentUserUid, movieData);
          
          document.getElementById('movie-name').value = '';
          document.getElementById('individual-notes').value = '';
          DOMHelper.setSelectValue(document.getElementById('add-prop-select'), '');
          const tagSelect = document.getElementById('add-tag-select');
          tagSelect.innerHTML = `<option value="">Tag</option>`;
          DOMHelper.setSelectDisabled(tagSelect, true);
          document.getElementById('input-tags-box').classList.add('hidden');
          document.getElementById('input-tags-box').innerHTML = '';
          
          AppState.currentMovieDraft = {}; 
          loadMovies(); 
          alert("Movie saved to Temporary Database.");
      } catch (e) {
          if (e.message === "Title is required!") alert(e.message);
          else console.error("Error adding document: ", e); 
      }
  });

  document.getElementById('save-batch-btn').addEventListener('click', async () => {
      try {
          const count = await saveBulkMovies(db, AppState.currentUserUid, AppState.bulkMoviesDraft);
          
          document.getElementById('batch-notes').value = '';
          DOMHelper.setSelectValue(document.getElementById('add-prop-select'), '');
          const tagSelect = document.getElementById('add-tag-select');
          tagSelect.innerHTML = `<option value="">Tag</option>`;
          DOMHelper.setSelectDisabled(tagSelect, true);
          document.getElementById('input-tags-box').classList.add('hidden');
          document.getElementById('input-tags-box').innerHTML = '';
          
          AppState.currentMovieDraft = {}; 
          AppState.bulkMoviesDraft = []; 
          renderBatchPreviewTable();
          loadMovies(); 
          alert(`Successfully saved ${count} movies to Temporary Database.`);
      } catch(e) { 
          if (e.message.includes("No movies") || e.message.includes("not authenticated")) alert(e.message);
          else console.error("Batch save error: ", e); 
      }
  });

  document.getElementById('compare-delete-btn').addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const checkedBoxes = document.querySelectorAll('.compare-tag-cb:checked');
    if (checkedBoxes.length === 0) { alert("Please select tags to delete."); return; }

    if (confirm(`Delete ${checkedBoxes.length} selected tag(s)?`)) {
        const batch = writeBatch(db);
        const updates = {};

        checkedBoxes.forEach(cb => {
            const movieId = cb.dataset.movieId;
            const prop = cb.dataset.prop;
            const valToRemove = cb.dataset.val;

            if (!updates[movieId]) {
                const movie = AppState.movies.find(m => m.id === movieId);
                if (movie) updates[movieId] = { ...movie };
            }

            if (updates[movieId]) {
                let currentVal = updates[movieId][prop];
                if (Array.isArray(currentVal)) {
                    updates[movieId][prop] = currentVal.filter(v => v !== valToRemove);
                    if (updates[movieId][prop].length === 0) updates[movieId][prop] = null;
                } else if (currentVal === valToRemove) {
                    updates[movieId][prop] = null;
                }
            }
        });

        let updateCount = 0;
        Object.keys(updates).forEach(movieId => {
            const dataToUpdate = { ...updates[movieId] };
            delete dataToUpdate.id; 
            batch.update(doc(db, "users", AppState.currentUserUid, "movies", movieId), dataToUpdate);
            updateCount++;
        });

        if (updateCount > 0) {
            try {
                await batch.commit();
                loadMovies(); 
                document.getElementById('execute-action-btn').click(); 
            } catch(e) { console.error("Delete tags error:", e); }
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
    
    if(checkedBoxes.length === 0) { alert("Please select entries to delete."); return; }
    
    if(confirm(`Delete ${checkedBoxes.length} selected entries?`)) {
      const batch = writeBatch(db);
      let hasDeletions = false;

      checkedBoxes.forEach(cb => { 
        if (AppState.showingDuplicates && cb.classList.contains('group-checkbox')) {
            const movieName = cb.dataset.name;
            const isDraftTable = activeTableBody === '#commits-body';
            const duplicateGroup = AppState.movies.filter(m =>
                (m.name || '').toLowerCase().trim() === movieName.toLowerCase().trim() &&
                (isDraftTable ? m.isMerged === false : m.isMerged !== false)
            );
            duplicateGroup.forEach(m => {
                batch.delete(doc(db, "users", AppState.currentUserUid, "movies", m.id));
                hasDeletions = true;
            });
        } else if (cb.dataset.id) {
            batch.delete(doc(db, "users", AppState.currentUserUid, "movies", cb.dataset.id)); 
            hasDeletions = true;
        }
      });

      if (hasDeletions) {
          await batch.commit();
          loadMovies();
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
    const sortedProps = sortAlpha(AppState.metadata.properties);
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
    
    AppState.metadata.tags[prop] = newTags;
    await saveMetadata();
    renderUI(); 
    renderManageTagsTable(); 
  });

  manageDeleteBtn.addEventListener('click', async () => {
    if (!AppState.currentUserUid) return;
    const prop = managePropSelect.value;
    if (!prop) return;

    const checked = document.querySelectorAll('.manage-tag-cb:checked');
    if (checked.length === 0) return;

    if (confirm(`Delete ${checked.length} tags?`)) {
      const indicesToRemove = Array.from(checked).map(cb => parseInt(cb.dataset.idx));
      AppState.metadata.tags[prop] = AppState.metadata.tags[prop].filter((_, idx) => !indicesToRemove.includes(idx));
      
      await saveMetadata();
      renderUI();
      renderManageTagsTable();
    }
  });

  customAddBtn.addEventListener('click', async () => {
    const propChoice = document.getElementById('customize-prop-select').value;
    const tagStringRaw = customTagInput.value;
    if (!tagStringRaw.trim()) return;

    const tagsToAdd = tagStringRaw.split(/,|\n/).map(t => t.trim()).filter(t => t);
    if (tagsToAdd.length === 0) return;

    let updated = false;

    if (propChoice === "Property") {
      tagsToAdd.forEach(tagString => {
        if (!AppState.metadata.properties.includes(tagString)) {
          AppState.metadata.properties.push(tagString);
          AppState.metadata.tags[tagString] = [];
          updated = true;
        }
      });
    } else {
      if (!AppState.metadata.tags[propChoice]) AppState.metadata.tags[propChoice] = [];
      tagsToAdd.forEach(tagString => {
        if (!AppState.metadata.tags[propChoice].includes(tagString)) {
          AppState.metadata.tags[propChoice].push(tagString);
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
      alert("Updated");
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
      const sortedTagsForProp = sortAlpha(AppState.metadata.tags[selectedProp] || []);
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
  
  document.getElementById('search-input').addEventListener('input', () => {
    AppState.currentPage = 1;
    triggerActiveFilter();
  });

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

// ==========================================================================
// UTILITIES: Router Layout Switch Panel Engine Overlay Triggers
// ==========================================================================
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

// ==========================================================================
// FILTRATION PIPELINE: Query Matcher & External Sorting Integration Engine
// ==========================================================================
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
          let targetDbMovies = isCommitsOpen ? AppState.movies.filter(m => m.isMerged === false) : AppState.movies.filter(m => m.isMerged !== false);

          const sortSelectNode = document.getElementById('sort-select');
          const sortBy = sortSelectNode ? sortSelectNode.value : 'name-asc';
          
          targetDbMovies = sortMovies(targetDbMovies, sortBy, AppState.metadata.properties);

          const nameCounts = {};
          const nameToMovies = {};
          const orderedNames = []; 

          targetDbMovies.forEach(m => {
              const n = (m.name || '').toLowerCase().trim();
              if(!nameCounts[n]) { 
                  nameCounts[n] = 0; 
                  nameToMovies[n] = []; 
                  orderedNames.push(n);
              }
              nameCounts[n]++;
              nameToMovies[n].push(m);
          });
          
          const groupList = [];
          const orderedLen = orderedNames.length;
          for (let i = 0; i < orderedLen; i++) {
              const n = orderedNames[i];
              if (nameCounts[n] > 1) {
                  groupList.push({
                      id: `group_${n}`,
                      name: `${nameToMovies[n][0].name} (${nameCounts[n]})`,
                      realName: nameToMovies[n][0].name
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

      let subsetMovies = isCommitsOpen ? AppState.movies.filter(m => m.isMerged === false) : AppState.movies.filter(m => m.isMerged !== false);

      const targetFields = ["name"];
      subsetMovies = searchDatabase(searchQuery, subsetMovies, targetFields);
      subsetMovies = filterMoviesByProperty(subsetMovies, filterBy, filterTag);

      const sortSelectNode = document.getElementById('sort-select');
      const sortBy = sortSelectNode ? sortSelectNode.value : 'name-asc';
      
      subsetMovies = sortMovies(subsetMovies, sortBy, AppState.metadata.properties);

      const totalPages = Math.ceil(subsetMovies.length / AppState.itemsPerPage) || 1;
      if (AppState.currentPage > totalPages) AppState.currentPage = totalPages;

      const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
      const pagedMovies = subsetMovies.slice(startIndex, startIndex + AppState.itemsPerPage);

      document.getElementById('prev-page-btn').disabled = AppState.currentPage === 1;
      document.getElementById('next-page-btn').disabled = AppState.currentPage === totalPages;
      document.getElementById('page-indicator').innerText = `${AppState.currentPage}/${totalPages}`;

      if (isCommitsOpen) {
          document.getElementById('commits-count').innerText = `${subsetMovies.length}`;
          renderTable(pagedMovies, "commits-body", true, startIndex);
      } else {
          document.getElementById('main-count').innerText = `${subsetMovies.length}`;
          renderTable(pagedMovies, "table-body", false, startIndex);
      }
  }
}
