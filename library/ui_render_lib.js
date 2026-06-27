export function renderDynamicForm(containerId, schema) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 

    schema.properties.forEach(prop => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${prop}</label>
            <input type="text" id="dynamic-${prop.replace(/\s+/g, '-')}" placeholder="Enter ${prop}..." 
                   style="width: 100%; height: 36px; padding: 0 15px; border: 1px solid var(--muted); border-radius: 8px; background-color: var(--surface); color: var(--text);">
        `;
        container.appendChild(div);
    });
}
