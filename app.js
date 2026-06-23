import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { handleExport } from "./library.js"; 

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

// Global Authentication & Pagination States
let currentUserUid = null;
let currentPage = 1;
const itemsPerPage = 50;

// Universal Alphabetical Sorter
const sortAlpha = (arr) => [...arr].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

// Dynamic Year Array Generation (2030 down to 1950)
const yearsArray = [];
for (let y = 2030; y >= 1950; y--) {
  yearsArray.push(y.toString());
}

// Data Handling Constants (Strict Single Tags)
const singleProps = ["Name", "Rating", "Year", "Language", "status", "Status", "Category"];

// Default Application State 
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

let appMetadata = JSON.parse(JSON.stringify(defaultMetadata));
let movies = [];
let isInitialized = false; 
let currentMovieDraft = {}; 
let bulkMoviesDraft = []; 
let activeModalMovieId = null;
let modalDraft = {}; 
let showingDuplicates = false;
let isBatchMode = false;

// Duplicate Action Global Drafts
let currentDuplicateGroup = [];
let currentDuplicateDraft = {};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const landingPanel = document.getElementById('landing-panel');
const inputPanel = document.getElementById('input-panel');
const databasePanel = document.getElementById('database-panel');
const commitsPanel = document.getElementById('commits-panel');
const comparePanel = document.getElementById('compare-panel');
const sharedFilterBar = document.getElementById('shared-filter-bar');
const deleteBtn = document.getElementById('delete-drafts-btn');
const analyzeBtn = document.getElementById('analyze-btn');
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

// ----------------------------------------------------
// CUSTOM DROPDOWN UI INJECTION (Prototype Overrides)
// ----------------------------------------------------
function initializeCustomDropdowns() {
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
      get() { return valueDesc.get.call(this); },
      set(val) {
          valueDesc.set.call(this, val);
          this.dispatchEvent(new CustomEvent('sync-custom-select'));
      }
  });

  const disabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');
  Object.defineProperty(HTMLSelectElement.prototype, 'disabled', {
      get() { return disabledDesc.get.call(this); },
      set(val) {
          disabledDesc.set.call(this, val);
          this.dispatchEvent(new CustomEvent('sync-custom-select'));
      }
  });

  const removeAttr = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function(name) {
      removeAttr.call(this, name);
      if (this.tagName === 'SELECT' && name === 'multiple') {
          this.dispatchEvent(new CustomEvent('sync-custom-select'));
      }
  };

  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, val) {
      setAttr.call(this, name, val);
      if (this.tagName === 'SELECT' && name === 'multiple') {
          this.dispatchEvent(new CustomEvent('sync-custom-select'));
      }
  };

  function applyCustomSelect(select) {
      if (select.dataset.customWrapper || select.dataset.customWrapper === "false") return;
      select.dataset.customWrapper = "true";
      select.classList.add('customized-native');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      
      // UPDATED: Bind sort wrapper constraint logic footprint
      if (select.id === 'sort-select') {
          wrapper.style.cssText = "flex: unset; width: 36px; height: 36px; position: relative;";
      }
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select); 

      const trigger = document.createElement('div');
      
      // UPDATED: Injected symbol structure for the custom sort wrapper trigger element
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
      
      // UPDATED: Aligned sort modal options container panel positioning specs
      if (select.id === 'sort-select') {
          optionsContainer.style.cssText = "position: absolute; top: calc(100% + 4px); right: 0; left: auto; width: 140px; background-color: var(--surface); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--muted); z-index: 9999; flex-direction: column; padding: 4px 0;";
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

          // UPDATED: Added symbol updater tracking sync loop for icons inside sort dropdown actions
          if (select.id === 'sort-select') {
              const sortIcon = trigger.querySelector('#sort-icon');
              if (sortIcon) {
                  if (selectedVal === 'a-z') { sortIcon.className = "fa-solid fa-arrow-down-a-z"; trigger.title = "Sort: A-Z"; }
                  else if (selectedVal === 'z-a') { sortIcon.className = "fa-solid fa-arrow-down-z-a"; trigger.title = "Sort: Z-A"; }
                  else if (selectedVal === 'rating') { sortIcon.className = "fa-solid fa-star"; trigger.title = "Sort: Rating"; }
                  else if (selectedVal === 'release-year') { sortIcon.className = "fa-solid fa-calendar-days"; trigger.title = "Sort: Release Year"; }
                  else if (selectedVal === 'watched-year') { sortIcon.className = "fa-solid fa-eye"; trigger.title = "Sort: Watched Year"; }
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

// ----------------------------------------------------
// AUTHENTICATION LOGIC 
// ----------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    await init();
  } else {
    currentUserUid = null;
    document.getElementById('login-wrapper').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
    movies = [];
    appMetadata = JSON.parse(JSON.stringify(defaultMetadata));
  }
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  if (!email || !password) { alert("Please enter both email and password."); return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  } catch (error) { alert("Login failed: " + error.message); }
});

logoutBtn.addEventListener('click', () => {
  signOut(auth).catch(error => console.error("Logout Error:", error));
});

// ----------------------------------------------------
// MAIN APP LOGIC
// ----------------------------------------------------
async function init() {
  initializeCustomDropdowns(); 
  await loadPreferencesAndMetadata();
  updateActionDropdown(); 
  renderUI();
  await loadMovies();
  if (!isInitialized) {
    setupEventListeners();
    isInitialized = true;
  }
}

async function loadPreferencesAndMetadata() {
  if (!currentUserUid) return;
  
  const metaRef = doc(db, "users", currentUserUid, "settings", "appMetadata");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) { 
    appMetadata = metaSnap.data(); 
    
    let forceSave = false;
    if (appMetadata.properties.includes("Watch Status")) {
      appMetadata.properties = appMetadata.properties.filter(p => p !== "Watch Status");
      delete appMetadata.tags["Watch Status"];
      forceSave = true;
    }

    if (!appMetadata.tags["Year"] || appMetadata.tags["Year"].length < 80) {
      appMetadata.tags["Year"] = yearsArray;
      forceSave = true;
    }
    
    if (forceSave) await setDoc(metaRef, appMetadata, { merge: true });

  } else { 
    appMetadata = JSON.parse(JSON.stringify(defaultMetadata));
    await setDoc(metaRef, appMetadata); 
  }

  const prefRef = doc(db, "users", currentUserUid, "settings", "preferences");
  const prefSnap = await getDoc(prefRef);
  
  let startView = 'landing';
  if (prefSnap.exists()) {
    const prefs = prefSnap.data();
    if (prefs.theme) {
      document.body.setAttribute('data-theme', prefs.theme);
      document.getElementById('theme-select').value = prefs.theme;
    }
    if (prefs.view) startView = prefs.view;
  }
  
  switchView(startView, false); 
}

async function saveMetadata() {
  if (!currentUserUid) return;
  await setDoc(doc(db, "users", currentUserUid, "settings", "appMetadata"), appMetadata);
}

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

function renderUI() {
  const prevAddChoice = document.getElementById('add-prop-select').value;
  const prevCustChoice = document.getElementById('customize-prop-select').value;
  const prevFiltChoice = document.getElementById('filter-by-select').value;
  
  const sortedProps = sortAlpha(appMetadata.properties);

  const addPropSelect = document.getElementById('add-prop-select');
  addPropSelect.innerHTML = `<option value="">Properties</option>`;
  sortedProps.forEach(prop => { addPropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (appMetadata.properties.includes(prevAddChoice)) addPropSelect.value = prevAddChoice;

  const customizePropSelect = document.getElementById('customize-prop-select');
  customizePropSelect.innerHTML = `<option value="Property">Properties</option>`;
  sortedProps.forEach(prop => { customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (prevCustChoice) customizePropSelect.value = prevCustChoice;

  const filterBySelect = document.getElementById('filter-by-select');
  filterBySelect.innerHTML = `<option value="">Filter By</option>`;
  sortedProps.forEach(prop => { filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (appMetadata.properties.includes(prevFiltChoice)) filterBySelect.value = prevFiltChoice;
}

async function loadMovies() {
  if (!currentUserUid) return;
  const querySnapshot = await getDocs(collection(db, "users", currentUserUid, "movies"));
  movies = [];
  querySnapshot.forEach((doc) => { movies.push({ id: doc.id, ...doc.data() }); });
  triggerActiveFilter();
}

function renderTable(dataToRender, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  dataToRender.forEach(movie => {
    let row = `<tr>
      <td>${sl++}</td>
      <td><span class="clickable-title" data-id="${movie.id}" data-draft="${isDraftTable}">${movie.name || '-'}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'}" data-id="${movie.id}"></td>
    </tr>`;
    tbody.innerHTML += row;
  });

  document.querySelectorAll(`#${tbodyId} .clickable-title`).forEach(el => {
    el.addEventListener('click', (e) => {
      openModal(e.target.dataset.id, e.target.dataset.draft === "true");
    });
  });
}

function renderGroupTable(groups, tbodyId, isDraftTable, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";
  let sl = startIndex + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  groups.forEach(group => {
    let row = `<tr>
      <td>${sl++}</td>
      <td><span class="clickable-group-title" data-name="${group.realName.replace(/"/g, '&quot;')}" data-draft="${isDraftTable}">${group.name}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'} group-checkbox" data-name="${group.realName.replace(/"/g, '&quot;')}"></td>
    </tr>`;
    tbody.innerHTML += row;
  });

  document.querySelectorAll(`#${tbodyId} .clickable-group-title`).forEach(el => {
    el.addEventListener('click', (e) => {
      openDuplicateMergeModal(e.target.dataset.name, e.target.dataset.draft === "true");
    });
  });
}

function renderBatchPreviewTable() {
  bulkMoviesDraft.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
  
  const tbody = document.getElementById('batch-preview-body');
  tbody.innerHTML = '';
  bulkMoviesDraft.forEach((movie, index) => {
      tbody.innerHTML += `
      <tr>
          <td>${index + 1}</td>
          <td>${movie.name}</td>
          <td style="text-align:right;"><input type="checkbox" class="batch-preview-checkbox" data-index="${index}"></td>
      </tr>`;
  });
  document.getElementById('select-all-batch').checked = false;
  document.getElementById('batch-count').innerText = `Count: ${bulkMoviesDraft.length}`;
}

function renderCompareTable() {
  const tbody = document.getElementById('compare-body');
  tbody.innerHTML = '';
  const tempMovies = movies.filter(m => m.isMerged === false);
  const mainMovies = movies.filter(m => m.isMerged !== false);

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

  matches.forEach(tMovie => {
    const mMovie = mainMovies.find(m => m.name.toLowerCase().trim() === tMovie.name.toLowerCase().trim());
    
    let rowsHtml = `<tr><td colspan="3" style="background: var(--secondary); color: var(--text); font-weight: bold; text-align: center; font-size: 1.05rem;">${tMovie.name}</td></tr>`;
    
    appMetadata.properties.forEach(p => {
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
    
    tbody.innerHTML += rowsHtml;
  });
}

function renderManageTagsTable() {
  const prop = managePropSelect.value;
  manageTagsBody.innerHTML = '';
  manageEditBtn.classList.remove('hidden');
  manageSaveBtn.classList.add('hidden');
  
  if (!prop) {
    manageEditBtn.disabled = true;
    manageDeleteBtn.disabled = true;
    document.getElementById('manage-tags-count').innerText = `Count: 0`;
    return;
  }
  
  manageEditBtn.disabled = false;
  manageDeleteBtn.disabled = false;

  const sortedTags = sortAlpha(appMetadata.tags[prop] || []);
  document.getElementById('manage-tags-count').innerText = `Count: ${sortedTags.length}`;

  sortedTags.forEach((tag, idx) => {
    const row = `<tr>
      <td style="text-align:center;"><input type="checkbox" class="manage-tag-cb" data-idx="${idx}"></td>
      <td><input type="text" class="manage-tag-input" data-idx="${idx}" value="${tag}" disabled></td>
    </tr>`;
    manageTagsBody.innerHTML += row;
  });
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

// ----------------------------------------------------
// MODAL LOGIC 
// ----------------------------------------------------
function openModal(movieId, isEditable) {
  const movie = movies.find(m => m.id === movieId);
  activeModalMovieId = movieId;
  modalDraft = {}; 
  
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
  
  const sortedProps = sortAlpha(appMetadata.properties);

  sortedProps.forEach(prop => {
    let div = document.createElement('div');
    div.className = 'form-group';
    div.style.alignItems = "flex-start"; 
    
    let label = document.createElement('label');
    label.innerText = prop;
    label.style.marginTop = "8px"; 
    div.appendChild(label);
    
    const sortedTagsForProp = sortAlpha(appMetadata.tags[prop] || []);

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
      modalDraft[prop] = Array.isArray(movie[prop]) ? [...movie[prop]] : (movie[prop] ? [movie[prop]] : []);
      
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
          modalDraft[prop].forEach(tag => {
              let pill = document.createElement('div');
              pill.className = 'tag-pill';
              pill.innerHTML = `<span>${tag}</span><span class="tag-pill-remove" data-tag="${tag}">&times;</span>`;
              
              pill.querySelector('.tag-pill-remove').addEventListener('click', (e) => {
                  modalDraft[prop] = modalDraft[prop].filter(t => t !== tag);
                  renderModalTags();
              });
              tagsBox.appendChild(pill);
          });

          addSelect.innerHTML = `<option value="">Add ${prop}...</option>`;
          sortedTagsForProp.forEach(tag => {
              if (!modalDraft[prop].includes(tag)) {
                  addSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
              }
          });
      };

      addSelect.addEventListener('change', (e) => {
          if (e.target.value) {
              modalDraft[prop].push(e.target.value);
              renderModalTags();
              e.target.value = '';
              e.target.dispatchEvent(new Event('change'));
          }
      });

      renderModalTags(); 
    }
    
    container.appendChild(div);
  });

  document.getElementById('details-modal').classList.remove('hidden');
}

// ----------------------------------------------------
// DUPLICATE MERGE MODAL LOGIC 
// ----------------------------------------------------
function openDuplicateMergeModal(movieName, isDraftTable) {
    currentDuplicateGroup = movies.filter(m => 
        (m.name || '').toLowerCase().trim() === movieName.toLowerCase().trim() && 
        (isDraftTable ? m.isMerged === false : m.isMerged !== false)
    );

    document.getElementById('duplicate-modal-heading').innerText = currentDuplicateGroup[0].name;
    
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";

    currentDuplicateGroup.forEach((movie, idx) => {
        let div = document.createElement('div');
        div.style.marginBottom = "15px";
        div.style.padding = "10px";
        div.style.background = "var(--secondary)";
        div.style.borderRadius = "8px";
        
        let html = `<strong style="color: var(--primary);">Copy ${idx + 1}</strong><br>`;
        appMetadata.properties.forEach(prop => {
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

document.getElementById('duplicate-merge-btn').addEventListener('click', () => {
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";
    currentDuplicateDraft = {};

    appMetadata.properties.forEach(prop => {
        let allVals = [];
        currentDuplicateGroup.forEach(m => {
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
                    currentDuplicateDraft[prop] = allVals[0];
                    div.innerHTML = `<label>${prop}</label><input type="text" value="${allVals[0]}" disabled>`;
                } else {
                    let html = `<label style="color:var(--primary)">${prop} (Choose one)</label><select id="dupe-conflict-${prop.replace(/\s+/g, '-')}" data-custom-wrapper="false" style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary); background: var(--surface); color: var(--text);">`;
                    allVals.forEach(v => { html += `<option value="${v}">${v}</option>`; });
                    html += `</select>`;
                    div.innerHTML = html;
                }
            } else {
                currentDuplicateDraft[prop] = allVals;
                div.innerHTML = `<label>${prop}</label><div class="tags-box">${allVals.map(v => `<span class="tag-pill">${v}</span>`).join('')}</div>`;
            }
            container.appendChild(div);
        }
    });

    let allNotes = currentDuplicateGroup.map(m => m.notes).filter(n => n && n.trim());
    if (allNotes.length > 0) {
        let combinedNotes = allNotes.join('\n---\n');
        currentDuplicateDraft.notes = combinedNotes;
        let div = document.createElement('div');
        div.className = 'form-group full-width';
        div.innerHTML = `<label>Notes</label><textarea id="dupe-merged-notes" rows="4" style="width:100%; border: 1px solid var(--muted); border-radius: 8px; padding: 8px;">${combinedNotes}</textarea>`;
        container.appendChild(div);
    }

    document.getElementById('duplicate-merge-btn').classList.add('hidden');
    document.getElementById('duplicate-save-btn').disabled = false;
});

document.getElementById('duplicate-save-btn').addEventListener('click', async () => {
    if (!currentUserUid) return;

    appMetadata.properties.forEach(prop => {
        if (singleProps.includes(prop)) {
            let sel = document.getElementById(`dupe-conflict-${prop.replace(/\s+/g, '-')}`);
            if (sel) currentDuplicateDraft[prop] = sel.value;
        }
    });
    
    let notesEl = document.getElementById('dupe-merged-notes');
    if (notesEl) currentDuplicateDraft.notes = notesEl.value;

    const finalMovie = {
        name: currentDuplicateGroup[0].name,
        isMerged: currentDuplicateGroup[0].isMerged,
        ...currentDuplicateDraft
    };

    const batch = writeBatch(db);
    
    currentDuplicateGroup.forEach(m => {
        batch.delete(doc(db, "users", currentUserUid, "movies", m.id));
    });

    const newRef = doc(collection(db, "users", currentUserUid, "movies"));
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

function enableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen icon-btn"; 
  document.getElementById('modal-title-input').disabled = false;
  document.getElementById('modal-notes-input').disabled = false;
  
  document.querySelectorAll('#modal-dynamic-props select:not(.modal-add-prop-select)').forEach(s => s.disabled = false);
  document.querySelectorAll('.modal-multi-prop-wrapper').forEach(w => w.classList.add('is-editing'));
  document.querySelectorAll('.modal-add-prop-select').forEach(s => s.disabled = false);

  document.getElementById('modal-edit-btn').disabled = true;
  document.getElementById('modal-update-btn').disabled = false;
}

function disableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen-slash icon-btn"; 
  document.getElementById('modal-title-input').disabled = true;
  document.getElementById('modal-notes-input').disabled = true;
  
  document.querySelectorAll('#modal-dynamic-props select:not(.modal-add-prop-select)').forEach(s => s.disabled = true);
  document.querySelectorAll('.modal-multi-prop-wrapper').forEach(w => w.classList.remove('is-editing'));
  document.querySelectorAll('.modal-add-prop-select').forEach(s => s.disabled = true);

  document.getElementById('modal-edit-btn').disabled = false;
  document.getElementById('modal-update-btn').disabled = true;
}

document.getElementById('modal-edit-toggle').addEventListener('click', (e) => {
  if (e.target.classList.contains("fa-pen-slash")) enableEditingMode();
  else disableEditingMode();
});

document.getElementById('modal-edit-btn').addEventListener('click', () => { enableEditingMode(); });

document.getElementById('modal-update-btn').addEventListener('click', async () => {
  if(!activeModalMovieId || !currentUserUid) return;
  const updatedData = {
    name: document.getElementById('modal-title-input').value,
    notes: document.getElementById('modal-notes-input').value
  };
  
  appMetadata.properties.forEach(prop => {
    if (singleProps.includes(prop)) {
      const select =
