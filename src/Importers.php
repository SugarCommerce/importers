<?php
/**
 * Importers
 *
 * @package     SugarCommerce\Importers
 * @copyright   Copyright (c) 2026, ArrayPress Limited
 * @license     GPL2+
 * @since       1.0.0
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers;

use SugarCommerce\Importers\Csv\Upload;
use SugarCommerce\Importers\Rest\Controller;
use SugarCommerce\Importers\Utils\Runtime;

/**
 * The registered import screens, and the hooks they share.
 */
final class Importers {

	/**
	 * The screens, by identifier.
	 *
	 * @var array<string, Importer>
	 */
	private static array $importers = [];

	/**
	 * Whether the shared hooks are attached.
	 *
	 * @var bool
	 */
	private static bool $hooked = false;

	/**
	 * Register a screen.
	 *
	 * @param string               $id     Its identifier.
	 * @param array<string, mixed> $config Its configuration.
	 *
	 * @return Importer|null Null when there is nothing for it to import.
	 */
	public static function register( string $id, array $config ): ?Importer {
		$id = sanitize_key( $id );

		if ( '' === $id || [] === (array) ( $config['operations'] ?? [] ) ) {
			return null;
		}

		self::hook();

		$importer = new Importer( $id, $config );

		self::$importers[ $id ] = $importer;

		// Registered from inside an `admin_menu` callback, or after it, the
		// shared menu hook has already run (or, added at the priority now
		// running, never will this request), so the page goes on the menu
		// here instead. REST requests never fire `admin_menu`, so uploads
		// still need the screen registered on `init`.
		if ( doing_action( 'admin_menu' ) || did_action( 'admin_menu' ) ) {
			$importer->register_menu();
		}

		return $importer;
	}

	/**
	 * Attach the hooks every screen shares, once.
	 *
	 * @return void
	 */
	private static function hook(): void {
		if ( self::$hooked ) {
			return;
		}

		self::$hooked = true;

		add_action( 'admin_menu', [ __CLASS__, 'register_menus' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue' ] );

		Controller::boot();

		// Files outlive the transients that describe them, and an import
		// nobody finished leaves a customer list on disk. Once a day is
		// often enough for something with a lifetime of a day.
		add_action( Runtime::hook( 'sweep' ), [ Upload::class, 'sweep' ] );

		if ( ! wp_next_scheduled( Runtime::hook( 'sweep' ) ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', Runtime::hook( 'sweep' ) );
		}
	}

	/**
	 * A registered screen.
	 *
	 * What `get_registered_importers()` was, and named for what it returns:
	 * the library once called it `get_importers()`, which WordPress core
	 * already declares in `wp-admin/includes/import.php`, and a static
	 * method cannot collide with a global function however it is named.
	 *
	 * @param string $id Its identifier.
	 *
	 * @return Importer|null
	 */
	public static function get( string $id ): ?Importer {
		return self::$importers[ sanitize_key( $id ) ] ?? null;
	}

	/**
	 * A screen's admin URL, for linking to it.
	 *
	 * @param string $id  Its identifier.
	 * @param string $tab A tab to open on, or '' for the first.
	 *
	 * @return string '' when there is no such screen.
	 */
	public static function url( string $id, string $tab = '' ): string {
		return self::get( $id )?->url( $tab ) ?? '';
	}

	/**
	 * Every registered screen.
	 *
	 * @return array<string, Importer>
	 */
	public static function all(): array {
		return self::$importers;
	}

	/**
	 * Forget one.
	 *
	 * @param string $id Its identifier.
	 *
	 * @return bool
	 */
	public static function unregister( string $id ): bool {
		$id = sanitize_key( $id );

		if ( ! isset( self::$importers[ $id ] ) ) {
			return false;
		}

		unset( self::$importers[ $id ] );

		return true;
	}

	/**
	 * The screen being looked at, if any.
	 *
	 * @return Importer|null
	 */
	public static function current(): ?Importer {
		foreach ( self::$importers as $importer ) {
			if ( $importer->is_current() ) {
				return $importer;
			}
		}

		return null;
	}

	/**
	 * Put every screen on the menu.
	 *
	 * @return void
	 */
	public static function register_menus(): void {
		foreach ( self::$importers as $importer ) {
			// Already on the menu: it was registered while this hook ran.
			if ( '' !== $importer->hook() ) {
				continue;
			}

			$importer->register_menu();
		}
	}

	/**
	 * Load what the screen being looked at needs.
	 *
	 * @return void
	 */
	public static function enqueue(): void {
		self::current()?->enqueue();
	}
}
