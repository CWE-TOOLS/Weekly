/**
 * Authentication Service
 * Handles JWT generation and Google OAuth authentication for service account access
 */

import { SERVICE_ACCOUNT } from '../config/api-config.js';

// Token caching
let cachedAccessToken = null;
let tokenExpiry = null;

/**
 * Encode a string to Base64 URL-safe format
 * @param {string} str - String to encode
 * @returns {string} Base64 URL-encoded string
 */
export function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Decode a Base64 URL-safe string
 * @param {string} str - Base64 URL-encoded string
 * @returns {string} Decoded string
 */
export function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

/**
 * Generate a JWT (JSON Web Token) for service account authentication
 * @returns {Promise<string>} Signed JWT token
 */
export async function generateJWT() {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: SERVICE_ACCOUNT.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = encodedHeader + '.' + encodedPayload;

    // Extract and decode private key
    const privateKeyPem = SERVICE_ACCOUNT.private_key
        .replace(/-----BEGIN PRIVATE KEY-----\n/, '')
        .replace(/\n-----END PRIVATE KEY-----\n/, '')
        .replace(/\n/g, '');

    let privateKeyDer;
    try {
        privateKeyDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
    } catch (e) {
        console.error('Error decoding private key:', e.message);
        throw e;
    }

    // Import private key for signing
    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        false,
        ['sign']
    );

    // Sign the message
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(message)
    );

    const encodedSignature = base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
    );

    return message + '.' + encodedSignature;
}

/**
 * Get an OAuth access token for Google Sheets API
 * Uses cached token if available and not expired
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken() {
    // Return cached token if still valid
    if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedAccessToken;
    }

    // Generate JWT and exchange for access token
    const jwt = await generateJWT();
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    if (!response.ok) {
        throw new Error('Failed to get access token');
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    // Refresh 5 minutes before expiry for better performance
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;

    return cachedAccessToken;
}

/**
 * Clear cached access token (useful for testing or logout)
 */
export function clearTokenCache() {
    cachedAccessToken = null;
    tokenExpiry = null;
}
