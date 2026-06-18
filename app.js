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

// --- UI INITIALIZATION & DEFAULTS ---
function populateYears() {
    let options = '<option value="">Select Year</option>';
    for (let i = 2026; i >= 1950; i--) options += `<option value="${i}">${i}</option>`;
    document.getElementById('movieYear').innerHTML = options;
    document.getElementById('bookYear').innerHTML = options;
}
populateYears();

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
}
showView(localStorage.getItem('lastView') || 'homeView');

document.getElementById('homeBtn').addEventListener('click', () => showView('homeView'));
document.getElementById('navMovie').addEventListener('click', () => showView('movieView'));
document.getElementById('navSong').addEventListener('click', () => showView('songView'));
document.getElementById('navBook').addEventListener('click', () => showView('bookView'));
document.getElementById('navTravel').addEventListener('click', () => showView('travelView'));

// --- DYNAMIC CUSTOMIZATIONS ---
const defaults = {
    movieGenre: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"],
    songGenre: ["Rock", "Pop", "Jazz", "Classical", "Hip Hop", "Country"],
    bookGenre: ["Fiction", "Non-Fiction", "Biography", "Fantasy", "Mystery"],
    Language: ["English", "Hindi", "Telugu", "Tamil", "Malayalam", "Japanese", "Spanish"]
};

let globalCustomData = { Language: [], movieGenre: [], songGenre: [], bookGenre: [], Artist: [], Author: [] };

onSnapshot(collection(db, "customOptions"), (snapshot) => {
    globalCustomData = { Language: [], movieGenre: [], songGenre: [], bookGenre: [], Artist: [], Author: [] };
    snapshot.forEach(doc => {
        const d = doc.data();
        if(d.type === 'Genre') globalCustomData.movieGenre.push(d.name); 
        else if(globalCustomData[d.type]) globalCustomData[d.type].push(d.name);
    });

    const populate = (id, defType, typeStr) => {
        const items = [...new Set([...(defaults[defType] || []), ...globalCustomData[defType]])].sort();
        document.getElementById(id).innerHTML = `<option value="" disabled>Select ${typeStr}</option>` 
            + items.map(i => `<option value="${i}">${i}</option>`).join('');
            
        if (defType === 'Language') document.getElementById(id).value = 'English';
    };

    populate('movieLang', 'Language', 'Language'); populate('songLang', 'Language', 'Language'); populate('bookLang', 'Language', 'Language');
    populate('movieGenre', 'movieGenre', 'Genre'); populate('songGenre', 'songGenre', 'Genre'); populate('bookGenre', 'bookGenre', 'Genre');
    populate('songSinger', 'Artist', 'Artist'); populate('bookAuthor', 'Author', 'Author');
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

// --- GLOBAL STATE & CACHE ---
let isViewingTemp = false;
const dataCache = { 
    movies: [], temp_movies: [], songs: [], temp_songs: [], books: [], temp_books: [], travels: [], temp_travels: [] 
};

const controls = {
    movie: { search: '', sort: 'date_desc', status: 'watched', filterMain: '', filterSub: '' },
    song: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    book: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    travel: { search: '', sort: 'date_desc', status: 'all', filterMain: '', filterSub: '' }
};

document.getElementById('toggleTempBtn').addEventListener('click', () => {
    isViewingTemp = !isViewingTemp;
    const btn = document.getElementById('toggleTempBtn');
    btn.innerText = isViewingTemp ? "Permanent List" : "Commits";
    btn.style.background = isViewingTemp ? "#17a2b8" : "#ff9800";
    
    const headText = isViewingTemp ? "Temporary Database" : "Database";
    document.getElementById('movieListHeading').innerText = headText;
    document.getElementById('songListHeading').innerText = headText;
    document.getElementById('bookListHeading').innerText = headText;
    document.getElementById('travelListHeading').innerText = headText;

    // Toggle specific views based on permanent/temp status
    document.getElementById('permActionsSection').style.display = isViewingTemp ? "none" : "block";
    
    document.querySelectorAll('.temp-discard-btn').forEach(dBtn => {
        dBtn.style.display = isViewingTemp ? "inline-block" : "none";
    });

    document.querySelectorAll('.list-controls').forEach(ctrl => {
        ctrl.style.display = isViewingTemp ? "none" : "flex";
    });

    ['movie', 'song', 'book', 'travel'].forEach(cat => {
        controls[cat] = { search: '', sort: 'date_desc', status: cat === 'movie' ? 'watched' : 'all', filterMain: '', filterSub: '' };
        document.getElementById(`${cat}Search`).value = '';
        if(cat === 'movie') document.getElementById('movieStatusFilter').value = 'watched';
        if(cat === 'travel') document.getElementById('travelStatusFilter').value = 'all';
        document.getElementById(`${cat}FilterMain`).value = '';
        document.getElementById(`${cat}FilterSub`).disabled = true;
        document.getElementById(`${cat}FilterSub`).innerHTML = '<option value="">Subfilter</option>';
    });

    renderAll();
    toggleMenu(false);
});

// --- DISCARD ALL TEMPORARY DATA ---
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
        document.getElementById('toggleTempBtn').click(); 
    });
});

document.getElementById('mergeBtn').addEventListener('click', async () => {
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
        if (isViewingTemp) document.getElementById('toggleTempBtn').click(); 
    } catch (e) { console.error(e); alert("Merge encountered an error."); }
});

// --- CLEAR VISIBLE PERMANENT ENTRIES ---
document.getElementById('clearVisibleBtn').addEventListener('click', async () => {
    if (isViewingTemp) return alert("This action is only available for the permanent database.");

    // Identify which tab is currently active
    const activeView = Array.from(document.querySelectorAll('.view')).find(v => v.classList.contains('active')).id;
    let cat = '', collName = '';
    if (activeView === 'movieView') { cat = 'movie'; collName = 'movies'; }
    else if (activeView === 'songView') { cat = 'song'; collName = 'songs'; }
    else if (activeView === 'bookView') { cat = 'book'; collName = 'books'; }
    else if (activeView === 'travelView') { cat = 'travel'; collName = 'travels'; }

    if (!cat) return;

    // processData() specifically applies all active search/filter logic to return exactly what is shown in the table
    const visibleData = processData(cat, dataCache[`${cat}s`]);
    if (visibleData.length === 0) return alert("No visible entries to clear.");

    if (!confirm(`Are you sure you want to permanently delete the ${visibleData.length} visible entries? This action cannot be undone.`)) return;

    try {
        for (let item of visibleData) {
            await deleteDoc(doc(db, collName, item._id));
        }
        alert(`Successfully deleted ${visibleData.length} entries.`);
        toggleMenu(false); // Close sidebar after clearing
    } catch (e) { 
        console.error(e); 
        alert("Error occurred while deleting entries."); 
    }
});

// Helper for filtering Watched Year & Month natively
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
        if ((type === 'movie' || type === 'travel') && c.status !== 'all') {
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
    document.getElementById(tableId).innerHTML = data.map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td style="text-align: left;"><span class="clickable-title" data-type="${typeStr}" data-id="${item._id}">${item[titleField]}</span></td>
            <td><button class="del-btn" data-type="${typeStr}" data-id="${item._id}">${trashIcon}</button></td>
        </tr>`).join('');
}

function renderMovies() { renderTable('movieList', processData('movie', isViewingTemp ? dataCache.temp_movies : dataCache.movies), 'movie', 'title'); }
function renderSongs() { renderTable('songList', processData('song', isViewingTemp ? dataCache.temp_songs : dataCache.songs), 'song', 'title'); }
function renderBooks() { renderTable('bookList', processData('book', isViewingTemp ? dataCache.temp_books : dataCache.books), 'book', 'name'); }
function renderTravels() { renderTable('travelList', processData('travel', isViewingTemp ? dataCache.temp_travels : dataCache.travels), 'travel', 'destination'); }

function renderAll() { renderMovies(); renderSongs(); renderBooks(); renderTravels(); }

// --- CONTROLS EVENT LISTENERS ---
let currentSortCat = ''; 
const sortModal = document.getElementById('sortModal');

['movie', 'song', 'book', 'travel'].forEach(cat => {
    document.getElementById(`${cat}Search`).addEventListener('input', (e) => { controls[cat].search = e.target.value; renderAll(); });
    document.getElementById(`${cat}SortBtn`).addEventListener('click', () => { currentSortCat = cat; sortModal.style.display = "block"; });
    
    if(cat === 'movie' || cat === 'travel') {
        document.getElementById(`${cat}StatusFilter`).addEventListener('change', (e) => { controls[cat].status = e.target.value; renderAll(); });
    }

    document.getElementById(`${cat}FilterMain`).addEventListener('change', (e) => {
        controls[cat].filterMain = e.target.value;
        controls[cat].filterSub = '';
        const sub = document.getElementById(`${cat}FilterSub`);
        
        if (!e.target.value) {
            sub.disabled = true; sub.innerHTML = '<option value="">Subfilter</option>';
        } else {
            sub.disabled = false;
            let source = isViewingTemp ? dataCache[`temp_${cat}s`] : dataCache[`${cat}s`];
            if (cat === 'movie') source = enhanceWithDates(source); 
            
            const uniqueVals = [...new Set(source.map(item => item[e.target.value]).filter(Boolean))].sort();
            sub.innerHTML = '<option value="">All Matches</option>' + uniqueVals.map(v => `<option value="${v}">${v}</option>`).join('');
        }
        renderAll();
    });
    document.getElementById(`${cat}FilterSub`).addEventListener('change', (e) => { controls[cat].filterSub = e.target.value; renderAll(); });
});

document.querySelectorAll('.sort-options-list li').forEach(li => {
    li.addEventListener('click', (e) => {
        if(!currentSortCat) return;
        controls[currentSortCat].sort = e.target.dataset.sort;
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
    const target = e.target.closest('button') || e.target; 
    const type = target.dataset.type;
    const id = target.dataset.id;
    if (!type || !id) return;

    if (target.classList.contains('del-btn')) {
        if (confirm("Are you sure you want to remove this?")) {
            const targetCollection = isViewingTemp ? `temp_${type}s` : `${type}s`;
            deleteDoc(doc(db, targetCollection, id));
        }
    } else if (target.classList.contains('clickable-title')) {
        const sourceArray = isViewingTemp ? dataCache[`temp_${type}s`] : dataCache[`${type}s`];
        const item = sourceArray.find(i => i._id === id);
        if (!item) return;

        let html = ``;

        // INLINE EDIT FOR TEMPORARY VIEW 
        if (isViewingTemp && type === 'movie') {
            const types = ["Movie", "Shortfilm", "Series", "Documentary", "Docu-Series"];
            const years = []; for(let i=2026; i>=1950; i--) years.push(i.toString());
            const langs = [...new Set([...defaults.Language, ...globalCustomData.Language])].sort();
            const genres = [...new Set([...defaults.movieGenre, ...globalCustomData.movieGenre])].sort();
            const ratings = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

            const makeOpts = (arr, sel, incNA) => {
                let opts = incNA ? `<option value="NA" ${sel==='NA'||!sel?'selected':''}>NA</option>` : '';
                opts += arr.map(v => `<option value="${v}" ${v===sel?'selected':''}>${v}</option>`).join('');
                return opts;
            };

            html += `<h3 style="margin-top:0;">Edit Commits Entry</h3>
            <label class="input-label">Title</label><input type="text" id="editMTitle" class="edit-temp-input" value="${item.title}">
            <label class="input-label">Type</label><select id="editMType" class="edit-temp-input">${makeOpts(types, item.type, true)}</select>
            <label class="input-label">Year</label><select id="editMYear" class="edit-temp-input">${makeOpts(years, item.year, true)}</select>
            <label class="input-label">Language</label><select id="editMLang" class="edit-temp-input">${makeOpts(langs, item.lang, true)}</select>
            <label class="input-label">Genre</label><select id="editMGenre" class="edit-temp-input">${makeOpts(genres, item.genre, true)}</select>
            <label class="input-label">Status</label><select id="editMStatus" class="edit-temp-input">
                <option value="watched" ${item.status==='watched'?'selected':''}>Watched</option>
                <option value="to_watch" ${item.status==='to_watch'?'selected':''}>To Watch</option>
            </select>
            <label class="input-label">Watched Date</label><input type="date" id="editMDate" class="edit-temp-input" value="${item.watchedDate && item.watchedDate !== 'NA' ? item.watchedDate : ''}">
            <label class="input-label">Rating</label><select id="editMRating" class="edit-temp-input">${makeOpts(ratings, item.rating, true)}</select>
            <label class="input-label">Notes</label><textarea id="editMNotes" class="edit-temp-input" rows="2">${item.notes || ''}</textarea>
            <button id="saveTempEditBtn" class="save-btn" data-id="${item._id}" style="width:100%; margin-top:10px;">Update Changes</button>`;
        } else {
            // STANDARD PERMANENT LIST VIEW
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
                html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating ? item.rating+'/10' : '-'}</div>`;
            } else if (type === 'book') {
                html += `<div class="detail-item"><strong>Author:</strong> ${item.author || '-'}</div>`;
                html += `<div class="detail-item"><strong>Year:</strong> ${item.year || '-'}</div>`;
                html += `<div class="detail-item"><strong>Language:</strong> ${item.lang || '-'}</div>`;
                html += `<div class="detail-item"><strong>Genre:</strong> ${item.genre || '-'}</div>`;
                html += `<div class="detail-item"><strong>Read:</strong> ${item.readDate || '-'}</div>`;
                html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating ? item.rating+'/10' : '-'}</div>`;
            } else if (type === 'travel') {
                html += `<div class="detail-item"><strong>Location:</strong> ${item.state ? item.state+', ' : ''}${item.country || '-'}</div>`;
                html += `<div class="detail-item"><strong>Category:</strong> ${item.category || '-'}</div>`;
                html += `<div class="detail-item"><strong>Status:</strong> ${item.status === 'visited' ? 'Visited' : 'Want to go'}</div>`;
                html += `<div class="detail-item"><strong>Date:</strong> ${item.date || '-'}</div>`;
                if (item.mapLink) html += `<div class="detail-item"><strong>Map:</strong> <a href="${item.mapLink}" target="_blank" style="color:var(--link-color);">View Map</a></div>`;
            }
            html += `<div class="detail-item"><strong>Notes:</strong> <span class="notes-text">${item.notes || '-'}</span></div>`;
        }
        
        modalBody.innerHTML = html;
        detailsModal.style.display = "block";
    }
}

['movieList', 'songList', 'bookList', 'travelList'].forEach(id => {
    document.getElementById(id).addEventListener('click', handleTableClick);
});

// Editable Details Modal Save Logic
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'saveTempEditBtn') {
        const id = e.target.dataset.id;
        try {
            await updateDoc(doc(db, "temp_movies", id), {
                title: document.getElementById('editMTitle').value.trim(),
                type: document.getElementById('editMType').value,
                year: document.getElementById('editMYear').value,
                lang: document.getElementById('editMLang').value,
                genre: document.getElementById('editMGenre').value,
                status: document.getElementById('editMStatus').value,
                watchedDate: document.getElementById('editMDate').value || 'NA',
                rating: document.getElementById('editMRating').value,
                notes: document.getElementById('editMNotes').value.trim()
            });
            document.getElementById('detailsModal').style.display = "none";
            alert("Commit changes saved successfully!");
        } catch(err) { console.error(err); }
    }
});

// --- DATABASE FETCHING ---
const setupSnapshots = (collName, arrayKey, renderFunc) => {
    onSnapshot(collection(db, collName), (snap) => {
        dataCache[arrayKey] = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        renderFunc();
    });
};
setupSnapshots("movies", "movies", renderMovies);
setupSnapshots("temp_movies", "temp_movies", renderMovies);
setupSnapshots("songs", "songs", renderSongs);
setupSnapshots("temp_songs", "temp_songs", renderSongs);
setupSnapshots("books", "books", renderBooks);
setupSnapshots("temp_books", "temp_books", renderBooks);
setupSnapshots("travels", "travels", renderTravels);
setupSnapshots("temp_travels", "temp_travels", renderTravels);

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
                if(m.year && m.year !== 'NA') document.getElementById('movieYear').value = m.year;
                if(m.lang && m.lang !== 'NA') document.getElementById('movieLang').value = m.lang;
                if(m.type && m.type !== 'NA') document.getElementById('movieType').value = m.type;
                if(m.genre && m.genre !== 'NA') document.getElementById('movieGenre').value = m.genre;
                document.getElementById('movieStatus').value = 'watched'; 
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

// Paste Note Bulk Handler
document.getElementById('savePasteBtn').addEventListener('click', async () => {
    const text = document.getElementById('pasteArea').value;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if(lines.length === 0) return alert("List is empty.");

    let count = 0;
    for(let line of lines) {
        let title = line.replace(/^\d+[\.\)]?\s*/, '').trim(); 
        let year = 'NA';
        const match = title.match(/\((\d+)\)/); 
        if (match) { year = match[1]; title = title.replace(match[0], '').trim(); }
        
        const existing = getDuplicateDoc('title', title, 'movie');
        if (existing && existing.status === 'watched') continue;

        try {
            await addDoc(collection(db, "temp_movies"), {
                title, type: 'NA', lang: 'NA', year: year, genre: 'NA', status: 'watched', rating: 'NA', watchedDate: 'NA', notes: '', ratingDate: null
            });
            count++;
        } catch(err) { console.error("Error bulk adding item", err); }
    }
    
    document.getElementById('movieTitle').value = "Movie List";
    document.getElementById('pasteArea').value = '';
    pasteModal.style.display = 'none';
    alert(`Successfully parsed and added ${count} movies!`);
    
    if(!isViewingTemp) document.getElementById('toggleTempBtn').click();
});

// Standard Updaters
document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const titleInput = document.getElementById('movieTitle').value.trim();
    if (!titleInput) return alert("Please enter a title.");
    
    if (titleInput === "Movie List") {
        document.getElementById('movieTitle').value = '';
        return alert("Your list was committed! Clear 'Movie List' to add single entries again.");
    }

    const type = document.getElementById('movieType').value;
    const lang = document.getElementById('movieLang').value;
    let year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value;
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    const watchedDate = document.getElementById('movieDate').value;
    const notes = document.getElementById('movieNotes').value.trim();

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
            title: titleInput, type: type||'', lang: lang||'English', year: year||'', genre: genre||'', status, rating: rating||'', watchedDate: watchedDate||'', notes, ratingDate: rating ? getTodayDate() : null 
        });
        document.getElementById('movieTitle').value = '';
        document.getElementById('movieRating').selectedIndex = 0;
        document.getElementById('movieNotes').value = '';
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) document.getElementById('toggleTempBtn').click();
    } catch (e) { console.error(e); }
});

document.getElementById('saveSongBtn').addEventListener('click', async () => {
    const title = document.getElementById('songTitle').value.trim();
    if (!title) return alert("Please enter a title.");
    if (getDuplicateDoc('title', title, 'song')) return alert(`Duplicate Entry: "${title}" is already in your database!`);

    const singer = document.getElementById('songSinger').value;
    const lang = document.getElementById('songLang').value;
    const genre = document.getElementById('songGenre').value;
    const rating = document.getElementById('songRating').value;
    const notes = document.getElementById('songNotes').value.trim();

    try {
        await addDoc(collection(db, "temp_songs"), { 
            title, singer: singer||'', lang: lang||'English', genre: genre||'', rating: rating||'', notes, dateAdded: getTodayDate()
        });
        document.getElementById('songTitle').value = '';
        document.getElementById('songRating').selectedIndex = 0;
        document.getElementById('songNotes').value = '';
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) document.getElementById('toggleTempBtn').click();
    } catch (e) { console.error(e); }
});

document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    if (!name) return alert("Please enter a book name.");
    if (getDuplicateDoc('name', name, 'book')) return alert(`Duplicate Entry: "${name}" is already in your database!`);

    const author = document.getElementById('bookAuthor').value;
    const lang = document.getElementById('bookLang').value;
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;
    const rating = document.getElementById('bookRating').value;
    const readDate = document.getElementById('bookDate').value;
    const notes = document.getElementById('bookNotes').value.trim();

    try {
        await addDoc(collection(db, "temp_books"), { 
            name, author: author||'', lang: lang||'English', year: year||'', genre: genre||'', rating: rating||'', readDate: readDate||'', notes
        });
        document.getElementById('bookName').value = '';
        document.getElementById('bookRating').selectedIndex = 0;
        document.getElementById('bookNotes').value = '';
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) document.getElementById('toggleTempBtn').click();
    } catch (e) { console.error(e); }
});

document.getElementById('saveTravelBtn').addEventListener('click', async () => {
    const destination = document.getElementById('travelDest').value.trim();
    if (!destination) return alert("Please enter a destination.");
    if (getDuplicateDoc('destination', destination, 'travel')) return alert(`Duplicate Entry: "${destination}" is already in your database!`);

    const state = document.getElementById('travelState').value.trim();
    const country = document.getElementById('travelCountry').value.trim();
    const category = document.getElementById('travelCategory').value;
    const status = document.getElementById('travelStatus').value;
    const mapLink = document.getElementById('travelMap').value.trim();
    const notes = document.getElementById('travelNotes').value.trim();
    
    let tDate = document.getElementById('travelDate').value;
    if (status === 'visited' && !tDate) tDate = getTodayDate();
    else if (status === 'want_to_go') tDate = 'Not Available';

    try {
        await addDoc(collection(db, "temp_travels"), { 
            destination, state, country, category: category||'', status, date: tDate, mapLink, notes
        });
        document.getElementById('travelDest').value = '';
        document.getElementById('travelState').value = '';
        document.getElementById('travelCountry').value = '';
        document.getElementById('travelCategory').selectedIndex = 0;
        document.getElementById('travelDate').value = '';
        document.getElementById('travelMap').value = '';
        document.getElementById('travelNotes').value = '';
        alert("Saved to Commits for verification!");
        if(!isViewingTemp) document.getElementById('toggleTempBtn').click();
    } catch (e) { console.error(e); }
});
