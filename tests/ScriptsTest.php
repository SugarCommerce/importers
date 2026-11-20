<?php
/**
 * Built script tests.
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Tests;

use PHPUnit\Framework\TestCase;
use SugarCommerce\Plugin\Assets;

/**
 * The script is built from src/js into assets/build, and the build is
 * committed: Composer and Strauss copy a package as it is, with nothing run
 * at install. These keep the build and the PHP that loads it in step.
 */
final class ScriptsTest extends TestCase {

	/**
	 * Every entry the PHP loads.
	 */
	private const ENTRIES = [ 'importers' ];

	/**
	 * A file of the package, for the asset helper to find it from.
	 */
	private const FILE = __DIR__ . '/../src/Importer.php';

	/**
	 * Every entry is built, with the manifest @wordpress/scripts writes
	 * beside it, and none of them needs jQuery.
	 */
	public function test_every_built_entry_has_its_manifest(): void {
		foreach ( self::ENTRIES as $entry ) {
			$manifest = Assets::built_manifest( self::FILE, $entry );

			$this->assertNotNull( $manifest, $entry );
			$this->assertFileExists( dirname( __DIR__ ) . '/assets/build/' . $entry . '.js', $entry );
			$this->assertSame( [], preg_grep( '/^(jquery|wp-util)/', $manifest['dependencies'] ), $entry );
			$this->assertContains( 'wp-dom-ready', $manifest['dependencies'], $entry );
			$this->assertMatchesRegularExpression( '/^[a-f0-9]{20}$/', (string) $manifest['version'], $entry );
		}

		$this->assertNull( Assets::built_manifest( self::FILE, 'nothing' ) );
	}

	/**
	 * The requests go through wp.apiFetch, which renews a nonce that ran
	 * out while the screen was open, and the words through wp.i18n.
	 */
	public function test_the_build_imports_api_fetch_and_i18n(): void {
		$this->assertSame(
			[ 'wp-api-fetch', 'wp-dom-ready', 'wp-i18n' ],
			Assets::built_manifest( self::FILE, 'importers' )['dependencies']
		);
	}

	/**
	 * The screen loads the build under the copy's handle, in the footer.
	 */
	public function test_the_screen_loads_the_build_under_its_handle(): void {
		$source = (string) file_get_contents( self::FILE );

		$this->assertStringContainsString( "Assets::enqueue_built_script( Runtime::handle(), __FILE__, 'importers' );", $source );
	}

	/**
	 * The sources ship beside the build, and nothing loads a script from
	 * the old hand-written folder.
	 */
	public function test_nothing_loads_the_old_script(): void {
		$this->assertDirectoryDoesNotExist( dirname( __DIR__ ) . '/assets/js' );
		$this->assertFileExists( dirname( __DIR__ ) . '/src/js/importers.js' );

		foreach ( glob( dirname( __DIR__ ) . '/src/{,*/,*/*/}*.php', GLOB_BRACE ) as $file ) {
			$this->assertStringNotContainsString( "'js/", (string) file_get_contents( $file ), basename( $file ) );
		}
	}
}
