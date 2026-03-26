<?php
/**
 * Visli_Admin — WordPress admin settings page for license management.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Visli_Admin {

    private static $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
            self::$instance->hooks();
        }
        return self::$instance;
    }

    private function hooks(): void {
        add_action( 'admin_menu', array( $this, 'add_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_notices', array( $this, 'license_notice' ) );
        add_action( 'admin_post_visli_activate', array( $this, 'handle_activate' ) );
        add_action( 'admin_post_visli_validate', array( $this, 'handle_validate' ) );
    }

    public function add_menu(): void {
        add_options_page(
            'Visli License',
            'Visli License',
            'manage_options',
            'visli-license',
            array( $this, 'render_page' )
        );
    }

    public function register_settings(): void {
        register_setting( 'visli_settings', 'visli_license_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        register_setting( 'visli_settings', 'visli_api_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
    }

    /**
     * Show admin notice when license is invalid.
     */
    public function license_notice(): void {
        $license_key = get_option( 'visli_license_key', '' );

        if ( empty( $license_key ) ) {
            echo '<div class="notice notice-warning"><p>';
            echo '<strong>Visli:</strong> Klucz licencji nie jest skonfigurowany. ';
            echo '<a href="' . admin_url( 'options-general.php?page=visli-license' ) . '">Skonfiguruj teraz</a>.';
            echo '</p></div>';
            return;
        }

        if ( ! Visli_License::instance()->is_valid() ) {
            echo '<div class="notice notice-error"><p>';
            echo '<strong>Visli:</strong> Licencja jest nieaktywna lub wygasła. Rezerwacje i SMS-y są wyłączone. ';
            echo '<a href="' . admin_url( 'options-general.php?page=visli-license' ) . '">Sprawdź licencję</a>.';
            echo '</p></div>';
        }
    }

    public function handle_activate(): void {
        check_admin_referer( 'visli_activate_nonce' );
        $result = Visli_License::instance()->activate();
        $redirect = admin_url( 'options-general.php?page=visli-license' );
        $redirect = add_query_arg( 'visli_activated', $result ? '1' : '0', $redirect );
        wp_safe_redirect( $redirect );
        exit;
    }

    public function handle_validate(): void {
        check_admin_referer( 'visli_validate_nonce' );
        $result = Visli_License::instance()->validate();
        $redirect = admin_url( 'options-general.php?page=visli-license' );
        $redirect = add_query_arg( 'visli_validated', $result ? '1' : '0', $redirect );
        wp_safe_redirect( $redirect );
        exit;
    }

    public function render_page(): void {
        $license_key = get_option( 'visli_license_key', '' );
        $api_key     = get_option( 'visli_api_key', '' );
        $lic         = Visli_License::instance();
        $is_valid    = ! empty( $license_key ) ? $lic->is_valid() : false;
        $plan        = $lic->get_plan();
        $sms_left    = $lic->get_sms_remaining();

        // Flash messages
        if ( isset( $_GET['visli_activated'] ) ) {
            echo $_GET['visli_activated'] === '1'
                ? '<div class="notice notice-success"><p>Licencja aktywowana pomyślnie!</p></div>'
                : '<div class="notice notice-error"><p>Aktywacja nie powiodła się. Sprawdź klucz.</p></div>';
        }
        if ( isset( $_GET['visli_validated'] ) ) {
            echo $_GET['visli_validated'] === '1'
                ? '<div class="notice notice-success"><p>Licencja zwalidowana — OK.</p></div>'
                : '<div class="notice notice-error"><p>Walidacja nie powiodła się.</p></div>';
        }
        ?>
        <div class="wrap">
            <h1>Visli License</h1>

            <!-- Status Box -->
            <div style="background:#fff;border:1px solid #ccd0d4;border-radius:8px;padding:20px;margin:20px 0;max-width:600px;">
                <h2 style="margin-top:0;">Status licencji</h2>
                <table class="form-table">
                    <tr>
                        <th>Status</th>
                        <td>
                            <?php if ( $is_valid ): ?>
                                <span style="color:#00a32a;font-weight:bold;">● Aktywna</span>
                            <?php else: ?>
                                <span style="color:#d63638;font-weight:bold;">● Nieaktywna</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th>Plan</th>
                        <td><code><?php echo esc_html( $plan ); ?></code></td>
                    </tr>
                    <tr>
                        <th>SMS pozostało</th>
                        <td><strong><?php echo esc_html( $sms_left ); ?></strong></td>
                    </tr>
                    <tr>
                        <th>Domena</th>
                        <td><code><?php echo esc_html( Visli_API::get_domain() ); ?></code></td>
                    </tr>
                </table>

                <div style="display:flex;gap:10px;margin-top:10px;">
                    <form method="post" action="<?php echo admin_url( 'admin-post.php' ); ?>">
                        <?php wp_nonce_field( 'visli_activate_nonce' ); ?>
                        <input type="hidden" name="action" value="visli_activate">
                        <input type="submit" class="button button-primary" value="Aktywuj licencję">
                    </form>
                    <form method="post" action="<?php echo admin_url( 'admin-post.php' ); ?>">
                        <?php wp_nonce_field( 'visli_validate_nonce' ); ?>
                        <input type="hidden" name="action" value="visli_validate">
                        <input type="submit" class="button" value="Sprawdź teraz">
                    </form>
                </div>
            </div>

            <!-- Settings Form -->
            <form method="post" action="options.php" style="max-width:600px;">
                <?php settings_fields( 'visli_settings' ); ?>

                <table class="form-table">
                    <tr>
                        <th><label for="visli_license_key">Klucz licencji</label></th>
                        <td>
                            <input type="text" id="visli_license_key" name="visli_license_key"
                                   value="<?php echo esc_attr( $license_key ); ?>"
                                   class="regular-text" placeholder="VISLI-XXXXX-XXXXX-XXXXX-XXXXX"
                                   style="font-family:monospace;">
                        </td>
                    </tr>
                    <tr>
                        <th><label for="visli_api_key">Klucz API</label></th>
                        <td>
                            <input type="text" id="visli_api_key" name="visli_api_key"
                                   value="<?php echo esc_attr( $api_key ); ?>"
                                   class="regular-text" placeholder="vsk_..."
                                   style="font-family:monospace;">
                            <p class="description">Oba klucze otrzymasz po zakupie subskrypcji na panel.visli.pl</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button( 'Zapisz ustawienia' ); ?>
            </form>
        </div>
        <?php
    }
}
