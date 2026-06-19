import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBa4irQ4cFjxmyRMGRx9YKAmfmiQUnli6w",
    authDomain: "myshelf-68156.firebaseapp.com",
    projectId: "myshelf-68156",
    storageBucket: "myshelf-68156.firebasestorage.app",
    messagingSenderId: "476392236584",
    appId: "1:476392236584:web:439915d82c93bfb988f71d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

const trashIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="red" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

// --- DYNAMIC UI ADJUSTMENTS (Heading Shifting, Checkbox Setup, Filter Migration & Row Height) ---
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
    
    headerBottom.insertBefore(mainDbHeading, document.getElementById('homeBtn'));
}

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
document.getElementById('movieDate').value = getTodayDate();
document.getElementById('bookDate').value = getTodayDate();

const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
document.getElementById('themeSelect').value = currentTheme;
document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    localStorage.setItem('theme', e.target.value);
});

const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const toggleMenu = (show) => {
    if(show) { sideMenu.classList.add('open'); menuOverlay.classList.add('open'); }
    else { sideMenu.classList.remove('open'); menuOverlay.classList.remove('open'); }
}
document.getElementById('menuBtn').addEventListener('click', () => toggleMenu(true));
document.getElementById('closeMenuBtn').addEventListener('click', () => toggleMenu(false));
menuOverlay.addEventListener('click', () => toggleMenu(false));

const views = document.querySelectorAll('.view');
function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    localStorage.setItem('lastView', viewId);
    
    const mainDbHeading = document.getElementById('mainDatabaseHeading');
    if (mainDbHeading) {
        mainDbHeading.style.display = (viewId === 'homeView' || viewId === 'movieView') ? 'none' : 'block';
    }
}
showView(localStorage.getItem('lastView') || 'homeView');

document.getElementById('homeBtn').addEventListener('click', () => {
    const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
    if (activeView === 'archiveView') {
        showView('movieView');
    } else {
        showView('homeView');
    }
});

document.getElementById('navMovie').addEventListener('click', () => showView('movieView'));
document.getElementById('navSong').addEventListener('click', () => showView('songView'));
document.getElementById('navBook').addEventListener('click', () => showView('bookView'));
document.getElementById('navTravel').addEventListener('click', () => showView('travelView'));

// --- DYNAMIC CUSTOMIZATIONS & PROPERTIES ---
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

onSnapshot(collection(db, "customOptions"), (snapshot) => {
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
    if (prop === 'state' || prop === 'country') return null; // Indicator for free text input
    return [];
};

window.removeCatProp = (cat, prop, val, isGenre) => {
    if(isGenre) {
        activeProps[cat].genre = activeProps[cat].genre.filter(g => g !== val);
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

    if (props.genre && props.genre.length > 0) {
        html += `<div style="flex-basis: 100%; height: 0;"></div>`;
        const genreStr = props.genre.join(', ');
        html += `<span class="prop-tag" style="background:var(--card-bg); border:1px solid var(--border-color); padding:6px 10px; border-radius:15px; font-size:13px; display:flex; align-items:center; gap:6px;">
            <strong>Genre:</strong> ${genreStr}
            <span style="cursor:pointer; color:#dc3545; font-weight:bold; font-size:16px; line-height:1;" onclick="activeProps['${cat}'].genre = []; renderTags('${cat}');">&times;</span>
        </span>`;
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
if (!controls) {
    controls = JSON.parse(JSON.stringify(defaultControls));
} else if (controls.movie && controls.movie.status !== undefined) {
    if (controls.movie.status !== 'all' && controls.movie.status !== '') {
        controls.movie.filterMain = 'status';
        controls.movie.filterSub = controls.movie.status;
    }
    delete controls.movie.status;
    localStorage.setItem('myShelfControls', JSON.stringify(controls));
}

const saveControls = () => localStorage.setItem('myShelfControls', JSON.stringify(controls));

const updateSubfilterUI = (cat) => {
    const sub = document.getElementById(`${cat}FilterSub`);
    const mainVal = controls[cat].filterMain;
    
    if (!mainVal) {
        sub.disabled = true; sub.innerHTML = '<option value="">Subfilter</option>';
        return;
    }
    sub.disabled = false;

    if (cat === 'movie' && mainVal === 'status') {
        sub.innerHTML = `<option value="">All Matches</option>
                         <option value="watched" ${controls[cat].filterSub === 'watched' ? 'selected' : ''}>Watched</option>
                         <option value="to_watch" ${controls[cat].filterSub === 'to_watch' ? 'selected' : ''}>Not watched</option>`;
        return;
    }

    let source = isViewingTemp ? dataCache[`temp_${cat}s`] : dataCache[`${cat}s`];
    if (cat === 'movie') source = enhanceWithDates(source); 
    
    const uniqueVals = [...new Set(source.map(item => item[mainVal]).filter(Boolean))].sort();
    sub.innerHTML = '<option value="">All Matches</option>' + uniqueVals.map(v => `<option value="${v}" ${v === controls[cat].filterSub ? 'selected' : ''}>${v}</option>`).join('');
};

function applyControlsToUI() {
    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        document.getElementById(`${cat}Search`).value = controls[cat].search || '';
        if(cat === 'travel') document.getElementById('travelStatusFilter').value = controls[cat].status || 'all';
        document.getElementById(`${cat}FilterMain`).value = controls[cat].filterMain || '';
        updateSubfilterUI(cat);
    });
}
applyControlsToUI();

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


document.getElementById('saveCustomBtn').addEventListener('click', async () => {
    const name = document.getElementById('customValue').value.trim();
    const type = document.getElementById('customType').value; 
    if (!name) return alert("Please enter a string.");
    try {
        await addDoc(collection(db, "customOptions"), { name, type });
        document.getElementById('customValue').value = '';
        alert("Added to your custom options!");
    } catch (e) { console.error(e); }
});

// --- DATABASE DROPDOWN MENU LOGIC ---
const dbSelect = document.getElementById('dbSelect');
const dbPreviewBtn = document.getElementById('dbPreviewBtn');
const dbEditBtn = document.getElementById('dbEditBtn');
const dbMergeBtn = document.getElementById('dbMergeBtn');

dbSelect.addEventListener('change', (e) => {
    if (e.target.value === 'archive') {
        dbEditBtn.style.display = 'block';
        dbMergeBtn.style.display = 'none';
    } else {
        dbEditBtn.style.display = 'none';
        dbMergeBtn.style.display = 'block';
        isEditPermanentMode = false;
        dbEditBtn.style.background = '#ffc107';
        dbEditBtn.style.color = '#000';
    }
});

dbEditBtn.addEventListener('click', () => {
    isEditPermanentMode = !isEditPermanentMode;
    dbEditBtn.style.background = isEditPermanentMode ? '#28a745' : '#ffc107';
    dbEditBtn.style.color = isEditPermanentMode ? '#fff' : '#000';
    alert(isEditPermanentMode ? "Permanent Edit Mode Enabled. Click an entry in the database to edit." : "Permanent Edit Mode Disabled.");
    
    if (isEditPermanentMode) {
        isViewingTemp = false;
        dbSelect.value = 'archive';
        renderAll();
        const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
        if (activeView === 'movieView' || activeView === 'homeView') {
            showView('archiveView');
        }
    }
    toggleMenu(false);
});

dbPreviewBtn.addEventListener('click', () => {
    const isCommit = dbSelect.value === 'commit';
    isViewingTemp = isCommit;
    currentMoviePage = 1; 

    const headText = isViewingTemp ? "Temporary Database" : "Database";
    const mainDbHeading = document.getElementById('mainDatabaseHeading');
    if (mainDbHeading) mainDbHeading.innerText = headText;

    document.getElementById('permActionsSection').style.display = isViewingTemp ? "none" : "block";

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
    document.getElementById('dbSelect').value = 'commit';
    document.getElementById('dbSelect').dispatchEvent(new Event('change'));
    document.getElementById('dbPreviewBtn').click();
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
        
        dbSelect.value = 'archive';
        dbSelect.dispatchEvent(new Event('change'));
        dbPreviewBtn.click();
    });
});

dbMergeBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to merge all temporary entries into your permanent list?")) return;
    try {
        const moveData = async (tempArray, collName, tempCollName) => {
            for (let item of tempArray) {
                const { _id, ...cleanData } = item;
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
            dbSelect.value = 'archive';
            dbSelect.dispatchEvent(new Event('change'));
            dbPreviewBtn.click();
        } 
    } catch (e) { console.error(e); alert("Merge encountered an error."); }
});

// --- CLEAR VISIBLE PERMANENT ENTRIES ---
document.getElementById('clearVisibleBtn').addEventListener('click', async () => {
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
    let data = type === 'movie' ? enhanceWithDates(sourceArray) : [...sourceArray];
    const c = controls[type];

    if (!isViewingTemp) {
        if ((type === 'travel') && c.status && c.status !== 'all') {
            data = data.filter(item => item.status === c.status);
        }
        if (c.search) {
            const q = c.search.toLowerCase();
            const titleField = type === 'book' ? 'name' : (type === 'travel' ? 'destination' : 'title');
            data = data.filter(item => (item[titleField] || '').toLowerCase().includes(q));
        }
        if (c.filterMain && c.filterSub) data = data.filter(item => item[c.filterMain] === c.filterSub);
    }

    data.sort((a, b) => {
        const tField = type === 'book' ? 'name' : (type === 'travel' ? 'destination' : 'title');
        const dField = type === 'movie' ? 'watchedDate' : (type === 'book' ? 'readDate' : (type === 'travel' ? 'date' : 'dateAdded'));
        if (c.sort === 'title_asc') return (a[tField] || '').localeCompare(b[tField] || '');
        if (c.sort === 'title_desc') return (b[tField] || '').localeCompare(a[tField] || '');
        if (c.sort === 'date_desc') return new Date(b[dField] || 0) - new Date(a[dField] || 0);
        if (c.sort === 'date_asc') return new Date(a[dField] || 0) - new Date(b[dField] || 0);
        return 0;
    });
    return data;
}

function renderTable(tableId, data, typeStr, titleField) {
    document.getElementById(tableId).innerHTML = data.map((item, i) => {
        let slNum = i + 1;
        if(typeStr === 'movie') slNum = ((currentMoviePage - 1) * moviesPerPage) + i + 1;

        return `
        <tr>
            <td>${slNum}</td>
            <td style="text-align: left;"><span class="clickable-title" data-type="${typeStr}" data-id="${item._id}">${item[titleField]}</span></td>
            <td><input type="checkbox" class="row-checkbox" data-type="${typeStr}" data-id="${item._id}" style="width: 16px; height: 16px; cursor: pointer;"></td>
        </tr>`;
    }).join('');
}

function renderMovies() { 
    const allData = processData('movie', isViewingTemp ? dataCache.temp_movies : dataCache.movies);
    const totalPages = Math.ceil(allData.length / moviesPerPage) || 1;
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

document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentMoviePage > 1) { currentMoviePage--; renderMovies(); }
});
document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentMoviePage++; renderMovies();
});

['movie', 'song', 'book', 'travel'].forEach(cat => {
    document.getElementById(`${cat}Search`).addEventListener('input', (e) => { 
        if (cat === 'movie') currentMoviePage = 1; 
        controls[cat].search = e.target.value; 
        saveControls();
        renderAll(); 
    });
    document.getElementById(`${cat}SortBtn`).addEventListener('click', () => { currentSortCat = cat; sortModal.style.display = "block"; });
    
    if(cat === 'travel') {
        document.getElementById(`${cat}StatusFilter`).addEventListener('change', (e) => { 
            controls[cat].status = e.target.value; 
            saveControls();
            renderAll(); 
        });
    }

    document.getElementById(`${cat}FilterMain`).addEventListener('change', (e) => {
        if (cat === 'movie') currentMoviePage = 1;
        controls[cat].filterMain = e.target.value;
        controls[cat].filterSub = '';
        saveControls();
        updateSubfilterUI(cat);
        renderAll();
    });
    document.getElementById(`${cat}FilterSub`).addEventListener('change', (e) => { 
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
        sortModal.style.display = "none";
        renderAll();
    });
});

// --- MODALS & CLICK DELEGATION ---
const detailsModal = document.getElementById('detailsModal');
const pasteModal = document.getElementById('pasteModal');
const modalBody = document.getElementById('modalBody');

document.getElementById('closeDetailsModal').addEventListener('click', () => detailsModal.style.display = "none");
document.getElementById('closeSortModal').addEventListener('click', () => sortModal.style.display = "none");
document.getElementById('closePasteModal').addEventListener('click', () => pasteModal.style.display = "none");
document.getElementById('openPasteModalBtn').addEventListener('click', () => pasteModal.style.display = "block");

window.addEventListener('click', (e) => { 
    if (e.target == detailsModal) detailsModal.style.display = "none"; 
    if (e.target == sortModal) sortModal.style.display = "none"; 
    if (e.target == pasteModal) pasteModal.style.display = "none";
});

function handleTableClick(e) {
    const target = e.target; 
    if (target.classList.contains('row-checkbox')) return; 

    const clickable = target.closest('.clickable-title');
    if (!clickable) return;

    const type = clickable.dataset.type;
    const id = clickable.dataset.id;
    
    const sourceArray = isViewingTemp ? dataCache[`temp_${type}s`] : dataCache[`${type}s`];
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
    
    modalBody.innerHTML = html;
    detailsModal.style.display = "block";
}

['movieList', 'songList', 'bookList', 'travelList'].forEach(id => {
    document.getElementById(id).addEventListener('click', handleTableClick);
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
                notes: document.getElementById('editMNotes').value.trim()
            };
            
            document.querySelectorAll('.custom-edit-field').forEach(f => {
                updates[f.dataset.key] = f.value.trim();
            });

            await updateDoc(doc(db, targetColl, id), updates);
            document.getElementById('detailsModal').style.display = "none";
            alert("Changes saved successfully!");
        } catch(err) { console.error(err); }
    }
});

// --- DATABASE FETCHING ---
const setupSnapshots = (collName, arrayKey, renderFunc, cat) => {
    onSnapshot(collection(db, collName), (snap) => {
        dataCache[arrayKey] = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        updateSubfilterUI(cat);
        renderFunc();
    });
};
setupSnapshots("movies", "movies", renderMovies, 'movie');
setupSnapshots("temp_movies", "temp_movies", renderMovies, 'movie');
setupSnapshots("songs", "songs", renderSongs, 'song');
setupSnapshots("temp_songs", "temp_songs", renderSongs, 'song');
setupSnapshots("books", "books", renderBooks, 'book');
setupSnapshots("temp_books", "temp_books", renderBooks, 'book');
setupSnapshots("travels", "travels", renderTravels, 'travel');
setupSnapshots("temp_travels", "temp_travels", renderTravels, 'travel');

// --- AUTO-SUGGEST "TO WATCH" MOVIES ---
const suggestBox = document.getElementById('movieSuggestions');

document.getElementById('movieTitle').addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    suggestBox.innerHTML = '';
    if(!val || val === "Movie List") { suggestBox.style.display = 'none'; return; }
    
    const matches = [...dataCache.movies, ...dataCache.temp_movies].filter(m => 
        m.status === 'to_watch' && (m.title||'').toLowerCase().includes(val)
    );
    
    const uniqueMatches = []; const seen = new Set();
    matches.forEach(m => { if(!seen.has(m.title)) { seen.add(m.title); uniqueMatches.push(m); } });

    if(uniqueMatches.length > 0) {
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
    } else {
        suggestBox.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if(e.target.id !== 'movieTitle') suggestBox.style.display = 'none';
});

// --- SAVING LOGIC ---
const getDuplicateDoc = (titleField, titleVal, type) => {
    const t = titleVal.toLowerCase();
    let docObj = dataCache[`${type}s`].find(i => (i[titleField]||'').toLowerCase() === t);
    if(!docObj) docObj = dataCache[`temp_${type}s`].find(i => (i[titleField]||'').toLowerCase() === t);
    return docObj;
};

let pendingBulkMovies = [];
document.getElementById('savePasteBtn').addEventListener('click', async () => {
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
    pasteModal.style.display = 'none';
    
    alert("List queued! You can now adjust the fields above. Click 'Update' to save the entire list to Commits.");
});

document.getElementById('saveMovieBtn').addEventListener('click', async () => {
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
                    title: item.title, type: type||'Movie', lang: finalLang, year: finalYear, genre: genre||'NA', status, rating: rating||'NA', watchedDate: watchedDate, notes, ratingDate: rating && rating !== 'NA' ? getTodayDate() : null, ...customDataToSave
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
            title: titleInput, type: type||'', lang: lang||'English', year: formYear||'', genre: genre||'', status, rating: rating||'NA', watchedDate: watchedDate, notes, ratingDate: rating && rating !== 'NA' ? getTodayDate() : null, ...customDataToSave
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

if (document.getElementById('saveSongBtn')) document.getElementById('saveSongBtn').addEventListener('click', async () => {
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
            title, singer, lang, genre, rating, notes, dateAdded: getTodayDate(), ...customDataToSave
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

if (document.getElementById('saveBookBtn')) document.getElementById('saveBookBtn').addEventListener('click', async () => {
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
            name, author, lang, year, genre, rating, readDate, notes, ...customDataToSave
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

if (document.getElementById('saveTravelBtn')) document.getElementById('saveTravelBtn').addEventListener('click', async () => {
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
            destination, state, country, category, status, date: tDate, mapLink, notes, ...customDataToSave
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
