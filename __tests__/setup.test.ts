/**
 * Teste básico para validar configuração do Jest
 */
describe('Jest Configuration', () => {
  it('should run basic test', () => {
    expect(true).toBe(true)
  })

  it('should have localStorage mock', () => {
    expect(global.localStorage).toBeDefined()
    expect(typeof global.localStorage.getItem).toBe('function')
  })

  it('should have window.matchMedia mock', () => {
    expect(window.matchMedia).toBeDefined()
    expect(typeof window.matchMedia).toBe('function')
  })
})
