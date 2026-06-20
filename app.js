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

// Application State
let appMetadata = {
  properties: ["Watch Status", "Rating", "Genre", "Year", "Language", "Director", "Cast"],
  tags: {
    "Watch Status": ["Watched", "Plan to Watch", "Dropped"],
    "Rating": ["1", "2", "3", "4", "5"],
    "Genre": ["Action", "Drama", "Sci-Fi", "Comedy", "Thriller"],
    "Year": ["2024", "2023", "2022", "2021", "2020", "Older"],
    "Language": ["English", "Spanish", "Hindi", "French", "Korean"],
    "Director": [],
    "Cast": []
  }
};
let movies = [];
let isInitialized = false; 
let currentMovieDraft = {}; 
let activeModalMovieId = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const inputPanel = document.getElementById('input-panel');
const databasePanel = document.getElementById('database-panel');
const commitsPanel = document.getElementById('commits-panel');
const sharedFilterBar = document.getElementById('shared-filter-bar');
const deleteBtn = document.getElementById('delete-drafts-btn');

// ----------------------------------------------------
// AUTHENTICATION LOGIC 
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    if (!isInitialized) { init(); isInitialized = true; }
  } else {
    document.getElementById('login-wrapper').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
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

document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).catch(error => console.error("Logout Error:", error));
});

// ----------------------------------------------------
// MAIN APP LOGIC
// ----------------------------------------------------
async function init() {
  await loadMetadata();
  renderUI();
  await loadMovies();
  setupEventListeners();
}

async function loadMetadata() {
  const metaRef = doc(db, "settings", "appMetadata");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) { appMetadata = metaSnap.data(); } 
  else { await setDoc(metaRef, appMetadata); }
}

async function saveMetadata() {
  await setDoc(doc(db, "settings", "appMetadata"), appMetadata);
}

function renderUI() {
  const addPropSelect = document.getElementById('add-prop-select');
  addPropSelect.innerHTML = `<option value="">Select Property</option>`;
  appMetadata.properties.forEach(prop => { addPropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });

  const customizePropSelect = document.getElementById('customize-prop-select');
  customizePropSelect.innerHTML = `<option value="Property">Properties</option>`;
  appMetadata.properties.forEach(prop => { customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`; });

  const filterBySelect = document.getElementById('filter-by-select');
  filterBySelect.innerHTML = `<option value="">Filter By</option>`;
  appMetadata.properties.forEach(prop => { filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`; });
}

async function loadMovies() {
  const querySnapshot = await getDocs(collection(db, "movies"));
  movies = [];
  querySnapshot.forEach((doc) => { movies.push({ id: doc.id, ...doc.data() }); });
  triggerActiveFilter();
}

// ----------------------------------------------------
// RENDERING TABLES
// ----------------------------------------------------
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

// ----------------------------------------------------
// MODAL LOGIC
// ----------------------------------------------------
function openModal(movieId, isEditable) {
  const movie = movies.find(m => m.id === movieId);
  activeModalMovieId = movieId;
  
  document.getElementById('modal-title-input').value = movie.name;
  document.getElementById('modal-title-input').disabled = !isEditable;
  
  const container = document.getElementById('modal-dynamic-props');
  container.innerHTML = "";
  
  appMetadata.properties.forEach(prop => {
    let div = document.createElement('div');
    div.className = 'form-group';
    let label = document.createElement('label');
    label.innerText = prop;
    
    let select = document.createElement('select');
    select.id = `modal-prop-${prop.replace(/\s+/g, '-')}`;
    select.disabled = !isEditable;
    
    let options = `<option value="">--</option>`;
    (appMetadata.tags[prop] || []).forEach(tag => {
      let isSelected = movie[prop] === tag ? "selected" : "";
      options += `<option value="${tag}" ${isSelected}>${tag}</option>`;
    });
    
    select.innerHTML = options;
    div.appendChild(label);
    div.appendChild(select);
    container.appendChild(div);
  });

  document.getElementById('modal-notes-input').value = movie.notes || '';
  document.getElementById('modal-notes-input').disabled = !isEditable;

  const updateBtn = document.getElementById('modal-update-btn');
  if (isEditable) updateBtn.classList.remove('hidden');
  else updateBtn.classList.add('hidden');

  document.getElementById('details-modal').classList.remove('hidden');
}

document.getElementById('modal-update-btn').addEventListener('click', async () => {
  if(!activeModalMovieId) return;

  const updatedData = {
    name: document.getElementById('modal-title-input').value,
    notes: document.getElementById('modal-notes-input').value
  };

  appMetadata.properties.forEach(prop => {
    const val = document.getElementById(`modal-prop-${prop.replace(/\s+/g, '-')}`).value;
    if(val) updatedData[prop] = val;
    else updatedData[prop] = null; 
  });

  try {
    await updateDoc(doc(db, "movies", activeModalMovieId), updatedData);
    document.getElementById('details-modal').classList.add('hidden');
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
  
  // Sidebar Controls logic
  const dbSelect = document.getElementById('db-select');
  const viewBtn = document.getElementById('view-btn');
  const mergeBtn = document.getElementById('merge-btn');
  const exportBtn = document.getElementById('export-btn');

  dbSelect.addEventListener('change', (e) => {
    if (e.target.value === 'commits') {
      mergeBtn.classList.remove('hidden');
      exportBtn.classList.add('hidden');
    } else {
      mergeBtn.classList.add('hidden');
      exportBtn.classList.remove('hidden');
    }
  });

  viewBtn.addEventListener('click', () => {
    switchView(dbSelect.value);
    sidebar.classList.remove('open');
  });

  exportBtn.addEventListener('click', () => {
    alert("Export completed.");
    sidebar.classList.remove('open');
  });
  
  document.getElementById('home-btn').addEventListener('click', () => switchView('input'));
  document.getElementById('open-sidebar').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('close-sidebar').addEventListener('click', () => sidebar.classList.remove('open'));
  document.getElementById('theme-select').addEventListener('change', (e) => document.body.setAttribute('data-theme', e.target.value));

  // Add Panel Logic
  document.getElementById('add-prop-select').addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    const tagSelect = document.getElementById('add-tag-select');
    tagSelect.innerHTML = `<option value="">Select Value</option>`;
    
    if (selectedProp) {
      tagSelect.disabled = false;
      (appMetadata.tags[selectedProp] || []).forEach(tag => {
        const isSelected = currentMovieDraft[selectedProp] === tag ? 'selected' : '';
        tagSelect.innerHTML += `<option value="${tag}" ${isSelected}>${tag}</option>`;
      });
    } else { tagSelect.disabled = true; }
  });

  document.getElementById('add-tag-select').addEventListener('change', (e) => {
    const prop = document.getElementById('add-prop-select').value;
    const tag = e.target.value;
    if (prop && tag) currentMovieDraft[prop] = tag;
    else if (prop && !tag) delete currentMovieDraft[prop]; 
  });

  document.getElementById('save-movie-btn').addEventListener('click', async () => {
    const movieData = {
      name: document.getElementById('movie-name').value,
      notes: document.getElementById('movie-notes').value,
      isMerged: false, 
      ...currentMovieDraft 
    };

    if (!movieData.name) { alert("Title is required!"); return; }

    try {
      await addDoc(collection(db, "movies"), movieData);
      document.getElementById('movie-name').value = '';
      document.getElementById('movie-notes').value = '';
      document.getElementById('add-prop-select').value = '';
      document.getElementById('add-tag-select').innerHTML = `<option value="">Select Value</option>`;
      document.getElementById('add-tag-select').disabled = true;
      currentMovieDraft = {}; 
      loadMovies(); 
      alert("Movie saved to Temporary Database.");
    } catch (e) { console.error("Error adding document: ", e); }
  });

  mergeBtn.addEventListener('click', async () => {
    const unmerged = movies.filter(m => m.isMerged === false);
    if(unmerged.length === 0) { alert("No user added movies to merge."); return; }
    
    const batch = writeBatch(db);
    unmerged.forEach(m => { batch.update(doc(db, "movies", m.id), { isMerged: true }); });
    
    await batch.commit();
    sidebar.classList.remove('open');
    alert(`Successfully merged ${unmerged.length} movies!`);
    loadMovies();
  });

  // Delete Drafts Action 
  document.getElementById('delete-drafts-btn').addEventListener('click', async () => {
    const checkedBoxes = document.querySelectorAll('.draft-checkbox:checked');
    if(checkedBoxes.length === 0) { alert("Please select movies to delete."); return; }
    
    if(confirm(`Delete ${checkedBoxes.length} movies?`)) {
      const batch = writeBatch(db);
      checkedBoxes.forEach(cb => { batch.delete(doc(db, "movies", cb.dataset.id)); });
      await batch.commit();
      loadMovies();
    }
  });

  // Add Custom Properties globally
  document.getElementById('add-custom-btn').addEventListener('click', async () => {
    const propChoice = document.getElementById('customize-prop-select').value;
    const tagString = document.getElementById('customize-tag-input').value.trim();
    if (!tagString) return;

    if (propChoice === "Property") {
      if (!appMetadata.properties.includes(tagString)) {
        appMetadata.properties.push(tagString);
        appMetadata.tags[tagString] = [];
      }
    } else {
      if (!appMetadata.tags[propChoice]) appMetadata.tags[propChoice] = [];
      if (!appMetadata.tags[propChoice].includes(tagString)) appMetadata.tags[propChoice].push(tagString);
    }
    document.getElementById('customize-tag-input').value = '';
    await saveMetadata();
    renderUI();
  });

  // Filtering System Integration
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
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------
function switchView(viewName) {
  inputPanel.classList.add('hidden');
  databasePanel.classList.add('hidden');
  commitsPanel.classList.add('hidden');
  sharedFilterBar.classList.add('hidden');

  if(viewName === 'input') {
    inputPanel.classList.remove('hidden');
  } else if(viewName === 'database') {
    sharedFilterBar.classList.remove('hidden');
    databasePanel.classList.remove('hidden');
    deleteBtn.classList.add('hidden'); // Ensure bin is hidden on Main Database
    triggerActiveFilter();
  } else if(viewName === 'commits') {
    sharedFilterBar.classList.remove('hidden');
    commitsPanel.classList.remove('hidden');
    deleteBtn.classList.remove('hidden'); // Show bin exclusively for Commits
    triggerActiveFilter();
  }
}

function triggerActiveFilter() {
  const filterBy = document.getElementById('filter-by-select').value;
  const filterTag = document.getElementById('filter-tag-select').value;
  
  let filteredMovies = movies;
  if (filterBy && filterTag) {
    filteredMovies = movies.filter(movie => movie[filterBy] === filterTag);
  }

  const isCommitsOpen = !commitsPanel.classList.contains('hidden');
  const isDatabaseOpen = !databasePanel.classList.contains('hidden');

  if(isCommitsOpen) {
    renderTable(filteredMovies.filter(m => m.isMerged === false), "commits-body", true);
  } else if (isDatabaseOpen) {
    renderTable(filteredMovies.filter(m => m.isMerged !== false), "table-body", false);
  }
}
