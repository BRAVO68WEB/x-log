import { assertPublicUrl, getEnv, safeFetch, UnsafeUrlError } from "@xlog/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(config?: Partial<OIDCConfig>) {
    const env = getEnv();
    this.config = {
      clientId: config?.clientId || env.OIDC_CLIENT_ID,
      clientSecret: config?.clientSecret || env.OIDC_CLIENT_SECRET,
      redirectUri: config?.redirectUri || env.OIDC_REDIRECT_URI,
      discoveryUrl: config?.discoveryUrl || env.OIDC_DISCOVERY_URL,
      scope: config?.scope || "openid email profile",
    };
  }

  private allowPrivateIdp(): boolean {
    return getEnv().NODE_ENV !== "production";
  }

  /**
   * Discovery, token, userinfo, and JWKS URLs must share one host so the
   * client secret is not posted to a different server.
   */
  private async validatedDiscovery(doc: OIDCDiscoveryDocument, fetchedUrl: string): Promise<OIDCDiscoveryDocument> {
    const allowPrivate = this.allowPrivateIdp();
    const fetched = await assertPublicUrl(fetchedUrl, { allowPrivate });
    const host = fetched.host.toLowerCase();
    const fields = ["authorization_endpoint", "token_endpoint", "jwks_uri", "userinfo_endpoint"] as const;
    for (const field of fields) {
      const endpoint = await assertPublicUrl(doc[field], { allowPrivate });
      if (endpoint.host.toLowerCase() !== host) {
        throw new UnsafeUrlError(`OIDC ${field} host does not match discovery host`);
      }
    }
    return doc;
  }

  /**
   * Fetch and cache the OIDC discovery document
   */
  async getDiscovery(): Promise<OIDCDiscoveryDocument> {
    if (this.discovery) {
      return this.discovery;
    }

    const configured = this.config.discoveryUrl.replace(/\/$/, "");
    const discoveryUrl = configured.endsWith("/.well-known/openid-configuration")
      ? configured
      : `${configured}/.well-known/openid-configuration`;
    try {
      const response = await safeFetch(discoveryUrl, {
        allowPrivate: this.allowPrivateIdp(),
        followRedirects: false,
        maxBytes: 256 * 1024,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.statusText}`);
      }
      const doc = (await response.json()) as OIDCDiscoveryDocument;
      this.discovery = await this.validatedDiscovery(doc, discoveryUrl);
      return this.discovery;
    } catch (error) {
      throw new Error(
        `OIDC discovery failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate authorization URL for OIDC login
   */
  async getAuthorizationUrl(state: string, nonce?: string): Promise<string> {
    const discovery = await this.getDiscovery();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope!,
      state,
    });

    if (nonce) {
      params.append("nonce", nonce);
    }

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OIDCTokenResponse> {
    const discovery = await this.getDiscovery();

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await safeFetch(discovery.token_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        allowPrivate: this.allowPrivateIdp(),
        followRedirects: false,
        maxBytes: 256 * 1024,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
      }

      const tokenResponse = (await response.json()) as OIDCTokenResponse;
      return tokenResponse;
    } catch (error) {
      throw new Error(
        `Token exchange failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Verify and decode ID token
   */
  async verifyIdToken(idToken: string, expectedNonce?: string): Promise<OIDCUserInfo> {
    const discovery = await this.getDiscovery();

    try {
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
      }

      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: discovery.issuer,
        audience: this.config.clientId,
      });

      if (expectedNonce) {
        const nonce = (payload as { nonce?: unknown }).nonce;
        if (typeof nonce !== "string" || nonce !== expectedNonce) {
          throw new Error("OIDC nonce mismatch");
        }
      }

      return payload as unknown as OIDCUserInfo;
    } catch (error) {
      throw new Error(
        `ID token verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Fetch userinfo from userinfo endpoint
   */
  async getUserInfo(accessToken: string): Promise<OIDCUserInfo> {
    const discovery = await this.getDiscovery();

    try {
      const response = await safeFetch(discovery.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        allowPrivate: this.allowPrivateIdp(),
        followRedirects: false,
        maxBytes: 256 * 1024,
      });

      if (!response.ok) {
        throw new Error(`Userinfo request failed: ${response.statusText}`);
      }

      return (await response.json()) as OIDCUserInfo;
    } catch (error) {
      throw new Error(
        `Userinfo request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Complete OIDC flow: exchange code and get user info
   */
  async completeFlow(code: string, expectedNonce: string): Promise<OIDCUserInfo> {
    const tokens = await this.exchangeCode(code);
    const userInfo = await this.verifyIdToken(tokens.id_token, expectedNonce);

    const additionalInfo = await this.getUserInfo(tokens.access_token);
    return { ...userInfo, ...additionalInfo };
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
