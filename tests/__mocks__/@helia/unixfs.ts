export const unixfs = vi.fn().mockReturnValue({
  addBytes: vi.fn(),
  cat: vi.fn().mockImplementation(function* () {
    yield new Uint8Array([1, 2, 3])
    yield new Uint8Array([4, 5, 6])
  })
})