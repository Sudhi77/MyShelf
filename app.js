import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// Notice we imported 'deleteDoc' and 'doc' below
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

// --- THEME & UI STATE ---
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
const savedView = localStorage.getItem('lastView') || 'homeView';
showView(savedView);

document.getElementById('homeBtn').addEventListener('click', () => showView('homeView'));
document.getElementById('navMovie').addEventListener('click', () => showView('movieView'));
document.getElementById('navSong').addEventListener('click', () => showView('songView'));
document.getElementById('navBook').addEventListener('click', () => showView('bookView'));

// --- DYNAMIC GENRES LOGIC ---
const defaultGenres = {
    movie: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror"],
    song: ["Rock", "Jazz", "Classical", "Pop", "Hip Hop"],
    book: ["Fiction", "Non-Fiction", "Biography", "Fantasy"]
};

onSnapshot(collection(db, "genres"), (snapshot) => {
    const customGenres = { movie: [], song: [], book: [] };
    snapshot.forEach(doc => {
        const data = doc.data();
        if(customGenres[data.category]) customGenres[data.category].push(data.name);
    });

    ['movie', 'song', 'book'].forEach(cat => {
        const select = document.getElementById(`${cat}Genre`);
        if(!select) return;
        select.innerHTML = `<option value="" disabled selected>Select Genre</option>`;
        const combined = [...defaultGenres[cat], ...customGenres[cat]].sort();
        combined.forEach(g => select.innerHTML += `<option value="${g}">${g}</option>`);
    });
});

document.getElementById('saveGenreBtn').addEventListener('click', async () => {
    const name = document.getElementById('newGenreName').value.trim();
    const category = document.getElementById('newGenreCategory').value;
    if (!name) return alert("Please enter a genre name.");
    try {
        await addDoc(collection(db, "genres"), { name, category });
        document.getElementById('newGenreName').value = '';
        alert("New genre added!");
    } catch (e) { console.error(e); }
});

// --- GLOBAL DELETE FUNCTION ---
async function deleteItem(collectionName, id) {
    if (confirm("Are you sure you want to remove this from your list?")) {
        await deleteDoc(doc(db, collectionName, id));
    }
}
// Attach listeners to tables
document.getElementById('movieList').addEventListener('click', (e) => {
    if (e.target.classList.contains('del-btn')) deleteItem('movies', e.target.dataset.id);
});
document.getElementById('songList').addEventListener('click', (e) => {
    if (e.target.classList.contains('del-btn')) deleteItem('songs', e.target.dataset.id);
});
document.getElementById('bookList').addEventListener('click', (e) => {
    if (e.target.classList.contains('del-btn')) deleteItem('books', e.target.dataset.id);
});

// --- LOCAL DATA FOR DUPLICATE CHECKS ---
let existingMovies = [];
let existingSongs = [];
let existingBooks = [];

// --- MOVIES LOGIC ---
document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const title = document.getElementById('movieTitle').value.trim();
    const type = document.getElementById('movieType').value;
    const lang = document.getElementById('movieLang').value.trim();
    const year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value;
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    
    if (!title) return alert("Please enter a movie title.");

    // Duplicate Check (Case-Insensitive)
    if (existingMovies.some(m => m.toLowerCase() === title.toLowerCase())) {
        return alert(`Duplicate Entry: "${title}" is already in your movie list!`);
    }

    let watchedDate = document.getElementById('movieDate').value;
    if (!watchedDate && status === "watched") {
        if (confirm("Watched date is empty. Was this watched today?")) watchedDate = getTodayDate();
        else return document.getElementById('movieDate').focus();
    }

    try {
        await addDoc(collection(db, "movies"), { 
            title, type, lang, year, genre: genre || '', status, rating, watchedDate, 
            ratingDate: rating ? getTodayDate() : null 
        });
        document.querySelectorAll('#movieView input').forEach(input => input.value = '');
        document.getElementById('movieGenre').value = '';
        document.getElementById('movieRating').value = '';
        document.getElementById('movieType').value = 'Movie';
        alert("Movie saved!");
    } catch (e) { console.error(e); }
});

onSnapshot(collection(db, "movies"), (snapshot) => {
    const list = document.getElementById('movieList');
    list.innerHTML = "";
    existingMovies = []; // Reset existing array
    snapshot.forEach(doc => {
        const data = doc.data();
        existingMovies.push(data.title); // Store for duplicate check
        
        const dateDisplay = data.status === 'watched' ? (data.watchedDate || 'Yes') : '⏳ To Watch';
        const infoDisplay = `<span class="small-text">${data.type} • ${data.lang || 'Unknown Lang'} • ${data.year || 'No Year'}</span>`;
        
        list.innerHTML += `<tr>
            <td><strong>${data.title}</strong>${infoDisplay}</td>
            <td>${dateDisplay}</td>
            <td>${data.genre || '-'}</td>
            <td>${data.rating ? data.rating + '/10' : '-'}</td>
            <td><button class="del-btn" data-id="${doc.id}">🗑️</button></td>
        </tr>`;
    });
});

// --- SONGS LOGIC ---
document.getElementById('saveSongBtn').addEventListener('click', async () => {
    const title = document.getElementById('songTitle').value.trim();
    const singer = document.getElementById('songSinger').value.trim();
    const lang = document.getElementById('songLang').value.trim();
    const genre = document.getElementById('songGenre').value;
    const rating = document.getElementById('songRating').value;

    if (!title) return alert("Please enter a song title.");
    if (existingSongs.some(s => s.toLowerCase() === title.toLowerCase())) {
        return alert(`Duplicate Entry: "${title}" is already in your song list!`);
    }

    try {
        await addDoc(collection(db, "songs"), { 
            title, singer, lang, genre: genre || '', rating, dateAdded: getTodayDate()
        });
        document.querySelectorAll('#songView input').forEach(input => input.value = '');
        document.getElementById('songGenre').value = '';
        document.getElementById('songRating').value = '';
        alert("Song saved!");
    } catch (e) { console.error(e); }
});

onSnapshot(collection(db, "songs"), (snapshot) => {
    const list = document.getElementById('songList');
    list.innerHTML = "";
    existingSongs = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        existingSongs.push(data.title);
        
        const infoDisplay = `<span class="small-text">${data.singer || 'Unknown Artist'} • ${data.lang || 'Unknown Lang'}</span>`;
        
        list.innerHTML += `<tr>
            <td><strong>${data.title}</strong>${infoDisplay}</td>
            <td>${data.dateAdded || '-'}</td>
            <td>${data.genre || '-'}</td>
            <td>${data.rating ? data.rating + '/10' : '-'}</td>
            <td><button class="del-btn" data-id="${doc.id}">🗑️</button></td>
        </tr>`;
    });
});

// --- BOOKS LOGIC ---
document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const lang = document.getElementById('bookLang').value.trim();
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;
    const rating = document.getElementById('bookRating').value;

    if (!name) return alert("Please enter a book name.");
    if (existingBooks.some(b => b.toLowerCase() === name.toLowerCase())) {
        return alert(`Duplicate Entry: "${name}" is already in your book list!`);
    }

    let readDate = document.getElementById('bookDate').value;
    if (!readDate) {
        if (confirm("Read date is empty. Was this finished today?")) readDate = getTodayDate();
        else return document.getElementById('bookDate').focus();
    }

    try {
        await addDoc(collection(db, "books"), { 
            name, author, lang, year, genre: genre || '', rating, readDate
        });
        document.querySelectorAll('#bookView input').forEach(input => input.value = '');
        document.getElementById('bookGenre').value = '';
        document.getElementById('bookRating').value = '';
        alert("Book saved!");
    } catch (e) { console.error(e); }
});

onSnapshot(collection(db, "books"), (snapshot) => {
    const list = document.getElementById('bookList');
    list.innerHTML = "";
    existingBooks = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        existingBooks.push(data.name);
        
        const infoDisplay = `<span class="small-text">${data.author || 'Unknown Author'} • ${data.lang || 'Unknown Lang'} • ${data.year || 'No Year'}</span>`;

        list.innerHTML += `<tr>
            <td><strong>${data.name}</strong>${infoDisplay}</td>
            <td>${data.readDate || '-'}</td>
            <td>${data.genre || '-'}</td>
            <td>${data.rating ? data.rating + '/10' : '-'}</td>
            <td><button class="del-btn" data-id="${doc.id}">🗑️</button></td>
        </tr>`;
    });
});
