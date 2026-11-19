<?php
/**
 * Tab and operation icon tests.
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Tests;

use SugarCommerce\Fields\Icons\Icons;
use SugarCommerce\Importers\Importer;
use SugarCommerce\Importers\Importers;
use SugarCommerce\Importers\Screen;
use PHPUnit\Framework\TestCase;

/**
 * A tab's and an operation's `icon` take two forms: a bare Dashicons name,
 * which is what they always took and must draw exactly as it did, and a
 * `set:name` value (`heroicons-outline:users`), drawn as inline SVG by
 * wp-field-kit. An operation that names no icon gets Heroicons' upload tray.
 */
final class IconTest extends TestCase {

	/**
	 * Reset the stubbed globals and the registry.
	 */
	protected function setUp(): void {
		ri_reset_globals();
		unset( $_GET['tab'] );
	}

	/**
	 * And the tab.
	 */
	protected function tearDown(): void {
		unset( $_GET['tab'] );
	}

	/**
	 * The screen for one operation, drawn.
	 *
	 * @param array<string, mixed> $operation Its overrides.
	 * @param array<string, mixed> $config    The screen's.
	 *
	 * @return string
	 */
	private function screen( array $operation = [], array $config = [] ): string {
		$importer = Importers::register(
			'myplugin',
			array_merge(
				[
					'operations' => [
						'products' => array_merge(
							[
								'title'            => 'Products',
								'fields'           => [ 'sku' => 'Code' ],
								'process_callback' => '__return_true',
							],
							$operation
						),
					],
				],
				$config
			)
		);

		$this->assertInstanceOf( Importer::class, $importer );

		ob_start();

		try {
			( new Screen( $importer ) )->render();
		} finally {
			$html = (string) ob_get_clean();
		}

		return $html;
	}

	/**
	 * The operation's heading: the icon in its tile, a space, the title.
	 *
	 * The icon has a tile of its own beside the title rather than sitting in
	 * the heading's text, so the two are read back together here to keep
	 * each assertion one string.
	 *
	 * @param string $html The screen.
	 *
	 * @return string
	 */
	private static function heading( string $html ): string {
		preg_match( '#<span class="importers__head-icon">(.*?)</span><div class="importers__head-text"><h2 class="importers__title">(.*?)</h2>#s', $html, $match );

		return ltrim( ( $match[1] ?? '' ) . ' ' . ( $match[2] ?? '' ) );
	}

	/**
	 * With no icon named, the heading has Heroicons' upload tray.
	 */
	public function test_the_default_operation_icon_is_heroicons(): void {
		$heading = self::heading( $this->screen() );

		$this->assertSame( Icons::render( 'heroicons-outline:arrow-up-tray' ) . ' Products', $heading );
		$this->assertStringStartsWith( '<svg ', $heading );
		$this->assertStringNotContainsString( 'dashicons', $heading );
	}

	/**
	 * A `set:name` icon is inline SVG, before the title.
	 */
	public function test_a_set_operation_icon_draws_svg(): void {
		$heading = self::heading( $this->screen( [ 'icon' => 'heroicons-outline:user-group' ] ) );

		$this->assertMatchesRegularExpression( '#^<svg [^>]*class="sugarcommerce-icon"[^>]*>.*</svg> Products$#s', $heading );
		$this->assertSame( Icons::render( 'heroicons-outline:user-group' ) . ' Products', $heading );
	}

	/**
	 * A bare name is the Dashicons span it always was, in either spelling.
	 */
	public function test_a_bare_operation_icon_draws_the_dashicon(): void {
		$span = '<span class="dashicons dashicons-cart sugarcommerce-icon" aria-hidden="true"></span> Products';

		$this->assertSame( $span, self::heading( $this->screen( [ 'icon' => 'cart' ] ) ) );

		ri_reset_globals();

		$this->assertSame( $span, self::heading( $this->screen( [ 'icon' => 'dashicons-cart' ] ) ) );
	}

	/**
	 * An icon that names nothing prints nothing, not a broken span.
	 */
	public function test_an_unknown_icon_draws_nothing(): void {
		$this->assertSame( 'Products', self::heading( $this->screen( [ 'icon' => 'heroicons-outline:no-such-icon' ] ) ) );
	}

	/**
	 * Tabs take both forms too, and a tab with none has no icon at all.
	 */
	public function test_tab_icons(): void {
		$html = $this->screen(
			[ 'tab' => 'catalogue' ],
			[
				'tabs' => [
					'catalogue' => [ 'label' => 'Catalogue', 'icon' => 'heroicons-outline:users' ],
					'people'    => [ 'label' => 'People', 'icon' => 'groups' ],
					'plain'     => 'Plain',
				],
			]
		);

		preg_match_all( '#<a [^>]*class="importers__tab[^"]*"[^>]*>(.*?)</a>#s', $html, $tabs );

		$this->assertSame(
			[
				Icons::render( 'heroicons-outline:users' ) . '<span class="importers__tab-label">Catalogue</span>',
				'<span class="dashicons dashicons-groups sugarcommerce-icon" aria-hidden="true"></span><span class="importers__tab-label">People</span>',
				'<span class="importers__tab-label">Plain</span>',
			],
			$tabs[1]
		);
	}
}
