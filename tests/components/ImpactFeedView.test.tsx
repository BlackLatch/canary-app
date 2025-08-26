import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import ImpactFeedView from '@/app/components/ImpactFeedView';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}));

// Mock ContractService
vi.mock('@/app/lib/contract', () => ({
  ContractService: {
    getUserDossierIds: vi.fn(),
    getDossier: vi.fn(),
    shouldDossierStayEncrypted: vi.fn(),
  },
}));

describe('ImpactFeedView', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useAccount as any).mockReturnValue({ address: null });
  });

  it('renders loading skeleton initially', () => {
    render(<ImpactFeedView theme="light" />);
    
    // Check for loading skeleton elements (not text since it's in skeleton)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no dossiers exist', async () => {
    const { ContractService } = await import('@/app/lib/contract');
    (ContractService.getUserDossierIds as any).mockResolvedValue([]);
    (useAccount as any).mockReturnValue({ address: '0x123' });
    
    render(<ImpactFeedView theme="light" />);
    
    await waitFor(() => {
      expect(screen.getByText('No Releases Found')).toBeInTheDocument();
    });
  });

  it('displays dossiers when they exist', async () => {
    const { ContractService } = await import('@/app/lib/contract');
    const mockDossier = {
      id: BigInt(1),
      name: 'Test Document',
      isActive: true,
      lastCheckIn: BigInt(Math.floor(Date.now() / 1000 - 3600)),
      checkInInterval: BigInt(86400),
      encryptedFileHashes: ['ipfs://hash1'],
      recipients: [],
    };
    
    (useAccount as any).mockReturnValue({ address: '0x123' });
    (ContractService.getUserDossierIds as any).mockResolvedValue([BigInt(1)]);
    (ContractService.getDossier as any).mockResolvedValue(mockDossier);
    (ContractService.shouldDossierStayEncrypted as any).mockResolvedValue(true);
    
    render(<ImpactFeedView theme="light" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });
  });

  it('filters dossiers correctly', async () => {
    const { ContractService } = await import('@/app/lib/contract');
    const mockDossier = {
      id: BigInt(1),
      name: 'Test Document',
      isActive: true,
      lastCheckIn: BigInt(Math.floor(Date.now() / 1000 - 3600)),
      checkInInterval: BigInt(86400),
      encryptedFileHashes: ['ipfs://hash1'],
      recipients: [],
    };
    
    (useAccount as any).mockReturnValue({ address: '0x123' });
    (ContractService.getUserDossierIds as any).mockResolvedValue([BigInt(1)]);
    (ContractService.getDossier as any).mockResolvedValue(mockDossier);
    (ContractService.shouldDossierStayEncrypted as any).mockResolvedValue(false);
    
    render(<ImpactFeedView theme="light" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });
    
    // Click on PUBLIC filter
    const publicFilter = screen.getByText('PUBLIC');
    fireEvent.click(publicFilter);
    
    // Should still show the document as it's unlocked
    expect(screen.getByText('Test Document')).toBeInTheDocument();
    
    // Click on PENDING filter
    const pendingFilter = screen.getByText('PENDING');
    fireEvent.click(pendingFilter);
    
    // Should now show empty state for pending
    await waitFor(() => {
      expect(screen.getByText('No Pending Releases')).toBeInTheDocument();
    });
  });

  it('navigates to release page on dossier click', async () => {
    const { ContractService } = await import('@/app/lib/contract');
    const mockDossier = {
      id: BigInt(1),
      name: 'Test Document',
      isActive: true,
      lastCheckIn: BigInt(Math.floor(Date.now() / 1000 - 3600)),
      checkInInterval: BigInt(86400),
      encryptedFileHashes: ['ipfs://hash1'],
      recipients: [],
    };
    
    (useAccount as any).mockReturnValue({ address: '0x123' });
    (ContractService.getUserDossierIds as any).mockResolvedValue([BigInt(1)]);
    (ContractService.getDossier as any).mockResolvedValue(mockDossier);
    (ContractService.shouldDossierStayEncrypted as any).mockResolvedValue(true);
    
    render(<ImpactFeedView theme="light" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });
    
    // Click on the dossier
    const dossierElement = screen.getByText('Test Document').closest('div[onClick]');
    if (dossierElement) {
      fireEvent.click(dossierElement);
      expect(mockPush).toHaveBeenCalledWith('/release?user=0x123&id=1');
    }
  });

  it('applies correct theme styles', () => {
    const { rerender } = render(<ImpactFeedView theme="light" />);
    expect(document.querySelector('.bg-white')).toBeInTheDocument();
    
    rerender(<ImpactFeedView theme="dark" />);
    expect(document.querySelector('.bg-gray-900')).toBeInTheDocument();
  });

  it('shows correct countdown format', async () => {
    const { ContractService } = await import('@/app/lib/contract');
    const mockDossier = {
      id: BigInt(1),
      name: 'Test Document',
      isActive: true,
      lastCheckIn: BigInt(Math.floor(Date.now() / 1000 - 3600)),
      checkInInterval: BigInt(7200), // 2 hours
      encryptedFileHashes: ['ipfs://hash1'],
      recipients: [],
    };
    
    (useAccount as any).mockReturnValue({ address: '0x123' });
    (ContractService.getUserDossierIds as any).mockResolvedValue([BigInt(1)]);
    (ContractService.getDossier as any).mockResolvedValue(mockDossier);
    (ContractService.shouldDossierStayEncrypted as any).mockResolvedValue(true);
    
    render(<ImpactFeedView theme="light" />);
    
    await waitFor(() => {
      // Should show time in hours/minutes format
      const timeElements = screen.getAllByText(/\d+h|\d+m/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});