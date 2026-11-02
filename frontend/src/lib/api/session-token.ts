let tokenProvider: () => string | null = () => null;

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

export function getCurrentToken(): string | null {
  return tokenProvider();
}
