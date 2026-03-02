import { parseDocxHtmlToImportedProject } from '@/utils/docxImportParser'

describe('docxImportParser', () => {
  it('builds sections from heading tags and preserves HTML table markup', () => {
    const html = [
      '<h1>Colheita Feliz 7Teen - GDD</h1>',
      '<p>Descrição inicial do projeto.</p>',
      '<h2>Mecânicas</h2>',
      '<p>Conteúdo da seção.</p>',
      '<table>',
      '  <tr><th colspan="2">Recursos</th></tr>',
      '  <tr><td rowspan="2">Animal</td><td>Galinha</td></tr>',
      '  <tr><td>Vaca</td></tr>',
      '</table>',
    ].join('')

    const result = parseDocxHtmlToImportedProject(html, 'teste.docx')

    expect(result.title).toBe('Colheita Feliz 7Teen - GDD')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].title).toBe('Mecânicas')
    expect(result.sections[0].content).toContain('<table>')
    expect(result.sections[0].content).toContain('colspan="2"')
    expect(result.sections[0].content).toContain('rowspan="2"')
  })

  it('skips sumário heading section', () => {
    const html = [
      '<h1>Projeto</h1>',
      '<h2>Sumário</h2>',
      '<p>Item 1</p>',
      '<h2>Gameplay</h2>',
      '<p>Loop principal</p>',
    ].join('')

    const result = parseDocxHtmlToImportedProject(html, 'teste.docx')

    expect(result.sections.map((section) => section.title)).toEqual(['Gameplay'])
  })

  it('ignores google-docs style toc links under sumário', () => {
    const html = [
      '<h1>Sumário</h1>',
      '<p><a href="#_id1"><strong>Visão Geral 6</strong></a></p>',
      '<p><a href="#_id2">Descrição: 7</a></p>',
      '<p><a id="_id1"></a></p>',
      '<h1>Colheita Feliz 7Teen - GDD</h1>',
      '<p>Inspiração: Colheita Feliz.</p>',
      '<h2>Visão Geral</h2>',
      '<p>Conteúdo principal.</p>',
    ].join('')

    const result = parseDocxHtmlToImportedProject(html, 'teste.docx')

    expect(result.title).toBe('Colheita Feliz 7Teen - GDD')
    expect(result.sections.map((section) => section.title)).toEqual(['Visão Geral'])
    expect(result.sections[0].content).toContain('Conteúdo principal')
    expect(result.sections[0].content).not.toContain('Visão Geral 6')
    expect(result.sections[0].content).not.toContain('Descrição: 7')
  })

  it('converts html internal anchor links to cross references', () => {
    const html = [
      '<h1>Projeto</h1>',
      '<h2>Armazém</h2>',
      '<p>Detalhes do armazém.</p>',
      '<p><a id="_mpzfxjctd6tr"></a></p>',
      '<h2>Economia</h2>',
      '<p>Veja <a href="#_mpzfxjctd6tr">o armazém</a> para mais detalhes.</p>',
    ].join('')

    const result = parseDocxHtmlToImportedProject(html, 'teste.docx')

    expect(result.sections).toHaveLength(2)
    expect(result.sections[1].content).toContain('$[Armazém]')
    expect(result.sections[1].content).not.toContain('href="#_mpzfxjctd6tr"')
  })

  it('removes huge inline data-uri images from content', () => {
    const hugeSrc = `data:image/png;base64,${'A'.repeat(6000)}`
    const html = [
      '<h1>Projeto</h1>',
      '<h2>UI</h2>',
      `<p><a href="https://example.com"><img src="${hugeSrc}" width="100" height="132"></a></p>`,
      '<p>Texto continua normalmente.</p>',
    ].join('')

    const result = parseDocxHtmlToImportedProject(html, 'teste.docx')

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].content).toContain('Texto continua normalmente.')
    expect(result.sections[0].content).not.toContain('data:image/png;base64')
    expect(result.sections[0].content).not.toContain('<img')
  })
})
