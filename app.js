import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// REPLACE THIS with your specific config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBa4irQ4cFjxmyRMGRx9YKAmfmiQUnli6w",
  authDomain: "myshelf-68156.firebaseapp.com",
  projectId: "myshelf-68156",
  storageBucket: "myshelf-68156.firebasestorage.app",
  messagingSenderId: "476392236584",
  appId: "1:476392236584:web:439915d82c93bfb988f71d"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const titleInput = document.getElementById('movieTitle');
const statusInput = document.getElementById('movieStatus');
const addBtn = document.getElementById('addBtn');
const toWatchList = document.getElementById('toWatchList');
const watchedList = document.getElementById('watchedList');

// Add a new movie to Firestore
addBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const status = statusInput.value;

    if (title === "") {
        alert("Please enter a movie title.");
        return;
    }

    try {
        await addDoc(collection(db, "movies"), {
            title: title,
            status: status,
            addedAt: new Date()
        });
        titleInput.value = ""; // Clear input
    } catch (e) {
        console.error("Error adding document: ", e);
    }
});

// Read and display movies in real-time
onSnapshot(collection(db, "movies"), (snapshot) => {
    toWatchList.innerHTML = "";
    watchedList.innerHTML = "";

    snapshot.forEach((doc) => {
        const movie = doc.data();
        const li = document.createElement('li');
        li.textContent = movie.title;

        if (movie.status === "to_watch") {
            toWatchList.appendChild(li);
        } else if (movie.status === "watched") {
            watchedList.appendChild(li);
        }
    });
});

