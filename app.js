import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
  properties: ["Watched Status", "Rating", "Genre", "Year", "Language", "Director", "Cast"],
  tags: {
    "Watched Status": ["Watched", "Plan to Watch", "Dropped"],
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
let sessionUnsubscribe = null; // Used to kill the session listener on logout

// DOM Elements
const sidebar = document.getElementById('sidebar');
const dynamicPropertiesContainer = document.getElementById('dynamic-properties');
const customizePropSelect = document.getElementById('customize-prop-select');
const filterBySelect = document.getElementById('filter-by-select');
const filterTagSelect = document.getElementById('filter-tag-select');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const databasePanel = document.getElementById('database-panel');

// ----------------------------------------------------
// AUTHENTICATION LOGIC & SINGLE SESSION ENFORCEMENT
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    
    // Single Session Enforcement: Listen to Firestore for session changes
    const localSessionId = localStorage.getItem('myShelfSession');
    sessionUnsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const dbSessionId = docSnap.data().sessionId;
        // If the database session doesn't match the local session, log out
        if (dbSessionId && localSessionId && dbSessionId !== localSessionId) {
          alert("Logged out: Your account was accessed from another device or browser.");
          signOut(auth);
        }
      }
    });

    if (!isInitialized) {
      init();
      isInitialized = true;
    }
  } else {
    // Show login screen
    document.getElementById('login-wrapper').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
    
    // Stop listening for session changes if logged out
    if (sessionUnsubscribe) {
      sessionUnsubscribe();
      sessionUnsubscribe = null;
    }
  }
});

// Login Execution
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Generate a unique session token for this specific login instance
    const newSessionId = Date.now().toString() + Math.random().toString(36).substring(2);
    localStorage.setItem('myShelfSession', newSessionId);
    
    // Write this token to Firestore to invalidate all other active sessions
    await setDoc(doc(db, "users", userCredential.user.uid), {
      sessionId: newSessionId
    }, { merge: true });

    // Clear input fields
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});

// Logout Execution
document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).catch((error) => {
    console.error("Logout Error:", error);
  });
});
// ----------------------------------------------------

// Initialize Main App 
async function init() {
  await loadMetadata();
  renderUI();
  await loadMovies();
  setupEventListeners();
}

// Fetch Custom Properties & Tags from Firestore
async function loadMetadata() {
  const metaRef = doc(db, "settings", "appMetadata");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) {
    appMetadata = metaSnap.data();
  } else {
    await setDoc(metaRef, appMetadata);
  }
}

// Save Metadata to Firestore
async function saveMetadata() {
  const metaRef = doc(db, "settings", "appMetadata");
  await setDoc(metaRef, appMetadata);
}

// Render dynamic parts of the UI
function renderUI() {
  dynamicPropertiesContainer.innerHTML = "";
  appMetadata.properties.forEach(prop => {
    const div = document.createElement('div');
    div.className = 'form-group';
    
    const label = document.createElement('label');
    label.innerText = prop;
    
    const select = document.createElement('select');
    select.id = `input-${prop.replace(/\s+/g, '-')}`;
    select.innerHTML = `<option value="">Select ${prop}</option>`;
    
    (appMetadata.tags[prop] || []).forEach(tag => {
      select.innerHTML += `<option value="${tag}">${tag}</option>`;
    });
    
    div.appendChild(label);
    div.appendChild(select);
    dynamicPropertiesContainer.appendChild(div);
  });

  customizePropSelect.innerHTML = `<option value="Property">Property (Add New)</option>`;
  appMetadata.properties.forEach(prop => {
    customizePropSelect.innerHTML += `<option value="${prop}">${prop}</option>`;
  });

  filterBySelect.innerHTML = `<option value="">Select Filter</option>`;
  appMetadata.properties.forEach(prop => {
    filterBySelect.innerHTML += `<option value="${prop}">${prop}</option>`;
  });
  
  tableHead.innerHTML = `<tr>
    <th>Movie Name</th>
    ${appMetadata.properties.map(p => `<th>${p}</th>`).join('')}
    <th>Notes</th>
  </tr>`;
}

// Fetch movies from Firestore
async function loadMovies() {
  const querySnapshot = await getDocs(collection(db, "movies"));
  movies = [];
  querySnapshot.forEach((doc) => {
    movies.push({ id: doc.id, ...doc.data() });
  });
  renderTable(movies);
}

// Render the Data Table
function renderTable(dataToRender) {
  tableBody.innerHTML = "";
  dataToRender.forEach(movie => {
    let row = `<tr><td>${movie.name || '-'}</td>`;
    appMetadata.properties.forEach(prop => {
      row += `<td>${movie[prop] || '-'}</td>`;
    });
    row += `<td>${movie.notes || '-'}</td></tr>`;
    tableBody.innerHTML += row;
  });
}

// Event Listeners Configuration
function setupEventListeners() {
  document.getElementById('open-sidebar').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('close-sidebar').addEventListener('click', () => sidebar.classList.remove('open'));
  
  document.getElementById('db-view-btn').addEventListener('click', () => {
    databasePanel.classList.toggle('hidden');
    sidebar.classList.remove('open');
  });

  document.getElementById('theme-select').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
  });

  document.getElementById('save-movie-btn').addEventListener('click', async () => {
    const movieData = {
      name: document.getElementById('movie-name').value,
      notes: document.getElementById('movie-notes').value,
    };
    
    appMetadata.properties.forEach(prop => {
      const el = document.getElementById(`input-${prop.replace(/\s+/g, '-')}`);
      if(el) movieData[prop] = el.value;
    });

    if (!movieData.name) {
      alert("Movie Name is required!");
      return;
    }

    try {
      await addDoc(collection(db, "movies"), movieData);
      alert("Movie saved to MyShelf!");
      
      document.getElementById('movie-name').value = '';
      document.getElementById('movie-notes').value = '';
      appMetadata.properties.forEach(prop => {
        const el = document.getElementById(`input-${prop.replace(/\s+/g, '-')}`);
        if(el) el.value = '';
      });

      loadMovies(); 
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  });

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
      if (!appMetadata.tags[propChoice].includes(tagString)) {
        appMetadata.tags[propChoice].push(tagString);
      }
    }

    document.getElementById('customize-tag-input').value = '';
    await saveMetadata();
    renderUI();
  });

  filterBySelect.addEventListener('change', (e) => {
    const selectedProp = e.target.value;
    filterTagSelect.innerHTML = `<option value="">Select Tag</option>`;
    
    if (selectedProp) {
      filterTagSelect.disabled = false;
      (appMetadata.tags[selectedProp] || []).forEach(tag => {
        filterTagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
      });
    } else {
      filterTagSelect.disabled = true;
      renderTable(movies); 
    }
  });

  filterTagSelect.addEventListener('change', (e) => {
    const filterBy = filterBySelect.value;
    const filterTag = e.target.value;

    if (filterBy && filterTag) {
      const filtered = movies.filter(movie => movie[filterBy] === filterTag);
      renderTable(filtered);
    } else {
      renderTable(movies);
    }
  });
}
