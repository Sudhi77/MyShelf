import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

const trashIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="red" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

// Hide app container initially to prevent UI flashing before Firebase verifies session
const mainAppContainer = document.querySelector('.container');
if (mainAppContainer) mainAppContainer.style.display = 'none';

// --- DYNAMIC LOGIN SCREEN INJECTION ---
let loginScreen = document.getElementById('loginScreen');
if (!loginScreen) {
    loginScreen = document.createElement('div');
    loginScreen.id = 'loginScreen';
    loginScreen.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:var(--bg-color); z-index:50000; display:none; flex-direction:column; justify-content:center; align-items:center; gap:15px;';
    
    const appTitle = document.createElement('h1');
    appTitle.innerText = 'MyShelf';
    appTitle.style.cssText = 'color: var(--text-color); font-size: 40px; margin: 0 0 10px 0; text-align: center;';
    
    const emailInput = document.createElement('input');
    emailInput.id = 'loginEmail';
    emailInput.type = 'email';
    emailInput.placeholder = 'Email';
    emailInput.style.cssText = 'padding: 12px; font-size: 16px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--list-bg); color: var(--text-color); width: 80%; max-width: 300px; box-sizing: border-box; margin: 0;';

    const passwordInput = document.createElement('input');
    passwordInput.id = 'loginPassword';
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.style.cssText = 'padding: 12px; font-size: 16px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--list-bg); color: var(--text-color); width: 80%; max-width: 300px; box-sizing: border-box; margin: 0;';
    
    const loginBtn = document.createElement('button');
    loginBtn.id = 'loginBtn';
    loginBtn.className = 'save-btn';
    loginBtn.innerText = 'Login';
    loginBtn.style.cssText = 'font-size: 16px; padding: 12px 24px; cursor: pointer; width: 80%; max-width: 300px; margin: 0; align-self: center; text-align: center;';
    
    loginScreen.appendChild(appTitle);
    loginScreen.appendChild(emailInput);
    loginScreen.appendChild(passwordInput);
    loginScreen.appendChild(loginBtn);
    document.body.appendChild(loginScreen);

    loginBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) return alert("Please enter your email and password.");
        
        setPersistence(auth, browserLocalPersistence)
            .then(() => signInWithEmailAndPassword(auth, email, password))
            .catch(error => {
                // Smart Fallback: If the database is completely empty/fresh, automatically register the user
                createUserWithEmailAndPassword(auth, email, password)
                    .catch(err => {
                        if (err.code === 'auth/email-already-in-use') {
                            alert("Login failed: Invalid credentials.");
                        } else {
                            alert("Login/Signup failed: " + err.message);
                        }
                    });
            });
    });
}

// --- DYNAMIC UI ADJUSTMENTS ---
const headerBottom = document.querySelector('.header-bottom');
if (headerBottom && !document.getElementById('mainDatabaseHeading')) {
    headerBottom.style.display = 'flex';
    headerBottom.style.justifyContent = 'space-between';
    headerBottom.style.alignItems = 'center';
    
    const mainDbHeading = document.createElement('h3');
    mainDbHeading.id = 'mainDatabaseHeading';
    mainDbHeading.style.margin = '0';
    mainDbHeading.style.textAlign = 'center';
    mainDbHeading.style.flex = '1';
    mainDbHeading.style.fontSize = '20px';
    mainDbHeading.innerText = 'Database';
    
    const referenceNode = document.getElementById('homeBtn') || null;
    headerBottom.insertBefore(mainDbHeading, referenceNode);
}

// Add Logout Button gracefully alongside Home Button
const existingHomeBtn = document.getElementById('homeBtn');
let logoutBtn = document.getElementById('logoutBtn');

if (existingHomeBtn && !logoutBtn) {
    logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.className = 'icon-btn';
    logoutBtn.title = 'Logout';
    logoutBtn.style.padding = '5px';
    logoutBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
    logoutBtn.style.display = 'none'; // hidden by default
    existingHomeBtn.parentNode.insertBefore(logoutBtn, existingHomeBtn.nextSibling);

    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch(e => console.error(e));
    });
}

const customTypeF = document.getElementById('customType');
if (customTypeF) customTypeF.style.padding = '8px';
const customValueF = document.getElementById('customValue');
if (customValueF) customValueF.style.padding = '8px';

document.querySelectorAll('.heading-row').forEach(row => {
    const discardBtn = row.querySelector('.temp-discard-btn');
    if (discardBtn) {
        discardBtn.style.marginLeft = '10px';
        const controls = row.nextElementSibling; 
        if (controls && controls.classList.contains('list-controls')) {
            controls.appendChild(discardBtn);
        }
    }
    row.remove();
});

document.querySelectorAll('th').forEach(th => {
    if (th.innerText.trim() === 'Del') {
        th.innerText = 'Select';
        th.style.width = '50px'; 
    }
});

const rowHeightStyle = document.createElement('style');
rowHeightStyle.innerHTML = `table th, table td { padding: 9px 6px !important; }`;
document.head.appendChild(rowHeightStyle);

const movieStatusFilter = document.getElementById('movieStatusFilter');
if (movieStatusFilter) movieStatusFilter.style.display = 'none';

const movieFilterMain = document.getElementById('movieFilterMain');
if (movieFilterMain && !movieFilterMain.querySelector('option[value="status"]')) {
    const opt = document.createElement('option');
    opt.value = 'status';
    opt.innerText = 'Watch Status';
    movieFilterMain.appendChild(opt);
}

// --- UI INITIALIZATION & DEFAULTS ---
const mdInput = document.getElementById('movieDate');
if (mdInput) mdInput.value = getTodayDate();
const bdInput = document.getElementById('bookDate');
if (bdInput) bdInput.value = getTodayDate();

const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
const tSelect = document.getElementById('themeSelect');
if (tSelect) {
    tSelect.value = currentTheme;
    tSelect.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-theme', e.target.value);
        localStorage.setItem('theme', e.target.value);
    });
}

const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const toggleMenu = (show) => {
    if (!sideMenu || !menuOverlay) return;
    if(show) { sideMenu.classList.add('open'); menuOverlay.classList.add('open'); }
    else { sideMenu.classList.remove('open'); menuOverlay.classList.remove('open'); }
}
const mBtn = document.getElementById('menuBtn');
if(mBtn) mBtn.addEventListener('click', () => toggleMenu(true));
const cBtn = document.getElementById('closeMenuBtn');
if (cBtn) cBtn.addEventListener('click', () => toggleMenu(false));
if (menuOverlay) menuOverlay.addEventListener('click', () => toggleMenu(false));

const views = document.querySelectorAll('.view');
function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    localStorage.setItem('lastView', viewId);
    
    const mainDbHeading = document.getElementById('mainDatabaseHeading');
    if (mainDbHeading) {
        mainDbHeading.style.display = (viewId === 'homeView' || viewId === 'movieView') ? 'none' : 'block';
    }

    if (existingHomeBtn && logoutBtn) {
        if (viewId === 'homeView') {
            existingHomeBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
        } else {
            existingHomeBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
    }
}
showView(localStorage.getItem('lastView') || 'homeView');

if (existingHomeBtn) {
    existingHomeBtn.addEventListener('click', () => {
        const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
        if (activeView === 'archiveView') {
            showView('movieView');
        } else {
            showView('homeView');
        }
    });
}

const nm = document.getElementById('navMovie'); if(nm) nm.addEventListener('click', () => showView('movieView'));
const ns = document.getElementById('navSong'); if(ns) ns.addEventListener('click', () => showView('songView'));
const nb = document.getElementById('navBook'); if(nb) nb.addEventListener('click', () => showView('bookView'));
const nt = document.getElementById('navTravel'); if(nt) nt.addEventListener('click', () => showView('travelView'));

// --- DYNAMIC CUSTOMIZATIONS & PROPERTIES ---
// These initialization values remain fully in code so empty databases do not throw errors
const defaults = {
    movieGenre: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"],
    songGenre: ["Rock", "Pop", "Jazz", "Classical", "Hip Hop", "Country"],
    bookGenre: ["Fiction", "Non-Fiction", "Biography", "Fantasy", "Mystery"],
    Language: ["English", "Hindi", "Telugu", "Tamil", "Malayalam", "Japanese", "Spanish"]
};

let globalCustomData = { Language: [], movieGenre: [], songGenre: [], bookGenre: [], Artist: [], Author: [] };
let globalCustomProps = [];

function updatePrimaryPropDropdowns() {
    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        const sel = document.getElementById(`${cat}PrimaryProp`);
        if (!sel) return;
        const currentVal = sel.value;
        let html = `<option value="" disabled selected>Properties</option>`;
        
        if (cat === 'movie') {
            html += `<option value="year">Year</option><option value="type">Type</option><option value="genre">Genre</option><option value="status">Watch Status</option><option value="lang">Language</option>`;
        } else if (cat === 'song') {
            html += `<option value="singer">Artist</option><option value="lang">Language</option><option value="genre">Genre</option>`;
        } else if (cat === 'book') {
            html += `<option value="author">Author</option><option value="year">Year</option><option value="lang">Language</option><option value="genre">Genre</option>`;
        } else if (cat === 'travel') {
            html += `<option value="state">State</option><option value="country">Country</option><option value="category">Category</option><option value="status">Status</option>`;
        }
        
        globalCustomProps.forEach(p => html += `<option value="custom_${p}">${p}</option>`);
        
        sel.innerHTML = html;
        if (sel.querySelector(`option[value="${currentVal}"]`)) sel.value = currentVal;
    });
}

// --- GLOBAL STATE FOR ALL FORMS ---
let activeProps = {
    movie: { type: 'Movie', lang: 'English', year: 'NA', status: 'watched', genre: [] },
    song: { lang: 'English', genre: [], singer: '' },
    book: { lang: 'English', year: 'NA', genre: [], author: '' },
    travel: { status: 'visited' }
};

const getOptionsForCat = (cat, prop) => {
    if (prop.startsWith('custom_')) {
        const pName = prop.replace('custom_', '');
        return [...new Set(globalCustomData[pName] || [])].sort();
    }
    if (prop === 'genre') {
        const arr = cat === 'movie' ? defaults.movieGenre.concat(globalCustomData.movieGenre) :
                    cat === 'song' ? defaults.songGenre.concat(globalCustomData.songGenre) :
                    cat === 'book' ? defaults.bookGenre.concat(globalCustomData.bookGenre) : [];
        return [...new Set(arr)].sort();
    }
    if (prop === 'lang') return [...new Set(defaults.Language.concat(globalCustomData.Language))].sort();
    if (prop === 'year') { let yrs = []; for(let i=2026; i>=1950; i--) yrs.push(i.toString()); return yrs; }
    if (prop === 'status' && cat === 'movie') return ['watched', 'to_watch'];
    if (prop === 'status' && cat === 'travel') return ['visited', 'want_to_go'];
    if (prop === 'type') return ["Movie", "Shortfilm", "Series", "Documentary", "Docu-Series"];
    if (prop === 'category') return ["Trekking", "Adventure", "Activities", "Historical Place", "Nature", "Other"];
    if (prop === 'singer') return [...new Set(globalCustomData.Artist || [])].sort();
    if (prop === 'author') return [...new Set(globalCustomData.Author || [])].sort();
    if (prop === 'state' || prop === 'country') return null; 
    return [];
};

window.removeCatProp = (cat, prop, val, isGenre) => {
    if(isGenre) {
        if(activeProps[cat].genre) activeProps[cat].genre = activeProps[cat].genre.filter(g => g !== val);
    } else {
        delete activeProps[cat][prop]; 
    }
    renderTags(cat);
};

const renderTags = (cat) => {
    const display = document.getElementById(`${cat}TagsDisplay`);
    if(!display) return;
    let html = '';
    const props = activeProps[cat];
    
    const addTag = (label, val, propKey, isGenre = false) => {
        if(!val || val === 'NA') return;
        html += `<span class="prop-tag" style="background:var(--card-bg); border:1px solid var(--border-color); padding:6px 10px; border-radius:15px; font-size:13px; display:flex; align-items:center; gap:6px;">
            <strong>${label}:</strong> ${val}
            <span style="cursor:pointer; color:#dc3545; font-weight:bold; font-size:16px; line-height:1;" onclick="removeCatProp('${cat}', '${propKey}', '${val}', ${isGenre})">&times;</span>
        </span>`;
    };

    Object.keys(props).forEach(k => {
        if (k === 'genre') return; 
        let label = k.charAt(0).toUpperCase() + k.slice(1);
        if (k.startsWith('custom_')) label = k.replace('custom_', '');
        if (k === 'status' && cat === 'movie') label = 'Watch Status'; 
        
        let displayVal = props[k];
        if (k === 'status' && cat === 'movie') displayVal = displayVal === 'watched' ? 'Watched' : 'To Watch';
        if (k === 'status' && cat === 'travel') displayVal = displayVal === 'visited' ? 'Visited' : 'Want to go';
        addTag(label, displayVal, k);
    });

    if (props.genre && Array.isArray(props.genre) && props.genre.length > 0) {
        html += `<div style="flex-basis: 100%; height: 0;"></div>`;
        props.genre.forEach((g, index) => {
            const labelStr = index === 0 ? `<strong>Genre:</strong> ` : ``;
            html += `<span class="prop-tag" style="background:var(--card-bg); border:1px solid var(--border-color); padding:6px 10px; border-radius:15px; font-size:13px; display:flex; align-items:center; gap:6px;">
                ${labelStr}${g}
                <span style="cursor:pointer; color:#dc3545; font-weight:bold; font-size:16px; line-height:1;" onclick="removeCatProp('${cat}', 'genre', '${g}', true)">&times;</span>
            </span>`;
        });
    }

    display.innerHTML = html || '<span style="color:var(--sub-text); font-size:14px; padding:4px;">Added properties will appear here...</span>';
};

const setupDynamicForm = (cat) => {
    const form = document.querySelector(`#${cat}View .input-form`);
    if (!form || document.getElementById(`${cat}PrimaryProp`)) return;
    
    const titleRow = form.children[0]; 
    const notesArea = document.getElementById(`${cat}Notes`);
    const saveBtn = document.getElementById(`save${cat.charAt(0).toUpperCase() + cat.slice(1)}Btn`);
    
    const dateInput = document.getElementById(`${cat}Date`);
    const ratingInput = document.getElementById(`${cat}Rating`);
    const mapInput = document.getElementById(`travelMap`);
    
    form.querySelectorAll('.row-inputs, .compact-row, input[type="url"]').forEach(el => {
        if(el !== titleRow) el.remove();
    });
    
    const propRow = document.createElement('div');
    propRow.className = 'row-inputs';
    propRow.style.marginBottom = '8px';
    propRow.innerHTML = `
        <select id="${cat}PrimaryProp" class="dynamic-dropdown">
            <option value="" disabled selected>Properties</option>
        </select>
        <div id="${cat}SubPropContainer" style="flex: 1; display: flex;">
            <select id="${cat}SubProp" class="dynamic-dropdown" disabled>
                <option value="" disabled selected>Subset</option>
            </select>
        </div>
        <button id="add${cat}PropBtn" class="save-custom-btn" style="margin:0; padding:12px;">Add</button>
    `;
    
    const staticRow = document.createElement('div');
    staticRow.className = 'compact-row';
    staticRow.style.marginBottom = '8px';
    if (dateInput) staticRow.appendChild(dateInput.closest('.input-group') || dateInput);
    if (ratingInput) staticRow.appendChild(ratingInput.closest('.input-group') || ratingInput);
    if (mapInput) staticRow.appendChild(mapInput);
    
    const tagsDisplay = document.createElement('div');
    tagsDisplay.id = `${cat}TagsDisplay`;
    tagsDisplay.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; min-height: 45px; padding: 10px; border: 1px dashed var(--border-color); border-radius: 4px; background: var(--list-bg); margin-bottom: 10px; align-items: center;';
    
    form.innerHTML = '';
    form.appendChild(titleRow);
    form.appendChild(propRow);
    if (staticRow.children.length > 0) form.appendChild(staticRow);
    form.appendChild(tagsDisplay);
    if (notesArea) form.appendChild(notesArea);
    if (saveBtn) form.appendChild(saveBtn);

    document.getElementById(`${cat}PrimaryProp`).addEventListener('change', (e) => {
        const prop = e.target.value;
        const container = document.getElementById(`${cat}SubPropContainer`);
        const opts = getOptionsForCat(cat, prop);
        
        if (opts === null) {
            container.innerHTML = `<input type="text" id="${cat}SubProp" class="dynamic-dropdown" placeholder="Type value..." style="width:100%;">`;
        } else {
            container.innerHTML = `<select id="${cat}SubProp" class="dynamic-dropdown">
                <option value="" disabled selected>Subset</option>
                ${opts.map(o => {
                    let label = o;
                    if(prop==='status' && cat==='movie') label = o==='watched'?'Watched':'To Watch';
                    if(prop==='status' && cat==='travel') label = o==='visited'?'Visited':'Want to go';
                    return `<option value="${o}">${label}</option>`;
                }).join('')}
            </select>`;
        }
    });

    document.getElementById(`add${cat}PropBtn`).addEventListener('click', (e) => {
        e.preventDefault();
        const prop = document.getElementById(`${cat}PrimaryProp`).value;
        const sub = document.getElementById(`${cat}SubProp`);
        const val = sub ? sub.value.trim() : null;
        if(!prop || !val) return;

        if(prop === 'genre') {
            if(!activeProps[cat].genre) activeProps[cat].genre = [];
            if(!activeProps[cat].genre.includes(val) && val !== 'NA') {
                activeProps[cat].genre.push(val);
            }
        } else {
            activeProps[cat][prop] = val;
        }
        if (sub.tagName === 'INPUT') sub.value = '';
        renderTags(cat);
    });
    
    setTimeout(() => renderTags(cat), 100);
};

['movie', 'song', 'book', 'travel'].forEach(setupDynamicForm);

// --- GLOBAL STATE, PAGINATION, CACHE & PERSISTENT CONTROLS ---
let isViewingTemp = false;
let isEditPermanentMode = false;
let currentMoviePage = 1;
const moviesPerPage = 50;

const dataCache = { 
    movies: [], temp_movies: [], songs: [], temp_songs: [], books: [], temp_books: [], travels: [], temp_travels: [] 
};

const defaultControls = {
    movie: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    song: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    book: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    travel: { search: '', sort: 'date_desc', status: 'all', filterMain: '', filterSub: '' }
};

let controls = JSON.parse(localStorage.getItem('myShelfControls'));
if (!controls || typeof controls !== 'object') {
    controls = JSON.parse(JSON.stringify(defaultControls));
} else {
    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        if (!controls[cat]) controls[cat] = JSON.parse(JSON.stringify(defaultControls[cat]));
    });
    if (controls.movie && controls.movie.status !== undefined) {
        if (controls.movie.status !== 'all' && controls.movie.status !== '') {
            controls.movie.filterMain = 'status';
            controls.movie.filterSub = controls.movie.status;
        }
        delete controls.movie.status;
        localStorage.setItem('myShelfControls', JSON.stringify(controls));
    }
}

const saveControls = () => localStorage.setItem('myShelfControls', JSON.stringify(controls));

const updateSubfilterUI = (cat) => {
    const sub = document.getElementById(`${cat}FilterSub`);
    if (!sub) return;
    
    const c = controls[cat] || defaultControls[cat];
    const mainVal = c.filterMain;
    
    if (!mainVal) {
        sub.disabled = true; sub.innerHTML = '<option value="">Subfilter</option>';
        return;
    }
    sub.disabled = false;

    if (cat === 'movie' && mainVal === 'status') {
        sub.innerHTML = `<option value="">All Matches</option>
                         <option value="watched" ${c.filterSub === 'watched' ? 'selected' : ''}>Watched</option>
                         <option value="to_watch" ${c.filterSub === 'to_watch' ? 'selected' : ''}>Not watched</option>`;
        return;
    }

    let source = isViewingTemp ? dataCache[`temp_${cat}s`] : dataCache[`${cat}s`];
    if (!source) source = [];
    if (cat === 'movie') source = enhanceWithDates(source); 
    
    const uniqueVals = [...new Set(source.map(item => item[mainVal]).filter(Boolean).flat())].sort();
    sub.innerHTML = '<option value="">All Matches</option>' + uniqueVals.map(v => `<option value="${v}" ${v === c.filterSub ? 'selected' : ''}>${v}</option>`).join('');
};

function applyControlsToUI() {
    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        const s = document.getElementById(`${cat}Search`);
        if(s) s.value = controls[cat].search || '';
        if(cat === 'travel') {
            const ts = document.getElementById('travelStatusFilter');
            if(ts) ts.value = controls[cat].status || 'all';
        }
        const fm = document.getElementById(`${cat}FilterMain`);
        if(fm) fm.value = controls[cat].filterMain || '';
        updateSubfilterUI(cat);
    });
}

document.querySelectorAll('.list-controls').forEach((ctrl) => {
    const btnGroup = document.createElement('div');
    btnGroup.style.marginLeft = 'auto'; 
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'save-custom-btn';
    clearBtn.style.backgroundColor = '#6c757d';
    clearBtn.style.margin = '0'; 
    clearBtn.innerText = 'Clear Filters';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'save-custom-btn';
    deleteBtn.style.backgroundColor = '#ffffff';
    deleteBtn.style.border = '1px solid #dddddd';
    deleteBtn.style.margin = '0';
    deleteBtn.style.padding = '8px 12px';
    deleteBtn.innerHTML = trashIcon;
    deleteBtn.title = 'Delete Selected';
    
    const searchInput = ctrl.querySelector('.search-bar');
    if (searchInput) {
        const cat = searchInput.id.replace('Search', '');
        
        clearBtn.addEventListener('click', () => {
            controls[cat] = JSON.parse(JSON.stringify(defaultControls[cat]));
            saveControls();
            applyControlsToUI();
            if(cat === 'movie') currentMoviePage = 1;
            renderAll();
        });

        deleteBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll(`#${cat}List .row-checkbox:checked`);
            if (checkboxes.length === 0) return alert("Please select items to delete.");
            if (!confirm(`Are you sure you want to permanently delete ${checkboxes.length} selected item(s)?`)) return;
            
            try {
                for (let cb of checkboxes) {
                    const id = cb.dataset.id;
                    const type = cb.dataset.type;
                    const targetCollection = isViewingTemp ? `temp_${type}s` : `${type}s`;
                    await deleteDoc(doc(db, targetCollection, id));
                }
            } catch (e) { console.error(e); }
        });

        btnGroup.appendChild(clearBtn);
        btnGroup.appendChild(deleteBtn);
        ctrl.appendChild(btnGroup);
    }
});

const cb = document.getElementById('saveCustomBtn');
if (cb) cb.addEventListener('click', async () => {
    const name = document.getElementById('customValue').value.trim();
    const type = document.getElementById('customType').value; 
    if (!name) return alert("Please enter a string.");
    try {
        await addDoc(collection(db, "customOptions"), { 
            name, 
            type,
            userId: auth.currentUser.uid 
        });
        document.getElementById('customValue').value = '';
        alert("Added to your custom options!");
    } catch (e) { console.error(e); }
});

// --- DATABASE DROPDOWN MENU LOGIC ---
const dbSelect = document.getElementById('dbSelect');
const dbPreviewBtn = document.getElementById('dbPreviewBtn');
const dbEditBtn = document.getElementById('dbEditBtn');
const dbMergeBtn = document.getElementById('dbMergeBtn');

if(dbSelect) dbSelect.addEventListener('change', (e) => {
    if (e.target.value === 'archive') {
        if(dbEditBtn) dbEditBtn.style.display = 'block';
        if(dbMergeBtn) dbMergeBtn.style.display = 'none';
    } else {
        if(dbEditBtn) dbEditBtn.style.display = 'none';
        if(dbMergeBtn) dbMergeBtn.style.display = 'block';
        isEditPermanentMode = false;
        if(dbEditBtn) {
            dbEditBtn.style.background = '#ffc107';
            dbEditBtn.style.color = '#000';
        }
    }
});

if(dbEditBtn) dbEditBtn.addEventListener('click', () => {
    isEditPermanentMode = !isEditPermanentMode;
    dbEditBtn.style.background = isEditPermanentMode ? '#28a745' : '#ffc107';
    dbEditBtn.style.color = isEditPermanentMode ? '#fff' : '#000';
    alert(isEditPermanentMode ? "Permanent Edit Mode Enabled. Click an entry in the database to edit." : "Permanent Edit Mode Disabled.");
    
    if (isEditPermanentMode) {
        isViewingTemp = false;
        if(dbSelect) dbSelect.value = 'archive';
        renderAll();
        const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
        if (activeView === 'movieView' || activeView === 'homeView') {
            showView('archiveView');
        }
    }
    toggleMenu(false);
});

if(dbPreviewBtn) dbPreviewBtn.addEventListener('click', () => {
    const isCommit = dbSelect ? dbSelect.value === 'commit' : false;
    isViewingTemp = isCommit;
    currentMoviePage = 1; 

    const headText = isViewingTemp ? "Temporary Database" : "Database";
    const mainDbHeading = document.getElementById('mainDatabaseHeading');
    if (mainDbHeading) mainDbHeading.innerText = headText;

    const pas = document.getElementById('permActionsSection');
    if(pas) pas.style.display = isViewingTemp ? "none" : "block";

    document.querySelectorAll('.temp-discard-btn').forEach(dBtn => {
        dBtn.style.display = isViewingTemp ? "inline-block" : "none";
    });

    document.querySelectorAll('.list-controls').forEach(ctrl => {
        ctrl.style.display = isViewingTemp ? "none" : "flex";
    });

    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        if (!isViewingTemp) updateSubfilterUI(cat);
    });

    renderAll();

    const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
    if (activeView === 'movieView' || activeView === 'homeView') {
        showView('archiveView');
    }

    toggleMenu(false);
});

const switchToCommitView = () => {
    const s = document.getElementById('dbSelect');
    if(s) {
        s.value = 'commit';
        s.dispatchEvent(new Event('change'));
        const pBtn = document.getElementById('dbPreviewBtn');
        if(pBtn) pBtn.click();
    }
};

// --- DISCARD & MERGE ---
document.querySelectorAll('.temp-discard-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (!confirm("Discard all temporary commits? This cannot be undone.")) return;
        const clearTemp = async (collName, cacheArray) => {
            for(let item of cacheArray) await deleteDoc(doc(db, collName, item._id));
        };
        await clearTemp("temp_movies", dataCache.temp_movies);
        await clearTemp("temp_songs", dataCache.temp_songs);
        await clearTemp("temp_books", dataCache.temp_books);
        await clearTemp("temp_travels", dataCache.temp_travels);
        
        if(dbSelect) {
            dbSelect.value = 'archive';
            dbSelect.dispatchEvent(new Event('change'));
        }
        const pBtn = document.getElementById('dbPreviewBtn');
        if(pBtn) pBtn.click();
    });
});

if(dbMergeBtn) dbMergeBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to merge all temporary entries into your permanent list?")) return;
    try {
        const moveData = async (tempArray, collName, tempCollName) => {
            for (let item of tempArray) {
                const { _id, ...cleanData } = item;
                cleanData.userId = auth.currentUser.uid;
                await addDoc(collection(db, collName), cleanData);
                await deleteDoc(doc(db, tempCollName, _id));
            }
        };
        await moveData(dataCache.temp_movies, "movies", "temp_movies");
        await moveData(dataCache.temp_songs, "songs", "temp_songs");
        await moveData(dataCache.temp_books, "books", "temp_books");
        await moveData(dataCache.temp_travels, "travels", "temp_travels");
        
        alert("Merge successful!");
        if (isViewingTemp) {
            if(dbSelect) {
                dbSelect.value = 'archive';
                dbSelect.dispatchEvent(new Event('change'));
            }
            const pBtn = document.getElementById('dbPreviewBtn');
            if(pBtn) pBtn.click();
        } 
    } catch (e) { console.error(e); alert("Merge encountered an error."); }
});

// --- CLEAR VISIBLE PERMANENT ENTRIES ---
const cvb = document.getElementById('clearVisibleBtn');
if (cvb) cvb.addEventListener('click', async () => {
    if (isViewingTemp) return alert("This action is only available for the permanent database.");

    const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
    let cat = '', collName = '';
    if (activeView === 'archiveView') { cat = 'movie'; collName = 'movies'; }
    else if (activeView === 'songView') { cat = 'song'; collName = 'songs'; }
    else if (activeView === 'bookView') { cat = 'book'; collName = 'books'; }
    else if (activeView === 'travelView') { cat = 'travel'; collName = 'travels'; }

    if (!cat) return;

    let visibleData = processData(cat, dataCache[`${cat}s`]);
    
    if (cat === 'movie') {
        const startIdx = (currentMoviePage - 1) * moviesPerPage;
        visibleData = visibleData.slice(startIdx, startIdx + moviesPerPage);
    }
    
    if (visibleData.length === 0) return alert("No visible entries to clear.");

    if (!confirm(`Are you sure you want to permanently delete the ${visibleData.length} visible entries? This action cannot be undone.`)) return;

    try {
        for (let item of visibleData) {
            await deleteDoc(doc(db, collName, item._id));
        }
        alert(`Successfully deleted ${visibleData.length} entries.`);
        toggleMenu(false);
    } catch (e) { 
        console.error(e); 
        alert("Error occurred while deleting entries."); 
    }
});

const enhanceWithDates = (source) => source.map(item => {
    let wy = 'NA', wm = 'NA';
    if (item.watchedDate && item.watchedDate !== 'NA') {
        const parts = item.watchedDate.split('-');
        if (parts.length >= 2) { wy = parts[0]; wm = parts[1]; }
    }
    return { ...item, watchedYear: wy, watchedMonth: wm };
});

// --- RENDER & FILTER LOGIC ---
function processData(type, sourceArray) {
    if (!sourceArray) return [];
    let data = type === 'movie' ? enhanceWithDates(sourceArray) : [...sourceArray];
    const c = controls[type] || defaultControls[type];

    if (!isViewingTemp) {
        if ((type === 'travel') && c.status && c.status !== 'all') {
            data = data.filter(item => item.status === c.status);
        }
        if (c.search) {
            const q = c.search.toLowerCase();
            const titleField = type === 'book' ? 'name' : (type === 'travel' ? 'destination' : 'title');
            data = data.filter(item => (item[titleField] || '').toLowerCase().includes(q));
        }
        if (c.filterMain && c.filterSub) {
            data = data.filter(item => {
                let val = item[c.filterMain];
                if (Array.isArray(val)) return val.includes(c.filterSub);
                return val === c.filterSub;
            });
        }
    }

    data.sort((a, b) => {
        const tField = type === 'book' ? 'name' : (type === 'travel' ? 'destination' : 'title');
        const dField = type === 'movie' ? 'watchedDate' : (type === 'book' ? 'readDate' : (type === 'travel' ? 'date' : 'dateAdded'));
        
        const parseDateSafely = (val) => {
            if (!val || val === 'NA') return 0;
            const parsed = new Date(val).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };

        if (c.sort === 'title_asc') return String(a[tField] || '').localeCompare(String(b[tField] || ''));
        if (c.sort === 'title_desc') return String(b[tField] || '').localeCompare(String(a[tField] || ''));
        
        if (c.sort === 'date_desc') return parseDateSafely(b[dField]) - parseDateSafely(a[dField]);
        if (c.sort === 'date_asc') return parseDateSafely(a[dField]) - parseDateSafely(b[dField]);
        return 0;
    });
    return data;
}

function renderTable(tableId, data, typeStr, titleField) {
    const tableEl = document.getElementById(tableId);
    if (!tableEl) return;
    
    tableEl.innerHTML = data.map((item, i) => {
        let slNum = i + 1;
        if(typeStr === 'movie') slNum = ((currentMoviePage - 1) * moviesPerPage) + i + 1;

        return `
        <tr>
            <td>${slNum}</td>
            <td style="text-align: left;"><span class="clickable-title" data-type="${typeStr}" data-id="${item._id}">${item[titleField] || 'Untitled'}</span></td>
            <td><input type="checkbox" class="row-checkbox" data-type="${typeStr}" data-id="${item._id}" style="width: 16px; height: 16px; cursor: pointer;"></td>
        </tr>`;
    }).join('');
}

function renderMovies() { 
    const allData = processData('movie', isViewingTemp ? dataCache.temp_movies : dataCache.movies);
    const totalPages = Math.max(1, Math.ceil(allData.length / moviesPerPage));
    if (currentMoviePage > totalPages) currentMoviePage = totalPages;
    const startIdx = (currentMoviePage - 1) * moviesPerPage;
    const paginatedData = allData.slice(startIdx, startIdx + moviesPerPage);

    renderTable('movieList', paginatedData, 'movie', 'title'); 

    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    
    if (prevBtn && nextBtn && pageInfo) {
        prevBtn.disabled = currentMoviePage === 1;
        nextBtn.disabled = currentMoviePage === totalPages;
        pageInfo.innerText = `Page ${currentMoviePage} of ${totalPages}`;
    }
}

function renderSongs() { renderTable('songList', processData('song', isViewingTemp ? dataCache.temp_songs : dataCache.songs), 'song', 'title'); }
function renderBooks() { renderTable('bookList', processData('book', isViewingTemp ? dataCache.temp_books : dataCache.books), 'book', 'name'); }
function renderTravels() { renderTable('travelList', processData('travel', isViewingTemp ? dataCache.temp_travels : dataCache.travels), 'travel', 'destination'); }

function renderAll() { renderMovies(); renderSongs(); renderBooks(); renderTravels(); }

// --- CONTROLS EVENT LISTENERS ---
let currentSortCat = ''; 
const sortModal = document.getElementById('sortModal');

const pb = document.getElementById('prevPageBtn');
if (pb) pb.addEventListener('click', () => {
    if (currentMoviePage > 1) { currentMoviePage--; renderMovies(); }
});
const nb = document.getElementById('nextPageBtn');
if (nb) nb.addEventListener('click', () => {
    currentMoviePage++; renderMovies();
});

['movie', 'song', 'book', 'travel'].forEach(cat => {
    const s = document.getElementById(`${cat}Search`);
    if(s) s.addEventListener('input', (e) => { 
        if (cat === 'movie') currentMoviePage = 1; 
        controls[cat].search = e.target.value; 
        saveControls();
        renderAll(); 
    });
    
    const sb = document.getElementById(`${cat}SortBtn`);
    if(sb) sb.addEventListener('click', () => { currentSortCat = cat; sortModal.style.display = "block"; });
    
    if(cat === 'travel') {
        const tsf = document.getElementById(`${cat}StatusFilter`);
        if(tsf) tsf.addEventListener('change', (e) => { 
            controls[cat].status = e.target.value; 
            saveControls();
            renderAll(); 
        });
    }

    const fm = document.getElementById(`${cat}FilterMain`);
    if(fm) fm.addEventListener('change', (e) => {
        if (cat === 'movie') currentMoviePage = 1;
        controls[cat].filterMain = e.target.value;
        controls[cat].filterSub = '';
        saveControls();
        updateSubfilterUI(cat);
        renderAll();
    });
    
    const fs = document.getElementById(`${cat}FilterSub`);
    if(fs) fs.addEventListener('change', (e) => { 
        if (cat === 'movie') currentMoviePage = 1;
        controls[cat].filterSub = e.target.value; 
        saveControls();
        renderAll(); 
    });
});

document.querySelectorAll('.sort-options-list li').forEach(li => {
    li.addEventListener('click', (e) => {
        if(!currentSortCat) return;
        if(currentSortCat === 'movie') currentMoviePage = 1;
        controls[currentSortCat].sort = e.target.dataset.sort;
        saveControls();
        if(sortModal) sortModal.style.display = "none";
        renderAll();
    });
});

// --- MODALS & CLICK DELEGATION ---
const detailsModal = document.getElementById('detailsModal');
const pasteModal = document.getElementById('pasteModal');
const modalBody = document.getElementById('modalBody');

const cdm = document.getElementById('closeDetailsModal'); if(cdm) cdm.addEventListener('click', () => detailsModal.style.display = "none");
const csm = document.getElementById('closeSortModal'); if(csm) csm.addEventListener('click', () => sortModal.style.display = "none");
const cpm = document.getElementById('closePasteModal'); if(cpm) cpm.addEventListener('click', () => pasteModal.style.display = "none");
const opm = document.getElementById('openPasteModalBtn'); if(opm) opm.addEventListener('click', () => pasteModal.style.display = "block");

window.addEventListener('click', (e) => { 
    if (detailsModal && e.target == detailsModal) detailsModal.style.display = "none"; 
    if (sortModal && e.target == sortModal) sortModal.style.display = "none"; 
    if (pasteModal && e.target == pasteModal) pasteModal.style.display = "none";
});

function handleTableClick(e) {
    const target = e.target; 
    if (target.classList.contains('row-checkbox')) return; 

    const clickable = target.closest('.clickable-title');
    if (!clickable) return;

    const type = clickable.dataset.type;
    const id = clickable.dataset.id;
    
    const sourceArray = isViewingTemp ? dataCache[`temp_${type}s`] : dataCache[`${type}s`];
    if(!sourceArray) return;
    const item = sourceArray.find(i => i._id === id);
    if (!item) return;

    let html = ``;

    if (type === 'movie' && (isViewingTemp || isEditPermanentMode)) {
        const types = ["Movie", "Shortfilm", "Series", "Documentary", "Docu-Series"];
        const years = []; for(let i=2026; i>=1950; i--) years.push(i.toString());
        const langs = [...new Set([...defaults.Language, ...globalCustomData.Language])].sort();
        const ratings = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

        const makeOpts = (arr, sel, incNA) => {
            let opts = incNA ? `<option value="NA" ${sel==='NA'||!sel?'selected':''}>NA</option>` : '';
            opts += arr.map(v => `<option value="${v}" ${v===sel?'selected':''}>${v}</option>`).join('');
            return opts;
        };

        html += `<h3 style="margin-top:0;">Edit ${isViewingTemp ? 'Commits' : 'Permanent'} Entry</h3>
        <label class="input-label">Title</label><input type="text" id="editMTitle" class="edit-temp-input" value="${item.title}">
        <label class="input-label">Type</label><select id="editMType" class="edit-temp-input">${makeOpts(types, item.type, true)}</select>
        <label class="input-label">Year</label><select id="editMYear" class="edit-temp-input">${makeOpts(years, item.year, true)}</select>
        <label class="input-label">Language</label><select id="editMLang" class="edit-temp-input">${makeOpts(langs, item.lang, true)}</select>
        <label class="input-label">Genre (Comma Separated)</label><input type="text" id="editMGenre" class="edit-temp-input" value="${item.genre || ''}">
        <label class="input-label">Status</label><select id="editMStatus" class="edit-temp-input">
            <option value="watched" ${item.status==='watched'?'selected':''}>Watched</option>
            <option value="to_watch" ${item.status==='to_watch'?'selected':''}>To Watch</option>
        </select>
        <label class="input-label">Watched Date</label><input type="date" id="editMDate" class="edit-temp-input" value="${item.watchedDate && item.watchedDate !== 'NA' ? item.watchedDate : ''}">
        <label class="input-label">Rating</label><select id="editMRating" class="edit-temp-input">${makeOpts(ratings, item.rating, true)}</select>
        <label class="input-label">Notes</label><textarea id="editMNotes" class="edit-temp-input" rows="2">${item.notes || ''}</textarea>`;
        
        Object.keys(item).forEach(k => {
            if (k.startsWith('custom_')) {
                html += `<label class="input-label">${k.replace('custom_', '')}</label><input type="text" class="edit-temp-input custom-edit-field" data-key="${k}" value="${item[k]}">`;
            }
        });

        html += `<button id="saveTempEditBtn" class="save-btn" data-id="${item._id}" data-target="${isViewingTemp ? 'temp_movies' : 'movies'}" style="width:100%; margin-top:10px;">Update Changes</button>`;
    } else {
        html += `<h2>${item.title || item.name || item.destination}</h2><hr>`;
        if (type === 'movie') {
            html += `<div class="detail-item"><strong>Type:</strong> ${item.type || '-'}</div>`;
            html += `<div class="detail-item"><strong>Year:</strong> ${item.year || '-'}</div>`;
            html += `<div class="detail-item"><strong>Language:</strong> ${item.lang || '-'}</div>`;
            html += `<div class="detail-item"><strong>Genre:</strong> ${item.genre || '-'}</div>`;
            html += `<div class="detail-item"><strong>Status:</strong> ${item.status === 'watched' ? 'Watched' : 'To Watch'}</div>`;
            html += `<div class="detail-item"><strong>Date:</strong> ${item.watchedDate || '-'}</div>`;
            html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating && item.rating !== 'NA' ? item.rating+'/10' : '-'}</div>`;
        } else if (type === 'song') {
            html += `<div class="detail-item"><strong>Artist:</strong> ${item.singer || '-'}</div>`;
            html += `<div class="detail-item"><strong>Language:</strong> ${item.lang || '-'}</div>`;
            html += `<div class="detail-item"><strong>Genre:</strong> ${item.genre || '-'}</div>`;
            html += `<div class="detail-item"><strong>Added:</strong> ${item.dateAdded || '-'}</div>`;
            html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating && item.rating !== 'NA' ? item.rating+'/10' : '-'}</div>`;
        } else if (type === 'book') {
            html += `<div class="detail-item"><strong>Author:</strong> ${item.author || '-'}</div>`;
            html += `<div class="detail-item"><strong>Year:</strong> ${item.year || '-'}</div>`;
            html += `<div class="detail-item"><strong>Language:</strong> ${item.lang || '-'}</div>`;
            html += `<div class="detail-item"><strong>Genre:</strong> ${item.genre || '-'}</div>`;
            html += `<div class="detail-item"><strong>Read:</strong> ${item.readDate || '-'}</div>`;
            html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating && item.rating !== 'NA' ? item.rating+'/10' : '-'}</div>`;
        } else if (type === 'travel') {
            html += `<div class="detail-item"><strong>Location:</strong> ${item.state ? item.state+', ' : ''}${item.country || '-'}</div>`;
            html += `<div class="detail-item"><strong>Category:</strong> ${item.category || '-'}</div>`;
            html += `<div class="detail-item"><strong>Status:</strong> ${item.status === 'visited' ? 'Visited' : 'Want to go'}</div>`;
            html += `<div class="detail-item"><strong>Date:</strong> ${item.date || '-'}</div>`;
            if (item.mapLink) html += `<div class="detail-item"><strong>Map:</strong> <a href="${item.mapLink}" target="_blank" style="color:var(--link-color);">View Map</a></div>`;
        }
        
        Object.keys(item).forEach(k => {
            if (!['_id', 'title', 'name', 'destination', 'type', 'year', 'lang', 'genre', 'status', 'watchedDate', 'readDate', 'date', 'dateAdded', 'rating', 'ratingDate', 'notes', 'singer', 'author', 'state', 'country', 'category', 'mapLink', 'watchedYear', 'watchedMonth'].includes(k)) {
                let label = k.startsWith('custom_') ? k.replace('custom_', '') : k;
                html += `<div class="detail-item"><strong>${label}:</strong> ${item[k] || '-'}</div>`;
            }
        });

        html += `<div class="detail-item"><strong>Notes:</strong> <span class="notes-text">${item.notes || '-'}</span></div>`;
    }
    
    if(modalBody) modalBody.innerHTML = html;
    if(detailsModal) detailsModal.style.display = "block";
}

['movieList', 'songList', 'bookList', 'travelList'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', handleTableClick);
});

document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'saveTempEditBtn') {
        const id = e.target.dataset.id;
        const targetColl = e.target.dataset.target || "temp_movies";
        try {
            let updates = {
                title: document.getElementById('editMTitle').value.trim(),
                type: document.getElementById('editMType').value,
                year: document.getElementById('editMYear').value,
                lang: document.getElementById('editMLang').value,
                genre: document.getElementById('editMGenre').value.trim(),
                status: document.getElementById('editMStatus').value,
                watchedDate: document.getElementById('editMDate').value || 'NA',
                rating: document.getElementById('editMRating').value,
                notes: document.getElementById('editMNotes').value.trim(),
                userId: auth.currentUser.uid
            };
            
            document.querySelectorAll('.custom-edit-field').forEach(f => {
                updates[f.dataset.key] = f.value.trim();
            });

            await updateDoc(doc(db, targetColl, id), updates);
            if(detailsModal) detailsModal.style.display = "none";
            alert("Changes saved successfully!");
        } catch(err) { console.error(err); }
    }
});

// --- DATABASE FETCHING (WRAPPED IN AUTH LISTENER & UID QUERY) ---
const setupSnapshots = (collName, arrayKey, renderFunc, cat, uid) => {
    const q = query(collection(db, collName), where("userId", "==", uid));
    onSnapshot(q, (snap) => {
        dataCache[arrayKey] = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        applyControlsToUI(); 
        renderFunc();
    });
};

let snapshotsInitialized = false;

onAuthStateChanged(auth, (user) => {
    const appContainer = document.querySelector('.container');
    if (user) {
        console.log("User is logged in:", user.email);
        const ls = document.getElementById('loginScreen');
        if(ls) ls.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        if (!snapshotsInitialized) {
            setupSnapshots("movies", "movies", renderMovies, 'movie', user.uid);
            setupSnapshots("temp_movies", "temp_movies", renderMovies, 'movie', user.uid);
            setupSnapshots("songs", "songs", renderSongs, 'song', user.uid);
            setupSnapshots("temp_songs", "temp_songs", renderSongs, 'song', user.uid);
            setupSnapshots("books", "books", renderBooks, 'book', user.uid);
            setupSnapshots("temp_books", "temp_books", renderBooks, 'book', user.uid);
            setupSnapshots("travels", "travels", renderTravels, 'travel', user.uid);
            setupSnapshots("temp_travels", "temp_travels", renderTravels, 'travel', user.uid);

            const customOptsQuery = query(collection(db, "customOptions"), where("userId", "==", user.uid));
            onSnapshot(customOptsQuery, (snapshot) => {
                globalCustomData = { Language: [], movieGenre: [], songGenre: [], bookGenre: [], Artist: [], Author: [] };
                globalCustomProps = [];
                const docs = snapshot.docs.map(d => d.data());
                
                docs.forEach(d => {
                    if (d.type === 'NewProperty') {
                        if (!globalCustomProps.includes(d.name)) globalCustomProps.push(d.name);
                        globalCustomData[d.name] = [];
                    }
                });
                
                docs.forEach(d => {
                    if (d.type === 'Genre') globalCustomData.movieGenre.push(d.name); 
                    else if (d.type !== 'NewProperty' && globalCustomData[d.type]) globalCustomData[d.type].push(d.name);
                });

                const customTypeSel = document.getElementById('customType');
                if (customTypeSel) {
                    let opts = `<option value="Language">Language</option><option value="movieGenre">Movie Genre</option>
                                <option value="songGenre">Song Genre</option><option value="bookGenre">Book Genre</option>
                                <option value="Artist">Artist</option><option value="Author">Author</option>`;
                    globalCustomProps.forEach(p => opts += `<option value="${p}">${p}</option>`);
                    opts += `<option value="NewProperty" style="font-weight:bold;">+ Add New property</option>`;
                    
                    const currentVal = customTypeSel.value;
                    customTypeSel.innerHTML = opts;
                    if (customTypeSel.querySelector(`option[value="${currentVal}"]`)) customTypeSel.value = currentVal;
                    else customTypeSel.selectedIndex = 0;
                }
                
                updatePrimaryPropDropdowns();
            });
            
            snapshotsInitialized = true;
        }
    } else {
        console.log("No user is logged in.");
        const ls = document.getElementById('loginScreen');
        if(ls) ls.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }
});

// --- AUTO-SUGGEST "TO WATCH" MOVIES ---
const suggestBox = document.getElementById('movieSuggestions');

const mTitle = document.getElementById('movieTitle');
if(mTitle) mTitle.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if(suggestBox) suggestBox.innerHTML = '';
    if(!val || val === "Movie List") { if(suggestBox) suggestBox.style.display = 'none'; return; }
    
    const matches = [...dataCache.movies, ...dataCache.temp_movies].filter(m => 
        m.status === 'to_watch' && (m.title||'').toLowerCase().includes(val)
    );
    
    const uniqueMatches = []; const seen = new Set();
    matches.forEach(m => { if(!seen.has(m.title)) { seen.add(m.title); uniqueMatches.push(m); } });

    if(uniqueMatches.length > 0 && suggestBox) {
        uniqueMatches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerText = m.title;
            div.onclick = () => {
                document.getElementById('movieTitle').value = m.title;
                if(m.year && m.year !== 'NA') activeProps.movie.year = m.year;
                if(m.lang && m.lang !== 'NA') activeProps.movie.lang = m.lang;
                if(m.type && m.type !== 'NA') activeProps.movie.type = m.type;
                if(m.genre && m.genre !== 'NA') {
                    activeProps.movie.genre = m.genre.split(', ').map(g => g.trim());
                }
                activeProps.movie.status = 'watched';
                renderTags('movie');
                suggestBox.style.display = 'none';
            };
            suggestBox.appendChild(div);
        });
        suggestBox.style.display = 'block';
    } else if(suggestBox) {
        suggestBox.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if(e.target.id !== 'movieTitle' && suggestBox) suggestBox.style.display = 'none';
});

// --- SAVING LOGIC ---
const getDuplicateDoc = (titleField, titleVal, type) => {
    const t = titleVal.toLowerCase();
    let docObj = dataCache[`${type}s`].find(i => (i[titleField]||'').toLowerCase() === t);
    if(!docObj) docObj = dataCache[`temp_${type}s`].find(i => (i[titleField]||'').toLowerCase() === t);
    return docObj;
};

let pendingBulkMovies = [];
const spb = document.getElementById('savePasteBtn');
if (spb) spb.addEventListener('click', async () => {
    const text = document.getElementById('pasteArea').value;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if(lines.length === 0) return alert("List is empty.");

    const knownLangs = [...new Set([...defaults.Language, ...globalCustomData.Language])];
    pendingBulkMovies = [];

    for(let line of lines) {
        let title = line.replace(/^\d+[\.\)]?\s*/, '').trim(); 
        let extractedYear = null;
        let extractedLang = null;

        const yearMatch = title.match(/\((\d+)\)/); 
        if (yearMatch) { 
            extractedYear = yearMatch[1]; 
            title = title.replace(yearMatch[0], '').trim(); 
        }

        for (let lang of knownLangs) {
            const regex = new RegExp(`(?:[\\s\\-\\|\\[\\(]*)\\b${lang}\\b(?:[\\s\\-\\|\\]\\)]*)$`, 'i');
            const langMatch = title.match(regex);
            if (langMatch) {
                extractedLang = lang;
                title = title.replace(regex, '').trim();
                break;
            }
        }
        
        pendingBulkMovies.push({ title, extractedYear, extractedLang });
    }
    
    document.getElementById('movieTitle').value = "Movie List";
    activeProps.movie = { type: 'Movie', lang: 'NA', year: 'NA', status: 'watched', genre: [] };
    renderTags('movie');
    const mDate = document.getElementById('movieDate');
    if (mDate) mDate.value = getTodayDate();
    const mRate = document.getElementById('movieRating');
    if (mRate) mRate.value = "NA";
    
    document.getElementById('pasteArea').value = '';
    if(pasteModal) pasteModal.style.display = 'none';
    
    alert("List queued! You can now adjust the fields above. Click 'Update' to save the entire list to Commits.");
});

const smb = document.getElementById('saveMovieBtn');
if (smb) smb.addEventListener('click', async () => {
    const titleInput = document.getElementById('movieTitle').value.trim();
    if (!titleInput) return alert("Please enter a title.");
    
    const type = activeProps.movie.type || 'Movie';
    const lang = activeProps.movie.lang || 'English';
    const formYear = activeProps.movie.year || 'NA';
    const genre = activeProps.movie.genre.length > 0 ? activeProps.movie.genre.join(', ') : 'NA';
    const status = activeProps.movie.status || 'watched';
    
    const rEl = document.getElementById('movieRating');
    const rating = rEl ? rEl.value : 'NA';
    const dEl = document.getElementById('movieDate');
    const watchedDate = dEl ? (dEl.value || 'NA') : 'NA';
    const nEl = document.getElementById('movieNotes');
    const notes = nEl ? nEl.value.trim() : '';

    const customDataToSave = Object.keys(activeProps.movie).filter(k => k.startsWith('custom_')).reduce((acc, k) => { acc[k] = activeProps.movie[k]; return acc; }, {});

    if (titleInput === "Movie List" && pendingBulkMovies.length > 0) {
        let count = 0;
        for(let item of pendingBulkMovies) {
            let finalYear = item.extractedYear ? item.extractedYear : (formYear || 'NA');
            let finalLang = item.extractedLang ? item.extractedLang : (lang && lang !== 'NA' ? lang : 'NA');
            
            const dupDoc = getDuplicateDoc('title', item.title, 'movie');
            if (dupDoc) {
                if (dupDoc.status === 'to_watch' && status === 'watched') {
                    const collName = dataCache.temp_movies.some(m => m._id === dupDoc._id) ? "temp_movies" : "movies";
                    await deleteDoc(doc(db, collName, dupDoc._id));
                } else if (dupDoc.status === 'watched') {
                    continue; 
                }
            }

            try {
                await addDoc(collection(db, "temp_movies"), {
                    title: item.title, type: type||'Movie', lang: finalLang, year: finalYear, genre: genre||'NA', status, rating: rating||'NA', watchedDate: watchedDate, notes, ratingDate: rating && rating !== 'NA' ? getTodayDate() : null, userId: auth.currentUser.uid, ...customDataToSave
                });
                count++;
            } catch(err) { console.error("Error bulk adding item", err); }
        }
        
        pendingBulkMovies = [];
        document.getElementById('movieTitle').value = '';
        if (rEl) rEl.value = 'NA';
        if (nEl) nEl.value = '';
        activeProps.movie = { type: 'Movie', lang: 'English', year: 'NA', status: 'watched', genre: [] };
        renderTags('movie');
        
        alert(`Successfully parsed and added ${count} movies to Commits!`);
        if(!isViewingTemp) switchToCommitView();
        return;
    }

    const dupDoc = getDuplicateDoc('title', titleInput, 'movie');
    if (dupDoc) {
        if (dupDoc.status === 'to_watch' && status === 'watched') {
            const collName = dataCache.temp_movies.some(m => m._id === dupDoc._id) ? "temp_movies" : "movies";
            await deleteDoc(doc(db, collName, dupDoc._id));
        } else if (dupDoc.status === 'watched') {
            return alert("Duplicate found: This movie is already recorded in your Watched list!");
        } else {
            return alert(`Duplicate Entry: "${titleInput}" is already in your database!`);
        }
    }
    
    try {
        await addDoc(collection(db, "temp_movies"), { 
            title: titleInput, type: type||'', lang: lang||'English', year: formYear||'', genre: genre||'', status, rating: rating||'NA', watchedDate: watchedDate, notes, ratingDate: rating && rating !== 'NA' ? getTodayDate() : null, userId: auth.currentUser.uid, ...customDataToSave
        });
        document.getElementById('movieTitle').value = '';
        if (rEl) rEl.value = 'NA';
        if (nEl) nEl.value = '';
        activeProps.movie = { type: 'Movie', lang: 'English', year: 'NA', status: 'watched', genre: [] };
        renderTags('movie');
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) switchToCommitView();
    } catch (e) { console.error(e); }
});

const ssb = document.getElementById('saveSongBtn');
if (ssb) ssb.addEventListener('click', async () => {
    const title = document.getElementById('songTitle').value.trim();
    if (!title) return alert("Please enter a title.");
    if (getDuplicateDoc('title', title, 'song')) return alert(`Duplicate Entry: "${title}" is already in your database!`);

    const singer = activeProps.song.singer || '';
    const lang = activeProps.song.lang || 'English';
    const genre = activeProps.song.genre && activeProps.song.genre.length > 0 ? activeProps.song.genre.join(', ') : '';
    
    const rEl = document.getElementById('songRating');
    const rating = rEl ? rEl.value : 'NA';
    const nEl = document.getElementById('songNotes');
    const notes = nEl ? nEl.value.trim() : '';

    const customDataToSave = Object.keys(activeProps.song).filter(k => k.startsWith('custom_')).reduce((acc, k) => { acc[k] = activeProps.song[k]; return acc; }, {});

    try {
        await addDoc(collection(db, "temp_songs"), { 
            title, singer, lang, genre, rating, notes, dateAdded: getTodayDate(), userId: auth.currentUser.uid, ...customDataToSave
        });
        document.getElementById('songTitle').value = '';
        if (rEl) rEl.value = 'NA';
        if (nEl) nEl.value = '';
        activeProps.song = { lang: 'English', genre: [], singer: '' };
        renderTags('song');
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) switchToCommitView();
    } catch (e) { console.error(e); }
});

const sbb = document.getElementById('saveBookBtn');
if (sbb) sbb.addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    if (!name) return alert("Please enter a book name.");
    if (getDuplicateDoc('name', name, 'book')) return alert(`Duplicate Entry: "${name}" is already in your database!`);

    const author = activeProps.book.author || '';
    const lang = activeProps.book.lang || 'English';
    const year = activeProps.book.year || '';
    const genre = activeProps.book.genre && activeProps.book.genre.length > 0 ? activeProps.book.genre.join(', ') : '';
    
    const rEl = document.getElementById('bookRating');
    const rating = rEl ? rEl.value : 'NA';
    const dEl = document.getElementById('bookDate');
    const readDate = dEl ? dEl.value : 'NA';
    const nEl = document.getElementById('bookNotes');
    const notes = nEl ? nEl.value.trim() : '';

    const customDataToSave = Object.keys(activeProps.book).filter(k => k.startsWith('custom_')).reduce((acc, k) => { acc[k] = activeProps.book[k]; return acc; }, {});

    try {
        await addDoc(collection(db, "temp_books"), { 
            name, author, lang, year, genre, rating, readDate, notes, userId: auth.currentUser.uid, ...customDataToSave
        });
        document.getElementById('bookName').value = '';
        if (rEl) rEl.value = 'NA';
        if (nEl) nEl.value = '';
        activeProps.book = { lang: 'English', year: 'NA', genre: [], author: '' };
        renderTags('book');
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) switchToCommitView();
    } catch (e) { console.error(e); }
});

const stb = document.getElementById('saveTravelBtn');
if (stb) stb.addEventListener('click', async () => {
    const destination = document.getElementById('travelDest').value.trim();
    if (!destination) return alert("Please enter a destination.");
    if (getDuplicateDoc('destination', destination, 'travel')) return alert(`Duplicate Entry: "${destination}" is already in your database!`);

    const state = activeProps.travel.state || '';
    const country = activeProps.travel.country || '';
    const category = activeProps.travel.category || '';
    const status = activeProps.travel.status || 'visited';
    
    const mEl = document.getElementById('travelMap');
    const mapLink = mEl ? mEl.value.trim() : '';
    const nEl = document.getElementById('travelNotes');
    const notes = nEl ? nEl.value.trim() : '';
    const dEl = document.getElementById('travelDate');
    
    let tDate = dEl ? dEl.value : '';
    if (status === 'visited' && !tDate) tDate = getTodayDate();
    else if (status === 'want_to_go') tDate = 'NA';

    const customDataToSave = Object.keys(activeProps.travel).filter(k => k.startsWith('custom_')).reduce((acc, k) => { acc[k] = activeProps.travel[k]; return acc; }, {});

    try {
        await addDoc(collection(db, "temp_travels"), { 
            destination, state, country, category, status, date: tDate, mapLink, notes, userId: auth.currentUser.uid, ...customDataToSave
        });
        document.getElementById('travelDest').value = '';
        if (mEl) mEl.value = '';
        if (nEl) nEl.value = '';
        if (dEl) dEl.value = '';
        activeProps.travel = { status: 'visited' };
        renderTags('travel');
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) switchToCommitView();
    } catch (e) { console.error(e); }
});
