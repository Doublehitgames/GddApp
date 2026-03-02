import { parseMarkdownToImportedProject } from '@/utils/markdownImportParser'

describe('markdownImportParser', () => {
  it('extracts project title, skips sumário section and keeps nested headings', () => {
    const markdown = [
      '# **Colheita Feliz 7Teen \\ - GDD**',
      '',
      'Inspiração: Colheita Feliz, Hago, HayDay.',
      '',
      '# **Sumário** {#sumário}',
      '[**Visão Geral\t6**](#visão-geral)',
      '[Descrição\t7](#descrição:)',
      '',
      '# **Visão Geral** {#visão-geral}',
      'Texto da visão geral.',
      '',
      '### **Descrição:** {#descrição:}',
      'Conteúdo detalhado da descrição.',
      '',
      '#### Detalhes extras',
      '- Item 1',
      '- Item 2',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'arquivo.md')

    expect(result.title).toBe('Colheita Feliz 7Teen - GDD')
    expect(result.description).toContain('Inspiração')
    expect(result.sections.map((s) => s.title)).toEqual(['Visão Geral'])

    const visaoGeral = result.sections[0]
    expect(visaoGeral.content).toContain('Texto da visão geral')
    expect(visaoGeral.subsections?.[0].title).toBe('Descrição:')
    expect(visaoGeral.subsections?.[0].content).toContain('Conteúdo detalhado da descrição')
    expect(visaoGeral.subsections?.[0].subsections?.[0].title).toBe('Detalhes extras')
  })

  it('falls back to file name when no H1 title exists', () => {
    const markdown = [
      '## Mecânicas',
      'Texto de mecânicas',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'Meu GDD Final.md')

    expect(result.title).toBe('Meu GDD Final')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].title).toBe('Mecânicas')
  })

  it('creates a default section when markdown has no headings', () => {
    const markdown = [
      'Linha 1 sem heading',
      '',
      'Linha 2 sem heading',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'Sem heading.md')

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].title).toBe('Conteúdo Importado')
    expect(result.sections[0].content).toContain('Linha 1 sem heading')
    expect(result.sections[0].content).toContain('Linha 2 sem heading')
  })

  it('converts internal anchor links into cross references', () => {
    const markdown = [
      '# Projeto Exemplo',
      '',
      '## Mecânicas',
      'Veja [Animais da fazenda](#construcao-de-animais-de-fazenda:).',
      '',
      '## CONSTRUCAO DE ANIMAIS DE FAZENDA: {#construcao-de-animais-de-fazenda:}',
      'Detalhes dos animais.',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'exemplo.md')
    const mecanicas = result.sections.find((section) => section.title === 'Mecânicas')

    expect(mecanicas).toBeDefined()
    expect(mecanicas?.content).toContain('$[CONSTRUCAO DE ANIMAIS DE FAZENDA:]')
    expect(mecanicas?.content).not.toContain('](#construcao-de-animais-de-fazenda:)')
  })

  it('converts unresolved internal anchors to missing cross-reference placeholders', () => {
    const markdown = [
      '# Projeto Exemplo',
      '',
      '## Economia',
      'Ver detalhes em [Mercado Negro](#secao-que-nao-existe).',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'exemplo.md')
    const economia = result.sections.find((section) => section.title === 'Economia')

    expect(economia).toBeDefined()
    expect(economia?.content).toContain('$[Mercado Negro]')
    expect(economia?.content).not.toContain('](#secao-que-nao-existe)')
  })

  it('keeps simple regular tables unchanged', () => {
    const markdown = [
      '# Projeto Exemplo',
      '',
      '## Status',
      '| Campo | Valor |',
      '| --- | --- |',
      '| Nome | Colheita Feliz |',
      '| Plataforma | Mobile |',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'exemplo.md')
    const status = result.sections.find((section) => section.title === 'Status')

    expect(status).toBeDefined()
    expect(status?.content).toContain('| Campo | Valor |')
    expect(status?.content).toContain('| Nome | Colheita Feliz |')
    expect(status?.content).not.toContain('Tabela complexa convertida automaticamente')
  })

  it('converts irregular complex tables into readable blocks', () => {
    const markdown = [
      '# Projeto Exemplo',
      '',
      '## Quadro',
      '| Coluna A | Coluna B |',
      '| --- | --- |',
      '| A1 | B1 |',
      '| A2 |',
      '| A3 | B3 | C3 |',
    ].join('\n')

    const result = parseMarkdownToImportedProject(markdown, 'exemplo.md')
    const quadro = result.sections.find((section) => section.title === 'Quadro')

    expect(quadro).toBeDefined()
    expect(quadro?.content).toContain('Tabela complexa convertida automaticamente')
    expect(quadro?.content).toContain('- Linha 1')
    expect(quadro?.content).toContain('Coluna')
  })
})
