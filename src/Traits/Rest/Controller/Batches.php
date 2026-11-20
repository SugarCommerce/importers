<?php
/**
 * Batches
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Traits\Rest\Controller;

use SugarCommerce\Importers\Csv\Reader;
use SugarCommerce\Importers\Operation;
use SugarCommerce\Importers\Progress;
use SugarCommerce\Importers\Row\Resolve;
use SugarCommerce\Jobs\Budget;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Checking and importing a file a batch at a time, with the columns
 * matched as the person matched them, and the progress so far.
 */
trait Batches {

	/**
	 * Do one batch, for real or as a rehearsal.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function run( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$operation = self::operation( $request );

		if ( $operation instanceof WP_Error ) {
			return self::failed( $operation );
		}

		$file = self::file( $request );

		if ( $file instanceof WP_Error ) {
			return self::failed( $file );
		}

		$commit  = (bool) $request->get_param( 'commit' );
		$offset  = (int) $request->get_param( 'offset' );
		$mapping = self::mapping( (array) $request->get_param( 'mapping' ), $operation );

		if ( $mapping instanceof WP_Error ) {
			return self::failed( $mapping );
		}

		$progress = new Progress( (string) $file['uuid'] . ( $commit ? '' : '_check' ) );

		if ( 0 === $offset ) {
			$progress->begin( (int) $file['rows'] );

			if ( $commit && is_callable( $operation->get( 'before_import' ) ) ) {
				call_user_func( $operation->get( 'before_import' ), $file );
			}
		}

		$batch = ( new Reader( (string) $file['path'], (string) $operation->get( 'separator', ',' ) ) )
			->batch( $offset, $operation->batch_size() );

		if ( $batch instanceof WP_Error ) {
			return self::failed( $batch );
		}

		// A term created earlier in this run is a term this batch should
		// find, and a batch is its own request, so the memo starts empty.
		Resolve::forget();

		$outcomes = [];
		$errors   = [];
		$done     = 0;

		// A row limit alone does not bound a request whose rows are slow:
		// a hundred rows that each call a payment API is a request the host
		// kills halfway through a row. The batch stops when its time is
		// spent -- after at least one row, so it always moves -- and the
		// next request starts from the row it reached.
		$budget = new Budget( $operation->time_limit() );

		foreach ( $batch['rows'] as $index => $row ) {
			if ( $done > 0 && $budget->spent() ) {
				break;
			}

			++$done;

			$number = $offset + $index + 1;
			$result = $operation->row( self::map( $row, $mapping ), $commit );

			if ( $result instanceof WP_Error ) {
				$outcomes[]        = null;
				$errors[ $number ] = $result->get_error_message();

				continue;
			}

			$outcomes[] = $result;
		}

		foreach ( $batch['malformed'] as $malformed ) {
			if ( $malformed >= $offset + $done ) {
				continue;
			}

			$errors[ $malformed + 1 ] = __( 'This row does not have the same number of columns as the header.', 'sugarcommerce' );
		}

		$state    = $progress->add( $outcomes, $errors );
		$finished = $done === $batch['count'] && ! $batch['has_more'];

		if ( $finished ) {
			$state = $progress->finish();

			if ( $commit && is_callable( $operation->get( 'after_import' ) ) ) {
				call_user_func( $operation->get( 'after_import' ), $state, $file );
			}
		}

		return rest_ensure_response(
			[
				'offset'   => $offset + $done,
				'finished' => $finished,
				'progress' => $state,
			]
		);
	}

	/**
	 * What has happened so far.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function progress( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$file = self::file( $request );

		if ( $file instanceof WP_Error ) {
			return self::failed( $file );
		}

		return rest_ensure_response(
			[ 'progress' => ( new Progress( (string) $file['uuid'] ) )->read() ]
		);
	}

	/**
	 * Check the column mapping covers what has to be covered.
	 *
	 * @param array<string, mixed> $mapping   Field key => column name.
	 * @param Operation            $operation The operation.
	 *
	 * @return array<string, string>|WP_Error
	 */
	private static function mapping( array $mapping, Operation $operation ): array|WP_Error {
		$clean = [];

		foreach ( $operation->fields() as $key => $field ) {
			$column = trim( (string) ( $mapping[ $key ] ?? '' ) );

			if ( '' !== $column ) {
				$clean[ $key ] = $column;
			}
		}

		$missing = array_diff( $operation->required(), array_keys( $clean ) );

		if ( [] !== $missing ) {
			$labels = array_map(
				static fn( string $key ): string => (string) ( $operation->fields()[ $key ]['label'] ?? $key ),
				$missing
			);

			return new WP_Error(
				'unmapped_columns',
				sprintf(
					/* translators: %s: the columns that still need a source. */
					__( 'These columns still need a column from the file: %s.', 'sugarcommerce' ),
					implode( ', ', $labels )
				)
			);
		}

		return $clean;
	}

	/**
	 * Turn a row of the file into a row of field keys.
	 *
	 * @param array<string, string> $row     The row, keyed by the file's headers.
	 * @param array<string, string> $mapping Field key => column name.
	 *
	 * @return array<string, mixed>
	 */
	private static function map( array $row, array $mapping ): array {
		$mapped = [];

		foreach ( $mapping as $key => $column ) {
			$mapped[ $key ] = $row[ $column ] ?? null;
		}

		return $mapped;
	}

	/**
	 * Give an error a status, so the browser can tell a refusal from a bug.
	 *
	 * @param WP_Error $error The error.
	 *
	 * @return WP_Error
	 */
	private static function failed( WP_Error $error ): WP_Error {
		$error->add_data( [ 'status' => 400 ], $error->get_error_code() );

		return $error;
	}
}
