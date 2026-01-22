import { getEnv } from '@xlog/config'
import { importJWK, type JWK, jwtVerify as verify } from 'jose'

const env = getEnv();

interface JWKSet {
    keys: JWK[];
}

export class JWKS {
    private jwks_url: string;
    private jwks: JWK[];
    public static url: string;
    private static instance: JWKS;

    constructor(jwks_url: string) {
        this.jwks_url = jwks_url;
        this.jwks = [];
    }

    static getInstance(jwks_url: string) {
        if (!JWKS.instance) {
            JWKS.instance = new JWKS(jwks_url);
        }
        return JWKS.instance;
    }

    async init() {
        await this.getJWKS()
        await this.createPublicKey()
    }

    async getJWKS() {
        const response = await fetch(this.jwks_url);
        const jwks = await response.json() as JWKSet;
        this.jwks = jwks.keys;
    }

    async getPublicKey(kid: string) {
        const publicKey = this.jwks.find((key) => key.kid === kid);
        return publicKey;
    }

    async createPublicKey() {
        // TODO: Expand to support multiple keys
        return importJWK(this.jwks[0], this.jwks[0].alg);
    }

    async verifyToken(token: string) {
        const publicKey = await this.createPublicKey();
        return verify(token, publicKey);
    }
}

JWKS.getInstance(env.OIDC_DISCOVERY_URL)