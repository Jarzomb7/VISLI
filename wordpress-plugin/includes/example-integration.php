<?php
/**
 * ═══════════════════════════════════════════════════════
 * EXAMPLE: How to integrate Visli License into your
 * WordPress booking plugin.
 *
 * This file is NOT loaded by the plugin — it's reference
 * code showing the patterns to use.
 * ═══════════════════════════════════════════════════════
 */

// ── 1. Block booking form if license is invalid ──────

add_shortcode( 'my_booking_form', function () {
    // Gate: license must be valid
    if ( ! visli_check_license() ) {
        return '<div class="booking-disabled">
            <p>System rezerwacji jest tymczasowo niedostępny.</p>
        </div>';
    }

    // Normal booking form HTML
    return '<form class="booking-form">
        <!-- your booking form here -->
        <button type="submit">Zarezerwuj</button>
    </form>';
} );


// ── 2. Block SMS sending if limit exceeded ───────────

function my_send_booking_sms( $phone, $message ) {
    // Check if we can send
    if ( ! visli_can_send_sms( 1 ) ) {
        error_log( 'Visli: SMS limit exceeded, cannot send.' );
        return false;
    }

    // Send via Twilio / SMSAPI / etc.
    $sent = my_sms_provider_send( $phone, $message );

    if ( $sent ) {
        // Track usage AFTER successful send
        visli_track_sms( 1 );
        return true;
    }

    return false;
}


// ── 3. Conditional features based on plan ────────────

function my_get_booking_features(): array {
    $plan = visli_get_plan();

    $features = array(
        'max_bookings_per_day' => 10,
        'sms_reminders'        => false,
        'custom_fields'        => false,
        'analytics'            => false,
    );

    switch ( $plan ) {
        case 'PRO':
            $features['max_bookings_per_day'] = 50;
            $features['sms_reminders']        = true;
            $features['custom_fields']        = true;
            break;

        case 'ENTERPRISE':
            $features['max_bookings_per_day'] = PHP_INT_MAX;
            $features['sms_reminders']        = true;
            $features['custom_fields']        = true;
            $features['analytics']            = true;
            break;
    }

    return $features;
}


// ── 4. Show SMS balance in admin bar ─────────────────

add_action( 'admin_bar_menu', function ( $wp_admin_bar ) {
    if ( ! current_user_can( 'manage_options' ) ) return;

    $remaining = visli_get_sms_remaining();

    $wp_admin_bar->add_node( array(
        'id'    => 'visli-sms',
        'title' => "SMS: {$remaining} left",
        'href'  => admin_url( 'options-general.php?page=visli-license' ),
    ) );
}, 100 );


// ── 5. Anti-tamper: critical booking logic ───────────
//
// The key anti-tamper principle: the booking submission
// handler MUST check the license. Without a valid license,
// the server-side processing refuses to save bookings.
// Simply removing the frontend check does NOT bypass this.

add_action( 'wp_ajax_submit_booking', function () {
    // Server-side gate — cannot be bypassed by editing JS
    if ( ! visli_check_license() ) {
        wp_send_json_error( array(
            'message' => 'License invalid. Booking disabled.',
        ), 403 );
        return;
    }

    // Verify nonce, sanitize input, save booking...
    // (your normal booking logic here)

    wp_send_json_success( array( 'message' => 'Booking saved.' ) );
} );

add_action( 'wp_ajax_nopriv_submit_booking', function () {
    if ( ! visli_check_license() ) {
        wp_send_json_error( array( 'message' => 'Service unavailable.' ), 403 );
        return;
    }

    // ... same booking logic for logged-out users
} );
