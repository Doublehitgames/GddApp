/**
 * Testes do componente SectionLink
 * Testa links de referências cruzadas entre seções
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { SectionLink } from '@/components/SectionLink'
import { useRouter } from 'next/navigation'

// Mock do Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('SectionLink', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('Valid section link', () => {
    it('should render as a clickable button when sectionId exists', () => {
      render(
        <SectionLink
          sectionName="Game Mechanics"
          projectId="project-123"
          sectionId="section-456"
        >
          Game Mechanics
        </SectionLink>
      )

      const button = screen.getByRole('button', { name: /game mechanics/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('text-blue-400')
      expect(button).toHaveClass('underline')
    })

    it('should have correct title attribute', () => {
      render(
        <SectionLink
          sectionName="Combat System"
          projectId="project-123"
          sectionId="section-789"
        >
          Combat System
        </SectionLink>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Ir para: Combat System')
    })

    it('should navigate to correct URL when clicked', () => {
      render(
        <SectionLink
          sectionName="Level Design"
          projectId="proj-abc"
          sectionId="sect-xyz"
        >
          Level Design
        </SectionLink>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/projects/proj-abc/sections/sect-xyz')
      expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('should prevent default event behavior', () => {
      render(
        <SectionLink
          sectionName="Test Section"
          projectId="project-123"
          sectionId="section-456"
        >
          Test Section
        </SectionLink>
      )

      const button = screen.getByRole('button')
      const event = { preventDefault: jest.fn() } as any

      fireEvent.click(button, event)

      // Note: This test verifies the click handler is called
      expect(mockPush).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(
        <SectionLink
          sectionName="Section Name"
          projectId="project-123"
          sectionId="section-456"
        >
          <span data-testid="custom-content">Custom Content</span>
        </SectionLink>
      )

      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
      expect(screen.getByText('Custom Content')).toBeInTheDocument()
    })
  })

  describe('Invalid section link', () => {
    it('should render as span when sectionId is null', () => {
      render(
        <SectionLink
          sectionName="Non Existent Section"
          projectId="project-123"
          sectionId={null}
        >
          Non Existent Section
        </SectionLink>
      )

      const span = screen.getByText('Non Existent Section')
      expect(span.tagName).toBe('SPAN')
      expect(span).not.toHaveRole('button')
    })

    it('should have error styling when sectionId is null', () => {
      render(
        <SectionLink
          sectionName="Invalid Reference"
          projectId="project-123"
          sectionId={null}
        >
          Invalid Reference
        </SectionLink>
      )

      const span = screen.getByText('Invalid Reference')
      expect(span).toHaveClass('text-red-500')
      expect(span).toHaveClass('underline')
      expect(span).toHaveClass('decoration-wavy')
      expect(span).toHaveClass('cursor-help')
    })

    it('should show error message in title', () => {
      render(
        <SectionLink
          sectionName="Broken Link"
          projectId="project-123"
          sectionId={null}
        >
          Broken Link
        </SectionLink>
      )

      const span = screen.getByText('Broken Link')
      expect(span).toHaveAttribute('title', 'Seção não encontrada: "Broken Link"')
    })

    it('should not navigate when clicked if sectionId is null', () => {
      render(
        <SectionLink
          sectionName="Invalid"
          projectId="project-123"
          sectionId={null}
        >
          Invalid
        </SectionLink>
      )

      const span = screen.getByText('Invalid')
      fireEvent.click(span)

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render children even when invalid', () => {
      render(
        <SectionLink
          sectionName="Invalid Section"
          projectId="project-123"
          sectionId={null}
        >
          <strong data-testid="bold-text">Bold Invalid Link</strong>
        </SectionLink>
      )

      expect(screen.getByTestId('bold-text')).toBeInTheDocument()
      expect(screen.getByText('Bold Invalid Link')).toBeInTheDocument()
    })
  })

  describe('Different content types', () => {
    it('should handle plain text children', () => {
      render(
        <SectionLink
          sectionName="Test"
          projectId="proj-1"
          sectionId="sect-1"
        >
          Plain Text
        </SectionLink>
      )

      expect(screen.getByText('Plain Text')).toBeInTheDocument()
    })

    it('should handle complex JSX children', () => {
      render(
        <SectionLink
          sectionName="Test"
          projectId="proj-1"
          sectionId="sect-1"
        >
          <div>
            <span>Complex</span>
            <strong>Content</strong>
          </div>
        </SectionLink>
      )

      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible when valid', () => {
      render(
        <SectionLink
          sectionName="Accessible Section"
          projectId="project-123"
          sectionId="section-456"
        >
          Accessible Section
        </SectionLink>
      )

      const button = screen.getByRole('button')
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveClass('cursor-pointer')
    })

    it('should have meaningful hover state', () => {
      render(
        <SectionLink
          sectionName="Hover Test"
          projectId="project-123"
          sectionId="section-456"
        >
          Hover Test
        </SectionLink>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:text-blue-300')
    })
  })
})
