export async function initializeStatistics(AppState, DOMHelper, sortAlpha, switchViewCallback, filterByTagCallback) {
    await loadChartJs();

    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    const navBtn = document.createElement('button');
    navBtn.id = 'nav-statistics';
    navBtn.className = 'icon-btn';
    navBtn.style.display = 'flex';
    navBtn.style.alignItems = 'center';
    navBtn.style.gap = '10px';
    navBtn.style.width = '100%';
    navBtn.style.padding = '10px 0';
    navBtn.style.fontSize = '1.1rem';
    navBtn.style.fontWeight = '500';
    navBtn.innerHTML = `<i class="fa-solid fa-chart-pie"></i> Statistics`;
    
    const sidebarSections = document.querySelectorAll('.sidebar-section');
    if (sidebarSections.length > 0) {
        sidebarSections[0].appendChild(navBtn);
    } else {
        sidebar.appendChild(navBtn);
    }

    const statsSidebarControls = document.createElement('div');
    statsSidebarControls.id = 'stats-sidebar-controls';
    statsSidebarControls.className = 'sidebar-section hidden';
    statsSidebarControls.innerHTML = `
        <h3>Chart Settings</h3>
        <div class="form-group">
            <select id="stats-chart-type">
                <option value="doughnut" selected>Donut</option>
                <option value="pie">Pie</option>
                <option value="bar">Bar</option>
                <option value="polarArea">Polar Area</option>
            </select>
        </div>
        <div class="form-group">
            <select id="stats-prop-select">
                <option value="">Select Property</option>
            </select>
        </div>
        <button id="stats-view-btn" class="btn btn-primary" style="width: max-content; padding: 0 20px; align-self: flex-start;">View</button>
    `;
    sidebar.insertBefore(statsSidebarControls, sidebar.querySelector('#close-sidebar').nextSibling);

    const statsPanel = document.createElement('div');
    statsPanel.id = 'statistics-panel';
    statsPanel.className = 'main-card hidden';
    statsPanel.innerHTML = `
        <div class="stats-header">
            <button id="stats-menu-btn" class="stats-menu-btn"><i class="fa-solid fa-bars"></i></button>
            <h2 class="stats-heading">Statistics</h2>
            <button id="stats-exit-btn" class="stats-exit-btn" title="Exit Statistics">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
        </div>
        <div class="chart-container">
            <canvas id="stats-canvas"></canvas>
        </div>
        <div class="stats-table-wrapper table-wrapper">
            <table id="stats-table">
                <thead>
                    <tr>
                        <th>Tag</th>
                        <th style="text-align: right;">Count</th>
                        <th style="text-align: right;">Percentage</th>
                    </tr>
                </thead>
                <tbody id="stats-table-body">
                    <tr><td colspan="3" style="text-align:center; color: var(--muted);">Select a property and click View.</td></tr>
                </tbody>
            </table>
        </div>
    `;
    mainContent.appendChild(statsPanel);

    navBtn.addEventListener('click', () => {
        enterStatsMode();
        switchViewCallback('statistics');
    });

    document.getElementById('stats-menu-btn').addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    document.getElementById('stats-exit-btn').addEventListener('click', () => {
        exitStatsMode();
        switchViewCallback('landing');
    });

    document.getElementById('stats-view-btn').addEventListener('click', () => {
        renderStatistics(AppState);
        sidebar.classList.remove('open');
    });

    document.getElementById('stats-table-body').addEventListener('click', (e) => {
        const link = e.target.closest('.stat-tag-link');
        if (link) {
            const prop = link.dataset.prop;
            const tag = link.dataset.tag;
            filterByTagCallback(prop, tag);
        }
    });

    function enterStatsMode() {
        const children = Array.from(sidebar.children);
        children.forEach(child => {
            if (child.id !== 'close-sidebar' && child.id !== 'stats-sidebar-controls') {
                child.classList.add('stats-hidden');
            }
        });
        statsSidebarControls.classList.remove('hidden');
        updateStatsDropdown(AppState, sortAlpha, DOMHelper);
    }

    function exitStatsMode() {
        const children = Array.from(sidebar.children);
        children.forEach(child => {
            child.classList.remove('stats-hidden');
        });
        statsSidebarControls.classList.add('hidden');
    }
}

export function updateStatsDropdown(AppState, sortAlpha, DOMHelper) {
    const propSelect = document.getElementById('stats-prop-select');
    if (!propSelect) return;
    
    const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
    const sortedProps = sortAlpha(currentSchema.properties);
    
    const prevVal = propSelect.value;
    propSelect.innerHTML = `<option value="">Select Property</option>`;
    sortedProps.forEach(prop => {
        propSelect.innerHTML += `<option value="${prop}">${prop}</option>`;
    });
    
    if (sortedProps.includes(prevVal)) {
        DOMHelper.setSelectValue(propSelect, prevVal);
    } else {
        DOMHelper.setSelectValue(propSelect, '');
    }
}

let chartInstance = null;

function renderStatistics(AppState) {
    const chartType = document.getElementById('stats-chart-type').value;
    const property = document.getElementById('stats-prop-select').value;
    const tbody = document.getElementById('stats-table-body');
    
    if (!property) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: red;">Please select a property first.</td></tr>';
        if(chartInstance) chartInstance.destroy();
        return;
    }

    const items = AppState.items.filter(m => m.isMerged !== false);
    const totalItems = items.length;
    
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data available in this category.</td></tr>';
        if(chartInstance) chartInstance.destroy();
        return;
    }

    const counts = {};
    
    items.forEach(item => {
        const val = item[property];
        if (!val || val === '' || (Array.isArray(val) && val.length === 0)) {
            counts['NA'] = (counts['NA'] || 0) + 1;
        } else if (Array.isArray(val)) {
            val.forEach(v => {
                const cleanV = String(v).trim();
                counts[cleanV] = (counts[cleanV] || 0) + 1;
            });
        } else {
            const cleanV = String(val).trim();
            counts[cleanV] = (counts[cleanV] || 0) + 1;
        }
    });

    // Group Cast with less than 5 occurrences into "Others (<5)"
    if (property === 'Cast') {
        let othersCount = 0;
        for (const key in counts) {
            if (key !== 'NA' && counts[key] < 5) {
                othersCount += counts[key];
                delete counts[key];
            }
        }
        if (othersCount > 0) {
            counts['Others (<5)'] = othersCount;
        }
    }

    const labels = Object.keys(counts).sort((a, b) => {
        if (a === 'NA') return 1;
        if (b === 'NA') return -1;
        if (a === 'Others (<5)') return 1;
        if (b === 'Others (<5)') return -1;
        return counts[b] - counts[a]; 
    });
    
    const dataValues = labels.map(label => counts[label]);
    const bgColors = labels.map(label => {
        if (label === 'NA') return '#9CA3AF';
        if (label === 'Others (<5)') return '#6B7280';
        return generateRandomColor();
    });

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('stats-canvas').getContext('2d');
    const fontColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#ffffff';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--muted').trim() || 'rgba(255,255,255,0.1)';

    chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: `Count`,
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 1,
                borderColor: getComputedStyle(document.body).getPropertyValue('--surface').trim()
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: fontColor }
                }
            },
            scales: chartType === 'bar' ? {
                x: { ticks: { color: fontColor }, grid: { color: gridColor } },
                y: { ticks: { color: fontColor }, grid: { color: gridColor }, beginAtZero: true }
            } : {}
        }
    });

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    labels.forEach(label => {
        const count = counts[label];
        const percentage = ((count / totalItems) * 100).toFixed(1);
        
        const tr = document.createElement('tr');
        let labelHtml = '';
        
        if (label === 'Others (<5)') {
            labelHtml = `<strong>${label}</strong>`;
        } else {
            labelHtml = `<span class="stat-tag-link" data-prop="${property}" data-tag="${label.replace(/"/g, '&quot;')}" style="color: var(--primary); cursor: pointer; text-decoration: underline; font-weight: 500;">${label}</span>`;
        }

        tr.innerHTML = `
            <td>${labelHtml}</td>
            <td style="text-align: right;">${count}</td>
            <td style="text-align: right;">${percentage}%</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function generateRandomColor() {
    const h = Math.floor(Math.random() * 360);
    const s = 60 + Math.floor(Math.random() * 30); 
    const l = 50 + Math.floor(Math.random() * 20); 
    return `hsl(${h}, ${s}%, ${l}%)`;
}

async function loadChartJs() {
    if (window.Chart) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/chart.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
