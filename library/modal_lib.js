export function enableEditingMode(AppState) {
  if(AppState.renderModalProps) AppState.renderModalProps(true);
}

export function disableEditingMode(AppState) {
  if(AppState.renderModalProps) AppState.renderModalProps(false);
}

export function openModal(itemId, isEditable, AppState, DOMHelper, sortAlpha, singleProps) {
  const item = AppState.items.find(m => m.id === itemId);
  AppState.activeModalId = itemId;
  AppState.modalDraft = {}; 
  
  const editToggle = document.getElementById('modal-edit-toggle');
  if (editToggle) editToggle.classList.add('hidden');
  
  const modalActions = document.getElementById('modal-actions');
  const editBtn = document.getElementById('modal-edit-btn');
  const updateBtn = document.getElementById('modal-update-btn');
  const titleInput = document.getElementById('modal-title-input');
  const notesInput = document.getElementById('modal-notes-input');
  
  let staticHeading = document.getElementById('details-modal').querySelector('h2, h3');
  if(staticHeading && staticHeading.id !== 'dynamic-modal-heading') {
      staticHeading.style.display = 'none';
  }

  let dynamicHeading = document.getElementById('dynamic-modal-heading');
  if (!dynamicHeading) {
      dynamicHeading = document.createElement('h2');
      dynamicHeading.id = 'dynamic-modal-heading';
      dynamicHeading.style.color = 'var(--primary)';
      dynamicHeading.style.marginBottom = '20px';
      dynamicHeading.style.textAlign = 'center';
      titleInput.parentNode.parentNode.insertBefore(dynamicHeading, titleInput.parentNode);
  }
  dynamicHeading.innerText = item.name;

  titleInput.value = item.name;
  notesInput.value = item.notes || '';
  
  AppState.renderModalProps = function(editable) {
      if (editable) {
          dynamicHeading.style.display = 'none';
          titleInput.style.display = '';
          if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
              titleInput.previousElementSibling.style.display = '';
          }
          titleInput.disabled = false;
          notesInput.disabled = false;
          editBtn.disabled = true;
          updateBtn.disabled = false;
          editBtn.classList.add('hidden');
          updateBtn.classList.remove('hidden');
      } else {
          dynamicHeading.style.display = 'block';
          titleInput.style.display = 'none';
          if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
              titleInput.previousElementSibling.style.display = 'none';
          }
          notesInput.disabled = true;
          editBtn.disabled = false;
          updateBtn.disabled = true;
          editBtn.classList.remove('hidden');
          updateBtn.classList.add('hidden');
      }
      
      const container = document.getElementById('modal-dynamic-props');
      container.innerHTML = "";
      
      const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [], tags: {} };
      const sortedProps = sortAlpha(currentSchema.properties);

      sortedProps.forEach(prop => {
          const hasData = item[prop] && (Array.isArray(item[prop]) ? item[prop].length > 0 : true);
          if (!editable && !hasData) return;
          
          let div = document.createElement('div');
          div.className = 'form-group';
          div.style.alignItems = "flex-start"; 
          
          let label = document.createElement('label');
          label.innerText = prop;
          label.style.marginTop = "8px"; 
          div.appendChild(label);
          
          const sortedTagsForProp = sortAlpha(currentSchema.tags[prop] || []);

          if (singleProps.includes(prop)) {
              let select = document.createElement('select');
              select.id = `modal-prop-${prop.replace(/\s+/g, '-')}`;
              select.disabled = !editable; 
              select.innerHTML = `<option value="">--</option>`;
              
              sortedTagsForProp.forEach(tag => {
                  let isSelected = item[prop] === tag;
                  select.innerHTML += `<option value="${tag}" ${isSelected ? 'selected' : ''}>${tag}</option>`;
              });
              div.appendChild(select);
          } else {
              AppState.modalDraft[prop] = Array.isArray(item[prop]) ? [...item[prop]] : (item[prop] ? [item[prop]] : []);
              
              let wrapper = document.createElement('div');
              wrapper.className = 'modal-multi-prop-wrapper';
              if(editable) wrapper.classList.add('is-editing');
              wrapper.style.width = "100%";

              let tagsBox = document.createElement('div');
              tagsBox.className = 'tags-box';
              tagsBox.style.marginBottom = '0';
              wrapper.appendChild(tagsBox);

              let addSelect = document.createElement('select');
              addSelect.id = `modal-add-prop-${prop.replace(/\s+/g, '-')}`;
              addSelect.className = 'modal-add-prop-select'; 
              addSelect.disabled = !editable; 

              wrapper.appendChild(addSelect);
              div.appendChild(wrapper);

              const renderModalTags = () => {
                  tagsBox.innerHTML = '';
                  AppState.modalDraft[prop].forEach(tag => {
                      let pill = document.createElement('div');
                      pill.className = 'tag-pill';
                      pill.innerHTML = `<span>${tag}</span>${editable ? `<span class="tag-pill-remove" data-tag="${tag}">&times;</span>` : ''}`;
                      
                      if(editable) {
                          pill.querySelector('.tag-pill-remove').addEventListener('click', (e) => {
                              AppState.modalDraft[prop] = AppState.modalDraft[prop].filter(t => t !== tag);
                              renderModalTags();
                          });
                      }
                      tagsBox.appendChild(pill);
                  });

                  addSelect.innerHTML = `<option value="">Add ${prop}...</option>`;
                  sortedTagsForProp.forEach(tag => {
                      if (!AppState.modalDraft[prop].includes(tag)) {
                          addSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
                      }
                  });
                  if(editable && addSelect.dataset.customWrapper) {
                      DOMHelper.setSelectValue(addSelect, '');
                  }
              };

              addSelect.addEventListener('change', (e) => {
                  if (e.target.value) {
                      AppState.modalDraft[prop].push(e.target.value);
                      renderModalTags();
                      DOMHelper.setSelectValue(e.target, '');
                  }
              });
              renderModalTags(); 
          }
          container.appendChild(div);
      });
  };

  AppState.renderModalProps(isEditable);
  modalActions.classList.remove('hidden');
  document.getElementById('details-modal').classList.remove('hidden');
}

export function openDuplicateMergeModal(itemName, isDraftTable, AppState, singleProps) {
    AppState.currentDuplicateGroup = AppState.items.filter(m => 
        (m.name || '').toLowerCase().trim() === itemName.toLowerCase().trim() && 
        (isDraftTable ? m.isMerged === false : m.isMerged !== false)
    );

    document.getElementById('duplicate-modal-heading').innerText = AppState.currentDuplicateGroup[0].name;
    
    const container = document.getElementById('duplicate-details-container');
    container.innerHTML = "";
    AppState.currentDuplicateDraft = {};
    
    const currentSchema = AppState.metadata.categories[AppState.currentCategory] || { properties: [] };
    let hasConflicts = false;

    currentSchema.properties.forEach(prop => {
        let allVals = [];
        AppState.currentDuplicateGroup.forEach(m => {
            if (m[prop]) {
                if (Array.isArray(m[prop])) allVals.push(...m[prop]);
                else allVals.push(m[prop]);
            }
        });

        allVals = [...new Set(allVals)];

        if (allVals.length > 0) {
            if (allVals.length === 1) {
                AppState.currentDuplicateDraft[prop] = singleProps.includes(prop) ? allVals[0] : allVals;
            } else {
                hasConflicts = true;
                let div = document.createElement('div');
                div.className = 'form-group';
                
                if (singleProps.includes(prop)) {
                    let html = `<label style="color:var(--primary)">${prop} (Conflict)</label><select id="dupe-conflict-${prop.replace(/\s+/g, '-')}" data-custom-wrapper="false" style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary); background: var(--surface); color: var(--text);">`;
                    allVals.forEach(v => { html += `<option value="${v}">${v}</option>`; });
                    html += `</select>`;
                    div.innerHTML = html;
                } else {
                    AppState.currentDuplicateDraft[prop] = allVals; 
                    div.innerHTML = `<label>${prop} (Merged)</label><div class="tags-box">${allVals.map(v => `<span class="tag-pill">${v}</span>`).join('')}</div>`;
                }
                container.appendChild(div);
            }
        }
    });

    let allNotes = AppState.currentDuplicateGroup.map(m => m.notes).filter(n => n && n.trim());
    allNotes = [...new Set(allNotes)];
    if (allNotes.length > 0) {
        let combinedNotes = allNotes.join('\n---\n');
        AppState.currentDuplicateDraft.notes = combinedNotes;
        if (allNotes.length > 1) {
            hasConflicts = true;
            let div = document.createElement('div');
            div.className = 'form-group full-width';
            div.innerHTML = `<label>Notes (Conflict)</label><textarea id="dupe-merged-notes" rows="4" style="width:100%; border: 1px solid var(--muted); border-radius: 8px; padding: 8px;">${combinedNotes}</textarea>`;
            container.appendChild(div);
        }
    }

    if (!hasConflicts) {
        let div = document.createElement('div');
        div.innerHTML = '<p style="text-align:center; color:var(--muted);">All copies are identical. Click save to consolidate.</p>';
        container.appendChild(div);
    }

    const mergeBtn = document.getElementById('duplicate-merge-btn');
    if(mergeBtn) mergeBtn.classList.add('hidden');
    
    const saveBtn = document.getElementById('duplicate-save-btn');
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = false;
    
    document.getElementById('duplicate-merge-modal').classList.remove('hidden');
}
