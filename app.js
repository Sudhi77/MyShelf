import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your Firebase configuration
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

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// --- NAVIGATION LOGIC ---
const views = document.querySelectorAll('.view');
const btnHome = document.getElementById('homeBtn');
const navMovie = document.getElementById('navMovie');
const navSong = document.getElementById('navSong');
const navBook = document.getElementById('navBook');

function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

btnHome.addEventListener('click', () => showView('homeView'));
navMovie.addEventListener('click', () => showView('movieView'));
navSong.addEventListener('click', () => showView('songView'));
navBook.addEventListener('click', () => showView('bookView'));

// --- MOVIES LOGIC ---
document.getElementById('saveMovieBtn').addEventListener('click', async () => {
    const title = document.getElementById('movieTitle').value.trim();
    const year = document.getElementById('movieYear').value;
    const genre = document.getElementById('movieGenre').value.trim();
    const status = document.getElementById('movieStatus').value;
    const rating = document.getElementById('movieRating').value;
    
    // Auto-fill watched date if empty
    let watchedDate = document.getElementById('movieDate').value;
    if (!watchedDate && status === "watched") {
        watchedDate = getTodayDate();
    }

    if (!title) return alert("Please enter a movie title.");

    try {
        await addDoc(collection(db, "movies"), { 
            title, year, genre, status, rating, watchedDate, 
            ratingDate: rating ? getTodayDate() : null 
        });
        
        // Clear inputs
        document.getElementById('movieTitle').value = '';
        document.getElementById('movieYear').value = '';
        document.getElementById('movieGenre').value = '';
        document.getElementById('movieDate').value = '';
        document.getElementById('movieRating').value = '';
        alert("Movie saved!");
    } catch (e) { console.error("Error saving movie:", e); }
});

onSnapshot(collection(db, "movies"), (snapshot) => {
    const list = document.getElementById('movieList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        let dateString = data.watchedDate ? ` | Date: ${data.watchedDate}` : '';
        let ratingString = data.rating ? ` | Rating: ${data.rating}/10` : '';
        
        list.innerHTML += `<li>
            <strong>${data.title}</strong> (${data.year || 'N/A'}) - ${data.status === 'watched' ? '✅ Watched' : '⏳ To Watch'}
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${dateString} ${ratingString}</div>
        </li>`;
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
            title, singer, genre, rating, 
            ratingDate: rating ? getTodayDate() : null 
        });
        
        document.getElementById('songTitle').value = '';
        document.getElementById('songSinger').value = '';
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
        let ratingString = data.rating ? ` | Rating: ${data.rating}/10` : '';

        list.innerHTML += `<li>
            <strong>${data.title}</strong> by ${data.singer || 'Unknown'}
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${ratingString}</div>
        </li>`;
    });
});

// --- BOOKS LOGIC ---
document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;
    const rating = document.getElementById('bookRating').value;

    // Auto-fill read date if empty
    let readDate = document.getElementById('bookDate').value;
    if (!readDate) {
        readDate = getTodayDate();
    }

    if (!name) return alert("Please enter a book name.");

    try {
        await addDoc(collection(db, "books"), { 
            name, author, year, genre, rating, readDate, 
            ratingDate: rating ? getTodayDate() : null 
        });
        
        document.getElementById('bookName').value = '';
        document.getElementById('bookAuthor').value = '';
        document.getElementById('bookYear').value = '';
        document.getElementById('bookGenre').value = '';
        document.getElementById('bookDate').value = '';
        document.getElementById('bookRating').value = '';
        alert("Book saved!");
    } catch (e) { console.error("Error saving book:", e); }
});

onSnapshot(collection(db, "books"), (snapshot) => {
    const list = document.getElementById('bookList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        let dateString = data.readDate ? ` | Date: ${data.readDate}` : '';
        let ratingString = data.rating ? ` | Rating: ${data.rating}/10` : '';

        list.innerHTML += `<li>
            <strong>${data.name}</strong> by ${data.author || 'Unknown'} (${data.year || 'N/A'})
            <div class="item-details">Genre: ${data.genre || 'N/A'} ${dateString} ${ratingString}</div>
        </li>`;
    });
});
