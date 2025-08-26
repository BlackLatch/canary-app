import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { ThemeProvider, useTheme } from '@/app/lib/theme-context';
import React from 'react';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component that uses the theme hook
function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('light', 'dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
  });

  it('provides default light theme', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('loads theme from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles theme correctly', async () => {
    localStorageMock.getItem.mockReturnValue('light');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    
    const toggleButton = screen.getByText('Toggle Theme');
    
    act(() => {
      fireEvent.click(toggleButton);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
    
    act(() => {
      fireEvent.click(toggleButton);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    });
  });

  it('prevents hydration mismatch', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    const { container } = render(
      <ThemeProvider>
        <div>Child Content</div>
      </ThemeProvider>
    );
    
    // Initially should render children without provider until mounted
    expect(container.textContent).toContain('Child Content');
  });

  it('applies theme classes immediately on mount', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    // Theme should be applied immediately
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('saves theme to localStorage when not already saved', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('returns default values when context is undefined', () => {
    // Test component that uses useTheme outside of provider
    function UnwrappedComponent() {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    }
    
    // Render without ThemeProvider
    render(<UnwrappedComponent />);
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    
    // Toggle should be a no-op
    const button = screen.getByText('Toggle');
    fireEvent.click(button);
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('handles multiple theme changes correctly', async () => {
    localStorageMock.getItem.mockReturnValue('light');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    const toggleButton = screen.getByText('Toggle Theme');
    
    // Toggle multiple times
    for (let i = 0; i < 3; i++) {
      act(() => {
        fireEvent.click(toggleButton);
      });
      
      await waitFor(() => {
        const expectedTheme = i % 2 === 0 ? 'dark' : 'light';
        expect(screen.getByTestId('theme')).toHaveTextContent(expectedTheme);
        expect(document.documentElement.classList.contains(expectedTheme)).toBe(true);
      });
    }
  });
});