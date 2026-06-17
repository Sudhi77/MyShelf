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

// --- GENERATE YEARS (1950 - 2026) ---
function populateYears() {
    let options = '<option value="" disabled selected>Select Year</option>';
    for (let i = 2026; i >= 1950; i--) { options += `<option value="${i}">${i}</option>`; }
    document.getElementById('movieYear').innerHTML = options;
    document.getElementById('bookYear').innerHTML = options;
}
populateYears(); // Run instantly on load

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

// --- DYNAMIC CUSTOMIZATIONS (Language, Genre, Artist, Author) ---
const defaults = {
    Genre: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Rock", "Pop", "Jazz", "Fiction", "Non-Fiction", "Biography", "Fantasy"],
    Language: ["English", "Hindi", "Telugu", "Tamil", "Malayalam", "Japanese", "Korean", "Spanish"]
};

onSnapshot(collection(db, "customOptions"), (snapshot) => {
    const customData = { Language: [], Genre: [], Artist: [], Author: [] };
    snapshot.forEach(doc => {
        const data = doc.data();
        if(customData[data.type]) customData[data.type].push(data.name);
    });

    // Populate Languages
    const langs = [...new Set([...defaults.Language, ...customData.Language])].sort();
    const langHTML = `<option value="" disabled selected>Select Language</option>` + langs.map(l => `<option value="${l}">${l}</option>`).join('');
    document.getElementById('movieLang').innerHTML = langHTML;
    document.getElementById('songLang').innerHTML = langHTML;
    document.getElementById('bookLang').innerHTML = langHTML;

    // Populate Genres
    const genres = [...new Set([...defaults.Genre, ...customData.Genre])].sort();
    const genreHTML = `<option value="" disabled selected>Select Genre</option>` + genres.map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('movieGenre').innerHTML = genreHTML;
    document.getElementById('songGenre').innerHTML = genreHTML;
    document.getElementById('bookGenre').innerHTML = genreHTML;

    // Populate Artists
    const artists = [...new Set(["Unknown Artist", ...customData.Artist])].sort();
    document.getElementById('songSinger').innerHTML = `<option value="" disabled selected>Select Artist</option>` + artists.map(a => `<option value="${a}">${a}</option>`).join('');

    // Populate Authors
    const authors = [...new Set(["Unknown Author", ...customData.Author])].sort();
    document.getElementById('bookAuthor').innerHTML = `<option value="" disabled selected>Select Author</option>` + authors.map(a => `<option value="${a}">${a}</option>`).join('');
});

// Save new Custom Option from Sidebar
document.getElementById('saveCustomBtn').addEventListener('click', async () => {
    const name = document.getElementById('customValue').value.trim();
    const type = document.getElementById('customType').value; // Language, Genre, Artist, Author
    if (!name) return alert(`Please enter a ${type} name.`);
    try {
        await addDoc(collection(db, "customOptions"), { name, type });
        document.getElementById('customValue').value = '';
        alert(`${type} added to your options!`);
    } catch (e) { console.error(e); }
});

// --- GLOBAL DELETE FUNCTION ---
async function deleteItem(collectionName, id) {
    if (confirm("Are you sure you want to remove this from your list?")) {
        await deleteDoc(doc(db, collectionName, id));
    }
}
document.getElementById('movieList').addEventListener('click', (e) => { if (e.target.classList.contains('del-btn')) deleteItem('movies', e.target.dataset.id); });
document.getElementById('songList').addEventListener('click', (e) => { if (e.target.classList.contains('del-btn')) deleteItem('songs', e.target.dataset.id); });
document.getElementById('bookList').addEventListener('click', (e) => { if (e.target.classList.contains('del-btn')) deleteItem('books', e.target.dataset.id); });

// --- LOCAL DATA FOR DUPLICATE CHECKS ---
let existingMovies = [];
let existingSongs = [];
let existingBooks = [];

// --- MOVIES LOGIC ---
document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const title = document.getElementById('movieTitle').value.trim();
    const type = document.getElementById('movieType').value;
    const lang = document.getElementById('movieLang').value;
    const year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value;
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    
    if (!title) return alert("Please enter a movie title.");

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
            title, type, lang: lang || '', year: year || '', genre: genre || '', status, rating: rating || '', watchedDate, 
            ratingDate: rating ? getTodayDate() : null 
        });
        document.querySelectorAll('#movieView input').forEach(input => input.value = '');
        document.querySelectorAll('#movieView select').forEach(select => select.selectedIndex = 0);
        document.getElementById('movieType').value = 'Movie';
        alert("Movie saved!");
    } catch (e) { console.error(e); }
});

onSnapshot(collection(db, "movies"), (snapshot) => {
    const list = document.getElementById('movieList');
    list.innerHTML = "";
    existingMovies = []; 
    snapshot.forEach(doc => {
        const data = doc.data();
        existingMovies.push(data.title); 
        
        const dateDisplay = data.status === 'watched' ? (data.watchedDate || 'Yes') : '⏳ To Watch';
        const infoDisplay = `<span class="small-text">${data.type} • ${data.lang || '-'} • ${data.year || '-'}</span>`;
        
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
    const singer = document.getElementById('songSinger').value;
    const lang = document.getElementById('songLang').value;
    const genre = document.getElementById('songGenre').value;
    const rating = document.getElementById('songRating').value;

    if (!title) return alert("Please enter a song title.");
    if (existingSongs.some(s => s.toLowerCase() === title.toLowerCase())) {
        return alert(`Duplicate Entry: "${title}" is already in your song list!`);
    }

    try {
        await addDoc(collection(db, "songs"), { 
            title, singer: singer || '', lang: lang || '', genre: genre || '', rating: rating || '', dateAdded: getTodayDate()
        });
        document.querySelectorAll('#songView input').forEach(input => input.value = '');
        document.querySelectorAll('#songView select').forEach(select => select.selectedIndex = 0);
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
        
        const infoDisplay = `<span class="small-text">${data.singer || '-'} • ${data.lang || '-'}</span>`;
        
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
    const author = document.getElementById('bookAuthor').value;
    const lang = document.getElementById('bookLang').value;
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
            name, author: author || '', lang: lang || '', year: year || '', genre: genre || '', rating: rating || '', readDate
        });
        document.querySelectorAll('#bookView input').forEach(input => input.value = '');
        document.querySelectorAll('#bookView select').forEach(select => select.selectedIndex = 0);
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
        
        const infoDisplay = `<span class="small-text">${data.author || '-'} • ${data.lang || '-'} • ${data.year || '-'}</span>`;

        list.innerHTML += `<tr>
            <td><strong>${data.name}</strong>${infoDisplay}</td>
            <td>${data.readDate || '-'}</td>
            <td>${data.genre || '-'}</td>
            <td>${data.rating ? data.rating + '/10' : '-'}</td>
            <td><button class="del-btn" data-id="${doc.id}">🗑️</button></td>
        </tr>`;
    });
});
