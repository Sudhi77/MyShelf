/**
 * library/db_control_lib.js
 * Pure engine logic for isolated batch transactions, duplicate analysis, and staging commits.
 */
import { doc, collection, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Updates unmerged entries to mark them as merged (isMerged: true) via a batch transaction.
 */
export async function commitUnmergedMovies(db, userId, unmergedMovies) {
    if (!userId) throw new Error("User not authenticated.");
    
    const batch = writeBatch(db);
    unmergedMovies.forEach(m => { 
        batch.update(doc(db, "users", userId, "movies", m.id), { isMerged: true }); 
    });
    
    await batch.commit();
    return unmergedMovies.length;
}

/**
 * Scans for duplicates within a specific sub-database segment (commits/main database).
 */
export function findDuplicates(movies, dbName) {
    let targetMovies = movies.filter(m => dbName === 'commits' ? m.isMerged === false : m.isMerged !== false);
    const nameCounts = {};
    
    targetMovies.forEach(m => {
        const n = (m.name || '').toLowerCase().trim();
        nameCounts[n] = (nameCounts[n] || 0) + 1;
    });
    
    let dupesCount = 0;
    for (let n in nameCounts) {
        if (nameCounts[n] > 1) dupesCount++;
    }
    
    return { dupesCount, nameCounts };
}

/**
 * Automatically resolves and merges lists of duplicate entries matching specified movie names.
 */
export async function bulkMergeSelectedDuplicates(db, userId, movies, isDraftTable, selectedNames, properties, singleProps) {
    if (!userId) throw new Error("User not authenticated.");
    
    const batch = writeBatch(db);
    let mergedCount = 0;

    selectedNames.forEach(movieName => {
        if (!movieName) return; 

        const duplicateGroup = movies.filter(m =>
            (m.name || '').toLowerCase().trim() === movieName.toLowerCase().trim() &&
            (isDraftTable ? m.isMerged === false : m.isMerged !== false)
        );

        if (duplicateGroup.length <= 1) return;

        let draft = {};
        properties.forEach(prop => {
            let allVals = [];
            duplicateGroup.forEach(m => {
                if (m[prop]) {
                    if (Array.isArray(m[prop])) allVals.push(...m[prop]);
                    else allVals.push(m[prop]);
                }
            });

            allVals = [...new Set(allVals)];

            if (allVals.length > 0) {
                if (singleProps.includes(prop)) {
                    draft[prop] = allVals[0]; 
                } else {
                    draft[prop] = allVals;
                }
            }
        });

        let allNotes = duplicateGroup.map(m => m.notes).filter(n => n && n.trim());
        if (allNotes.length > 0) {
            draft.notes = allNotes.join('\n---\n');
        }

        const finalMovie = {
            name: duplicateGroup[0].name,
            isMerged: duplicateGroup[0].isMerged,
            ...draft
        };

        duplicateGroup.forEach(m => {
            batch.delete(doc(db, "users", userId, "movies", m.id));
        });

        const newRef = doc(collection(db, "users", userId, "movies"));
        batch.set(newRef, finalMovie);
        mergedCount++;
    });

    if (mergedCount > 0) {
        await batch.commit();
    }
    return mergedCount;
}
