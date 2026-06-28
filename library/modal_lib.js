// library/modal_lib.js

export function enableEditingMode(AppState) {
    if (AppState.renderModalProps) AppState.renderModalProps(true);
}

export function disableEditingMode(AppState) {
    if (AppState.renderModalProps) AppState.renderModalProps(false);
}

export function openModal(itemId, isEditable, AppState, DOMHelper, sortAlpha, singleProps) {
    const item = AppState.items.find(m => m.id === itemId);
    if (!item) return;

    AppState.activeModalId = itemId;
    AppState.modalDraft = {}; 
    
    const modal = document.getElementById('details-modal');
    const editToggle = document.getElementById('modal-edit-toggle');
    const modalActions = document.getElementById('modal-actions');
    const editBtn = document.getElementById('modal-edit-btn');
    const updateBtn = document.getElementById('modal-update-btn');
    const titleInput = document.getElementById('modal-title-input');
    const notesInput = document.getElementById('modal-notes-input');
    
    if (editToggle) editToggle.classList.add('hidden');
    
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
        titleInput.disabled = !editable;
        notesInput.disabled = !editable;
        
        if (editable) {
            dynamicHeading.style.display = 'none';
            titleInput.style.display = '';
            if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
                titleInput.previousElementSibling.style.display = '';
            }
            editBtn.classList.add('hidden');
            updateBtn.classList.remove('hidden');
            updateBtn.disabled = false;
        } else {
            dynamicHeading.style.display = 'block';
            titleInput.style.display = 'none';
            if(titleInput.previousElementSibling && titleInput.previousElementSibling.tagName === 'LABEL') {
                titleInput.previousElementSibling.style.display = 'none';
            }
            editBtn.classList.remove('hidden');
            updateBtn.classList.add('hidden');
            updateBtn.disabled = true;
        }
        
        const container = document.getElementById('modal-dynamic-props');
        container.innerHTML = "";
        const fragment = document.createDocumentFragment();
        
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
                
                let defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.textContent = "--";
                select.appendChild(defaultOpt);
                
                sortedTagsForProp.forEach(tag => {
                    let option = document.createElement('option');
                    option.value = tag;
                    option.textContent = tag;
                    if (item[prop] === tag) option.selected = true;
                    select.appendChild(option);
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
                    const tagFrag = document.createDocumentFragment();
                    
                    AppState.modalDraft[prop].forEach(tag => {
                        let pill = document.createElement('div');
                        pill.className = 'tag-pill';
                        
                        let span = document.createElement('span');
                        span.textContent = tag;
                        pill.appendChild(span);
                        
                        if(editable) {
                            let removeBtn = document.createElement('span');
                            removeBtn.className = 'tag-pill-remove';
                            removeBtn.dataset.tag = tag;
                            removeBtn.innerHTML = '&times;';
                            removeBtn.addEventListener('click', () => {
                                AppState.modalDraft[prop] = AppState.modalDraft[prop].filter(t => t !== tag);
                                renderModalTags();
                            });
                            pill.appendChild(removeBtn);
                        }
                        tagFrag.appendChild(pill);
                    });
                    tagsBox.appendChild(tagFrag);

                    addSelect.innerHTML = `<option value="">Add ${prop}...</option>`;
                    sortedTagsForProp.forEach(tag => {
                        if (!AppState.modalDraft[prop].includes(tag)) {
                            let option = document.createElement('option');
                            option.value = tag;
                            option.textContent = tag;
                            addSelect.appendChild(option);
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
            fragment.appendChild(div);
        });
        
        container.appendChild(fragment);
    };

    AppState.renderModalProps(isEditable);
    modalActions.classList.remove('hidden');
    modal.classList.remove('hidden');
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
    const fragment = document.createDocumentFragment();

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
                    let label = document.createElement('label');
                    label.style.color = 'var(--primary)';
                    label.textContent = `${prop} (Conflict)`;
                    
                    let select = document.createElement('select');
                    select.id = `dupe-conflict-${prop.replace(/\s+/g, '-')}`;
                    select.dataset.customWrapper = "false";
                    select.className = "dupe-conflict-select";
                    
                    allVals.forEach(v => { 
                        let opt = document.createElement('option');
                        opt.value = v;
                        opt.textContent = v;
                        select.appendChild(opt); 
                    });
                    
                    div.appendChild(label);
                    div.appendChild(select);
                } else {
                    AppState.currentDuplicateDraft[prop] = allVals; 
                    
                    let label = document.createElement('label');
                    label.textContent = `${prop} (Merged)`;
                    
                    let tagsBox = document.createElement('div');
                    tagsBox.className = 'tags-box';
                    
                    allVals.forEach(v => {
                        let span = document.createElement('span');
                        span.className = 'tag-pill';
                        span.textContent = v;
                        tagsBox.appendChild(span);
                    });
                    
                    div.appendChild(label);
                    div.appendChild(tagsBox);
                }
                fragment.appendChild(div);
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
            
            let label = document.createElement('label');
            label.textContent = 'Notes (Conflict)';
            
            let textarea = document.createElement('textarea');
            textarea.id = 'dupe-merged-notes';
            textarea.rows = 4;
            textarea.style.cssText = "width:100%; border: 1px solid var(--muted); border-radius: 8px; padding: 8px;";
            textarea.value = combinedNotes;
            
            div.appendChild(label);
            div.appendChild(textarea);
            fragment.appendChild(div);
        }
    }

    if (!hasConflicts) {
        let div = document.createElement('div');
        let p = document.createElement('p');
        p.style.cssText = "text-align:center; color:var(--muted);";
        p.textContent = "All copies are identical. Click save to consolidate.";
        div.appendChild(p);
        fragment.appendChild(div);
    }

    container.appendChild(fragment);

    const mergeBtn = document.getElementById('duplicate-merge-btn');
    if(mergeBtn) mergeBtn.classList.add('hidden');
    
    const saveBtn = document.getElementById('duplicate-save-btn');
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = false;
    
    document.getElementById('duplicate-merge-modal').classList.remove('hidden');
}
