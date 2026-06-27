import { doc, collection, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function commitUnmergedEntries(db, userId, category, unmergedEntries) {
    if (!userId) throw new Error("User not authenticated.");
    const batch = writeBatch(db);
    unmergedEntries.forEach(m => { 
        batch.update(doc(db, "users", userId, category, m.id), { isMerged: true }); 
    });
    await batch.commit();
    return unmergedEntries.length;
}

export async function bulkMergeSelectedDuplicates(db, userId, category, entries, isDraftTable, selectedNames, properties, singleProps) {
    if (!userId) throw new Error("User not authenticated.");
    const batch = writeBatch(db);
    let mergedCount = 0;

    selectedNames.forEach(name => {
        const group = entries.filter(m => (m.name || '').toLowerCase().trim() === name.toLowerCase().trim() && (isDraftTable ? m.isMerged === false : m.isMerged !== false));
        if (group.length <= 1) return;

        let draft = {};
        properties.forEach(prop => {
            let vals = [...new Set(group.flatMap(m => m[prop] || []))];
            if (vals.length > 0) draft[prop] = singleProps.includes(prop) ? vals[0] : vals;
        });

        const newRef = doc(collection(db, "users", userId, category));
        batch.set(newRef, { name: group[0].name, isMerged: group[0].isMerged, ...draft });
        group.forEach(m => batch.delete(doc(db, "users", userId, category, m.id)));
        mergedCount++;
    });
    await batch.commit();
    return mergedCount;
}
