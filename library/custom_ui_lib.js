export const DOMHelper = {
    setSelectValue: (element, value) => {
        if (!element) return;
        element.value = value;
        element.dispatchEvent(new CustomEvent('sync-custom-select'));
    },
    setSelectDisabled: (element, isDisabled) => {
        if (!element) return;
        element.disabled = isDisabled;
        element.dispatchEvent(new CustomEvent('sync-custom-select'));
    },
    setSelectMultiple: (element, isMultiple) => {
         if (!element) return;
         if (isMultiple) element.setAttribute('multiple', '');
         else element.removeAttribute('multiple');
         element.dispatchEvent(new CustomEvent('sync-custom-select'));
    }
};

export function initializeCustomDropdowns() {
  function applyCustomSelect(select) {
      if (select.dataset.customWrapper || select.dataset.customWrapper === "false") return;
      select.dataset.customWrapper = "true";
      select.classList.add('customized-native');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      
      if (select.id === 'sort-select') {
          wrapper.style.cssText = "flex: unset; width: 36px; height: 36px; position: relative;";
      }
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select); 

      const trigger = document.createElement('div');
      
      if (select.id === 'sort-select') {
          trigger.className = 'custom-select-trigger btn btn-outline icon-only-btn';
          trigger.style.cssText = "width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;";
          trigger.innerHTML = `<i class="fa-solid fa-arrow-down-a-z" id="sort-icon"></i>`;
      } else {
          trigger.className = 'custom-select-trigger';
          trigger.innerHTML = `<span class="custom-select-text"></span><i class="fa-solid fa-chevron-down custom-select-icon"></i>`;
      }
      wrapper.appendChild(trigger);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-select-options';
      
      if (select.id === 'sort-select') {
          optionsContainer.style.cssText = "position: absolute; top: calc(100% + 4px); right: 0; left: auto; width: 160px; background-color: var(--surface); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--muted); z-index: 9999; flex-direction: column; padding: 4px 0;";
      }
      
      const hasSearch = !select.dataset.noSearch;
      let searchInputNode = null;

      if (hasSearch) {
          searchInputNode = document.createElement('input');
          searchInputNode.type = 'text';
          searchInputNode.className = 'custom-select-search';
          searchInputNode.placeholder = 'Search...';
          optionsContainer.appendChild(searchInputNode);
      }

      const optionsList = document.createElement('div');
      optionsList.className = 'custom-options-list';
      optionsContainer.appendChild(optionsList);

      wrapper.appendChild(optionsContainer);

      const textEl = trigger.querySelector('.custom-select-text');

      if (hasSearch) {
          searchInputNode.addEventListener('input', (e) => {
              const filter = e.target.value.toLowerCase();
              optionsList.querySelectorAll('.custom-option').forEach(optEl => {
                  optEl.style.display = optEl.innerText.toLowerCase().includes(filter) ? '' : 'none';
              });
          });
      }

      optionsContainer.addEventListener('click', (e) => e.stopPropagation());

      function syncUI() {
          if (select.hasAttribute('multiple')) {
              wrapper.classList.add('is-multiple');
              return;
          } else {
              wrapper.classList.remove('is-multiple');
          }

          if (select.disabled) wrapper.classList.add('disabled');
          else wrapper.classList.remove('disabled');

          optionsList.innerHTML = '';
          const selectedVal = select.value;
          let displayHtml = '';

          Array.from(select.options).forEach(opt => {
              const optEl = document.createElement('div');
              optEl.className = 'custom-option';
              
              if (select.id === 'sort-select') {
                  optEl.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer;";
              }
              
              if (opt.value === selectedVal) {
                  optEl.classList.add('selected');
                  displayHtml = opt.innerHTML;
              }
              optEl.innerHTML = opt.innerHTML;
              optEl.dataset.value = opt.value;
              
              optEl.addEventListener('click', (e) => {
                  e.stopPropagation();
                  if (select.disabled) return;
                  select.value = opt.value;
                  select.dispatchEvent(new Event('change'));
                  wrapper.classList.remove('open');
                  syncUI();
              });
              optionsList.appendChild(optEl);
          });

          if (select.id === 'sort-select') {
              const activeOpt = Array.from(select.options).find(o => o.value === selectedVal);
              if (activeOpt) {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = activeOpt.innerHTML;
                  const iconEl = tempDiv.querySelector('i');
                  trigger.innerHTML = iconEl ? iconEl.outerHTML : '';
                  trigger.title = activeOpt.getAttribute('title') || 'Sort';
                  trigger.className = 'custom-select-trigger btn btn-outline icon-only-btn';
                  trigger.style.cssText = "width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;";
              }
          } else {
              if (!displayHtml && select.options.length > 0) displayHtml = select.options[0].innerHTML;
              if (textEl) textEl.innerHTML = displayHtml || '&nbsp;';
          }
      }

      select.addEventListener('sync-custom-select', syncUI);
      select.addEventListener('change', syncUI);

      const obs = new MutationObserver(syncUI);
      obs.observe(select, { childList: true });

      trigger.addEventListener('click', (e) => {
          if (select.disabled || select.hasAttribute('multiple')) return;
          e.stopPropagation();
          const isOpen = wrapper.classList.contains('open');
          document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
              if (w !== wrapper) w.classList.remove('open');
          });
          if (!isOpen) {
              wrapper.classList.add('open');
              if (hasSearch && searchInputNode) {
                  searchInputNode.value = '';
                  optionsList.querySelectorAll('.custom-option').forEach(opt => opt.style.display = '');
                  setTimeout(() => searchInputNode.focus(), 10);
              }
          } else {
              wrapper.classList.remove('open');
          }
      });

      syncUI();
  }

  document.querySelectorAll('select').forEach(applyCustomSelect);

  const globalObs = new MutationObserver(mutations => {
      mutations.forEach(m => {
          m.addedNodes.forEach(node => {
              if (node.tagName === 'SELECT') applyCustomSelect(node);
              else if (node.querySelectorAll) {
                  node.querySelectorAll('select').forEach(applyCustomSelect);
              }
          });
      });
  });
  
  const targetContainers = [
    document.getElementById('sidebar'),
    document.getElementById('input-panel'),
    document.getElementById('shared-filter-bar'),
    document.getElementById('details-modal'),
    document.getElementById('duplicate-merge-modal'),
    document.getElementById('manage-props-modal')
  ];

  targetContainers.forEach(container => {
    if (container) {
      globalObs.observe(container, { childList: true, subtree: true });
    }
  });

  document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
  });
}
