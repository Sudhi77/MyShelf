
/**
 * Modular Export Library for MyShelf
 * Handles Excel (CSV), HTML, and PDF database exports securely.
 */

export function exportDatabase(movies, metadata) {
    const format = prompt("Enter desired export format (excel, html, pdf):", "excel");
    if (!format) return;

    const normalizedFormat = format.toLowerCase().trim();
    const headers = ["Title", "Notes", ...metadata.properties];

    // Alphabetize the export data
    const sortedMovies = [...movies].sort((a, b) => 
        String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
    );

    if (normalizedFormat === 'excel' || normalizedFormat === 'csv') {
        exportCSV(sortedMovies, headers);
    } else if (normalizedFormat === 'html') {
        exportHTML(sortedMovies, headers);
    } else if (normalizedFormat === 'pdf') {
        exportPDF(sortedMovies, headers);
    } else {
        alert("Invalid format selected. Please enter excel, html, or pdf.");
    }
}

function getVal(movie, prop) {
    if (prop === "Title") return movie.name || "";
    if (prop === "Notes") return movie.notes || "";
    let val = movie[prop];
    if (!val) return "";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
}

function exportCSV(movies, headers) {
    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";
    movies.forEach(m => {
        let row = headers.map(h => `"${getVal(m, h).replace(/"/g, '""')}"`);
        csvContent += row.join(",") + "\n";
    });
    triggerDownload("MyShelf_Export.csv", "text/csv;charset=utf-8;", csvContent);
}

function exportHTML(movies, headers) {
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>MyShelf Export</title>
        <style>
            body { font-family: 'Roboto', sans-serif; background-color: #f4f5f9; padding: 20px; color: #212121; }
            h2 { text-align: center; color: #4A90E2; }
            table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
            th, td { border: 1px solid #e0e0e0; padding: 12px; text-align: left; font-size: 0.95rem; }
            th { background-color: #4A90E2; color: #fff; font-weight: 600; }
            tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
    </head>
    <body>
        <h2>MyShelf Database Export</h2>
        <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
                ${movies.map(m => `<tr>${headers.map(h => `<td>${getVal(m, h)}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
    triggerDownload("MyShelf_Export.html", "text/html", html);
}

function exportPDF(movies, headers) {
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>MyShelf Export</title>
        <style>
            body { font-family: sans-serif; font-size: 12px; padding: 10px; color: #000; }
            h2 { text-align: center; margin-bottom: 15px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #eee; font-weight: bold; }
        </style>
    </head>
    <body>
        <h2>MyShelf Database Export</h2>
        <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
                ${movies.map(m => `<tr>${headers.map(h => `<td>${getVal(m, h)}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
        <script>
            window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 500);
            };
        </script>
    </body>
    </html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}

function triggerDownload(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
