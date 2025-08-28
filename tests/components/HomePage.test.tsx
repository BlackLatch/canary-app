import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import Home from '@/app/page';
import { useSearchParams } from 'next/navigation';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: null, isConnected: false })),
  useConnect: vi.fn(() => ({ connectors: [], connect: vi.fn(), isPending: false })),
  useDisconnect: vi.fn(() => ({ disconnect: vi.fn() })),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    ready: true,
    authenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  })),
  useWallets: vi.fn(() => ({ wallets: [] })),
  useConnectWallet: vi.fn(() => ({ connectWallet: vi.fn() })),
}));

vi.mock('@privy-io/wagmi', () => ({
  useSetActiveWallet: vi.fn(() => ({ setActiveWallet: vi.fn() })),
}));

vi.mock('@privy-io/react-auth/smart-wallets', () => ({
  useSmartWallets: vi.fn(() => ({ client: null })),
}));

vi.mock('@/app/lib/theme-context', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
}));

vi.mock('@/app/lib/contract', () => ({
  ContractService: {
    getUserDossierIds: vi.fn(() => Promise.resolve([])),
    getDossier: vi.fn(),
    getConstants: vi.fn(() => Promise.resolve({
      minInterval: BigInt(60),
      maxInterval: BigInt(31536000),
      gracePeriod: BigInt(86400),
      maxDossiers: BigInt(100),
    })),
    checkIn: vi.fn(),
    createDossier: vi.fn(),
    deactivateDossier: vi.fn(),
    reactivateDossier: vi.fn(),
    shouldDossierStayEncrypted: vi.fn(),
  },
  CANARY_DOSSIER_ADDRESS: '0x123',
  CANARY_DOSSIER_ABI: [],
  isOnPolygonAmoy: vi.fn(() => true),
  getNetworkName: vi.fn(() => 'Polygon Amoy'),
}));

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockSearchParams = new URLSearchParams();
    (useSearchParams as any).mockReturnValue(mockSearchParams);
  });

  it('renders sign-in page when not authenticated', () => {
    render(<Home />);
    
    // Should show the landing page with sign-in options
    expect(screen.getByText(/Protect Your Truth/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  it('switches between standard and advanced auth modes', async () => {
    render(<Home />);
    
    // Find and click the advanced mode button
    const advancedButton = screen.getByText(/Advanced Mode/i);
    fireEvent.click(advancedButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
    });
  });

  it('handles URL query parameters for view selection', async () => {
    // Mock authenticated state
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as any).mockReturnValue({
      ready: true,
      authenticated: true,
      user: { email: { address: 'test@example.com' } },
      login: vi.fn(),
      logout: vi.fn(),
    });

    // Mock search params with documents view
    const mockSearchParams = new URLSearchParams('view=documents');
    (useSearchParams as any).mockReturnValue(mockSearchParams);
    
    render(<Home />);
    
    await waitFor(() => {
      // Should show documents view
      expect(screen.getByText(/DOSSIERS/i)).toBeInTheDocument();
    });
  });

  it('shows loading state for dossiers', async () => {
    // Mock authenticated state
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as any).mockReturnValue({
      ready: true,
      authenticated: true,
      user: { email: { address: 'test@example.com' } },
      login: vi.fn(),
      logout: vi.fn(),
    });
    
    render(<Home />);
    
    // Should show loading skeleton
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('displays check-in view when authenticated', async () => {
    // Mock authenticated state
    const { usePrivy } = await import('@privy-io/react-auth');
    const { useAccount } = await import('wagmi');
    
    (usePrivy as any).mockReturnValue({
      ready: true,
      authenticated: true,
      user: { email: { address: 'test@example.com' } },
      login: vi.fn(),
      logout: vi.fn(),
    });
    
    (useAccount as any).mockReturnValue({
      address: '0x123',
      isConnected: true,
    });
    
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/CHECK IN/i)).toBeInTheDocument();
      expect(screen.getByText(/System Status/i)).toBeInTheDocument();
    });
  });

  it('toggles theme correctly', async () => {
    const { useTheme } = await import('@/app/lib/theme-context');
    const mockToggleTheme = vi.fn();
    
    (useTheme as any).mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
    });
    
    render(<Home />);
    
    // Find theme toggle button (moon/sun icon button)
    const themeButton = document.querySelector('[title*="dark mode"]')?.closest('button');
    if (themeButton) {
      fireEvent.click(themeButton);
      expect(mockToggleTheme).toHaveBeenCalled();
    }
  });

  it('navigates between check-in and documents views', async () => {
    // Mock authenticated state
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as any).mockReturnValue({
      ready: true,
      authenticated: true,
      user: { email: { address: 'test@example.com' } },
      login: vi.fn(),
      logout: vi.fn(),
    });
    
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/CHECK IN/i)).toBeInTheDocument();
    });
    
    // Click on Documents navigation
    const documentsNav = screen.getByRole('button', { name: /Documents/i });
    fireEvent.click(documentsNav);
    
    await waitFor(() => {
      expect(screen.getByText(/Create and manage encrypted documents/i)).toBeInTheDocument();
    });
  });

  it('shows no active documents state correctly', async () => {
    // Mock authenticated state with no documents
    const { usePrivy } = await import('@privy-io/react-auth');
    const { ContractService } = await import('@/app/lib/contract');
    
    (usePrivy as any).mockReturnValue({
      ready: true,
      authenticated: true,
      user: { email: { address: 'test@example.com' } },
      login: vi.fn(),
      logout: vi.fn(),
    });
    
    (ContractService.getUserDossierIds as any).mockResolvedValue([]);
    
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/No Active Documents/i)).toBeInTheDocument();
      expect(screen.getByText(/Create your first encrypted document/i)).toBeInTheDocument();
    });
  });
});