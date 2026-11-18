<?php
/**
 * Assets
 *
 * @package     SugarCommerce\Importers
 * @copyright   Copyright (c) 2026, ArrayPress Limited
 * @license     GPL-2.0-or-later
 * @since       1.0.0
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Utils;

/**
 * The library's own script and stylesheet, wherever the library was put.
 *
 * It ships inside somebody's plugin -- in `vendor/`, in a Strauss-prefixed
 * folder, in a plugin that is a symlink on a developer's machine -- so the
 * URL of `assets/` is worked out from where this file is, not assumed.
 * WordPress serves the content directory and the site root, and keeps a map
 * from each symlinked plugin's path to its real one; a folder under none of
 * those is not served, and nothing is enqueued rather than a broken URL.
 */
final class Assets {

	/**
	 * Enqueue the library's stylesheet.
	 *
	 * @param string   $handle Its handle.
	 * @param string   $file   Its path under `assets/`.
	 * @param string[] $deps   Handles it depends on.
	 *
	 * @return bool Whether it was found.
	 */
	public static function style( string $handle, string $file, array $deps = [] ): bool {
		$asset = self::resolve( $file );

		if ( null === $asset ) {
			return false;
		}

		wp_enqueue_style( $handle, $asset['url'], $deps, $asset['version'] );

		return true;
	}

	/**
	 * Enqueue the library's script, in the footer.
	 *
	 * @param string   $handle Its handle.
	 * @param string   $file   Its path under `assets/`.
	 * @param string[] $deps   Handles it depends on.
	 *
	 * @return bool Whether it was found.
	 */
	public static function script( string $handle, string $file, array $deps = [] ): bool {
		$asset = self::resolve( $file );

		if ( null === $asset ) {
			return false;
		}

		wp_enqueue_script( $handle, $asset['url'], $deps, $asset['version'], [ 'in_footer' => true ] );

		return true;
	}

	/**
	 * A file under `assets/`: its URL and a version that changes with it.
	 *
	 * @param string $file Its path under `assets/`, such as `css/importers.css`.
	 *
	 * @return array{url: string, version: string}|null Null when it is not
	 *                                                  there, would leave
	 *                                                  `assets/`, or is
	 *                                                  not served.
	 */
	public static function resolve( string $file ): ?array {
		$file = ltrim( str_replace( '\\', '/', $file ), '/' );

		if ( '' === $file || in_array( '..', explode( '/', $file ), true ) ) {
			return null;
		}

		$path = self::normalize( dirname( __DIR__, 2 ) . '/assets/' . $file );

		if ( ! is_file( $path ) ) {
			return null;
		}

		$url = self::url_of( $path );

		if ( null === $url ) {
			return null;
		}

		return [
			'url'     => $url,
			'version' => (string) ( filemtime( $path ) ?: '1' ),
		];
	}

	/**
	 * The URL of a file on disk, if WordPress serves it.
	 *
	 * @param string $path A normalised absolute path.
	 *
	 * @return string|null
	 */
	public static function url_of( string $path ): ?string {
		if ( defined( 'WP_CONTENT_DIR' ) && function_exists( 'content_url' ) ) {
			$url = self::url_within( $path, self::normalize( (string) WP_CONTENT_DIR ), content_url() );

			if ( null !== $url ) {
				return $url;
			}
		}

		if ( defined( 'ABSPATH' ) && function_exists( 'site_url' ) ) {
			$url = self::url_within( $path, self::normalize( (string) ABSPATH ), site_url( '/' ) );

			if ( null !== $url ) {
				return $url;
			}
		}

		// A symlinked plugin: __DIR__ is the real path, which can be
		// anywhere on disk. Core keeps a map from each plugin's path under
		// the content directory to its real one, and plugins_url() reads it.
		foreach ( (array) ( $GLOBALS['wp_plugin_paths'] ?? [] ) as $plugin_path => $real_path ) {
			$real_path = rtrim( self::normalize( (string) $real_path ), '/' );

			if ( '' === $real_path || ! str_starts_with( $path, $real_path . '/' ) ) {
				continue;
			}

			$mapped = rtrim( self::normalize( (string) $plugin_path ), '/' ) . substr( $path, strlen( $real_path ) );

			if ( defined( 'WP_CONTENT_DIR' ) && function_exists( 'content_url' ) ) {
				$url = self::url_within( $mapped, self::normalize( (string) WP_CONTENT_DIR ), content_url() );

				if ( null !== $url ) {
					return $url;
				}
			}
		}

		return null;
	}

	/**
	 * The URL of a path, if it sits under a folder whose URL is known.
	 *
	 * @param string $path     Normalised absolute path.
	 * @param string $base     Normalised base folder.
	 * @param string $base_url The base folder's URL.
	 *
	 * @return string|null
	 */
	private static function url_within( string $path, string $base, string $base_url ): ?string {
		$base = rtrim( $base, '/' );

		if ( '' === $base || ! str_starts_with( $path, $base . '/' ) ) {
			return null;
		}

		return rtrim( $base_url, '/' ) . substr( $path, strlen( $base ) );
	}

	/**
	 * A path with forward slashes and no doubled ones.
	 *
	 * @param string $path The path.
	 *
	 * @return string
	 */
	private static function normalize( string $path ): string {
		return (string) preg_replace( '#/+#', '/', str_replace( '\\', '/', $path ) );
	}
}
