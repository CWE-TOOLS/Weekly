/**
 * Authentication Service
 * Handles JWT generation and Google OAuth authentication for service account access
 * @module services/auth-service
 */

import { SERVICE_ACCOUNT } from '../config/api-config.js';
import { NETWORK_TIMING } from '../config/timing-constants.js';

import { logger } from '../utils/logger.js';
// Token caching
let cachedAccessToken = null;
let tokenExpiry = null;

/**
 * Encode a string to Base64 URL-safe format
 *
 * Converts string to Base64 and makes it URL-safe by replacing characters
 * and removing padding. Used for JWT encoding.
 *
 * @param {string} str - String to encode
 * @returns {string} Base64 URL-encoded string
 *
 * @example
 * const encoded = base64UrlEncode('{"alg":"RS256"}');
 * // Returns: URL-safe Base64 string
 */
export function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Decode a Base64 URL-safe string
 *
 * Converts URL-safe Base64 back to standard Base64 and decodes it.
 * Used for JWT decoding.
 *
 * @param {string} str - Base64 URL-encoded string
 * @returns {string} Decoded string
 *
 * @example
 * const decoded = base64UrlDecode('eyJhbGciOiJSUzI1NiJ9');
 * // Returns: '{"alg":"RS256"}'
 */
export function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

/**
 * Generate a JWT (JSON Web Token) for service account authentication
 *
 * Creates and signs a JWT using RS256 algorithm with the service account's
 * private key. The JWT is used to authenticate with Google OAuth2.
 *
 * @returns {Promise<string>} Signed JWT token in format: header.payload.signature
 * @throws {Error} If private key decoding or signing fails
 *
 * @example
 * const jwt = await generateJWT();
 * // Returns: 'eyJhbGc...payload...signature'
 */
export async function generateJWT() {
    const jwtStartTime = performance.now();

    logger.info('[Startup] 🔐 generateJWT() called');
    logger.info(`[Startup]   → Service account email: ${SERVICE_ACCOUNT.client_email}`);
    logger.info(`[Startup]   → Private key present: ${SERVICE_ACCOUNT.private_key ? 'Yes (length: ' + SERVICE_ACCOUNT.private_key.length + ')' : 'No'}`);

    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: SERVICE_ACCOUNT.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + NETWORK_TIMING.JWT_EXPIRY_SECONDS,
        iat: now
    };

    logger.info(`[Startup]   → JWT issued at: ${new Date(now * 1000).toISOString()}`);
    logger.info(`[Startup]   → JWT expires at: ${new Date((now + NETWORK_TIMING.JWT_EXPIRY_SECONDS) * 1000).toISOString()}`);

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = encodedHeader + '.' + encodedPayload;

    logger.info('[Startup] 🔑 Decoding private key...');
    const decodeStartTime = performance.now();

    // Extract and decode private key
    const privateKeyPem = SERVICE_ACCOUNT.private_key
        .replace(/-----BEGIN PRIVATE KEY-----\n/, '')
        .replace(/\n-----END PRIVATE KEY-----\n/, '')
        .replace(/\n/g, '');

    let privateKeyDer;
    try {
        privateKeyDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
        const decodeCompleteTime = performance.now();
        const decodeDuration = (decodeCompleteTime - decodeStartTime).toFixed(0);

        logger.info(`[Startup] ✅ Private key decoded in ${decodeDuration}ms`);
        logger.info(`[Startup]   → Key bytes: ${privateKeyDer.length}`);
    } catch (e) {
        const decodeErrorTime = performance.now();
        const errorDuration = (decodeErrorTime - decodeStartTime).toFixed(0);

        logger.error(`[Startup] ❌ Private key decode failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${e.message}`);
        throw e;
    }

    logger.info('[Startup] 📥 Importing private key...');
    const importStartTime = performance.now();

    let privateKey;
    try {
        // Import private key for signing
        privateKey = await crypto.subtle.importKey(
            'pkcs8',
            privateKeyDer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        );
        const importCompleteTime = performance.now();
        const importDuration = (importCompleteTime - importStartTime).toFixed(0);

        logger.info(`[Startup] ✅ Private key imported in ${importDuration}ms`);
    } catch (e) {
        const importErrorTime = performance.now();
        const errorDuration = (importErrorTime - importStartTime).toFixed(0);

        logger.error(`[Startup] ❌ Private key import failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${e.message}`);
        throw e;
    }

    logger.info('[Startup] ✍️ Signing JWT...');
    const signStartTime = performance.now();

    let signature;
    try {
        // Sign the message
        signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            privateKey,
            new TextEncoder().encode(message)
        );
        const signCompleteTime = performance.now();
        const signDuration = (signCompleteTime - signStartTime).toFixed(0);

        logger.info(`[Startup] ✅ JWT signed in ${signDuration}ms`);
        logger.info(`[Startup]   → Signature bytes: ${signature.byteLength}`);
    } catch (e) {
        const signErrorTime = performance.now();
        const errorDuration = (signErrorTime - signStartTime).toFixed(0);

        logger.error(`[Startup] ❌ JWT signing failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${e.message}`);
        throw e;
    }

    const encodedSignature = base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
    );

    const jwt = message + '.' + encodedSignature;
    const jwtCompleteTime = performance.now();
    const totalDuration = (jwtCompleteTime - jwtStartTime).toFixed(0);

    logger.info(`[Startup] ✅ generateJWT() complete - Total time: ${totalDuration}ms`);
    logger.info(`[Startup]   → JWT length: ${jwt.length} characters`);

    return jwt;
}

/**
 * Get an OAuth access token for Google Sheets API
 *
 * Returns cached token if still valid, otherwise generates new JWT and
 * exchanges it for a fresh access token. Tokens are cached for performance
 * and refreshed 5 minutes before expiry.
 *
 * @returns {Promise<string>} OAuth2 access token for Google Sheets API
 * @throws {Error} If token generation or exchange fails
 *
 * @example
 * const token = await getAccessToken();
 * // Use token in Authorization header for Google Sheets API calls
 */
export async function getAccessToken() {
    const tokenStartTime = performance.now();

    logger.info('[Startup] 🎫 getAccessToken() called');

    // Return cached token if still valid
    if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
        const timeToExpiry = Math.floor((tokenExpiry - Date.now()) / 1000);
        logger.info('[Startup] ✅ Using cached access token');
        logger.info(`[Startup]   → Token expires in: ${timeToExpiry} seconds`);
        logger.info(`[Startup]   → Token present: Yes (length: ${cachedAccessToken.length})`);
        return cachedAccessToken;
    }

    if (cachedAccessToken) {
        logger.info('[Startup] ⚠️ Cached token expired or about to expire, generating new one');
    } else {
        logger.info('[Startup] ℹ️ No cached token, generating new one');
    }

    // Generate JWT and exchange for access token
    logger.info('[Startup] 🔄 Generating JWT...');
    const jwtStartTime = performance.now();

    let jwt;
    try {
        jwt = await generateJWT();
        const jwtCompleteTime = performance.now();
        const jwtDuration = (jwtCompleteTime - jwtStartTime).toFixed(0);
        logger.info(`[Startup] ✅ JWT generated in ${jwtDuration}ms`);
    } catch (jwtError) {
        const jwtErrorTime = performance.now();
        const errorDuration = (jwtErrorTime - jwtStartTime).toFixed(0);
        logger.error(`[Startup] ❌ JWT generation failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${jwtError.message}`);
        throw jwtError;
    }

    logger.info('[Startup] 🌐 Exchanging JWT for access token...');
    logger.info(`[Startup]   → OAuth2 endpoint: https://oauth2.googleapis.com/token`);
    logger.info(`[Startup]   → Network state: ${navigator.onLine ? 'Online' : 'Offline'}`);

    const exchangeStartTime = performance.now();

    let response;
    try {
        response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        const exchangeCompleteTime = performance.now();
        const exchangeDuration = (exchangeCompleteTime - exchangeStartTime).toFixed(0);

        logger.info(`[Startup] ✅ OAuth2 fetch completed in ${exchangeDuration}ms`);
        logger.info(`[Startup]   → Response status: ${response.status} ${response.statusText}`);
        logger.info(`[Startup]   → Response ok: ${response.ok}`);
    } catch (fetchError) {
        const exchangeErrorTime = performance.now();
        const errorDuration = (exchangeErrorTime - exchangeStartTime).toFixed(0);

        logger.error(`[Startup] ❌ OAuth2 fetch failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error type: ${fetchError.name}`);
        logger.error(`[Startup]   → Error message: ${fetchError.message}`);
        logger.error(`[Startup]   → Network state: ${navigator.onLine ? 'Online' : 'Offline'}`);
        throw fetchError;
    }

    if (!response.ok) {
        logger.error(`[Startup] ❌ OAuth2 response not OK: ${response.status} ${response.statusText}`);

        // Try to get error details
        try {
            const errorText = await response.text();
            logger.error(`[Startup]   → Response body: ${errorText}`);
        } catch (e) {
            logger.error(`[Startup]   → Could not read response body`);
        }

        throw new Error('Failed to get access token');
    }

    logger.info('[Startup] 📦 Parsing OAuth2 response...');
    const parseStartTime = performance.now();

    let data;
    try {
        data = await response.json();
        const parseCompleteTime = performance.now();
        const parseDuration = (parseCompleteTime - parseStartTime).toFixed(0);

        logger.info(`[Startup] ✅ OAuth2 response parsed in ${parseDuration}ms`);
        logger.info(`[Startup]   → Access token present: ${!!data.access_token}`);
        logger.info(`[Startup]   → Access token length: ${data.access_token ? data.access_token.length : 0}`);
        logger.info(`[Startup]   → Expires in: ${data.expires_in} seconds`);
        logger.info(`[Startup]   → Token type: ${data.token_type}`);
    } catch (parseError) {
        const parseErrorTime = performance.now();
        const errorDuration = (parseErrorTime - parseStartTime).toFixed(0);

        logger.error(`[Startup] ❌ OAuth2 response parsing failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${parseError.message}`);
        throw parseError;
    }

    cachedAccessToken = data.access_token;
    // Refresh 5 minutes before expiry for better performance
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;

    const tokenCompleteTime = performance.now();
    const totalDuration = (tokenCompleteTime - tokenStartTime).toFixed(0);

    logger.info(`[Startup] ✅ getAccessToken() complete - Total time: ${totalDuration}ms`);
    logger.info(`[Startup]   → Token cached until: ${new Date(tokenExpiry).toISOString()}`);

    return cachedAccessToken;
}

/**
 * Clear cached access token
 *
 * Invalidates the cached access token, forcing a new token to be generated
 * on the next getAccessToken() call. Useful for testing or manual refresh.
 *
 * @example
 * clearTokenCache();
 * // Next getAccessToken() call will generate fresh token
 */
export function clearTokenCache() {
    cachedAccessToken = null;
    tokenExpiry = null;
}
