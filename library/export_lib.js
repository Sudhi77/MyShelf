/**
 * library/export_lib.js
 */

// Private Helpers (only accessible within this file)
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Logic: Text Export
function exportTxt(data) {
    let content = "MyShelf Library Export\n======================\n\n";
    data.forEach((row, i) => {
        content += `${i+1}. ${row.Title}\n`;
        for(let key in row) {
            if(key !== "Title" && row[key] !== '-') content += `   ${key}: ${row[key]}\n`;
        }
        content += "\n";
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "MyShelf_Library.txt"; a.click();
    URL.revokeObjectURL(url);
}

// Logic: PDF Export
async function exportPdf(data, properties) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.text("MyShelf Database Library", 14, 15);
    doc.autoTable({
        startY: 20,
        head: [["Title", ...properties, "Notes"]],
        body: data.map(row => [row.Title, ...properties.map(p => row[p]), row.Notes || '-']),
        styles: { fontSize: 8, cellWidth: 'wrap' }
    });
    doc.save("MyShelf_Library.pdf");
}

// Logic: Excel Export
async function exportExcel(data) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Library");
    XLSX.writeFile(wb, "MyShelf_Library.xlsx");
}

// THE SINGLE ENTRY POINT
export async function handleExport(movies, properties, format) {
    const exportMovies = movies.filter(m => m.isMerged !== false);
    const data = exportMovies.map(m => {
        let row = { "Title": m.name || '-' };
        properties.forEach(p => row[p] = Array.isArray(m[p]) ? m[p].join(', ') : (m[p] || '-'));
        if(m.notes) row["Notes"] = m.notes;
        return row;
    });

    if (format === 'txt') exportTxt(data);
    if (format === 'pdf') await exportPdf(data, properties);
    if (format === 'xlsx') await exportExcel(data);
}
