<?php
/**
 * Run tests.
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Tests;

use SugarCommerce\Text\CsvReader;
use SugarCommerce\Importers\Csv\Sample;
use SugarCommerce\Importers\Importers;
use SugarCommerce\Importers\Rest\Controller;
use SugarCommerce\Importers\Utils\Runtime;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

/**
 * A whole import through the run endpoint, a batch at a time, as the
 * screen's script drives it: each answer's offset is the next request's.
 */
final class RunTest extends TestCase {

	/**
	 * The file being imported.
	 *
	 * @var string
	 */
	private string $path = '';

	/**
	 * Its upload id.
	 *
	 * @var string
	 */
	private string $uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';

	/**
	 * Start clean.
	 */
	protected function setUp(): void {
		ri_reset_globals();
		CsvReader::forget();
	}

	/**
	 * Remove the file.
	 */
	protected function tearDown(): void {
		if ( '' !== $this->path && is_file( $this->path ) ) {
			unlink( $this->path );
		}

		CsvReader::forget();
	}

	/**
	 * A file uploaded for the screen, as Upload::receive() leaves it.
	 *
	 * @param string $contents The CSV.
	 * @param int    $rows     How many rows it has.
	 */
	private function upload( string $contents, int $rows ): void {
		$this->path = (string) tempnam( sys_get_temp_dir(), 'scimport' );

		file_put_contents( $this->path, $contents );

		set_transient(
			Runtime::key( 'file_' . $this->uuid ),
			[
				'uuid'    => $this->uuid,
				'name'    => 'products.csv',
				'path'    => $this->path,
				'rows'    => $rows,
				'headers' => [ 'Code', 'Name' ],
				'page'    => 'myplugin',
				'user'    => 1,
			]
		);
	}

	/**
	 * Register a screen whose one operation records what it is given.
	 *
	 * @param array<string, mixed> $operation Overrides.
	 * @param array<int, string>   $seen      Codes the callback saw.
	 */
	private function screen( array $operation, array &$seen ): void {
		Importers::register(
			'myplugin',
			[
				'operations' => [
					'products' => array_merge(
						[
							'fields'           => [
								'sku'  => [
									'label'    => 'Code',
									'required' => true,
								],
								'name' => 'Name',
							],
							'process_callback' => static function ( array $row ) use ( &$seen ): string {
								$seen[] = $row['sku'];

								return 'created';
							},
						],
						$operation
					),
				],
			]
		);
	}

	/**
	 * Ask for one batch.
	 *
	 * @param int $offset Where it starts.
	 *
	 * @return array<string, mixed>
	 */
	private function batch( int $offset ): array {
		$response = Controller::run(
			new WP_REST_Request(
				[
					'page'      => 'myplugin',
					'operation' => 'products',
					'uuid'      => $this->uuid,
					'mapping'   => [
						'sku'  => 'Code',
						'name' => 'Name',
					],
					'offset'    => $offset,
					'commit'    => true,
				]
			)
		);

		$this->assertInstanceOf( \WP_REST_Response::class, $response );

		return (array) $response->get_data();
	}

	/**
	 * Every row is imported once, in order, a batch at a time.
	 */
	public function test_a_file_is_imported_in_batches(): void {
		$seen = [];

		$this->upload( "Code,Name\nA,One\nB,Two\nC,Three\nD,Four\nE,Five\n", 5 );
		$this->screen( [ 'batch_size' => 2 ], $seen );

		$first = $this->batch( 0 );
		$this->assertSame( 2, $first['offset'] );
		$this->assertFalse( $first['finished'] );

		$second = $this->batch( 2 );
		$this->assertSame( 4, $second['offset'] );
		$this->assertFalse( $second['finished'] );

		$last = $this->batch( 4 );
		$this->assertSame( 5, $last['offset'] );
		$this->assertTrue( $last['finished'] );

		$this->assertSame( [ 'A', 'B', 'C', 'D', 'E' ], $seen );
		$this->assertSame( 5, $last['progress']['created'] );
		$this->assertNotSame( 0, $last['progress']['finished'] );
	}

	/**
	 * A batch whose time is spent stops after the row it is on, says where
	 * it got to, and the next request carries on from there -- every row
	 * still imported exactly once.
	 */
	public function test_a_spent_batch_stops_early_and_resumes(): void {
		$seen = [];

		$this->upload( "Code,Name\nA,One\nB,Two\nC,Three\n", 3 );

		// A budget so small it is spent the moment the first row is done.
		$this->screen(
			[
				'batch_size' => 100,
				'time_limit' => 0.000000001,
			],
			$seen
		);

		$first = $this->batch( 0 );
		$this->assertSame( 1, $first['offset'] );
		$this->assertFalse( $first['finished'] );

		$second = $this->batch( 1 );
		$this->assertSame( 2, $second['offset'] );

		$last = $this->batch( 2 );
		$this->assertSame( 3, $last['offset'] );
		$this->assertTrue( $last['finished'] );

		$this->assertSame( [ 'A', 'B', 'C' ], $seen );
	}

	/**
	 * With no time limit a batch is its size, however slow.
	 */
	public function test_no_time_limit_runs_the_whole_batch(): void {
		$seen = [];

		$this->upload( "Code,Name\nA,One\nB,Two\nC,Three\n", 3 );
		$this->screen( [ 'time_limit' => 0 ], $seen );

		$only = $this->batch( 0 );

		$this->assertSame( 3, $only['offset'] );
		$this->assertTrue( $only['finished'] );
		$this->assertSame( [ 'A', 'B', 'C' ], $seen );
	}

	/**
	 * A malformed row is reported by the batch that reached it, not by one
	 * that stopped before it.
	 */
	public function test_a_malformed_row_is_reported_once_it_is_reached(): void {
		$seen = [];

		$this->upload( "Code,Name\nA,One\nB\n", 2 );
		$this->screen( [ 'time_limit' => 0.000000001 ], $seen );

		$first = $this->batch( 0 );
		$this->assertSame( [], $first['progress']['errors'] );

		$second = $this->batch( 1 );
		$this->assertArrayHasKey( 2, $second['progress']['errors'] );
	}

	/**
	 * A file uploaded for one screen cannot be imported through another,
	 * nor by somebody other than who uploaded it.
	 */
	public function test_a_file_belongs_to_its_screen_and_its_uploader(): void {
		$seen = [];

		$this->upload( "Code,Name\nA,One\n", 1 );
		$this->screen( [], $seen );

		$stored         = get_transient( Runtime::key( 'file_' . $this->uuid ) );
		$stored['page'] = 'another';
		set_transient( Runtime::key( 'file_' . $this->uuid ), $stored );

		$request = new WP_REST_Request(
			[
				'page'      => 'myplugin',
				'operation' => 'products',
				'uuid'      => $this->uuid,
				'mapping'   => [ 'sku' => 'Code' ],
				'offset'    => 0,
				'commit'    => true,
			]
		);

		$this->assertSame( 'wrong_screen', Controller::run( $request )->get_error_code() );

		$stored['page']  = 'myplugin';
		$stored['user']  = 2;
		set_transient( Runtime::key( 'file_' . $this->uuid ), $stored );

		$this->assertSame( 'no_such_file', Controller::run( $request )->get_error_code() );
		$this->assertSame( [], $seen );
	}

	/**
	 * The time limit defaults to twenty seconds and is never negative.
	 */
	public function test_the_time_limit(): void {
		$seen = [];

		$this->screen( [], $seen );
		$this->assertSame( 20.0, Importers::get( 'myplugin' )->operation( 'products' )->time_limit() );

		$this->screen( [ 'time_limit' => -5 ], $seen );
		$this->assertSame( 0.0, Importers::get( 'myplugin' )->operation( 'products' )->time_limit() );
	}

	/**
	 * The sample starts with a byte-order mark and cannot run as a formula
	 * in the spreadsheet it is opened in.
	 */
	public function test_the_sample_is_safe_to_open(): void {
		$sample = Sample::of(
			[
				'sku'    => [ 'example' => '=HYPERLINK("https://evil.test")' ],
				'amount' => [ 'example' => '-12.50' ],
			]
		);

		$this->assertStringStartsWith( "\xEF\xBB\xBF", $sample );
		$this->assertStringContainsString( "'=HYPERLINK", $sample );
		$this->assertStringContainsString( ',-12.50', $sample );
	}

	/**
	 * A byte-order mark in the file does not become part of the first
	 * column's name.
	 */
	public function test_the_byte_order_mark_is_not_part_of_a_header(): void {
		$this->path = (string) tempnam( sys_get_temp_dir(), 'scimport' );

		file_put_contents( $this->path, "\xEF\xBB\xBFCode,Name\nA,One\n" );

		$this->assertSame( [ 'Code', 'Name' ], ( new CsvReader( $this->path ) )->headers() );
	}
}
