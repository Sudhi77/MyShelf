export function renderTable(dataToRender, tbodyId, isDraftTable, callback, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = ''; 
  
  let sl = (parseInt(startIndex) || 0) + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  const fragment = document.createDocumentFragment();

  dataToRender.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sl++}</td>
      <td><span class="clickable-title" data-id="${item.id}" data-draft="${isDraftTable}">${item.name || '-'}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'}" data-id="${item.id}"></td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

export function renderGroupTable(groups, tbodyId, isDraftTable, callback, startIndex = 0) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = ''; 
  
  let sl = (parseInt(startIndex) || 0) + 1;
  
  if (tbodyId === "commits-body") document.getElementById('select-all-commits').checked = false;
  if (tbodyId === "table-body") document.getElementById('select-all-main').checked = false;

  const fragment = document.createDocumentFragment();

  groups.forEach(group => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sl++}</td>
      <td><span class="clickable-group-title" data-name="${group.realName.replace(/"/g, '&quot;')}" data-draft="${isDraftTable}">${group.name}</span></td>
      <td style="text-align:right;"><input type="checkbox" class="${isDraftTable ? 'draft-checkbox' : 'main-checkbox'} group-checkbox" data-name="${group.realName.replace(/"/g, '&quot;')}"></td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

export function renderBatchPreviewTable(bulkEntriesDraft) {
  bulkEntriesDraft.sort((a, b) => {
      if (a.status === 'error' && b.status !== 'error') return -1;
      if (a.status !== 'error' && b.status === 'error') return 1;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
  });
  
  const tbody = document.getElementById('batch-preview-body');
  tbody.innerHTML = '';

  const fragment = document.createDocumentFragment();
  
  bulkEntriesDraft.forEach((item, index) => {
      const tr = document.createElement('tr');
      if (item.status === 'error') {
          tr.style.background = 'rgba(255, 0, 0, 0.1)';
          tr.innerHTML = `
              <td>${index + 1}</td>
              <td style="color: #ff4444;"><strong>Error:</strong> ${item.reason}<br><small>${item.input}</small></td>
              <td style="text-align:right;"><input type="checkbox" disabled></td>
          `;
      } else {
          tr.innerHTML = `
              <td>${index + 1}</td>
              <td>${item.name}</td>
              <td style="text-align:right;"><input type="checkbox" class="batch-preview-checkbox" data-index="${index}"></td>
          `;
      }
      fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
  document.getElementById('select-all-batch').checked = false;
  
  const validCount = bulkEntriesDraft.filter(i => i.status !== 'error').length;
  document.getElementById('batch-count').innerText = `Valid Count: ${validCount} / Total: ${bulkEntriesDraft.length}`;
}

export function renderCompareTable(items, currentSchema) {
  const tbody = document.getElementById('compare-body');
  tbody.innerHTML = '';

  const tempItems = items.filter(m => m.isMerged === false);
  const mainItems = items.filter(m => m.isMerged !== false);

  let matches = tempItems.filter(t => mainItems.some(m => m.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

  if(matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No overlapping entries found.</td></tr>';
    return;
  }

  matches.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));

  const hasData = (val) => {
      if (!val || val === '-') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
  };

  const formatTags = (val, itemId, prop) => {
      if (!hasData(val)) return '-';
      let tags = Array.isArray(val) ? val : [val];
      return tags.map(tag => `
          <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
              <input type="checkbox" class="compare-tag-cb" data-movie-id="${itemId}" data-prop="${prop}" data-val="${String(tag).replace(/"/g, '&quot;')}" style="margin-top: 2px;">
              <span style="word-break: break-word; line-height: 1.2;">${tag}</span>
          </div>
      `).join('');
  };

  const fragment = document.createDocumentFragment();

  matches.forEach(tItem => {
    const mItem = mainItems.find(m => m.name.toLowerCase().trim() === tItem.name.toLowerCase().trim());
    
    const titleRow = document.createElement('tr');
    titleRow.innerHTML = `<td colspan="3" style="background: var(--secondary); color: var(--text); font-weight: bold; text-align: center; font-size: 1.05rem;">${tItem.name}</td>`;
    fragment.appendChild(titleRow);
    
    currentSchema.properties.forEach(p => {
       if(hasData(mItem[p]) || hasData(tItem[p])) {
         const mValHtml = formatTags(mItem[p], mItem.id, p);
         const tValHtml = formatTags(tItem[p], tItem.id, p);
         const tr = document.createElement('tr');
         tr.innerHTML = `
            <td style="font-weight: 500;">${p}</td>
            <td>${mValHtml}</td>
            <td>${tValHtml}</td>
         `;
         fragment.appendChild(tr);
       }
    });
    
    if (hasData(mItem.notes) || hasData(tItem.notes)) {
        const mNoteHtml = formatTags(mItem.notes, mItem.id, 'notes');
        const tNoteHtml = formatTags(tItem.notes, tItem.id, 'notes');
        const notesTr = document.createElement('tr');
        notesTr.innerHTML = `
            <td style="font-weight: 500;">Notes</td>
            <td>${mNoteHtml}</td>
            <td>${tNoteHtml}</td>
         `;
         fragment.appendChild(notesTr);
    }
  });
  
  tbody.appendChild(fragment);
}

export function renderManageTagsTable(prop, currentSchema, btns, sortAlphaFn) {
  btns.editBtn.classList.remove('hidden');
  btns.saveBtn.classList.add('hidden');
  
  const tbody = document.getElementById('manage-tags-body');
  tbody.innerHTML = '';
  
  if (!prop) {
    btns.editBtn.disabled = true;
    btns.deleteBtn.disabled = true;
    document.getElementById('manage-tags-count').innerText = `Count: 0`;
    return;
  }
  
  btns.editBtn.disabled = false;
  btns.deleteBtn.disabled = false;

  const sortedTags = sortAlphaFn(currentSchema.tags[prop] || []);
  document.getElementById('manage-tags-count').innerText = `Count: ${sortedTags.length}`;

  const fragment = document.createDocumentFragment();

  sortedTags.forEach((tag, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="manage-tag-cb" data-idx="${idx}"></td>
      <td><input type="text" class="manage-tag-input" data-idx="${idx}" value="${tag}" disabled></td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}
