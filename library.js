// Dynamically load external scripts to keep index.html clean
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export async function handleExport(movies, properties) {
    // Filter movies to only include those in the main Database
    const exportMovies = movies.filter(m => m.isMerged !== false);
    
    if (exportMovies.length === 0) {
        alert("No movies available in the database to export.");
        return;
    }

    // Format Data for tabular export
    const data = exportMovies.map(m => {
        let row = { "Title": m.name || '-' };
        properties.forEach(p => {
            row[p] = Array.isArray(m[p]) ? m[p].join(', ') : (m[p] || '-');
        });
        if(m.notes) row["Notes"] = m.notes;
        return row;
    });

    // Create dynamic UI overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;backdrop-filter:blur(3px);";
    
    const modal = document.createElement('div');
    modal.className = 'main-card';
    modal.style.cssText = "background:var(--surface);padding:25px;border-radius:12px;display:flex;flex-direction:column;gap:15px;min-height:auto;width:90%;max-width:320px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.3);";
    
    modal.innerHTML = `<h3 style="color:var(--text);margin-bottom:10px;font-family:var(--font-heading);">Select Export Format</h3>`;
    
    const btnTxt = document.createElement('button');
    btnTxt.className = 'btn btn-primary';
    btnTxt.innerText = 'Export as .TXT';
    
    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn btn-primary';
    btnPdf.innerText = 'Export as .PDF';
    
    const btnExcel = document.createElement('button');
    btnExcel.className = 'btn btn-primary';
    btnExcel.innerText = 'Export as .XLSX';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.style.marginTop = "10px";
    btnCancel.innerText = 'Cancel';

    modal.append(btnTxt, btnPdf, btnExcel, btnCancel);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => document.body.removeChild(overlay);
    btnCancel.onclick = close;

    // Output logic
    btnTxt.onclick = () => {
        exportTxt(data);
        close();
    };

    btnPdf.onclick = async () => {
        btnPdf.innerText = "Loading PDF Engine...";
        try {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js");
            exportPdf(data, properties);
        } catch(e) { alert("Failed to load PDF library. Check your internet connection."); }
        close();
    };

    btnExcel.onclick = async () => {
        btnExcel.innerText = "Loading Excel Engine...";
        try {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
            exportExcel(data);
        } catch(e) { alert("Failed to load Excel library. Check your internet connection."); }
        close();
    };
}

// Format Processing Functions
function exportTxt(data) {
    let content = "MyShelf Library Export\n======================\n\n";
    data.forEach((row, i) => {
        content += `${i+1}. ${row.Title}\n`;
        for(let key in row) {
            if(key !== "Title" && row[key] !== '-') {
                content += `   ${key}: ${row[key]}\n`;
            }
        }
        content += "\n";
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MyShelf_Library.txt";
    a.click();
    URL.revokeObjectURL(url);
}

function exportPdf(data, properties) {
    const { jsPDF } = window.jspdf;
    // Use landscape for better column fitting
    const doc = new jsPDF('landscape');
    doc.text("MyShelf Database Library", 14, 15);
    
    const head = [["Title", ...properties, "Notes"]];
    const body = data.map(row => {
        return [row.Title, ...properties.map(p => row[p]), row.Notes || '-'];
    });

    doc.autoTable({
        startY: 20,
        head: head,
        body: body,
        styles: { fontSize: 8, cellWidth: 'wrap' },
        columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' } }
    });
    doc.save("MyShelf_Library.pdf");
}

function exportExcel(data) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Library");
    XLSX.writeFile(wb, "MyShelf_Library.xlsx");
}
