/**
 * Get the authority address from environment variables.
 * This address will own the AccessManager contract and must be set before deployment.
 * @returns Authority address from AUTHORITY env var
 * @throws Error if AUTHORITY env var is not set
 */
export function getAuthorityAddress(): string {
  const authority = process.env.AUTHORITY;
  
  if (!authority) {
    throw new Error(
      'AUTHORITY environment variable is not set. ' +
      'Please set AUTHORITY to the MultiSig or AccessManager address before deployment. ' +
      'Example: export AUTHORITY=0x1234567890abcdef1234567890abcdef12345678'
    );
  }
  
  // Validate that it looks like a valid Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(authority)) {
    throw new Error(
      `AUTHORITY environment variable "${authority}" is not a valid Ethereum address. ` +
      'Must be in format: 0x followed by 40 hexadecimal characters.'
    );
  }
  
  return authority;
}
