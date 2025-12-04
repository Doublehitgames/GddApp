"use client";

import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  name?: string;
  title?: string;
  content?: string;
}

interface UseAutocompleteOptions {
  sections: Section[];
  textareaSelector?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function useMarkdownAutocomplete({ sections, textareaSelector = "textarea", containerRef }: UseAutocompleteOptions) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCursorPos = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const findTextarea = () => {
      // Se tem containerRef, procura dentro dele
      const root = containerRef?.current || document;
      
      let textarea: HTMLTextAreaElement | null = null;
      
      // Toast UI Editor - vários modos (procura direto nos específicos)
      const selectors = [
        ".toastui-editor-contents[contenteditable]",
        ".ProseMirror",
        ".toastui-editor-ww-container [contenteditable]",
        ".toastui-editor .CodeMirror textarea",
        ".toastui-editor-md-container textarea",
        ".w-md-editor-text-input", // MDEditor
        textareaSelector, // Genérico por último
      ];
      
      for (const selector of selectors) {
        const found = root.querySelector(selector);
        textarea = found as any;
        if (textarea) {
          // Ignora textarea de clipboard
          if (textarea.className?.includes("pseudo-clipboard")) {
            textarea = null;
            continue;
          }
          break;
        }
      }
      
      if (textarea && textarea !== textareaRef.current) {
        textareaRef.current = textarea;
        
        // Para quando encontrar
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        // Para contenteditable (Toast UI Editor WYSIWYG), usa eventos diferentes
        if (textarea.getAttribute?.("contenteditable") === "true") {
          textarea.addEventListener("input", handleInputContentEditable as any);
          textarea.addEventListener("keydown", handleKeyDown);
        } else {
          textarea.addEventListener("input", handleInput);
          textarea.addEventListener("keydown", handleKeyDown);
          textarea.addEventListener("click", handleClick);
        }
      }
    };

    // Procura textarea periodicamente (porque editores podem renderizar depois)
    intervalId = setInterval(findTextarea, 1000);
    findTextarea();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (textareaRef.current) {
        const isContentEditable = textareaRef.current.getAttribute?.("contenteditable") === "true";
        if (isContentEditable) {
          textareaRef.current.removeEventListener("input", handleInputContentEditable as any);
          textareaRef.current.removeEventListener("keydown", handleKeyDown);
        } else {
          textareaRef.current.removeEventListener("input", handleInput);
          textareaRef.current.removeEventListener("keydown", handleKeyDown);
          textareaRef.current.removeEventListener("click", handleClick);
        }
      }
    };
  }, [sections]);

  const handleClick = () => {
    setShowAutocomplete(false);
  };

  const handleKeyDown = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (!showAutocomplete) return;

    if (keyEvent.key === "ArrowDown") {
      keyEvent.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = (prev + 1) % filteredSections.length;
        // Scroll para o item selecionado (somente quando usar teclado)
        setTimeout(() => {
          if (selectedItemRef.current && dropdownRef.current) {
            selectedItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, 0);
        return newIndex;
      });
    } else if (keyEvent.key === "ArrowUp") {
      keyEvent.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = (prev - 1 + filteredSections.length) % filteredSections.length;
        // Scroll para o item selecionado (somente quando usar teclado)
        setTimeout(() => {
          if (selectedItemRef.current && dropdownRef.current) {
            selectedItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, 0);
        return newIndex;
      });
    } else if (keyEvent.key === "Enter" || keyEvent.key === "Tab") {
      if (filteredSections[selectedIndex]) {
        keyEvent.preventDefault();
        insertSection(filteredSections[selectedIndex]);
      }
    } else if (keyEvent.key === "Escape") {
      setShowAutocomplete(false);
    }
  };

  const handleInputContentEditable = () => {
    if (!textareaRef.current) return;
    const element = textareaRef.current as any;
    
    // Para contenteditable, pega o texto completo
    const content = element.innerText || element.textContent || "";
    
    // Tenta obter posição do cursor
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const cursorPos = preCaretRange.toString().length;
    
    lastCursorPos.current = cursorPos;

    // Procura por $[ antes do cursor
    const textBeforeCursor = content.substring(0, cursorPos);
    const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

    if (match) {
      const query = match[1];

      // Filtra seções que correspondem à busca (usa 'title' ou 'name')
      const filtered = sections.filter((s) => {
        const sectionName = s?.title || s?.name || "";
        return sectionName && sectionName.toLowerCase().includes(query.toLowerCase());
      });

      setFilteredSections(filtered);
      setSelectedIndex(0);

      if (filtered.length > 0) {
        // Posição fixa para contenteditable (mais simples)
        const rect = range.getBoundingClientRect();
        setAutocompletePosition({
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX,
        });
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleInput = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const content = textarea.value;
    const cursorPos = textarea.selectionStart;
    lastCursorPos.current = cursorPos;

    // Procura por $[ antes do cursor
    const textBeforeCursor = content.substring(0, cursorPos);
    const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

    if (match) {
      const query = match[1];

      // Filtra seções que correspondem à busca (usa 'title' ou 'name')
      const filtered = sections.filter((s) => {
        const sectionName = s?.title || s?.name || "";
        return sectionName && sectionName.toLowerCase().includes(query.toLowerCase());
      });

      setFilteredSections(filtered);
      setSelectedIndex(0);

      if (filtered.length > 0) {
        // Calcula posição do dropdown
        const coords = getCaretCoordinates(textarea, cursorPos);
        setAutocompletePosition({
          top: coords.top + coords.height + 5,
          left: coords.left,
        });
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const insertSection = (section: Section) => {
    if (!textareaRef.current) return;

    const element = textareaRef.current as any;
    const isContentEditable = element.getAttribute?.("contenteditable") === "true";

    if (isContentEditable) {
      // Para Toast UI Editor (contenteditable)
      const content = element.innerText || element.textContent || "";
      const cursorPos = lastCursorPos.current;
      const textBeforeCursor = content.substring(0, cursorPos);
      const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

      if (match) {
        const startPos = cursorPos - match[0].length;
        const sectionName = section.title || section.name || "";
        const textToInsert = `$[${sectionName}]`;
        
        // Abordagem mais simples: substitui no conteúdo completo
        const newContent = 
          content.substring(0, startPos) + 
          textToInsert + 
          content.substring(cursorPos);
        
        // Seta o conteúdo no elemento
        element.innerHTML = newContent;
        
        // Move cursor para depois do texto inserido
        const newCursorPos = startPos + textToInsert.length;
        const selection = window.getSelection();
        if (selection) {
          // Encontra o nó de texto
          const textNodes: Node[] = [];
          const getTextNodes = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              textNodes.push(node);
            } else {
              node.childNodes.forEach(getTextNodes);
            }
          };
          getTextNodes(element);
          
          // Calcula posição no texto
          let charCount = 0;
          for (const textNode of textNodes) {
            const nodeLength = textNode.textContent?.length || 0;
            if (charCount + nodeLength >= newCursorPos) {
              const offset = newCursorPos - charCount;
              const range = document.createRange();
              range.setStart(textNode, Math.min(offset, nodeLength));
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              break;
            }
            charCount += nodeLength;
          }
        }
        
        // Dispara evento de input
        const event = new Event("input", { bubbles: true });
        element.dispatchEvent(event);
      }
    } else {
      // Para textarea normal (MDEditor)
      const textarea = element as HTMLTextAreaElement;
      const content = textarea.value;
      const cursorPos = lastCursorPos.current;

      // Remove o $[ e texto já digitado
      const textBeforeCursor = content.substring(0, cursorPos);
      const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

      if (match) {
        const startPos = cursorPos - match[0].length;
        const sectionName = section.title || section.name || "";
        const newContent =
          content.substring(0, startPos) +
          `$[${sectionName}]` +
          content.substring(cursorPos);

        textarea.value = newContent;
        
        // Dispara evento para MDEditor detectar mudança
        const event = new Event("input", { bubbles: true });
        textarea.dispatchEvent(event);

        // Move cursor para depois da referência inserida
        const newCursorPos = startPos + `$[${sectionName}]`.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }
    }

    setShowAutocomplete(false);
  };

  // Função auxiliar para obter coordenadas do cursor
  const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement("div");
    const style = window.getComputedStyle(element);
    
    // Copia estilos do textarea
    [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "padding",
      "border",
      "boxSizing",
    ].forEach((prop) => {
      (div.style as any)[prop] = (style as any)[prop];
    });

    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";
    div.style.width = `${element.clientWidth}px`;

    const text = element.value.substring(0, position);
    div.textContent = text;

    const span = document.createElement("span");
    span.textContent = element.value.substring(position) || ".";
    div.appendChild(span);

    document.body.appendChild(div);

    const rect = element.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();

    const top = rect.top + window.scrollY + (spanRect.top - div.getBoundingClientRect().top);
    const left = rect.left + window.scrollX + (spanRect.left - div.getBoundingClientRect().left);

    document.body.removeChild(div);

    return {
      top,
      left,
      height: parseInt(style.lineHeight) || parseInt(style.fontSize),
    };
  };

  const AutocompleteDropdown = () => {
    if (!showAutocomplete || filteredSections.length === 0) return null;

    return (
      <>
        <style>{`
          .autocomplete-item:hover {
            background-color: #2d2d2d !important;
          }
        `}</style>
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.preventDefault()} // Previne perda de foco
          onWheel={(e) => e.stopPropagation()} // Permite scroll no dropdown
          style={{
            position: "fixed",
            top: `${autocompletePosition.top}px`,
            left: `${autocompletePosition.left}px`,
            backgroundColor: "#1e1e1e",
            border: "1px solid #444",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 10000,
            minWidth: "250px",
            color: "#ccc",
          }}
        >
        {filteredSections.map((section, index) => (
          <div
            key={section.id}
            onClick={() => insertSection(section)}
            className="autocomplete-item"
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              backgroundColor: "#1e1e1e",
              borderBottom: index < filteredSections.length - 1 ? "1px solid #333" : "none",
            }}
          >
            <div style={{ fontWeight: 500, fontSize: "14px", color: "#fff" }}>
              {section.title || section.name}
            </div>
            {section.content && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: "4px",
                }}
              >
                {section.content.substring(0, 60)}
                {section.content.length > 60 ? "..." : ""}
              </div>
            )}
          </div>
        ))}
        </div>
      </>
    );
  };

  return { AutocompleteDropdown };
}
