/**
 * Renomear uma página não pode quebrar as referências que apontavam para ela.
 * Um ref por nome (`$[Título]`) é reescrito no rename; um ref por id (`$[#id]`)
 * já acompanha o rename sozinho e não deve ser mexido.
 */

import {
  renameReferencesInText,
  renameReferencesInBlocks,
  buildRenameRefPatches,
  convertBlockRefsToNames,
} from '@/utils/sectionReferences'

describe('renameReferencesInText', () => {
  it('rewrites a name ref to the new title', () => {
    const text = 'Comprada no $[Racoes Animal] e usada no cocho.'
    expect(renameReferencesInText(text, 'Racoes Animal', 'Rações de Animal')).toBe(
      'Comprada no $[Rações de Animal] e usada no cocho.'
    )
  })

  it('rewrites every occurrence, keeping the rest of the text intact', () => {
    const text = '$[Milho] vira $[Milho] moído no $[Moinho].'
    expect(renameReferencesInText(text, 'Milho', 'Milho Doce')).toBe(
      '$[Milho Doce] vira $[Milho Doce] moído no $[Moinho].'
    )
  })

  it('matches the title case-insensitively, like the renderer does', () => {
    expect(renameReferencesInText('Ver $[racoes animal].', 'Racoes Animal', 'Rações')).toBe(
      'Ver $[Rações].'
    )
  })

  it('leaves id refs alone — those already follow the rename', () => {
    const text = 'Ver $[#abc-123] e $[Milho].'
    expect(renameReferencesInText(text, 'Milho', 'Milho Doce')).toBe(
      'Ver $[#abc-123] e $[Milho Doce].'
    )
  })

  it('does not touch a ref to a different page', () => {
    const text = 'Ver $[Moinho].'
    expect(renameReferencesInText(text, 'Milho', 'Milho Doce')).toBe(text)
  })

  it('returns the text untouched when there is nothing to rewrite', () => {
    expect(renameReferencesInText('Sem refs aqui.', 'Milho', 'Milho Doce')).toBe('Sem refs aqui.')
    expect(renameReferencesInText('', 'Milho', 'Milho Doce')).toBe('')
  })

  it('ignores a rename that only changes case', () => {
    expect(renameReferencesInText('Ver $[Milho].', 'Milho', 'milho')).toBe('Ver $[Milho].')
  })

  it('handles emoji titles, which are part of the title', () => {
    expect(renameReferencesInText('Ver $[🦴Osso].', '🦴Osso', '🦴Osso Grande')).toBe(
      'Ver $[🦴Osso Grande].'
    )
  })
})

describe('renameReferencesInBlocks', () => {
  it('rewrites refs in paragraphs, nested children and links', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Feita com $[Milho].', styles: {} },
          {
            type: 'link',
            href: 'https://x.dev',
            content: [{ type: 'text', text: 'ver $[Milho]', styles: {} }],
          },
        ],
        children: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Também $[Milho].', styles: {} }] },
        ],
      },
    ]

    const out = renameReferencesInBlocks(blocks, 'Milho', 'Milho Doce')

    expect(out[0].content[0].text).toBe('Feita com $[Milho Doce].')
    expect(out[0].content[1].content[0].text).toBe('ver $[Milho Doce]')
    expect(out[0].children[0].content[0].text).toBe('Também $[Milho Doce].')
  })

  it('rewrites refs inside table cells', () => {
    const blocks = [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: [[{ type: 'text', text: 'Insumo: $[Milho]', styles: {} }]] },
            { cells: [{ content: [{ type: 'text', text: 'Saída: $[Milho]', styles: {} }] }] },
          ],
        },
      },
    ]

    const out = renameReferencesInBlocks(blocks, 'Milho', 'Milho Doce')

    expect(out[0].content.rows[0].cells[0][0].text).toBe('Insumo: $[Milho Doce]')
    expect(out[0].content.rows[1].cells[0].content[0].text).toBe('Saída: $[Milho Doce]')
  })

  it('keeps the original nodes when no text changed', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Nada aqui.', styles: {} }] },
    ]
    const out = renameReferencesInBlocks(blocks, 'Milho', 'Milho Doce')
    expect(out[0].content[0]).toBe(blocks[0].content[0])
  })

  it('survives blocks that are not arrays or carry no content', () => {
    expect(renameReferencesInBlocks(null, 'a', 'b')).toBeNull()
    expect(renameReferencesInBlocks([{ type: 'image', props: { url: 'x' } }], 'a', 'b')).toEqual([
      { type: 'image', props: { url: 'x' } },
    ])
  })
})

describe('convertBlockRefsToNames', () => {
  const sections = [{ id: 'sec-1', title: 'Moinho' }]

  it('turns id refs into readable titles, tables included', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Moído no $[#sec-1].', styles: {} }] },
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: [[{ type: 'text', text: '$[#sec-1]', styles: {} }]] }],
        },
      },
    ]

    const out = convertBlockRefsToNames(blocks, sections)

    expect(out[0].content[0].text).toBe('Moído no $[Moinho].')
    expect(out[1].content.rows[0].cells[0][0].text).toBe('$[Moinho]')
  })
})

describe('buildRenameRefPatches', () => {
  const sections = [
    { id: 's1', title: 'Racoes Animal', content: 'Ela mesma cita $[Racoes Animal].' },
    { id: 's2', title: 'Cocho', content: 'Enche com $[Racoes Animal].' },
    { id: 's3', title: 'Moinho', content: 'Nada a ver.' },
    {
      id: 's4',
      title: 'Fazenda',
      content: 'Ver $[Racoes Animal].',
      contentBlocks: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Ver $[Racoes Animal].', styles: {} }] },
      ],
    },
  ]

  it('patches only the pages that actually reference the old title', () => {
    const patches = buildRenameRefPatches(sections, 's1', 'Racoes Animal', 'Rações de Animal')

    expect(patches.map((p) => p.id).sort()).toEqual(['s1', 's2', 's4'])
    expect(patches.find((p) => p.id === 's2')!.content).toBe('Enche com $[Rações de Animal].')
  })

  it('patches markdown and blocks together', () => {
    const patch = buildRenameRefPatches(sections, 's1', 'Racoes Animal', 'Rações de Animal').find(
      (p) => p.id === 's4'
    )!

    expect(patch.content).toBe('Ver $[Rações de Animal].')
    expect((patch.contentBlocks as any)[0].content[0].text).toBe('Ver $[Rações de Animal].')
  })

  it('sweeps the renamed page itself, so a self-reference survives', () => {
    const patch = buildRenameRefPatches(sections, 's1', 'Racoes Animal', 'Rações de Animal').find(
      (p) => p.id === 's1'
    )!

    expect(patch.content).toBe('Ela mesma cita $[Rações de Animal].')
  })

  it('rewrites nothing when another page still carries the old title', () => {
    const ambiguous = [...sections, { id: 's5', title: 'Racoes Animal', content: '' }]
    expect(buildRenameRefPatches(ambiguous, 's1', 'Racoes Animal', 'Rações de Animal')).toEqual([])
  })

  it('rewrites nothing when the title did not really change', () => {
    expect(buildRenameRefPatches(sections, 's1', 'Racoes Animal', 'racoes animal ')).toEqual([])
    expect(buildRenameRefPatches(sections, 's1', '', 'Nova')).toEqual([])
  })
})
