<?php
/**
 * Visli_API — Handles all signed requests to api.visli.pl
 *
 * Security features:
 *  - HMAC-SHA256 request signing
 *  - Timestamp in every request (anti-replay)
 *  - Domain binding
 *  - API key authentication
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Visli_API {

    /**
     * Build the HMAC signature for a request body.
     * The server expects: HMAC of JSON-encoded body (sorted keys, excluding 'signature').
     */
    public static function sign( array $data ): string {
        // Remove signature key if present
        unset( $data['signature'] );
        // Sort by key for deterministic serialization
        ksort( $data );
        $payload = json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
        return hash_hmac( 'sha256', $payload, VISLI_HMAC_SECRET );
    }

    /**
     * Get the current site domain (normalized).
     */
    public static function get_domain(): string {
        $domain = wp_parse_url( home_url(), PHP_URL_HOST );
        $domain = strtolower( $domain );
        $domain = preg_replace( '/^www\./', '', $domain );
        return $domain;
    }

    /**
     * Send a signed POST request to the Visli API.
     *
     * @param string $endpoint  e.g. "/api/license/validate"
     * @param array  $extra     Additional body fields
     * @return array|WP_Error   Decoded response or error
     */
    public static function post( string $endpoint, array $extra = [] ) {
        $license_key = get_option( 'visli_license_key', '' );
        $api_key     = get_option( 'visli_api_key', '' );

        if ( empty( $license_key ) || empty( $api_key ) ) {
            return new WP_Error( 'visli_no_keys', 'License key or API key not configured.' );
        }

        $body = array_merge( $extra, array(
            'licenseKey' => $license_key,
            'apiKey'     => $api_key,
            'domain'     => self::get_domain(),
            'timestamp'  => (int) ( microtime( true ) * 1000 ), // milliseconds
        ) );

        // Sign
        $body['signature'] = self::sign( $body );

        $response = wp_remote_post( VISLI_API_URL . $endpoint, array(
            'timeout' => 15,
            'headers' => array( 'Content-Type' => 'application/json' ),
            'body'    => json_encode( $body, JSON_UNESCAPED_SLASHES ),
        ) );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $data = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code >= 400 ) {
            $msg = isset( $data['error'] ) ? $data['error'] : "HTTP $code";
            return new WP_Error( 'visli_api_error', $msg, array( 'status' => $code ) );
        }

        return $data;
    }
}
