# Canary Test Suite

## Overview

This test suite provides comprehensive coverage for the Canary decentralized deadman switch application. Tests are written using Vitest with React Testing Library for component testing.

## Test Structure

```
tests/
├── setup.ts                  # Global test setup and mocks
├── lib/                     # Unit tests for library functions
│   ├── taco.test.ts         # TACo encryption/decryption tests
│   ├── ipfs.test.ts         # IPFS storage tests
│   ├── pinata.test.ts       # Pinata gateway tests
│   ├── codex.test.ts        # Codex storage tests
│   ├── contract.test.ts     # Smart contract interaction tests
│   └── ethers-adapter.test.ts # Ethers/Privy adapter tests
├── components/              # Component tests
│   ├── Onboarding.test.tsx  # Onboarding flow tests
│   └── Web3Provider.test.tsx # Web3 provider tests
└── integration/             # Integration tests
    └── page.test.tsx        # Main page flow tests
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Coverage Requirements

The project maintains the following coverage thresholds:
- Lines: 80%
- Branches: 80%
- Functions: 80%
- Statements: 80%

## Writing Tests

### Unit Tests

Test individual functions and modules in isolation:

```typescript
describe('Function Name', () => {
  it('should handle normal case', async () => {
    const result = await myFunction(input)
    expect(result).toBe(expected)
  })

  it('should handle error case', async () => {
    await expect(myFunction(badInput)).rejects.toThrow('Error message')
  })
})
```

### Component Tests

Test React components with user interactions:

```typescript
describe('Component Name', () => {
  it('should render correctly', () => {
    render(<MyComponent prop="value" />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(mockHandler).toHaveBeenCalled()
  })
})
```

### Integration Tests

Test complete user flows:

```typescript
describe('User Flow', () => {
  it('should complete encryption flow', async () => {
    // Setup authenticated state
    setupMocks()
    
    // Render app
    render(<App />)
    
    // Perform user actions
    await user.upload(fileInput, testFile)
    await user.click(encryptButton)
    
    // Verify results
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })
})
```

## Mocking

### Web3 Mocks

The test suite includes comprehensive mocks for:
- Ethereum providers (window.ethereum, Privy)
- Wagmi hooks and functions
- Smart contract interactions
- IPFS/Pinata/Codex storage

### Common Mock Patterns

```typescript
// Mock Privy authentication
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    authenticated: true,
    user: { id: 'test-user' }
  }))
}))

// Mock contract calls
vi.mock('@/app/lib/contract', () => ({
  createDossier: vi.fn().mockResolvedValue(BigInt(1))
}))
```

## Debugging Tests

### Run specific test file
```bash
npm test tests/lib/taco.test.ts
```

### Run tests matching pattern
```bash
npm test -- -t "encryption"
```

### Debug in VS Code
1. Set breakpoints in test files
2. Use "Debug: JavaScript Debug Terminal"
3. Run `npm test`

## CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

Coverage reports are:
- Uploaded to Codecov
- Archived as artifacts
- Commented on PRs

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Use descriptive test names
3. **Coverage**: Test both success and error paths
4. **Performance**: Mock external dependencies
5. **Maintenance**: Update tests when changing code

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase timeout for slow operations
   ```typescript
   it('slow test', async () => {
     // test code
   }, 10000) // 10 second timeout
   ```

2. **Module resolution**: Ensure `@/` alias is configured
3. **React warnings**: Check for missing act() wrappers
4. **Async errors**: Always await async operations

### Getting Help

- Check test output for detailed error messages
- Review similar tests for patterns
- Consult Vitest and Testing Library documentation