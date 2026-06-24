/**
 * library/importmovie_lib.js
 * Pure logic engine for importing individual and bulk movies into the database.
 */
import { collection, addDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Saves a single movie to the database.
 */
export async function saveIndividualMovie(db, userId, movieData) {
    if (!userId) throw new Error("User not authenticated.");
    if (!movieData.name) throw new Error("Title is required!");
    
    const finalData = {
        ...movieData,
        isMerged: false
    };

    const newDocRef = await addDoc(collection(db, "users", userId, "movies"), finalData);
    return newDocRef.id;
}

/**
 * Parses raw text into an array of movie objects based on the specific regex format.
 */
export function parseBulkText(text) {
    const extractionRegex = /^(.*?)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)$/;
    const lines = text.split('\n');
    const parsedMovies = []; 

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        let movieData = { name: line }; 
        const match = line.match(extractionRegex);
        
        if (match) {
            movieData.name = match[1].trim();
            movieData.Year = match[2].trim();
            movieData.Language = match[3].trim();
            movieData.Category = match[4].trim(); 
            
            const directorText = match[5].trim();
            if (directorText) movieData.Director = directorText.split(',').map(s => s.trim()).filter(Boolean);

            const genreText = match[6].trim();
            if (genreText) movieData.Genre = genreText.split(',').map(s => s.trim()).filter(Boolean);

            const castText = match[7].trim();
            if (castText) movieData.Cast = castText.split(',').map(s => s.trim()).filter(Boolean);
        }
        parsedMovies.push(movieData);
    });

    return parsedMovies;
}

/**
 * Saves an array of movies using a Firestore batch transaction.
 */
export async function saveBulkMovies(db, userId, moviesArray) {
    if (!userId) throw new Error("User not authenticated.");
    if (!moviesArray || moviesArray.length === 0) throw new Error("No movies in batch to save.");

    const batch = writeBatch(db);
    
    moviesArray.forEach(bMovie => {
        let finalMovie = { isMerged: false, ...bMovie };
        const newRef = doc(collection(db, "users", userId, "movies"));
        batch.set(newRef, finalMovie);
    });
    
    await batch.commit();
    return moviesArray.length;
}
