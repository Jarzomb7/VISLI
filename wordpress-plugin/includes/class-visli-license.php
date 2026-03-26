<?php
/**
 * Visli_License — Core license state management.
 *
 * Security features:
 *  - Encrypted local cache (max 24h)
 *  - Random revalidation intervals (server-provided)
 *  - Automatic feature blocking on invalid license
 *  - Domain mismatch detection
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Visli_License {

    private static $instance = null;
    private $cache_key = 'visli_license_cache';
    private $cache_expiry_key = 'visli_license_cache_expiry';
    private $max_cache_hours = 24;

    public static function instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // ═══════════════════════════════════════════════
    //  PUBLIC FUNCTIONS (use these in your plugin)
    // ═══════════════════════════════════════════════

    /**
     * Is the license currently valid?
     * Reads from encrypted cache first, falls back to API.
     */
    public function is_valid(): bool {
        $cached = $this->get_cache();
        if ( $cached !== false ) {
            return $cached['valid'] === true;
        }

        // Cache expired or missing — revalidate
        $result = $this->validate();
        return $result === true;
    }

    /**
     * Can the user send SMS? (checks SMS balance)
     */
    public function can_send_sms( int $count = 1 ): bool {
        if ( ! $this->is_valid() ) {
            return false;
        }

        $cached = $this->get_cache();
        if ( $cached && isset( $cached['sms'] ) ) {
            return $cached['sms']['remaining'] >= $count;
        }

        return false;
    }

    /**
     * Track SMS usage (call AFTER successfully sending SMS).
     *
     * @param int $count Number of SMS sent.
     * @return bool True if tracked successfully.
     */
    public function track_sms( int $count = 1 ): bool {
        $result = Visli_API::post( '/api/sms/track', array( 'count' => $count ) );

        if ( is_wp_error( $result ) ) {
            error_log( 'Visli SMS track error: ' . $result->get_error_message() );
            return false;
        }

        if ( ! empty( $result['success'] ) && isset( $result['sms'] ) ) {
            $this->update_sms_cache( $result['sms'] );
            return true;
        }

        return false;
    }

    /**
     * Get current plan name.
     */
    public function get_plan(): string {
        $cached = $this->get_cache();
        if ( $cached && isset( $cached['license']['plan'] ) ) {
            return $cached['license']['plan'];
        }
        return 'NONE';
    }

    /**
     * Get SMS remaining count.
     */
    public function get_sms_remaining(): int {
        $cached = $this->get_cache();
        if ( $cached && isset( $cached['sms']['remaining'] ) ) {
            return (int) $cached['sms']['remaining'];
        }
        return 0;
    }

    // ═══════════════════════════════════════════════
    //  VALIDATION
    // ═══════════════════════════════════════════════

    /**
     * Call the API to validate the license.
     * Stores result in encrypted cache.
     *
     * @return bool True if valid.
     */
    public function validate(): bool {
        $result = Visli_API::post( '/api/license/validate' );

        if ( is_wp_error( $result ) ) {
            error_log( 'Visli validation error: ' . $result->get_error_message() );

            // If we have a non-expired cache, use it (offline tolerance)
            $cached = $this->get_cache();
            if ( $cached !== false ) {
                return $cached['valid'] === true;
            }

            // No cache, no connection — block
            $this->set_cache( array( 'valid' => false ) );
            return false;
        }

        $valid = ! empty( $result['valid'] );

        // Store in cache
        $this->set_cache( $result );

        // Update next validation interval from server
        if ( isset( $result['nextValidationMs'] ) ) {
            $seconds = max( 4 * 3600, intval( $result['nextValidationMs'] / 1000 ) );
            update_option( 'visli_next_validation_seconds', $seconds );

            // Reschedule cron
            wp_clear_scheduled_hook( 'visli_validate_license_cron' );
            wp_schedule_single_event( time() + $seconds, 'visli_validate_license_cron' );
        }

        if ( ! $valid ) {
            do_action( 'visli_license_invalid' );
        }

        return $valid;
    }

    /**
     * Activate the license (bind to this domain).
     */
    public function activate(): bool {
        $result = Visli_API::post( '/api/license/activate' );

        if ( is_wp_error( $result ) ) {
            error_log( 'Visli activation error: ' . $result->get_error_message() );
            return false;
        }

        if ( ! empty( $result['success'] ) ) {
            // Immediately validate to populate cache
            return $this->validate();
        }

        return false;
    }

    // ═══════════════════════════════════════════════
    //  ENCRYPTED CACHE
    // ═══════════════════════════════════════════════

    private function get_cache() {
        $expiry = get_option( $this->cache_expiry_key, 0 );

        // Hard limit: 24 hours
        if ( time() > $expiry ) {
            delete_option( $this->cache_key );
            delete_option( $this->cache_expiry_key );
            return false;
        }

        $encrypted = get_option( $this->cache_key, '' );
        if ( empty( $encrypted ) ) {
            return false;
        }

        $data = $this->decrypt( $encrypted );
        if ( ! $data ) {
            return false;
        }

        return $data;
    }

    private function set_cache( array $data ): void {
        $encrypted = $this->encrypt( $data );
        $ttl = min( $this->max_cache_hours * 3600, 8 * 3600 ); // max 8h, hard cap 24h

        update_option( $this->cache_key, $encrypted );
        update_option( $this->cache_expiry_key, time() + $ttl );
    }

    private function update_sms_cache( array $sms_data ): void {
        $cached = $this->get_cache();
        if ( $cached !== false ) {
            $cached['sms'] = $sms_data;
            $this->set_cache( $cached );
        }
    }

    /**
     * Simple AES-256-CBC encryption using a site-specific key.
     */
    private function encrypt( array $data ): string {
        $key = $this->get_encryption_key();
        $json = json_encode( $data );
        $iv = openssl_random_pseudo_bytes( 16 );
        $encrypted = openssl_encrypt( $json, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv );
        return base64_encode( $iv . $encrypted );
    }

    private function decrypt( string $data ) {
        $key = $this->get_encryption_key();
        $raw = base64_decode( $data );
        if ( strlen( $raw ) < 17 ) return false;

        $iv = substr( $raw, 0, 16 );
        $encrypted = substr( $raw, 16 );
        $json = openssl_decrypt( $encrypted, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv );

        if ( $json === false ) return false;
        return json_decode( $json, true );
    }

    private function get_encryption_key(): string {
        // Derive from WP auth salts + HMAC secret for site-specific key
        $salt = defined( 'AUTH_SALT' ) ? AUTH_SALT : 'visli-default-salt';
        return hash( 'sha256', $salt . VISLI_HMAC_SECRET, true );
    }
}

// ═══════════════════════════════════════════════════════
//  GLOBAL HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Check if the Visli license is valid.
 * Usage: if ( visli_check_license() ) { ... }
 */
function visli_check_license(): bool {
    return Visli_License::instance()->is_valid();
}

/**
 * Check if the user can send N SMS messages.
 * Usage: if ( visli_can_send_sms( 1 ) ) { ... }
 */
function visli_can_send_sms( int $count = 1 ): bool {
    return Visli_License::instance()->can_send_sms( $count );
}

/**
 * Track SMS usage after sending.
 * Usage: visli_track_sms( 1 );
 */
function visli_track_sms( int $count = 1 ): bool {
    return Visli_License::instance()->track_sms( $count );
}

/**
 * Get current plan name.
 * Usage: $plan = visli_get_plan();
 */
function visli_get_plan(): string {
    return Visli_License::instance()->get_plan();
}

/**
 * Get remaining SMS count.
 */
function visli_get_sms_remaining(): int {
    return Visli_License::instance()->get_sms_remaining();
}
