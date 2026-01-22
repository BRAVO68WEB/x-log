import { getEnv } from '@xlog/config';
import { CryptoKey, jwtVerify } from 'jose';

export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface OIDCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
}

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  discoveryUrl: string;
  scope?: string;
}

export class OIDCClient {
  private config: OIDCConfig;
  private discovery: OIDCDiscoveryDocument | null = null;
  private jwks: Map<string, CryptoKey> = new Map();

  constructor(config?: Partial<OIDCConfig>) {
    const env = getEnv();
    console.log(env);
    this.config = {
      clientId: config?.clientId || env.OIDC_CLIENT_ID,
      clientSecret: config?.clientSecret || env.OIDC_CLIENT_SECRET,
      redirectUri: config?.redirectUri || env.OIDC_REDIRECT_URI,
      discoveryUrl: config?.discoveryUrl || env.OIDC_DISCOVERY_URL,
      scope: config?.scope || 'openid email profile',
    };
  }

  /**
   * Fetch and cache the OIDC discovery document
   */
  async getDiscovery(): Promise<OIDCDiscoveryDocument> {
    if (this.discovery) {
      return this.discovery;
    }

    try {
      const response = await fetch(this.config.discoveryUrl + '/.well-known/openid-configuration');
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.statusText}`);
      }
      this.discovery = (await response.json()) as OIDCDiscoveryDocument;
      return this.discovery;
    } catch (error) {
      throw new Error(`OIDC discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate authorization URL for OIDC login
   */
  async getAuthorizationUrl(state: string, nonce?: string): Promise<string> {
    const discovery = await this.getDiscovery();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope!,
      state,
    });

    if (nonce) {
      params.append('nonce', nonce);
    }

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OIDCTokenResponse> {
    const discovery = await this.getDiscovery();
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
        console.log(discovery.token_endpoint);
        console.log(params.toString());
      const response = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      console.log(await response.json());

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
      }

      return (await response.json()) as OIDCTokenResponse;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify and decode ID token
   */
  async verifyIdToken(idToken: string): Promise<OIDCUserInfo> {
    const discovery = await this.getDiscovery();
    
    try {
      // Fetch JWKS if not cached
      if (this.jwks.size === 0) {
        await this.fetchJWKS(discovery.jwks_uri);
      }

      // Parse the token header to get the kid
      const [headerB64] = idToken.split('.');
      const header = JSON.parse(atob(headerB64));
      const kid = header.kid;

      if (!kid) {
        throw new Error('No kid in token header');
      }

      const publicKey = this.jwks.get(kid);
      if (!publicKey) {
        // Refresh JWKS and try again
        await this.fetchJWKS(discovery.jwks_uri);
        const refreshedKey = this.jwks.get(kid);
        if (!refreshedKey) {
          throw new Error(`Public key not found for kid: ${kid}`);
        }
      }

      const { payload } = await jwtVerify(idToken, this.jwks.get(kid)!, {
        issuer: discovery.issuer,
        audience: this.config.clientId,
      });

      return payload as unknown as OIDCUserInfo;
    } catch (error) {
      throw new Error(`ID token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch userinfo from userinfo endpoint
   */
  async getUserInfo(accessToken: string): Promise<OIDCUserInfo> {
    const discovery = await this.getDiscovery();
    
    try {
      const response = await fetch(discovery.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Userinfo request failed: ${response.statusText}`);
      }

      return (await response.json()) as OIDCUserInfo;
    } catch (error) {
      throw new Error(`Userinfo request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch and cache JWKS
   */
  private async fetchJWKS(jwksUri: string): Promise<void> {
    try {
      const response = await fetch(jwksUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
      }

      const jwks = (await response.json()) as { keys: any[] };
      this.jwks.clear();

      // Import all keys
      const { importJWK } = await import('jose');
      for (const key of jwks.keys) {
        if (key.kid) {
          const cryptoKey = await importJWK(key, key.alg) as CryptoKey;
          this.jwks.set(key.kid, cryptoKey);
        }
      }
    } catch (error) {
      throw new Error(`JWKS fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete OIDC flow: exchange code and get user info
   */
  async completeFlow(code: string): Promise<OIDCUserInfo> {
    const tokens = await this.exchangeCode(code);
    const userInfo = await this.verifyIdToken(tokens.id_token);
    
    // Optionally fetch additional userinfo if needed
    // const additionalInfo = await this.getUserInfo(tokens.access_token);
    // return { ...userInfo, ...additionalInfo };
    
    return userInfo;
  }
}

// Singleton instance
let oidcClientInstance: OIDCClient | null = null;

export function getOIDCClient(): OIDCClient {
  if (!oidcClientInstance) {
    oidcClientInstance = new OIDCClient();
  }
  return oidcClientInstance;
}
