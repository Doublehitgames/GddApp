// Custom color plugin for Toast UI Editor
// Adds text color formatting capability

// Predefined color palette
export const COLOR_PALETTE = [
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Roxo', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Cinza', value: '#6b7280' },
  { name: 'Preto', value: '#000000' },
  { name: 'Branco', value: '#ffffff' },
];

// Function to apply color to selected text
function applyColorToSelection(editor: any, color: string) {
  try {
    const selectedText = editor.getSelectedText();
    
    if (!selectedText) {
      alert('Selecione um texto primeiro para aplicar a cor!');
      return;
    }

    const editorType = editor.isMarkdownMode() ? 'markdown' : 'wysiwyg';
    const coloredText = `<span style="color: ${color}">${selectedText}</span>`;
    
    if (editorType === 'wysiwyg') {
      // In WYSIWYG mode, we need to work with the markdown directly
      // Get current markdown content
      const currentMarkdown = editor.getMarkdown();
      
      // Find and replace the selected text in markdown
      // This preserves the HTML when switching modes
      const newMarkdown = currentMarkdown.replace(selectedText, coloredText);
      
      // Update the content
      editor.setMarkdown(newMarkdown, false); // false = don't move cursor to end
    } else {
      // In Markdown mode, just replace the selection
      editor.replaceSelection(coloredText);
    }
  } catch (error) {
    console.error('Error applying color:', error);
  }
}

// Function to add color button to toolbar
export function addColorButtonToToolbar(editor: any) {
  // Wait for DOM to be ready
  setTimeout(() => {
    const toolbarElement = document.querySelector('.toastui-editor-toolbar');
    if (!toolbarElement) {
      console.warn('Toolbar not found');
      return;
    }

    // Create color picker button
    const colorButton = document.createElement('button');
    colorButton.type = 'button';
    colorButton.className = 'toastui-editor-toolbar-icons color';
    colorButton.style.cssText = `
      position: relative;
      padding: 5px 8px;
      margin: 0 2px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    `;
    colorButton.innerHTML = '🎨';
    colorButton.title = 'Cor do texto';

    // Create color palette dropdown
    const colorDropdown = document.createElement('div');
    colorDropdown.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 8px;
      z-index: 1000;
      min-width: 160px;
    `;

    // Add color palette
    const paletteGrid = document.createElement('div');
    paletteGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      margin-bottom: 8px;
    `;

    COLOR_PALETTE.forEach(color => {
      const colorSwatch = document.createElement('button');
      colorSwatch.type = 'button';
      colorSwatch.style.cssText = `
        width: 28px;
        height: 28px;
        border: 2px solid #ddd;
        border-radius: 4px;
        background-color: ${color.value};
        cursor: pointer;
        transition: transform 0.1s;
      `;
      colorSwatch.title = color.name;
      
      colorSwatch.addEventListener('mouseenter', () => {
        colorSwatch.style.transform = 'scale(1.1)';
        colorSwatch.style.borderColor = '#666';
      });
      
      colorSwatch.addEventListener('mouseleave', () => {
        colorSwatch.style.transform = 'scale(1)';
        colorSwatch.style.borderColor = '#ddd';
      });
      
      colorSwatch.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyColorToSelection(editor, color.value);
        colorDropdown.style.display = 'none';
      });
      
      paletteGrid.appendChild(colorSwatch);
    });

    colorDropdown.appendChild(paletteGrid);

    // Add custom color input
    const customColorSection = document.createElement('div');
    customColorSection.style.cssText = `
      padding-top: 8px;
      border-top: 1px solid #ddd;
    `;

    const customColorLabel = document.createElement('label');
    customColorLabel.style.cssText = `
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
    `;
    customColorLabel.textContent = 'Cor personalizada:';

    const customColorInput = document.createElement('input');
    customColorInput.type = 'color';
    customColorInput.style.cssText = `
      width: 100%;
      height: 32px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    `;

    customColorInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      applyColorToSelection(editor, target.value);
      colorDropdown.style.display = 'none';
    });

    customColorSection.appendChild(customColorLabel);
    customColorSection.appendChild(customColorInput);
    colorDropdown.appendChild(customColorSection);

    // Toggle dropdown
    colorButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = colorDropdown.style.display === 'block';
      colorDropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!colorButton.contains(e.target as Node) && !colorDropdown.contains(e.target as Node)) {
        colorDropdown.style.display = 'none';
      }
    });

    // Append elements
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.cssText = 'position: relative; display: inline-block;';
    buttonWrapper.appendChild(colorButton);
    buttonWrapper.appendChild(colorDropdown);

    // Insert into toolbar (after first group)
    const firstGroup = toolbarElement.querySelector('.toastui-editor-toolbar-group');
    if (firstGroup) {
      firstGroup.appendChild(buttonWrapper);
    }
  }, 100);
}
