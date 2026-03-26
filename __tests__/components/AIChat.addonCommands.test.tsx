import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import AIChat from "@/components/AIChat";
import { useProjectStore } from "@/store/projectStore";

jest.mock("@/hooks/useAIConfig", () => ({
  useAIConfig: () => ({
    hasValidConfig: true,
    getAIHeaders: () => ({}),
  }),
}));

describe("AIChat addon commands", () => {
  const projectId = "proj-ai";

  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      value: jest.fn(),
      writable: true,
    });
    useProjectStore.setState({
      projects: [
        {
          id: projectId,
          title: "Projeto IA",
          description: "Descricao",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          sections: [
            {
              id: "sec-1",
              title: "Economia",
              content: "Conteudo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [],
            },
            {
              id: "sec-moedas",
              title: "Moedas",
              content: "Moedas do jogo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [],
            },
          ],
        },
      ],
    });
  });

  it("creates currency addon after confirmation", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | currency | {\"name\":\"Moeda Base\",\"code\":\"GOLD\",\"displayName\":\"Ouro\"}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            projectDescription: "Descricao",
            sections: [
              {
                id: "sec-1",
                title: "Economia",
                content: "Conteudo",
              },
            ],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie addon de moeda" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirma executar/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      const project = useProjectStore.getState().getProject(projectId);
      const section = project?.sections.find((item) => item.id === "sec-1");
      expect(section?.addons?.length).toBe(1);
      expect(section?.addons?.[0]?.type).toBe("currency");
      expect(section?.addons?.[0]?.name).toBe("Moeda Base");
    });
  });

  it("shows critical warning when currency page is created at root without currency addon", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: "Plano pronto.\n\n[EXECUTAR]\nCRIAR: Diamante | Moeda premium do jogo",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            projectDescription: "Descricao",
            sections: [
              { id: "sec-1", title: "Economia", content: "Conteudo" },
              { id: "sec-moedas", title: "Moedas", content: "Conteudo" },
            ],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie a página da moeda Diamante" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Avisos de validação encontrados/i)).toBeInTheDocument();
      expect(screen.getByText(/foi planejada na raiz/i)).toBeInTheDocument();
      expect(screen.getByText(/não há ADDON_CRIAR currency no plano/i)).toBeInTheDocument();
    });
  });

  it("creates currency addon by using newly created section title token", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nSUBSECAO: Diamante | Moedas | Moeda premium usada para conversão.\nADDON_CRIAR: Diamante | currency | {\"name\":\"Diamante\",\"code\":\"GEM\",\"displayName\":\"Diamante\",\"kind\":\"premium\",\"decimals\":0}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            projectDescription: "Descricao",
            sections: [
              { id: "sec-1", title: "Economia", content: "Conteudo" },
              { id: "sec-moedas", title: "Moedas", content: "Conteudo" },
            ],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie moeda Diamante com addon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirma executar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      const project = useProjectStore.getState().getProject(projectId);
      const section = project?.sections.find((item) => item.title === "Diamante");
      expect(section).toBeDefined();
      expect(section?.parentId).toBe("sec-moedas");
      expect(section?.addons?.some((addon) => addon.type === "currency")).toBe(true);
    });
  });

  it("shows validation warning for invalid addon JSON", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: "Teste\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | currency | {invalido}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie addon inválido" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Avisos de validação encontrados/i)).toBeInTheDocument();
      expect(screen.getByText(/JSON inválido/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Infos/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nenhum aviso neste filtro/i)).toBeInTheDocument();
    });
  });

  it("shows addon opportunity warning for item page without inventory addon", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: "Plano\n\n[EXECUTAR]\nCRIAR: Espada de Ferro | Item de combate com dano base e raridade comum.",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie item espada" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/item\/entidade de inventário/i)).toBeInTheDocument();
    });
  });

  it("shows addon opportunity warnings for economy, production and progression gaps", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano\n\n[EXECUTAR]\nCRIAR: Loja de Poções | Pode comprar e vender poções com preços dinâmicos.\nCRIAR: Fazenda de Galinhas | Produção passiva de ovos a cada 60 segundos.\nCRIAR: Progressão do Herói | Curva de nível e XP até o nível 50.",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie economia e progressão" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/compra\/venda\/preço/i)).toBeInTheDocument();
      expect(screen.getByText(/produção\/receita\/passivo/i)).toBeInTheDocument();
      expect(screen.getByText(/progressão por nível\/XP/i)).toBeInTheDocument();
    });
  });

  it("shows pet-focused addon opportunity warning", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: "Plano\n\n[EXECUTAR]\nCRIAR: Animais de Estimação | Sistema de pets para o jogador colecionar.",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie sistema de pets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/parece pet\/animal/i)).toBeInTheDocument();
    });
  });

  it("creates inventory addon with sanitized payload values", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | inventory | {\"name\":\"Poção de Vida\",\"inventoryCategory\":\"consumivel\",\"maxStack\":-20,\"slotSize\":0,\"bindType\":\"bad_type\",\"weight\":-5}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie addon de inventário" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirma executar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      const project = useProjectStore.getState().getProject(projectId);
      const section = project?.sections.find((item) => item.id === "sec-1");
      expect(section?.addons?.some((addon) => addon.type === "inventory")).toBe(true);
      const inventoryAddon = section?.addons?.find((addon) => addon.type === "inventory");
      expect(inventoryAddon?.name).toBe("Poção de Vida");
      expect(inventoryAddon?.data.maxStack).toBe(1);
      expect(inventoryAddon?.data.slotSize).toBe(1);
      expect(inventoryAddon?.data.bindType).toBe("none");
      expect(inventoryAddon?.data.weight).toBe(0);
    });
  });

  it("removes invalid economyLink references during execution", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | economyLink | {\"name\":\"Preco Trigo\",\"hasBuyConfig\":true,\"buyCurrencyRef\":\"sec-currency-inexistente\",\"buyModifiers\":[{\"refId\":\"sec-gvar-inexistente\"}],\"hasUnlockConfig\":true,\"unlockRef\":\"sec-xp-inexistente\",\"unlockValue\":99}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie economy link" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirma executar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      const project = useProjectStore.getState().getProject(projectId);
      const section = project?.sections.find((item) => item.id === "sec-1");
      const addon = section?.addons?.find((item) => item.type === "economyLink");
      expect(addon).toBeDefined();
      expect(addon?.data.buyCurrencyRef).toBeUndefined();
      expect(addon?.data.buyModifiers).toEqual([]);
      expect(addon?.data.unlockRef).toBeUndefined();
      expect(addon?.data.unlockValue).toBeUndefined();
    });
  });

  it("shows strong consistency warning with auto-fix suggestion for economyLink in preview", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | economyLink | {\"name\":\"Loja\",\"hasBuyConfig\":true,\"buyValue\":10,\"buyCurrencyRef\":\"invalido\"}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie economy link de compra" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Avisos de validação encontrados/i)).toBeInTheDocument();
      expect(screen.getByText(/compra ativa com valor > 0 sem moeda válida/i)).toBeInTheDocument();
      expect(screen.getByText(/Sugestão: informe buyCurrencyRef válido/i)).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole("button", { name: /Confirmar/i });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Entendi os avisos críticos/i));
    expect(confirmButton).toBeEnabled();

    const severityLines = screen
      .getAllByText(/\[(CRITICAL|WARNING|INFO)\]/i)
      .map((node) => node.textContent || "");
    expect(severityLines.length).toBeGreaterThan(1);
    expect(severityLines[0]).toContain("[CRITICAL]");
  });

  it("removes invalid production item and progression references during execution", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message:
            "Plano pronto.\n\n[EXECUTAR]\nADDON_CRIAR: sec-1 | production | {\"name\":\"Forja\",\"mode\":\"recipe\",\"outputRef\":\"sec-item-inexistente\",\"ingredients\":[{\"itemRef\":\"sec-item-inexistente\",\"quantity\":2}],\"outputs\":[{\"itemRef\":\"sec-item-inexistente\",\"quantity\":1}],\"minOutputProgressionLink\":{\"progressionAddonId\":\"prog-x\",\"columnId\":\"atk\",\"columnName\":\"ATK\"},\"craftTimeSecondsProgressionLink\":{\"progressionAddonId\":\"prog-x\",\"columnId\":\"atk\",\"columnName\":\"ATK\"}}",
        }),
      });

    render(
      <I18nProvider initialLocale="pt-BR">
        <AIChat
          isOpen
          projectContext={{
            projectId,
            projectTitle: "Projeto IA",
            sections: [{ id: "sec-1", title: "Economia" }],
          }}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/Digite sua mensagem/i), {
      target: { value: "Crie production com refs inválidas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirma executar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      const project = useProjectStore.getState().getProject(projectId);
      const section = project?.sections.find((item) => item.id === "sec-1");
      const addon = section?.addons?.find((item) => item.type === "production");
      expect(addon).toBeDefined();
      expect(addon?.data.outputRef).toBeUndefined();
      expect(addon?.data.ingredients).toEqual([]);
      expect(addon?.data.outputs).toEqual([]);
      expect(addon?.data.minOutputProgressionLink).toBeUndefined();
      expect(addon?.data.craftTimeSecondsProgressionLink).toBeUndefined();
    });
  });
});
