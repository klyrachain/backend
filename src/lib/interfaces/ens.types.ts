/**
 * Response when resolving an address to ENS name (and optional avatar).
 * @property ensName - Resolved ENS/Basename or null if not found
 * @property avatar - Avatar URL when available
 */
export interface EnsNameResponse {
  ensName: string | null;
  avatar?: string | null;
}

/**
 * Response when resolving an ENS name to address.
 * @property address - Resolved wallet address or null if not found
 * @property avatar - Avatar URL when available
 */
export interface EnsAddressResponse {
  address: string | null;
  avatar?: string | null;
}
