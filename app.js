import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// !!! PASTE YOUR FIREBASE CONFIG HERE !!!
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

// --- THEME & SESSION PERSISTENCE ---
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
document.getElementById('themeSelect').value = currentTheme;

document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    localStorage.setItem('theme', e.target.value);
});

// --- SIDE MENU LOGIC ---
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const toggleMenu = (show) => {
    if(show) { sideMenu.classList.add('open'); menuOverlay.classList.add('open'); }
    else { sideMenu.classList.remove('open'); menuOverlay.classList.remove('open'); }
}
document.getElementById('menuBtn').addEventListener('click', () => toggleMenu(true));
document.getElementById('closeMenuBtn').addEventListener('click', () => toggleMenu(false));
menuOverlay.addEventListener('click', () => toggleMenu(false));

// --- NAVIGATION & UI SESSION LOGIC ---
const views = document.querySelectorAll('.view');
function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    localStorage.setItem('lastView', viewId); // Save session locally
}

// Restore last viewed page on refresh
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

// Listen for custom genres added to Firebase
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
        
        // Merge defaults and custom, sort alphabetically
        const combined = [...defaultGenres[cat], ...customGenres[cat]].sort();
        combined.forEach(g => {
            select.innerHTML += `<option value="${g}">${g}</option>`;
        });
    });
});

// Save new Custom Genre
document.getElementById('saveGenreBtn').addEventListener('click', async () => {
    const name = document.getElementById('newGenreName').value.trim();
    const category = document.getElementById('newGenreCategory').value;
    if (!name) return alert("Please enter a genre name.");

    try {
        await addDoc(collection(db, "genres"), { name, category });
        document.getElementById('newGenreName').value = '';
        alert("New genre added!");
    } catch (e) { console.error("Error saving genre:", e); }
});

// --- MOVIES LOGIC ---
document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const title = document.getElementById('movieTitle').value.trim();
    const year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value;
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    
    // Popup Logic for missing Date
    let watchedDate = document.getElementById('movieDate').value;
    if (!watchedDate && status === "watched") {
        if (confirm("Watched date is empty. Was this movie watched today? (Click OK for Yes, Cancel for No)")) {
            watchedDate = getTodayDate();
        } else {
            alert("Please select the correct Watched Date.");
            document.getElementById('movieDate').focus();
            return; // Abort saving until they pick a date
        }
    }

    if (!title) return alert("Please enter a movie title.");

    try {
        await addDoc(collection(db, "movies"), { 
            title, year, genre: genre || '', status, rating, watchedDate, 
            ratingDate: rating ? getTodayDate() : null 
        });
        
        document.querySelectorAll('#movieView input').forEach(input => input.value = '');
        document.getElementById('movieGenre').value = '';
        document.getElementById('movieRating').value = '';
        alert("Movie saved!");
    } catch (e) { console.error("Error saving movie:", e); }
});

onSnapshot(collection(db, "movies"), (snapshot) => {
    const list = document.getElementById('movieList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        let dateStr = data.watchedDate ? ` | Watched: ${data.watchedDate}` : '';
        let ratingStr = data.rating ? ` | Rating: ${data.rating}/10` : '';
        list.innerHTML += `<li><strong>${data.title}</strong> (${data.year || 'N/A'}) - ${data.status === 'watched' ? '✅' : '⏳'}
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${dateStr} ${ratingStr}</div></li>`;
    });
});

// --- SONGS LOGIC ---
document.getElementById('saveSongBtn').addEventListener('click', async () => {
    const title = document.getElementById('songTitle').value.trim();
    const singer = document.getElementById('songSinger').value.trim();
    const genre = document.getElementById('songGenre').value;
    const rating = document.getElementById('songRating').value;

    if (!title) return alert("Please enter a song title.");

    try {
        await addDoc(collection(db, "songs"), { 
            title, singer, genre: genre || '', rating, ratingDate: rating ? getTodayDate() : null 
        });
        document.querySelectorAll('#songView input').forEach(input => input.value = '');
        document.getElementById('songGenre').value = '';
        document.getElementById('songRating').value = '';
        alert("Song saved!");
    } catch (e) { console.error("Error saving song:", e); }
});

onSnapshot(collection(db, "songs"), (snapshot) => {
    const list = document.getElementById('songList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        let ratingStr = data.rating ? ` | Rating: ${data.rating}/10` : '';
        list.innerHTML += `<li><strong>${data.title}</strong> by ${data.singer || 'Unknown'}
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${ratingStr}</div></li>`;
    });
});

// --- BOOKS LOGIC ---
document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;
    const rating = document.getElementById('bookRating').value;

    // Popup Logic for missing Date
    let readDate = document.getElementById('bookDate').value;
    if (!readDate) {
        if (confirm("Read date is empty. Was this book finished today? (Click OK for Yes, Cancel for No)")) {
            readDate = getTodayDate();
        } else {
            alert("Please select the correct Read Date.");
            document.getElementById('bookDate').focus();
            return; // Abort saving until they pick a date
        }
    }

    if (!name) return alert("Please enter a book name.");

    try {
        await addDoc(collection(db, "books"), { 
            name, author, year, genre: genre || '', rating, readDate, ratingDate: rating ? getTodayDate() : null 
        });
        document.querySelectorAll('#bookView input').forEach(input => input.value = '');
        document.getElementById('bookGenre').value = '';
        document.getElementById('bookRating').value = '';
        alert("Book saved!");
    } catch (e) { console.error("Error saving book:", e); }
});

onSnapshot(collection(db, "books"), (snapshot) => {
    const list = document.getElementById('bookList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        let dateStr = data.readDate ? ` | Read: ${data.readDate}` : '';
        let ratingStr = data.rating ? ` | Rating: ${data.rating}/10` : '';
        list.innerHTML += `<li><strong>${data.name}</strong> by ${data.author || 'Unknown'} (${data.year || 'N/A'})
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${dateStr} ${ratingStr}</div></li>`;
    });
});
