import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Global Authentication State
let currentUserUid = null;

// Dynamic Year Array Generation (2030 down to 1950)
const yearsArray = [];
for (let y = 2030; y >= 1950; y--) {
  yearsArray.push(y.toString());
}

// Data Handling Constants (Strict Single Tags)
const singleProps = ["Name", "Rating", "Year", "Language", "status", "Status"];

// Default Application State 
const defaultMetadata = {
  properties: ["Rating", "Genre", "Year", "Language", "Director", "Cast"],
  tags: {
    "Rating": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "Genre": ["Action", "Drama", "Sci-Fi", "Comedy", "Thriller"],
    "Year": yearsArray, 
    "Language": ["English", "Spanish", "Hindi", "French", "Korean"],
    "Director": [],
    "Cast": []
  }
};

let appMetadata = JSON.parse(JSON.stringify(defaultMetadata));
let movies = [];
let isInitialized = false; 
let currentMovieDraft = {}; 
let bulkMoviesDraft = []; 
let activeModalMovieId = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const landingPanel = document.getElementById('landing-panel');
const inputPanel = document.getElementById('input-panel');
const databasePanel = document.getElementById('database-panel');
const commitsPanel = document.getElementById('commits-panel');
const comparePanel = document.getElementById('compare-panel');
const sharedFilterBar = document.getElementById('shared-filter-bar');
const deleteBtn = document.getElementById('delete-drafts-btn');
const discardBtn = document.getElementById('discard-all-btn');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');

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
      if (select.dataset.customWrapper) return;
      select.dataset.customWrapper = "true";
      select.classList.add('customized-native');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select); 

      const trigger = document.createElement('div');
      trigger.className = 'custom-select-trigger';
      trigger.innerHTML = `<span class="custom-select-text"></span><i class="fa-solid fa-chevron-down custom-select-icon"></i>`;
      wrapper.appendChild(trigger);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-select-options';
      wrapper.appendChild(optionsContainer);

      const textEl = trigger.querySelector('.custom-select-text');

      function syncUI() {
          if (select.hasAttribute('multiple')) {
              wrapper.classList.add('is-multiple');
              return;
          } else {
              wrapper.classList.remove('is-multiple');
          }

          if (select.disabled) wrapper.classList.add('disabled');
          else wrapper.classList.remove('disabled');

          optionsContainer.innerHTML = '';
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
              optionsContainer.appendChild(optEl);
          });

          if (!displayHtml && select.options.length > 0) displayHtml = select.options[0].innerHTML;
          textEl.innerHTML = displayHtml || '&nbsp;';
      }

      select.addEventListener('sync-custom-select', syncUI);
      select.addEventListener('change', syncUI);

      const obs = new MutationObserver(syncUI);
      obs.observe(select, { childList: true });

      trigger.addEventListener('click', (e) => {
          if (select.disabled || select.hasAttribute('multiple')) return;
          e.stopPropagation();
          document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
              if (w !== wrapper) w.classList.remove('open');
          });
          wrapper.classList.toggle('open');
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
  initializeCustomDropdowns(); // Mount Custom Select Wrapper immediately on boot
  await loadPreferencesAndMetadata();
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

function renderUI() {
  const prevAddChoice = document.getElementById('add-prop-select').value;
  const prevCustChoice = document.getElementById('customize-prop-select').value;
  const prevFiltChoice = document.getElementById('filter-by-select').value;
  
  const addPropSelect = document.getElementById('add-prop-select');
  addPropSelect.innerHTML = `<option value="">Properties</option>`;
  appMetadata.properties.forEach(prop => { addPropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (appMetadata.properties.includes(prevAddChoice)) addPropSelect.value = prevAddChoice;

  const customizePropSelect = document.getElementById('customize-prop-select');
  customizePropSelect.innerHTML = `<option value="Property">Properties</option>`;
  appMetadata.properties.forEach(prop => { customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (prevCustChoice) customizePropSelect.value = prevCustChoice;

  const filterBySelect = document.getElementById('filter-by-select');
  filterBySelect.innerHTML = `<option value="">Filter By</option>`;
  appMetadata.properties.forEach(prop => { filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
  if (appMetadata.properties.includes(prevFiltChoice)) filterBySelect.value = prevFiltChoice;
}

async function loadMovies() {
  if (!currentUserUid) return;
  const querySnapshot = await getDocs(collection(db, "users", currentUserUid, "movies"));
  movies = [];
  querySnapshot.forEach((doc) => { movies.push({ id: doc.id, ...doc.data() }); });
  triggerActiveFilter();
}

function renderTable(dataToRender, tbodyId, isDraftTable) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";
  let sl = 1;
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

function renderCompareTable() {
  const tbody = document.getElementById('compare-body');
  tbody.innerHTML = '';
  const tempMovies = movies.filter(m => m.isMerged === false);
  const mainMovies = movies.filter(m => m.isMerged !== false);

  const matches = tempMovies.filter(t => mainMovies.some(m => m.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

  if(matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No overlapping movies found.</td></tr>';
    return;
  }

  matches.forEach(tMovie => {
    const mMovie = mainMovies.find(m => m.name.toLowerCase().trim() === tMovie.name.toLowerCase().trim());
    
    let rowsHtml = `<tr><td colspan="3" style="background: var(--secondary); color: var(--text); font-weight: bold; text-align: center; font-size: 1.05rem;">${tMovie.name}</td></tr>`;
    
    appMetadata.properties.forEach(p => {
       if(mMovie[p] || tMovie[p]) {
         const mVal = Array.isArray(mMovie[p]) ? mMovie[p].join(', ') : (mMovie[p] || '-');
         const tVal = Array.isArray(tMovie[p]) ? tMovie[p].join(', ') : (tMovie[p] || '-');
         rowsHtml += `<tr>
            <td style="font-weight: 500;">${p}</td>
            <td>${mVal}</td>
            <td>${tVal}</td>
         </tr>`;
       }
    });
    
    if (mMovie.notes || tMovie.notes) {
        rowsHtml += `<tr>
            <td style="font-weight: 500;">Notes</td>
            <td>${mMovie.notes || '-'}</td>
            <td>${tMovie.notes || '-'}</td>
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
    return;
  }
  
  manageEditBtn.disabled = false;
  manageDeleteBtn.disabled = false;

  (appMetadata.tags[prop] || []).forEach((tag, idx) => {
    const row = `<tr>
      <td style="text-align:center;"><input type="checkbox" class="manage-tag-cb" data-idx="${idx}"></td>
      <td><input type="text" class="manage-tag-input" data-idx="${idx}" value="${tag}" disabled></td>
    </tr>`;
    manageTagsBody.innerHTML += row;
  });
}

// Fetch Dynamic GitHub Info
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
  
  appMetadata.properties.forEach(prop => {
    let div = document.createElement('div');
    div.className = 'form-group';
    let label = document.createElement('label');
    label.innerText = prop;
    
    let select = document.createElement('select');
    select.id = `modal-prop-${prop.replace(/\s+/g, '-')}`;
    select.disabled = true; 
    
    if (!singleProps.includes(prop)) {
       select.setAttribute('multiple', 'multiple');
    } else {
       select.innerHTML = `<option value="">--</option>`;
    }
    
    (appMetadata.tags[prop] || []).forEach(tag => {
      let isSelected = false;
      if (Array.isArray(movie[prop])) {
         isSelected = movie[prop].includes(tag);
      } else {
         isSelected = movie[prop] === tag;
      }
      select.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
    });
    
    div.appendChild(label);
    div.appendChild(select);
    container.appendChild(div);
  });

  document.getElementById('details-modal').classList.remove('hidden');
}

function enableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen icon-btn"; 
  document.getElementById('modal-title-input').disabled = false;
  document.getElementById('modal-notes-input').disabled = false;
  document.querySelectorAll('#modal-dynamic-props select').forEach(s => s.disabled = false);
  document.getElementById('modal-edit-btn').disabled = true;
  document.getElementById('modal-update-btn').disabled = false;
}

function disableEditingMode() {
  const editToggle = document.getElementById('modal-edit-toggle');
  editToggle.className = "fa-solid fa-pen-slash icon-btn"; 
  document.getElementById('modal-title-input').disabled = true;
  document.getElementById('modal-notes-input').disabled = true;
  document.querySelectorAll('#modal-dynamic-props select').forEach(s => s.disabled = true);
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
    const select = document.getElementById(`modal-prop-${prop.replace(/\s+/g, '-')}`);
    if (select.multiple) {
      const vals = Array.from(select.selectedOptions).map(o => o.value).filter(v => v !== "");
      updatedData[prop] = vals.length > 0 ? vals : null;
    } else {
      updatedData[prop] = select.value || null;
    }
  });
  try {
    await updateDoc(doc(db, "users", currentUserUid, "movies", activeModalMovieId), updatedData);
    disableEditingMode(); 
    loadMovies();
  } catch (error) { console.error("Update error: ", error); }
});

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('details-modal').classList.add('hidden');
});

// ----------------------------------------------------
// EVENT LISTENERS & ROUTING
// ----------------------------------------------------
function setupEventListeners() {
  
  const dbSelect = document.getElementById('db-select');
  const viewBtn = document.getElementById('view-btn');
  const compareBtn = document.getElementById('compare-btn');
  const mergeBtn = document.getElementById('merge-btn');
  const exportBtn = document.getElementById('export-btn');

  // Top Nav View Routing
  dbSelect.addEventListener('change', (e) => {
    if (e.target.value === 'commits') {
      mergeBtn.classList.remove('hidden');
      compareBtn.classList.remove('hidden');
      exportBtn.classList.add('hidden');
    } else {
      mergeBtn.classList.add('hidden');
      compareBtn.classList.add('hidden');
      exportBtn.classList.remove('hidden');
    }
  });

  viewBtn.addEventListener('click', () => { switchView(dbSelect.value); sidebar.classList.remove('open'); });
  compareBtn.addEventListener('click', () => { switchView('compare'); sidebar.classList.remove('open'); renderCompareTable(); });
  exportBtn.addEventListener('click', () => { alert("Export completed."); sidebar.classList.remove('open'); });
  
  document.getElementById('home-btn').addEventListener('click', () => {
    const isDatabaseOpen = !databasePanel.classList.contains('hidden');
    const isCommitsOpen = !commitsPanel.classList.contains('hidden');
    const isInputOpen = !inputPanel.classList.contains('hidden');
    const isCompareOpen = !comparePanel.classList.contains('hidden');
    if (isDatabaseOpen || isCommitsOpen || isCompareOpen) switchView('input');
    else if (isInputOpen) switchView('landing');
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
    if(currentUserUid) {
      await setDoc(doc(db, "users", currentUserUid, "settings", "preferences"), { theme: newTheme }, { merge: true });
    }
  });

  // Info Modal Logic
  openInfoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
    sidebar.classList.remove('open'); 
    fetchGitInfo();
  });
  closeInfoModal.addEventListener('click', () => infoModal.classList.add('hidden'));

  // Bulk Import Note Box Logic
  document.getElementById('open-bulk-btn').addEventListener('click', () => {
    document.getElementById('bulk-input-text').value = '';
    document.getElementById('bulk-modal').classList.remove('hidden');
  });

  document.getElementById('close-bulk-modal').addEventListener('click', () => {
    document.getElementById('bulk-modal').classList.add('hidden');
  });

  document.getElementById('bulk-save-btn').addEventListener('click', () => {
    const text = document.getElementById('bulk-input-text').value;
    const extractionRegex = /^(.*?)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)$/;
    const lines = text.split('\n');
    bulkMoviesDraft = []; 

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      
      let movieData = { name: line }; 
      const match = line.match(extractionRegex);
      
      if (match) {
        movieData.name = match[1].trim();
        movieData.Year = match[2].trim();
        movieData.Language = match[3].trim();
      }
      bulkMoviesDraft.push(movieData);
    });

    if(bulkMoviesDraft.length > 0) {
      document.getElementById('bulk-modal').classList.add('hidden');
      document.getElementById('bulk-input-text').value = '';
      
      const titleInput = document.getElementById('movie-name');
      titleInput.value = `[Bulk Mode] ${bulkMoviesDraft.length} movies ready`;
      titleInput.disabled = true;
    } else { 
      alert("No valid lines to process."); 
    }
  });

  // Input Properties Assignment Logic 
  document.getElementById('add-prop-select').addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    const tagSelect = document.getElementById('add-tag-select');
    
    if (selectedProp) {
      tagSelect.disabled = false;
      if (singleProps.includes(selectedProp)) {
        tagSelect.removeAttribute('multiple');
        tagSelect.innerHTML = `<option value="">Tag</option>`;
      } else {
        tagSelect.setAttribute('multiple', 'multiple');
        tagSelect.innerHTML = ''; 
      }
      
      (appMetadata.tags[selectedProp] || []).forEach(tag => {
        let isSelected = false;
        if (currentMovieDraft[selectedProp]) {
           if (Array.isArray(currentMovieDraft[selectedProp])) isSelected = currentMovieDraft[selectedProp].includes(tag);
           else isSelected = currentMovieDraft[selectedProp] === tag;
        }
        tagSelect.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
      });
    } else { 
      tagSelect.innerHTML = `<option value="">Tag</option>`;
      tagSelect.disabled = true; 
      tagSelect.removeAttribute('multiple');
    }
  });

  document.getElementById('add-tag-select').addEventListener('change', (e) => {
    const prop = document.getElementById('add-prop-select').value;
    if (!prop) return;
    
    if (e.target.multiple) {
      const vals = Array.from(e.target.selectedOptions).map(o => o.value).filter(v => v !== "");
      if (vals.length > 0) currentMovieDraft[prop] = vals;
      else delete currentMovieDraft[prop];
    } else {
      const tag = e.target.value;
      if (tag) currentMovieDraft[prop] = tag;
      else delete currentMovieDraft[prop]; 
    }
  });

  // Master Save Button logic
  document.getElementById('save-movie-btn').addEventListener('click', async () => {
    if (!currentUserUid) return;
    
    if (bulkMoviesDraft.length > 0) {
      const batch = writeBatch(db);
      const count = bulkMoviesDraft.length;
      
      bulkMoviesDraft.forEach(bMovie => {
        let finalMovie = {
          name: bMovie.name,
          notes: document.getElementById('movie-notes').value,
          isMerged: false,
          ...currentMovieDraft 
        };
        if (bMovie.Year) finalMovie.Year = bMovie.Year;
        if (bMovie.Language) finalMovie.Language = bMovie.Language;

        const newRef = doc(collection(db, "users", currentUserUid, "movies"));
        batch.set(newRef, finalMovie);
      });
      
      try {
        await batch.commit();
        const nameInput = document.getElementById('movie-name');
        nameInput.value = '';
        nameInput.disabled = false;
        document.getElementById('movie-notes').value = '';
        document.getElementById('add-prop-select').value = '';
        document.getElementById('add-tag-select').innerHTML = `<option value="">Tag</option>`;
        document.getElementById('add-tag-select').disabled = true;
        document.getElementById('add-tag-select').removeAttribute('multiple');
        
        currentMovieDraft = {}; 
        bulkMoviesDraft = []; 
        loadMovies(); 
        alert(`Successfully saved ${count} movies to Temporary Database.`);
      } catch(e) { console.error("Bulk save error: ", e); }

    } else {
      const movieData = {
        name: document.getElementById('movie-name').value,
        notes: document.getElementById('movie-notes').value,
        isMerged: false, 
        ...currentMovieDraft 
      };

      if (!movieData.name) { alert("Title is required!"); return; }

      try {
        await addDoc(collection(db, "users", currentUserUid, "movies"), movieData);
        document.getElementById('movie-name').value = '';
        document.getElementById('movie-notes').value = '';
        document.getElementById('add-prop-select').value = '';
        document.getElementById('add-tag-select').innerHTML = `<option value="">Tag</option>`;
        document.getElementById('add-tag-select').disabled = true;
        document.getElementById('add-tag-select').removeAttribute('multiple');
        
        currentMovieDraft = {}; 
        loadMovies(); 
        alert("Movie saved to Temporary Database.");
      } catch (e) { console.error("Error adding document: ", e); }
    }
  });

  // Merge/Overlap Actions
  mergeBtn.addEventListener('click', async () => {
    if (!currentUserUid) return;
    const unmerged = movies.filter(m => m.isMerged === false);
    if(unmerged.length === 0) { alert("No user added movies to merge."); return; }
    
    const batch = writeBatch(db);
    unmerged.forEach(m => { batch.update(doc(db, "users", currentUserUid, "movies", m.id), { isMerged: true }); });
    
    await batch.commit();
    sidebar.classList.remove('open');
    alert(`Successfully merged ${unmerged.length} movies!`);
    loadMovies();
  });
  
  document.getElementById('overlap-btn').addEventListener('click', async () => {
    if (!currentUserUid) return;
    const tempMovies = movies.filter(m => m.isMerged === false);
    const mainMovies = movies.filter(m => m.isMerged !== false);
    const matches = tempMovies.filter(t => mainMovies.some(m => m.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

    if(matches.length === 0) { alert("No overlaps to process."); return; }

    const batch = writeBatch(db);
    let overlapCount = 0;

    matches.forEach(tMovie => {
      const mMovie = mainMovies.find(m => m.name.toLowerCase().trim() === tMovie.name.toLowerCase().trim());
      let updatedData = {};
      let hasUpdates = false;

      appMetadata.properties.forEach(p => {
        const mainEmpty = !mMovie[p] || (Array.isArray(mMovie[p]) && mMovie[p].length === 0);
        const tempHasVal = tMovie[p] && (!Array.isArray(tMovie[p]) || tMovie[p].length > 0);
        
        if (mainEmpty && tempHasVal) {
          updatedData[p] = tMovie[p];
          hasUpdates = true;
        }
      });
      if (!mMovie.notes && tMovie.notes) {
        updatedData.notes = tMovie.notes;
        hasUpdates = true;
      }

      if (hasUpdates) {
        batch.update(doc(db, "users", currentUserUid, "movies", mMovie.id), updatedData);
      }
      batch.delete(doc(db, "users", currentUserUid, "movies", tMovie.id));
      overlapCount++;
    });

    if(overlapCount > 0) {
      try {
        await batch.commit();
        alert(`Successfully processed overlap for ${overlapCount} movies.`);
        loadMovies();
        switchView('commits');
      } catch(e) { console.error("Overlap error:", e); }
    }
  });

  // Table Deletions
  document.getElementById('delete-drafts-btn').addEventListener('click', async () => {
    if (!currentUserUid) return;
    const activeTableBody = commitsPanel.classList.contains('hidden') ? '#table-body' : '#commits-body';
    const checkedBoxes = document.querySelectorAll(`${activeTableBody} input[type="checkbox"]:checked`);
    
    if(checkedBoxes.length === 0) { alert("Please select movies to delete."); return; }
    
    if(confirm(`Delete ${checkedBoxes.length} movies?`)) {
      const batch = writeBatch(db);
      checkedBoxes.forEach(cb => { 
        batch.delete(doc(db, "users", currentUserUid, "movies", cb.dataset.id)); 
      });
      await batch.commit();
      loadMovies();
    }
  });

  document.getElementById('discard-all-btn').addEventListener('click', async () => {
    if (!currentUserUid) return;
    const unmerged = movies.filter(m => m.isMerged === false);
    if(unmerged.length === 0) { alert("No temporary movies to discard."); return; }
    
    if(confirm(`Are you sure you want to discard all ${unmerged.length} temporary movies?`)) {
      const batch = writeBatch(db);
      unmerged.forEach(m => { 
        batch.delete(doc(db, "users", currentUserUid, "movies", m.id)); 
      });
      await batch.commit();
      loadMovies();
    }
  });

  // --- CUSTOMIZER & PROPERTY MANAGER LOGIC ---
  const customTagInput = document.getElementById('customize-tag-input');
  const customAddBtn = document.getElementById('add-custom-btn');
  
  customTagInput.addEventListener('input', (e) => {
    customAddBtn.disabled = e.target.value.trim().length === 0;
  });

  document.getElementById('view-props-btn').addEventListener('click', () => {
    managePropSelect.innerHTML = `<option value="">Select Property</option>`;
    appMetadata.properties.forEach(prop => {
       managePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`;
    });
    manageTagsBody.innerHTML = '';
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
    if (!currentUserUid) return;
    const prop = managePropSelect.value;
    if (!prop) return;

    const newTags = [];
    document.querySelectorAll('.manage-tag-input').forEach(input => {
      const val = input.value.trim();
      if (val && !newTags.includes(val)) newTags.push(val);
    });
    
    appMetadata.tags[prop] = newTags;
    await saveMetadata();
    renderUI(); 
    renderManageTagsTable(); 
  });

  manageDeleteBtn.addEventListener('click', async () => {
    if (!currentUserUid) return;
    const prop = managePropSelect.value;
    if (!prop) return;

    const checked = document.querySelectorAll('.manage-tag-cb:checked');
    if (checked.length === 0) return;

    if (confirm(`Delete ${checked.length} tags?`)) {
      const indicesToRemove = Array.from(checked).map(cb => parseInt(cb.dataset.idx));
      appMetadata.tags[prop] = appMetadata.tags[prop].filter((_, idx) => !indicesToRemove.includes(idx));
      
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
        if (!appMetadata.properties.includes(tagString)) {
          appMetadata.properties.push(tagString);
          appMetadata.tags[tagString] = [];
          updated = true;
        }
      });
    } else {
      if (!appMetadata.tags[propChoice]) appMetadata.tags[propChoice] = [];
      tagsToAdd.forEach(tagString => {
        if (!appMetadata.tags[propChoice].includes(tagString)) {
          appMetadata.tags[propChoice].push(tagString);
          updated = true;
        }
      });
    }
    
    if (updated) {
      customTagInput.value = '';
      customAddBtn.disabled = true; 
      await saveMetadata();
      renderUI();
      document.getElementById('customize-prop-select').value = propChoice;
      alert("Updated");
    }
  });

  // Table Filters
  const filterBySelect = document.getElementById('filter-by-select');
  const filterTagSelect = document.getElementById('filter-tag-select');

  filterBySelect.addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    filterTagSelect.innerHTML = `<option value="">Select Tag</option>`;
    if (selectedProp) {
      filterTagSelect.disabled = false;
      (appMetadata.tags[selectedProp] || []).forEach(tag => {
        filterTagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
      });
    } else { filterTagSelect.disabled = true; }
    triggerActiveFilter();
  });

  filterTagSelect.addEventListener('change', () => triggerActiveFilter());

  // Search Logic 
  document.getElementById('search-btn').addEventListener('click', () => triggerActiveFilter());
  document.getElementById('search-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') triggerActiveFilter();
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    filterBySelect.value = '';
    filterTagSelect.innerHTML = `<option value="">Select Tag</option>`;
    filterTagSelect.disabled = true;
    searchInput.value = '';
    triggerActiveFilter();
  });
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------
function switchView(viewName, saveToDb = true) {
  landingPanel.classList.add('hidden');
  inputPanel.classList.add('hidden');
  databasePanel.classList.add('hidden');
  commitsPanel.classList.add('hidden');
  comparePanel.classList.add('hidden');
  sharedFilterBar.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  document.getElementById('home-btn').classList.add('hidden');

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
      deleteBtn.classList.remove('hidden'); 
      discardBtn.classList.add('hidden'); 
      triggerActiveFilter();
    } else if(viewName === 'commits') {
      sharedFilterBar.classList.remove('hidden');
      commitsPanel.classList.remove('hidden');
      deleteBtn.classList.remove('hidden'); 
      discardBtn.classList.remove('hidden'); 
      triggerActiveFilter();
    } else if (viewName === 'compare') {
      comparePanel.classList.remove('hidden');
    }
  }

  if (saveToDb && currentUserUid) {
    setDoc(doc(db, "users", currentUserUid, "settings", "preferences"), { view: viewName }, { merge: true });
  }
}

function triggerActiveFilter() {
  const filterBy = document.getElementById('filter-by-select').value;
  const filterTag = document.getElementById('filter-tag-select').value;
  const searchQuery = searchInput.value.toLowerCase().trim();
  
  let filteredMovies = movies;
  
  if (searchQuery) {
    filteredMovies = filteredMovies.filter(movie => movie.name && movie.name.toLowerCase().includes(searchQuery));
  }

  if (filterBy && filterTag) {
    filteredMovies = filteredMovies.filter(movie => {
      const val = movie[filterBy];
      if (Array.isArray(val)) return val.includes(filterTag);
      return val === filterTag;
    });
  }

  const isCommitsOpen = !commitsPanel.classList.contains('hidden');
  const isDatabaseOpen = !databasePanel.classList.contains('hidden');

  if(isCommitsOpen) {
    renderTable(filteredMovies.filter(m => m.isMerged === false), "commits-body", true);
  } else if (isDatabaseOpen) {
    renderTable(filteredMovies.filter(m => m.isMerged !== false), "table-body", false);
  }
}
