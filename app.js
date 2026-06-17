import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// SVG Red Trash Bin
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

// --- DYNAMIC CUSTOMIZATIONS ---
const defaults = {
    movieGenre: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"],
    songGenre: ["Rock", "Pop", "Jazz", "Classical", "Hip Hop", "Country"],
    bookGenre: ["Fiction", "Non-Fiction", "Biography", "Fantasy", "Mystery"],
    Language: ["English", "Hindi", "Telugu", "Tamil", "Malayalam", "Japanese", "Spanish"]
};

onSnapshot(collection(db, "customOptions"), (snapshot) => {
    const customData = { Language: [], movieGenre: [], songGenre: [], bookGenre: [], Artist: [], Author: [] };
    snapshot.forEach(doc => {
        const d = doc.data();
        if(d.type === 'Genre') customData.movieGenre.push(d.name); 
        else if(customData[d.type]) customData[d.type].push(d.name);
    });

    const populate = (id, defType, typeStr) => {
        const items = [...new Set([...(defaults[defType] || []), ...customData[defType]])].sort();
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
const dataCache = { movies: [], temp_movies: [], songs: [], temp_songs: [], books: [], temp_books: [] };

const controls = {
    movie: { search: '', sort: 'date_desc', status: 'watched', filterMain: '', filterSub: '' },
    song: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' },
    book: { search: '', sort: 'date_desc', filterMain: '', filterSub: '' }
};

document.getElementById('toggleTempBtn').addEventListener('click', () => {
    isViewingTemp = !isViewingTemp;
    const btn = document.getElementById('toggleTempBtn');
    btn.innerText = isViewingTemp ? "View Permanent List" : "Commits";
    btn.style.background = isViewingTemp ? "#17a2b8" : "#ff9800";
    
    const headText = isViewingTemp ? "Temporary Database" : "Database";
    document.getElementById('movieListHeading').innerText = headText;
    document.getElementById('songListHeading').innerText = headText;
    document.getElementById('bookListHeading').innerText = headText;

    ['movie', 'song', 'book'].forEach(cat => {
        controls[cat] = { search: '', sort: 'date_desc', status: cat === 'movie' ? 'watched' : '', filterMain: '', filterSub: '' };
        document.getElementById(`${cat}Search`).value = '';
        if(cat === 'movie') document.getElementById('movieStatusFilter').value = 'watched';
        document.getElementById(`${cat}FilterMain`).value = '';
        document.getElementById(`${cat}FilterSub`).disabled = true;
        document.getElementById(`${cat}FilterSub`).innerHTML = '<option value="">Subfilter</option>';
    });

    renderAll();
    toggleMenu(false);
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
        
        alert("Merge successful!");
        if (isViewingTemp) document.getElementById('toggleTempBtn').click(); 
    } catch (e) { console.error(e); alert("Merge encountered an error."); }
});

// --- RENDER & FILTER LOGIC ---
function processData(type, sourceArray) {
    let data = [...sourceArray];
    const c = controls[type];

    if (type === 'movie' && c.status !== 'all') data = data.filter(item => item.status === c.status);
    if (c.search) {
        const q = c.search.toLowerCase();
        const titleField = type === 'book' ? 'name' : 'title';
        data = data.filter(item => (item[titleField] || '').toLowerCase().includes(q));
    }
    if (c.filterMain && c.filterSub) data = data.filter(item => item[c.filterMain] === c.filterSub);

    data.sort((a, b) => {
        const tField = type === 'book' ? 'name' : 'title';
        const dField = type === 'movie' ? 'watchedDate' : type === 'book' ? 'readDate' : 'dateAdded';
        if (c.sort === 'title_asc') return (a[tField] || '').localeCompare(b[tField] || '');
        if (c.sort === 'title_desc') return (b[tField] || '').localeCompare(a[tField] || '');
        if (c.sort === 'date_desc') return new Date(b[dField] || 0) - new Date(a[dField] || 0);
        if (c.sort === 'date_asc') return new Date(a[dField] || 0) - new Date(b[dField] || 0);
        return 0;
    });
    return data;
}

function renderMovies() {
    const data = processData('movie', isViewingTemp ? dataCache.temp_movies : dataCache.movies);
    document.getElementById('movieList').innerHTML = data.map((m, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><span class="clickable-title" data-type="movie" data-id="${m._id}">${m.title}</span></td>
            <td><button class="del-btn" data-type="movie" data-id="${m._id}">${trashIcon}</button></td>
        </tr>`).join('');
}
function renderSongs() {
    const data = processData('song', isViewingTemp ? dataCache.temp_songs : dataCache.songs);
    document.getElementById('songList').innerHTML = data.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><span class="clickable-title" data-type="song" data-id="${s._id}">${s.title}</span></td>
            <td><button class="del-btn" data-type="song" data-id="${s._id}">${trashIcon}</button></td>
        </tr>`).join('');
}
function renderBooks() {
    const data = processData('book', isViewingTemp ? dataCache.temp_books : dataCache.books);
    document.getElementById('bookList').innerHTML = data.map((b, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><span class="clickable-title" data-type="book" data-id="${b._id}">${b.name}</span></td>
            <td><button class="del-btn" data-type="book" data-id="${b._id}">${trashIcon}</button></td>
        </tr>`).join('');
}
function renderAll() { renderMovies(); renderSongs(); renderBooks(); }

// --- CONTROLS EVENT LISTENERS ---
let currentSortCat = ''; 
const sortModal = document.getElementById('sortModal');

['movie', 'song', 'book'].forEach(cat => {
    document.getElementById(`${cat}Search`).addEventListener('input', (e) => { controls[cat].search = e.target.value; renderAll(); });
    
    document.getElementById(`${cat}SortBtn`).addEventListener('click', () => {
        currentSortCat = cat;
        sortModal.style.display = "block";
    });
    
    if(cat === 'movie') {
        document.getElementById('movieStatusFilter').addEventListener('change', (e) => { controls.movie.status = e.target.value; renderAll(); });
    }

    document.getElementById(`${cat}FilterMain`).addEventListener('change', (e) => {
        controls[cat].filterMain = e.target.value;
        controls[cat].filterSub = '';
        const sub = document.getElementById(`${cat}FilterSub`);
        
        if (!e.target.value) {
            sub.disabled = true; sub.innerHTML = '<option value="">Subfilter</option>';
        } else {
            sub.disabled = false;
            const source = isViewingTemp ? dataCache[`temp_${cat}s`] : dataCache[`${cat}s`];
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
        const sortVal = e.target.dataset.sort;
        controls[currentSortCat].sort = sortVal;
        sortModal.style.display = "none";
        renderAll();
    });
});

// --- MODALS & CLICK DELEGATION ---
const detailsModal = document.getElementById('detailsModal');
const modalBody = document.getElementById('modalBody');

document.getElementById('closeDetailsModal').addEventListener('click', () => detailsModal.style.display = "none");
document.getElementById('closeSortModal').addEventListener('click', () => sortModal.style.display = "none");

window.addEventListener('click', (e) => { 
    if (e.target == detailsModal) detailsModal.style.display = "none"; 
    if (e.target == sortModal) sortModal.style.display = "none"; 
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

        let html = `<h2>${item.title || item.name}</h2><hr>`;
        if (type === 'movie') {
            html += `<div class="detail-item"><strong>Type:</strong> ${item.type || '-'}</div>`;
            html += `<div class="detail-item"><strong>Year:</strong> ${item.year || '-'}</div>`;
            html += `<div class="detail-item"><strong>Language:</strong> ${item.lang || '-'}</div>`;
            html += `<div class="detail-item"><strong>Genre:</strong> ${item.genre || '-'}</div>`;
            html += `<div class="detail-item"><strong>Status:</strong> ${item.status === 'watched' ? 'Watched' : 'To Watch'}</div>`;
            html += `<div class="detail-item"><strong>Date:</strong> ${item.watchedDate || '-'}</div>`;
            html += `<div class="detail-item"><strong>Rating:</strong> ${item.rating ? item.rating+'/10' : '-'}</div>`;
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
        }
        html += `<div class="detail-item"><strong>Notes:</strong> <span class="notes-text">${item.notes || '-'}</span></div>`;
        
        modalBody.innerHTML = html;
        detailsModal.style.display = "block";
    }
}

document.getElementById('movieList').addEventListener('click', handleTableClick);
document.getElementById('songList').addEventListener('click', handleTableClick);
document.getElementById('bookList').addEventListener('click', handleTableClick);

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

// --- SAVING LOGIC ---
const isDuplicate = (titleField, titleVal, type) => {
    const t = titleVal.toLowerCase();
    return dataCache[`${type}s`].some(i => (i[titleField]||'').toLowerCase() === t) || 
           dataCache[`temp_${type}s`].some(i => (i[titleField]||'').toLowerCase() === t);
};

document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const title = document.getElementById('movieTitle').value.trim();
    if (!title) return alert("Please enter a title.");
    if (isDuplicate('title', title, 'movie')) return alert(`Duplicate Entry: "${title}" is already in your database!`);

    const type = document.getElementById('movieType').value;
    const lang = document.getElementById('movieLang').value;
    const year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value;
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    const watchedDate = document.getElementById('movieDate').value;
    const notes = document.getElementById('movieNotes').value.trim();
    
    try {
        await addDoc(collection(db, "temp_movies"), { 
            title, type: type||'', lang: lang||'', year: year||'', genre: genre||'', status, rating: rating||'', watchedDate: watchedDate||'', notes, ratingDate: rating ? getTodayDate() : null 
        });
        document.getElementById('movieTitle').value = '';
        document.getElementById('movieRating').selectedIndex = 0;
        document.getElementById('movieNotes').value = '';
        alert("Saved to Temporary List for verification!");
    } catch (e) { console.error(e); }
});

document.getElementById('saveSongBtn').addEventListener('click', async () => {
    const title = document.getElementById('songTitle').value.trim();
    if (!title) return alert("Please enter a title.");
    if (isDuplicate('title', title, 'song')) return alert(`Duplicate Entry: "${title}" is already in your database!`);

    const singer = document.getElementById('songSinger').value;
    const lang = document.getElementById('songLang').value;
    const genre = document.getElementById('songGenre').value;
    const rating = document.getElementById('songRating').value;
    const notes = document.getElementById('songNotes').value.trim();

    try {
        await addDoc(collection(db, "temp_songs"), { 
            title, singer: singer||'', lang: lang||'', genre: genre||'', rating: rating||'', notes, dateAdded: getTodayDate()
        });
        document.getElementById('songTitle').value = '';
        document.getElementById('songRating').selectedIndex = 0;
        document.getElementById('songNotes').value = '';
        alert("Saved to Temporary List for verification!");
    } catch (e) { console.error(e); }
});

document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    if (!name) return alert("Please enter a book name.");
    if (isDuplicate('name', name, 'book')) return alert(`Duplicate Entry: "${name}" is already in your database!`);

    const author = document.getElementById('bookAuthor').value;
    const lang = document.getElementById('bookLang').value;
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;
    const rating = document.getElementById('bookRating').value;
    const readDate = document.getElementById('bookDate').value;
    const notes = document.getElementById('bookNotes').value.trim();

    try {
        await addDoc(collection(db, "temp_books"), { 
            name, author: author||'', lang: lang||'', year: year||'', genre: genre||'', rating: rating||'', readDate: readDate||'', notes
        });
        document.getElementById('bookName').value = '';
        document.getElementById('bookRating').selectedIndex = 0;
        document.getElementById('bookNotes').value = '';
        alert("Saved to Temporary List for verification!");
    } catch (e) { console.error(e); }
});
