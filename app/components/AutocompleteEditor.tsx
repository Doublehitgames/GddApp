"use client";

import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  name: string;
  content?: string;
  parentId?: string;
  order: number;
}

interface AutocompleteEditorProps {
  initialValue: string;
  editorMode: "markdown" | "wysiwyg";
  sections: Section[];
  onSave: (content: string) => void;
  height?: string;
}

export default function AutocompleteEditor({
  initialValue,
  editorMode,
  sections,
  onSave,
  height = "400px",
}: AutocompleteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: any;
    let cancelled = false;

    async function initEditor() {
      if (!containerRef.current) return;

      // @ts-ignore - Toast UI Editor tem problema com declarações de tipo
      const mod: any = await import("@toast-ui/editor");
      if (cancelled) return;

      const ToastEditor = mod.default || mod;
      instance = new ToastEditor({
        el: containerRef.current,
        initialEditType: editorMode,
        previewStyle: "vertical",
        height,
        initialValue,
        usageStatistics: false,
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task"],
          ["table", "link"],
          ["code", "codeblock"],
        ],
      });

      editorRef.current = instance;

      // Detecta quando usuário digita
      const editorEl = containerRef.current.querySelector(".toastui-editor-defaultUI");
      if (editorEl) {
        editorEl.addEventListener("keyup", handleKeyUp);
        editorEl.addEventListener("keydown", handleKeyDown);
      }
    }

    initEditor();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        const editorEl = containerRef.current?.querySelector(".toastui-editor-defaultUI");
        if (editorEl) {
          editorEl.removeEventListener("keyup", handleKeyUp);
          editorEl.removeEventListener("keydown", handleKeyDown);
        }
        editorRef.current.destroy();
      }
    };
  }, [initialValue, editorMode, height]);

  const handleKeyDown = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (!showAutocomplete) return;

    if (keyEvent.key === "ArrowDown") {
      keyEvent.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredSections.length);
    } else if (keyEvent.key === "ArrowUp") {
      keyEvent.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredSections.length) % filteredSections.length);
    } else if (keyEvent.key === "Enter" || keyEvent.key === "Tab") {
      keyEvent.preventDefault();
      insertSection(filteredSections[selectedIndex]);
    } else if (keyEvent.key === "Escape") {
      setShowAutocomplete(false);
    }
  };

  const handleKeyUp = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (!editorRef.current) return;

    // Ignora teclas de navegação
    if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(keyEvent.key)) return;

    const content = editorRef.current.getMarkdown();
    const cursorPos = getCursorPosition();

    // Procura por $[ antes do cursor
    const textBeforeCursor = content.substring(0, cursorPos);
    const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

    if (match) {
      const query = match[1];
      setSearchQuery(query);

      // Filtra seções que correspondem à busca
      const filtered = sections.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
      );

      setFilteredSections(filtered);
      setSelectedIndex(0);

      if (filtered.length > 0) {
        // Posiciona o dropdown próximo ao cursor
        const position = getCursorScreenPosition();
        if (position) {
          setAutocompletePosition(position);
          setShowAutocomplete(true);
        }
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const getCursorPosition = (): number => {
    try {
      // Tenta obter posição do cursor no Toast UI Editor
      const mdEditor = editorRef.current.getEditorElements?.()?.mdEditor;
      if (mdEditor) {
        const cm = mdEditor.querySelector(".CodeMirror");
        if (cm && (cm as any).CodeMirror) {
          const cursor = (cm as any).CodeMirror.getCursor();
          const content = editorRef.current.getMarkdown();
          const lines = content.split("\n");
          let pos = 0;
          for (let i = 0; i < cursor.line; i++) {
            pos += lines[i].length + 1; // +1 para o \n
          }
          pos += cursor.ch;
          return pos;
        }
      }
    } catch (err) {
      console.error("Erro ao obter posição do cursor:", err);
    }
    return 0;
  };

  const getCursorScreenPosition = (): { top: number; left: number } | null => {
    try {
      const mdEditor = editorRef.current.getEditorElements?.()?.mdEditor;
      if (mdEditor) {
        const cm = mdEditor.querySelector(".CodeMirror");
        if (cm && (cm as any).CodeMirror) {
          const coords = (cm as any).CodeMirror.cursorCoords(true, "page");
          return {
            top: coords.bottom + 5,
            left: coords.left,
          };
        }
      }
    } catch (err) {
      console.error("Erro ao obter posição na tela:", err);
    }
    return null;
  };

  const insertSection = (section: Section) => {
    if (!editorRef.current) return;

    const content = editorRef.current.getMarkdown();
    const cursorPos = getCursorPosition();

    // Remove o $[ e texto já digitado
    const textBeforeCursor = content.substring(0, cursorPos);
    const match = textBeforeCursor.match(/\$\[([^\]]*?)$/);

    if (match) {
      const startPos = cursorPos - match[0].length;
      const newContent =
        content.substring(0, startPos) +
        `$[${section.name}]` +
        content.substring(cursorPos);

      editorRef.current.setMarkdown(newContent);

      // Move cursor para depois da referência inserida
      setTimeout(() => {
        try {
          const mdEditor = editorRef.current.getEditorElements?.()?.mdEditor;
          if (mdEditor) {
            const cm = mdEditor.querySelector(".CodeMirror");
            if (cm && (cm as any).CodeMirror) {
              const newCursorPos = startPos + `$[${section.name}]`.length;
              const lines = newContent.substring(0, newCursorPos).split("\n");
              const line = lines.length - 1;
              const ch = lines[lines.length - 1].length;
              (cm as any).CodeMirror.setCursor({ line, ch });
              (cm as any).CodeMirror.focus();
            }
          }
        } catch (err) {
          console.error("Erro ao mover cursor:", err);
        }
      }, 0);
    }

    setShowAutocomplete(false);
  };

  const getEditorContent = (): string => {
    return editorRef.current?.getMarkdown() || "";
  };

  // Expõe método de salvar para componente pai
  useEffect(() => {
    (containerRef.current as any)?.setAttribute("data-get-content", "true");
    if (containerRef.current) {
      (containerRef.current as any).getContent = getEditorContent;
    }
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} />
      {showAutocomplete && filteredSections.length > 0 && (
        <div
          ref={autocompleteRef}
          style={{
            position: "fixed",
            top: `${autocompletePosition.top}px`,
            left: `${autocompletePosition.left}px`,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 10000,
            minWidth: "200px",
          }}
        >
          {filteredSections.map((section, index) => (
            <div
              key={section.id}
              onClick={() => insertSection(section)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: index === selectedIndex ? "#e6f2ff" : "white",
                borderBottom: index < filteredSections.length - 1 ? "1px solid #eee" : "none",
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{ fontWeight: 500, fontSize: "14px" }}>{section.name}</div>
              {section.content && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section.content.substring(0, 50)}
                  {section.content.length > 50 ? "..." : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
