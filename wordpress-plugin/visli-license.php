<?php
/**
 * Plugin Name: Visli License Integration
 * Description: License validation and SMS tracking for Visli-powered WordPress plugins.
 * Version: 1.0.0
 * Author: Visli
 * License: Proprietary
 * Text Domain: visli-license
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'VISLI_VERSION', '1.0.0' );
define( 'VISLI_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'VISLI_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// ══════════════════════════════════════════════════════════
//  CONFIGURATION — set these in wp-config.php or below
// ══════════════════════════════════════════════════════════

if ( ! defined( 'VISLI_API_URL' ) ) {
    define( 'VISLI_API_URL', 'https://api.visli.pl' );
}

if ( ! defined( 'VISLI_HMAC_SECRET' ) ) {
    // MUST match API_HMAC_SECRET on the server
    define( 'VISLI_HMAC_SECRET', 'CHANGE-ME-must-match-server' );
}

require_once VISLI_PLUGIN_DIR . 'includes/class-visli-api.php';
require_once VISLI_PLUGIN_DIR . 'includes/class-visli-license.php';
require_once VISLI_PLUGIN_DIR . 'includes/class-visli-admin.php';

// Initialize
add_action( 'plugins_loaded', function () {
    Visli_License::instance();
    if ( is_admin() ) {
        Visli_Admin::instance();
    }
});

// Cron for periodic validation
register_activation_hook( __FILE__, function () {
    if ( ! wp_next_scheduled( 'visli_validate_license_cron' ) ) {
        wp_schedule_event( time(), 'visli_random_interval', 'visli_validate_license_cron' );
    }
});

register_deactivation_hook( __FILE__, function () {
    wp_clear_scheduled_hook( 'visli_validate_license_cron' );
});

// Custom cron interval: 4-8 hours (randomized anti-tamper)
add_filter( 'cron_schedules', function ( $schedules ) {
    $interval = get_option( 'visli_next_validation_seconds', 6 * HOUR_IN_SECONDS );
    $schedules['visli_random_interval'] = array(
        'interval' => max( 4 * HOUR_IN_SECONDS, min( $interval, 8 * HOUR_IN_SECONDS ) ),
        'display'  => 'Visli Random Validation Interval',
    );
    return $schedules;
});

add_action( 'visli_validate_license_cron', function () {
    Visli_License::instance()->validate();
});
