<?php
/**
 * The screen's markup, as a whole.
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Tests;

use SugarCommerce\Importers\Importers;
use SugarCommerce\Importers\Screen;
use PHPUnit\Framework\TestCase;

/**
 * The script builds the matching rows and the results from what the screen
 * prints -- the columns' `data-*`, the regions, the actions, the segments --
 * and the stylesheet hangs off its classes. A change to the markup is a
 * change to both, so it is compared whole against a snapshot, one tag to a
 * line so a diff says what moved.
 *
 * A deliberate change is recorded with `UPDATE_SNAPSHOTS=1 composer test`,
 * and the snapshot's diff is then read like any other.
 */
final class ScreenSnapshotTest extends TestCase {

	/**
	 * Where the snapshots are kept.
	 */
	private const DIRECTORY = __DIR__ . '/snapshots';

	/**
	 * Reset the stubbed globals and the registry.
	 */
	protected function setUp(): void {
		ri_reset_globals();
		$_GET['tab'] = 'catalogue';
	}

	/**
	 * And the tab.
	 */
	protected function tearDown(): void {
		unset( $_GET['tab'] );
	}

	/**
	 * Two tabs, one operation on the current one, columns of every kind
	 * the table describes: required and not, an example, a date format,
	 * a separator, a list of options.
	 */
	public function test_the_screen(): void {
		Importers::register(
			'myplugin',
			[
				'page_title'  => 'Import',
				'description' => 'Bring your catalogue in from a spreadsheet.',
				'tabs'        => [
					'catalogue' => [
						'label' => 'Catalogue',
						'icon'  => 'heroicons-outline:shopping-bag',
					],
					'people'    => [
						'label' => 'People',
						'icon'  => 'groups',
					],
				],
				'operations'  => [
					'products'  => [
						'title'            => 'Products',
						'description'      => 'Each row adds a product, or updates the one with its code.',
						'tab'              => 'catalogue',
						'icon'             => 'heroicons-outline:cube',
						'fields'           => [
							'sku'      => [
								'label'    => 'Code',
								'required' => true,
								'example'  => 'TSHIRT-RED',
							],
							'price'    => [
								'label'   => 'Price',
								'type'    => 'number',
								'example' => '19.99',
							],
							'released' => [
								'label'       => 'Released',
								'type'        => 'date',
								'date_format' => 'd/m/Y',
							],
							'tags'     => [
								'label'     => 'Tags',
								'separator' => '|',
							],
							'status'   => [
								'label'   => 'Status',
								'options' => [ 'draft', 'publish' ],
							],
						],
						'process_callback' => '__return_true',
					],
					'customers' => [
						'tab'              => 'people',
						'fields'           => [ 'email' => 'Email' ],
						'process_callback' => '__return_true',
					],
				],
			]
		);

		$this->assertSnapshot( 'screen', $this->draw() );
	}

	/**
	 * An operation with no callback: the warning, and Upload disabled.
	 */
	public function test_an_operation_that_cannot_run(): void {
		unset( $_GET['tab'] );

		Importers::register(
			'myplugin',
			[
				'operations' => [
					'products' => [
						'title'  => 'Products',
						'fields' => [ 'sku' => 'Code' ],
					],
				],
			]
		);

		$this->assertSnapshot( 'not-runnable', $this->draw() );
	}

	/**
	 * The screen, drawn.
	 *
	 * @return string
	 */
	private function draw(): string {
		ob_start();

		try {
			( new Screen( Importers::get( 'myplugin' ) ) )->render();
		} finally {
			$html = (string) ob_get_clean();
		}

		return $html;
	}

	/**
	 * Compare against a snapshot, or record it when asked to.
	 *
	 * @param string $name The snapshot.
	 * @param string $html The markup.
	 */
	private function assertSnapshot( string $name, string $html ): void {
		// One tag to a line, and the SVG paths left out: an icon set's
		// drawing is the icon set's business, and a path is a line nobody
		// can read in a diff.
		$readable = (string) preg_replace( '#(<path [^>]*?) d="[^"]*"#', '$1 d="…"', $html );
		$readable = str_replace( '><', ">\n<", $readable ) . "\n";

		$file = self::DIRECTORY . '/' . $name . '.html';

		if ( '1' === getenv( 'UPDATE_SNAPSHOTS' ) || ! is_file( $file ) ) {
			if ( ! is_dir( self::DIRECTORY ) ) {
				mkdir( self::DIRECTORY, 0777, true );
			}

			file_put_contents( $file, $readable );

			$this->markTestIncomplete( sprintf( 'Recorded the %s snapshot; read its diff, then run again.', $name ) );
		}

		$this->assertSame( (string) file_get_contents( $file ), $readable );
	}
}
