// Custom color plugin for Toast UI Editor
// Adds text color formatting capability and image buttons (URL, Google Drive)

import {
  openGoogleDriveImagePicker,
  driveFileIdToImageUrl,
  getGoogleClientId,
} from "@/lib/googleDrivePicker";
import { GDD_EMOJI_CATEGORIES, GDD_EMOJI_PRESETS } from "@/lib/emojiPresets";
import { extractYouTubeVideoId, buildYouTubeEditorPlaceholder } from "@/utils/youtubeEmbeds";

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

type ToastEditorLike = {
  getSelectedText?: () => string;
  isMarkdownMode?: () => boolean;
  getMarkdown?: () => string;
  setMarkdown?: (value: string, cursorToEnd?: boolean) => void;
  replaceSelection?: (value: string) => void;
  el?: Element | null;
  insertText?: (value: string) => void;
  getCurrentModeEditor?: () => { replaceSelection?: (value: string) => void };
  exec?: (command: string, payload?: unknown) => void;
};

// Function to apply color to selected text
function applyColorToSelection(editor: ToastEditorLike, color: string) {
  try {
    if (typeof editor.getSelectedText !== 'function') return;

    const selectedText = editor.getSelectedText();
    
    if (!selectedText) {
      alert('Selecione um texto primeiro para aplicar a cor!');
      return;
    }

    const editorType =
      typeof editor.isMarkdownMode === 'function' && editor.isMarkdownMode() ? 'markdown' : 'wysiwyg';
    const coloredText = `<span style="color: ${color}">${selectedText}</span>`;
    
    if (editorType === 'wysiwyg') {
      // In WYSIWYG mode, we need to work with the markdown directly
      // Get current markdown content
      const currentMarkdown = editor.getMarkdown?.() || '';
      
      // Find and replace the selected text in markdown
      // This preserves the HTML when switching modes
      const newMarkdown = currentMarkdown.replace(selectedText, coloredText);
      
      // Update the content
      editor.setMarkdown?.(newMarkdown, false); // false = don't move cursor to end
    } else {
      // In Markdown mode, just replace the selection
      editor.replaceSelection?.(coloredText);
    }
  } catch (error) {
    console.error('Error applying color:', error);
  }
}

// Function to add color button to toolbar
export function addColorButtonToToolbar(editor: ToastEditorLike) {
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

// Function to add image-by-URL button to toolbar (without local upload)
export function addImageUrlButtonToToolbar(editor: ToastEditorLike) {
  setTimeout(() => {
    const editorRoot =
      editor?.el?.closest?.('.toastui-editor-defaultUI') ||
      document.querySelector('.toastui-editor-defaultUI');

    const toolbarElement = editorRoot?.querySelector('.toastui-editor-toolbar') as HTMLElement | null;
    if (!toolbarElement) {
      console.warn('Toolbar not found for image URL button');
      return;
    }

    if (toolbarElement.querySelector('.image-url-wrapper')) {
      return;
    }

    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'image-url-wrapper';
    buttonWrapper.style.cssText = 'position: relative; display: inline-block;';

    const imageUrlButton = document.createElement('button');
    imageUrlButton.type = 'button';
    imageUrlButton.className = 'toastui-editor-toolbar-icons image-url';
    imageUrlButton.style.cssText = `
      position: relative;
      padding: 5px 8px;
      margin: 0 2px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    `;
    imageUrlButton.textContent = '🖼️';
    imageUrlButton.title = 'Inserir imagem por URL';

    imageUrlButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const imageUrl = window.prompt('Cole a URL da imagem:');
      if (!imageUrl) return;

      const trimmedUrl = imageUrl.trim();
      const isValidUrl = /^https?:\/\//i.test(trimmedUrl) || trimmedUrl.startsWith('/');
      if (!isValidUrl) {
        alert('URL inválida. Use um link http(s) ou caminho relativo.');
        return;
      }

      const altText = window.prompt('Texto alternativo (opcional):', 'imagem') || 'imagem';
      const markdownImage = `![${altText}](${trimmedUrl})`;
      const htmlImage = `<img src="${trimmedUrl}" alt="${altText}" />`;

      const isMarkdownMode =
        typeof editor?.isMarkdownMode === 'function' ? editor.isMarkdownMode() : false;

      // Em WYSIWYG, usa comando nativo para inserir imagem renderizada
      if (!isMarkdownMode && typeof editor?.exec === 'function') {
        try {
          editor.exec('addImage', {
            imageUrl: trimmedUrl,
            altText,
          });
          return;
        } catch (error) {
          console.warn('Falha ao inserir imagem via comando nativo, usando fallback markdown.', error);
        }

        const currentModeEditor = editor?.getCurrentModeEditor?.();
        if (typeof currentModeEditor?.replaceSelection === 'function') {
          currentModeEditor.replaceSelection(htmlImage);
          return;
        }

        const currentMarkdown = editor?.getMarkdown?.() || '';
        editor?.setMarkdown?.(`${currentMarkdown}\n${markdownImage}`);
        return;
      }

      if (typeof editor?.insertText === 'function') {
        editor.insertText(markdownImage);
        return;
      }

      const currentModeEditor = editor?.getCurrentModeEditor?.();
      if (typeof currentModeEditor?.replaceSelection === 'function') {
        currentModeEditor.replaceSelection(markdownImage);
        return;
      }

      const currentMarkdown = editor?.getMarkdown?.() || '';
      editor?.setMarkdown?.(`${currentMarkdown}\n${markdownImage}`);
    });

    buttonWrapper.appendChild(imageUrlButton);

    const firstGroup = toolbarElement.querySelector('.toastui-editor-toolbar-group');
    if (firstGroup) {
      firstGroup.appendChild(buttonWrapper);
    }
  }, 120);
}

/** Adiciona botão para inserir video do YouTube por URL no editor. */
export function addYouTubeButtonToToolbar(editor: ToastEditorLike) {
  setTimeout(() => {
    const editorRoot =
      editor?.el?.closest?.(".toastui-editor-defaultUI") ||
      document.querySelector(".toastui-editor-defaultUI");

    const toolbarElement = editorRoot?.querySelector(".toastui-editor-toolbar") as HTMLElement | null;
    if (!toolbarElement) return;
    if (toolbarElement.querySelector(".youtube-button-wrapper")) return;

    const buttonWrapper = document.createElement("div");
    buttonWrapper.className = "youtube-button-wrapper";
    buttonWrapper.style.cssText = "position: relative; display: inline-block;";

    const ytButton = document.createElement("button");
    ytButton.type = "button";
    ytButton.className = "toastui-editor-toolbar-icons youtube";
    ytButton.style.cssText = `
      position: relative;
      padding: 5px 8px;
      margin: 0 2px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    `;
    ytButton.textContent = "▶️";
    ytButton.title = "Inserir video do YouTube";

    ytButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const rawUrl = window.prompt("Cole a URL do video do YouTube:");
      if (!rawUrl) return;

      const videoId = extractYouTubeVideoId(rawUrl);
      if (!videoId) {
        window.alert("URL invalida. Use um link do YouTube (youtube.com ou youtu.be).");
        return;
      }

      const placeholder = buildYouTubeEditorPlaceholder(videoId);
      const insertion = `\n${placeholder}\n`;

      if (typeof editor?.insertText === "function") {
        editor.insertText(insertion);
        return;
      }

      const modeEditor = editor?.getCurrentModeEditor?.();
      if (typeof modeEditor?.replaceSelection === "function") {
        modeEditor.replaceSelection(insertion);
        return;
      }

      const currentMarkdown = editor?.getMarkdown?.() || "";
      const separator = currentMarkdown.endsWith("\n") || currentMarkdown.length === 0 ? "" : "\n";
      editor?.setMarkdown?.(`${currentMarkdown}${separator}${placeholder}\n`);
    });

    buttonWrapper.appendChild(ytButton);

    const firstGroup = toolbarElement.querySelector(".toastui-editor-toolbar-group");
    if (firstGroup) {
      firstGroup.appendChild(buttonWrapper);
    }
  }, 140);
}

export type DriveImageButtonOptions = {
  notConfiguredMessage: string;
  getMarkdownToInsert: (fileId: string, fileName: string) => string;
  /** Mensagem quando a inserção automática falhar e o link foi copiado (cole com Ctrl+V). */
  pasteHintMessage?: string;
  /** Retorna o editor atual (ex.: ref.current). Use após operações async (Picker) para evitar referência destruída. */
  getCurrentEditor?: () => ToastEditorLike | null;
};

/** Adiciona botão "Inserir do Google Drive" na toolbar do Toast UI Editor. */
export function addDriveImageButtonToToolbar(
  editor: ToastEditorLike,
  options: DriveImageButtonOptions
) {
  const { notConfiguredMessage, getMarkdownToInsert, pasteHintMessage, getCurrentEditor } = options;

  setTimeout(() => {
    const editorRoot =
      editor?.el?.closest?.(".toastui-editor-defaultUI") ||
      document.querySelector(".toastui-editor-defaultUI");

    const toolbarElement = editorRoot?.querySelector(
      ".toastui-editor-toolbar"
    ) as HTMLElement | null;
    if (!toolbarElement) return;

    if (toolbarElement.querySelector(".drive-image-wrapper")) return;

    const buttonWrapper = document.createElement("div");
    buttonWrapper.className = "drive-image-wrapper";
    buttonWrapper.style.cssText = "position: relative; display: inline-block;";

    const driveButton = document.createElement("button");
    driveButton.type = "button";
    driveButton.className = "toastui-editor-toolbar-icons drive-image";
    driveButton.style.cssText = `
      position: relative;
      padding: 5px 8px;
      margin: 0 2px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    `;
    driveButton.innerHTML = "☁️";
    driveButton.title = "Inserir imagem do Google Drive";

    driveButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const clientId = await getGoogleClientId();
      if (!clientId) {
        window.alert(notConfiguredMessage);
        return;
      }

      const file = await openGoogleDriveImagePicker(clientId);
      if (process.env.NODE_ENV === "development") {
        console.log("[Drive image] file from Picker", file);
      }
      if (!file) return;

      const markdownImage = getMarkdownToInsert(file.id, file.name);
      const win = typeof window !== "undefined" && window.top ? window.top : window;
      const doc = win.document;

      // 1) Copiar para a área de transferência (janela principal)
      try {
        if (win.navigator?.clipboard?.writeText) {
          await win.navigator.clipboard.writeText(markdownImage);
        }
      } catch {
        // ignora
      }

      // 2) Disparar evento no document da janela principal (Picker pode rodar em iframe)
      const fire = () => {
        doc.dispatchEvent(new CustomEvent("gdd-insert-drive-image", { detail: { markdownImage } }));
      };
      if (typeof win.requestAnimationFrame === "function") {
        win.requestAnimationFrame(() => win.requestAnimationFrame(fire));
      } else {
        win.setTimeout(fire, 0);
      }

      // 3) Fallback: avisar para colar se a inserção automática não ocorrer
      const hint = pasteHintMessage || "Link da imagem copiado. Cole no editor com Ctrl+V (ou Cmd+V no Mac).";
      win.setTimeout(() => {
        const inserted = (doc as unknown as { __gddDriveImageInserted?: boolean }).__gddDriveImageInserted;
        if (!inserted) win.alert(hint);
        delete (doc as unknown as { __gddDriveImageInserted?: boolean }).__gddDriveImageInserted;
      }, 400);
    });

    buttonWrapper.appendChild(driveButton);

    const firstGroup = toolbarElement.querySelector(".toastui-editor-toolbar-group");
    if (firstGroup) {
      firstGroup.appendChild(buttonWrapper);
    }
  }, 140);
}

export interface ReferenceButtonOptions {
  sections: Array<{ id: string; title?: string; name?: string }>;
  buttonTitle?: string;
  searchPlaceholder?: string;
}

/** Adiciona botão "Inserir referência" na toolbar: abre lista de seções com busca para inserir $[Nome]. */
export function addReferenceButtonToToolbar(
  editor: ToastEditorLike,
  options: ReferenceButtonOptions
) {
  const { sections, buttonTitle = "Inserir referência", searchPlaceholder = "Buscar seção…" } = options;

  setTimeout(() => {
    const editorRoot =
      editor?.el?.closest?.(".toastui-editor-defaultUI") ||
      document.querySelector(".toastui-editor-defaultUI");
    const toolbarElement = editorRoot?.querySelector(".toastui-editor-toolbar") as HTMLElement | null;
    if (!toolbarElement) return;
    if (toolbarElement.querySelector(".reference-button-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "reference-button-wrapper";
    wrapper.style.cssText = "position: relative; display: inline-block;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toastui-editor-toolbar-icons reference";
    btn.style.cssText = "padding: 5px 8px; margin: 0 2px; border: none; background: transparent; cursor: pointer; font-size: 16px;";
    btn.innerHTML = "🔗";
    btn.title = buttonTitle;

    function renderList(container: HTMLElement, list: Array<{ id: string; title?: string; name?: string }>) {
      container.innerHTML = "";
      if (list.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "12px";
        empty.style.color = "#94a3b8";
        empty.textContent = "Nenhuma seção encontrada.";
        container.appendChild(empty);
        return;
      }
      list.forEach((sec) => {
        const title = (sec.title || sec.name || "").trim() || "(sem título)";
        const row = document.createElement("div");
        row.style.cssText = "padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #334155;";
        row.textContent = title;
        row.addEventListener("mouseenter", () => { row.style.background = "#334155"; });
        row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
        row.addEventListener("click", () => {
          const text = `$[${title}]`;
          const modeEditor = editor?.getCurrentModeEditor?.();
          if (typeof modeEditor?.replaceSelection === "function") {
            modeEditor.replaceSelection(text);
          }
          const d = document.getElementById("gdd-reference-dropdown");
          d?.remove();
        });
        container.appendChild(row);
      });
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      let dropdown = document.getElementById("gdd-reference-dropdown");
      if (dropdown) {
        dropdown.remove();
        return;
      }
      const rect = btn.getBoundingClientRect();
      dropdown = document.createElement("div");
      dropdown.id = "gdd-reference-dropdown";
      dropdown.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 6}px;
        left: ${rect.left}px;
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 10001;
        min-width: 260px;
        max-width: 360px;
        color: #e2e8f0;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        max-height: 320px;
      `;

      const list = sections || [];
      const header = document.createElement("div");
      header.style.cssText = "padding: 8px; border-bottom: 1px solid #334155; flex-shrink: 0;";
      const search = document.createElement("input");
      search.type = "text";
      search.placeholder = searchPlaceholder;
      search.autocomplete = "off";
      search.style.cssText = `
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #475569;
        border-radius: 6px;
        background: #0f172a;
        color: #e2e8f0;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
      `;
      search.addEventListener("input", () => {
        const q = (search.value || "").trim().toLowerCase();
        const filtered = q
          ? list.filter((s) => ((s.title || s.name || "").trim() || "").toLowerCase().includes(q))
          : list;
        renderList(listContainer, filtered);
      });
      header.appendChild(search);
      dropdown.appendChild(header);

      const listContainer = document.createElement("div");
      listContainer.style.cssText = "overflow-y: auto; max-height: 260px;";
      dropdown.appendChild(listContainer);

      if (list.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "12px";
        empty.textContent = "Nenhuma seção no projeto.";
        listContainer.appendChild(empty);
      } else {
        renderList(listContainer, list);
      }

      document.body.appendChild(dropdown);
      search.focus();
      const onOutside = (ev: MouseEvent) => {
        const t = ev.target as Node;
        if (dropdown && !dropdown.contains(t) && !btn.contains(t)) {
          dropdown.remove();
          document.removeEventListener("click", onOutside);
        }
      };
      setTimeout(() => document.addEventListener("click", onOutside), 0);
    });

    wrapper.appendChild(btn);
    const firstGroup = toolbarElement.querySelector(".toastui-editor-toolbar-group");
    if (firstGroup) firstGroup.appendChild(wrapper);
  }, 140);
}

/** Adiciona botão de emojis na toolbar para inserção rápida. */
export function addEmojiButtonToToolbar(editor: ToastEditorLike) {
  setTimeout(() => {
    const editorRoot =
      editor?.el?.closest?.(".toastui-editor-defaultUI") ||
      document.querySelector(".toastui-editor-defaultUI");
    const toolbarElement = editorRoot?.querySelector(".toastui-editor-toolbar") as HTMLElement | null;
    if (!toolbarElement) return;
    if (toolbarElement.querySelector(".emoji-button-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "emoji-button-wrapper";
    wrapper.style.cssText = "position: relative; display: inline-block;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toastui-editor-toolbar-icons emoji";
    btn.style.cssText = "padding: 5px 8px; margin: 0 2px; border: none; background: transparent; cursor: pointer; font-size: 16px;";
    btn.innerHTML = "😊";
    btn.title = "Inserir emoji";

    const dropdown = document.createElement("div");
    dropdown.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      padding: 8px;
      z-index: 10001;
      width: 380px;
    `;

    const insertEmoji = (emoji: string) => {
      const modeEditor = editor?.getCurrentModeEditor?.();
      if (typeof modeEditor?.replaceSelection === "function") {
        modeEditor.replaceSelection(emoji);
        return;
      }
      if (typeof editor?.insertText === "function") {
        editor.insertText(emoji);
        return;
      }
      const currentMarkdown = editor?.getMarkdown?.() || "";
      editor?.setMarkdown?.(`${currentMarkdown}${emoji}`);
    };

    const categories = [{ id: "all", label: "Todos", emojis: GDD_EMOJI_PRESETS }, ...GDD_EMOJI_CATEGORIES];
    let activeCategoryId = "all";

    const tabs = document.createElement("div");
    tabs.style.cssText = "display:flex; flex-wrap:wrap; gap:4px; padding-bottom:6px; margin-bottom:6px;";

    const grid = document.createElement("div");
    grid.style.cssText = "display: grid; grid-template-columns: repeat(10, minmax(0,1fr)); gap: 4px;";

    const setActiveTabStyles = () => {
      Array.from(tabs.querySelectorAll("button")).forEach((node) => {
        const tab = node as HTMLButtonElement;
        if (tab.dataset.category === activeCategoryId) {
          tab.style.background = "#4f46e5";
          tab.style.color = "#ffffff";
        } else {
          tab.style.background = "#374151";
          tab.style.color = "#e5e7eb";
        }
      });
    };

    const renderEmojiGrid = () => {
      const activeCategory = categories.find((category) => category.id === activeCategoryId) || categories[0];
      grid.innerHTML = "";
      activeCategory.emojis.forEach((emoji) => {
        const emojiBtn = document.createElement("button");
        emojiBtn.type = "button";
        emojiBtn.textContent = emoji;
        emojiBtn.title = `Inserir ${emoji}`;
        emojiBtn.style.cssText =
          "height: 28px; width: 28px; border: none; border-radius: 6px; background: transparent; cursor: pointer; font-size: 18px; line-height: 1;";
        emojiBtn.addEventListener("mouseenter", () => {
          emojiBtn.style.background = "#374151";
        });
        emojiBtn.addEventListener("mouseleave", () => {
          emojiBtn.style.background = "transparent";
        });
        emojiBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          insertEmoji(emoji);
          dropdown.style.display = "none";
        });
        grid.appendChild(emojiBtn);
      });
      setActiveTabStyles();
    };

    categories.forEach((category) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.category = category.id;
      tab.textContent = category.label;
      tab.style.cssText =
        "padding: 4px 8px; border: none; border-radius: 6px; font-size: 11px; white-space: nowrap; cursor: pointer; transition: background 120ms;";
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activeCategoryId = category.id;
        renderEmojiGrid();
      });
      tabs.appendChild(tab);
    });

    renderEmojiGrid();
    dropdown.appendChild(tabs);
    dropdown.appendChild(grid);

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (event) => {
      const target = event.target as Node;
      if (!wrapper.contains(target)) {
        dropdown.style.display = "none";
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);

    const firstGroup = toolbarElement.querySelector(".toastui-editor-toolbar-group");
    if (firstGroup) firstGroup.appendChild(wrapper);
  }, 140);
}
