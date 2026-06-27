import { collection, addDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function saveIndividualEntry(db, userId, category, entryData) {
    if (!userId) throw new Error("User not authenticated.");
    if (!entryData.name) throw new Error("Name/Title is required!");
    
    const finalData = { ...entryData, isMerged: false, createdAt: new Date().toISOString() };
    const newDocRef = await addDoc(collection(db, "users", userId, category), finalData);
    return newDocRef.id;
}

export async function saveBulkEntries(db, userId, category, entriesArray) {
    if (!userId || !entriesArray || entriesArray.length === 0) throw new Error("Invalid save request.");
    const batch = writeBatch(db);
    entriesArray.forEach(entry => {
        const newRef = doc(collection(db, "users", userId, category));
        batch.set(newRef, { isMerged: false, ...entry });
    });
    await batch.commit();
    return entriesArray.length;
}

export function parseBulkText(text) {
    const extractionRegex = /^(.*?)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)\s*\(\s*(.*?)\s*\)$/;
    const lines = text.split('\n');
    return lines.map(line => {
        line = line.trim();
        if (!line) return null;
        let entryData = { name: line }; 
        const match = line.match(extractionRegex);
        if (match) {
            entryData.name = match[1].trim();
            // Extend this logic to map your specific regex groups if needed
        }
        return entryData;
    }).filter(Boolean);
}
