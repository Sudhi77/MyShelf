import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// !!! REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG !!!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

    if (!title) return alert("Please enter a movie title.");

    try {
        await addDoc(collection(db, "movies"), { title, year, genre, status });
        document.getElementById('movieTitle').value = '';
        document.getElementById('movieYear').value = '';
        document.getElementById('movieGenre').value = '';
        alert("Movie saved!");
    } catch (e) { console.error("Error saving movie:", e); }
});

onSnapshot(collection(db, "movies"), (snapshot) => {
    const list = document.getElementById('movieList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        list.innerHTML += `<li>
            <strong>${data.title}</strong> (${data.year || 'N/A'}) - ${data.status === 'watched' ? '✅ Watched' : '⏳ To Watch'}
            <div class="item-details">Genre: ${data.genre || 'N/A'}</div>
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
        await addDoc(collection(db, "songs"), { title, singer, genre, rating });
        document.getElementById('songTitle').value = '';
        document.getElementById('songSinger').value = '';
        document.getElementById('songRating').value = '';
        alert("Song saved!");
    } catch (e) { console.error("Error saving song:", e); }
});

onSnapshot(collection(db, "songs"), (snapshot) => {
    const list = document.getElementById('songList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        list.innerHTML += `<li>
            <strong>${data.title}</strong> by ${data.singer || 'Unknown'}
            <div class="item-details">Genre: ${data.genre || 'N/A'} | Rating: ${data.rating ? data.rating + '/10' : 'N/A'}</div>
        </li>`;
    });
});

// --- BOOKS LOGIC ---
document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const name = document.getElementById('bookName').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const year = document.getElementById('bookYear').value;
    const genre = document.getElementById('bookGenre').value;

    if (!name) return alert("Please enter a book name.");

    try {
        await addDoc(collection(db, "books"), { name, author, year, genre });
        document.getElementById('bookName').value = '';
        document.getElementById('bookAuthor').value = '';
        document.getElementById('bookYear').value = '';
        alert("Book saved!");
    } catch (e) { console.error("Error saving book:", e); }
});

onSnapshot(collection(db, "books"), (snapshot) => {
    const list = document.getElementById('bookList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        list.innerHTML += `<li>
            <strong>${data.name}</strong> by ${data.author || 'Unknown'} (${data.year || 'N/A'})
            <div class="item-details">Genre: ${data.genre || 'N/A'}</div>
        </li>`;
    });
});
