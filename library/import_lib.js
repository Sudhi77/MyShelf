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
    
    const validEntries = entriesArray.filter(entry => entry.status !== 'error');
    if (validEntries.length === 0) throw new Error("No valid data to process.");

    validEntries.forEach(entry => {
        const newRef = doc(collection(db, "users", userId, category));
        batch.set(newRef, { isMerged: false, ...entry });
    });
    
    await batch.commit();
    return validEntries.length;
}

export function parseBulkText(text) {
    if (!text) return [];

    const lines = text.split(/\r?\n/);
    const results = [];

    const cleanNA = (val) => {
        if (!val) return null;
        const s = val.trim();
        if (s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NA') return null;
        return s;
    };

    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const line = originalLine.trim();

        if (!line) continue;

        const firstParenIndex = line.indexOf('(');
        if (firstParenIndex === -1) {
            results.push({
                status: "error",
                input: originalLine,
                reason: "Missing parentheses. Could not reliably locate metadata blocks."
            });
            continue;
        }

        const title = line.substring(0, firstParenIndex).trim();
        const remainder = line.substring(firstParenIndex);

        const groupRegex = /\(([^)]*)\)/g;
        const groups = [];
        let match;
        while ((match = groupRegex.exec(remainder)) !== null) {
            groups.push(match[1].trim());
        }

        if (groups.length !== 6) {
            results.push({
                status: "error",
                input: originalLine,
                reason: `Expected exactly 6 metadata groupings, but found ${groups.length}.`
            });
            continue;
        }

        const [yearStr, language, category, director, genreStr, castStr] = groups;

        let yearNum = null;
        const cleanYearStr = cleanNA(yearStr);
        if (cleanYearStr && /^\d{4}$/.test(cleanYearStr)) {
            yearNum = parseInt(cleanYearStr, 10);
        } else if (cleanYearStr) {
            console.warn(`[Parser Engine] Invalid Year format: "${yearStr}" in line: "${originalLine}". Value set to null.`);
        }

        const genres = genreStr ? genreStr.split(',').map(s => s.trim()).filter(s => s && s.toUpperCase() !== 'N/A' && s.toUpperCase() !== 'NA') : [];
        const cast = castStr ? castStr.split(',').map(s => s.trim()).filter(s => s && s.toUpperCase() !== 'N/A' && s.toUpperCase() !== 'NA') : [];

        results.push({
            name: title,
            Year: yearNum,
            Language: cleanNA(language),
            Category: cleanNA(category),
            Director: cleanNA(director),
            Genre: genres.length > 0 ? genres : null,
            Cast: cast.length > 0 ? cast : null
        });
    }

    return results;
}
