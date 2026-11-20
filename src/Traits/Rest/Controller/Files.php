<?php
/**
 * Files
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Traits\Rest\Controller;

use SugarCommerce\Importers\Csv\Reader;
use SugarCommerce\Importers\Csv\Upload;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The file routes: an upload, its preview, throwing it away, and the
 * sample file.
 */
trait Files {

	/**
	 * Take a file.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function upload( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$stored = Upload::receive( (string) $request->get_param( 'page' ) );

		if ( $stored instanceof WP_Error ) {
			return self::failed( $stored );
		}

		unset( $stored['path'], $stored['user'] );

		return rest_ensure_response( $stored );
	}

	/**
	 * The first few rows of a file, to check the columns line up.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function preview( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$file = self::file( $request );

		if ( $file instanceof WP_Error ) {
			return self::failed( $file );
		}

		$batch = ( new Reader( (string) $file['path'] ) )->batch( 0, 5 );

		if ( $batch instanceof WP_Error ) {
			return self::failed( $batch );
		}

		return rest_ensure_response(
			[
				'headers'   => $file['headers'],
				'rows'      => $batch['rows'],
				'malformed' => $batch['malformed'],
				'total'     => $file['rows'],
			]
		);
	}

	/**
	 * Throw a file away.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response
	 */
	public static function discard( WP_REST_Request $request ): WP_REST_Response {
		return rest_ensure_response(
			[ 'discarded' => Upload::discard( (string) $request->get_param( 'uuid' ) ) ]
		);
	}

	/**
	 * A file showing what an operation expects.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function sample( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$operation = self::operation( $request );

		if ( $operation instanceof WP_Error ) {
			return self::failed( $operation );
		}

		return rest_ensure_response(
			[
				'filename' => $operation->sample_filename(),
				'contents' => $operation->sample(),
			]
		);
	}

	/**
	 * The file a request names.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function file( WP_REST_Request $request ): array|WP_Error {
		$file = Upload::find( (string) $request->get_param( 'uuid' ) );

		if ( null === $file ) {
			return new WP_Error(
				'no_such_file',
				__( 'That file has expired, or was uploaded by somebody else.', 'sugarcommerce' )
			);
		}

		// A file uploaded for one screen cannot be imported through another.
		// Both checks are needed: the capability says who, this says what.
		return (string) $file['page'] === (string) $request->get_param( 'page' )
			? $file
			: new WP_Error( 'wrong_screen', __( 'That file was uploaded for a different import screen.', 'sugarcommerce' ) );
	}
}
