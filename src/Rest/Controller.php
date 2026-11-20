<?php
/**
 * Controller
 *
 * @package     SugarCommerce\Importers
 * @copyright   Copyright (c) 2026, ArrayPress Limited
 * @license     GPL2+
 * @since       1.0.0
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Rest;

use SugarCommerce\Importers\Importer;
use SugarCommerce\Importers\Importers;
use SugarCommerce\Importers\Operation;
use SugarCommerce\Importers\Traits\Rest\Controller\Batches;
use SugarCommerce\Importers\Traits\Rest\Controller\Files;
use SugarCommerce\Importers\Utils\Runtime;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

/**
 * The endpoints an import screen talks to.
 *
 * The namespace comes from Runtime rather than being written here, and that
 * is not tidiness. Strauss renames classes and leaves string literals alone,
 * so two plugins each bundling a prefixed copy of this library would register
 * the same route — and `WP_REST_Server::register_route()` merges same-path
 * registrations by appending handlers, then dispatches to the first whose
 * methods match.
 *
 * One plugin's importer would answer the other's requests: its capability,
 * its registry of operations, its process callback writing rows out of a file
 * it was never shown.
 */
final class Controller {

	use Files;
	use Batches;

	/**
	 * Whether the routes are attached.
	 *
	 * @var bool
	 */
	private static bool $booted = false;

	/**
	 * Attach the routes, once.
	 *
	 * @return void
	 */
	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}

		self::$booted = true;

		add_action( 'rest_api_init', [ __CLASS__, 'register' ] );
	}

	/**
	 * Register them.
	 *
	 * @return void
	 */
	public static function register(): void {
		$namespace = Runtime::rest_namespace();

		$page = [
			'required'          => true,
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_key',
		];

		$operation = [
			'required'          => true,
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_key',
		];

		$uuid = [
			'required'          => true,
			'type'              => 'string',
			'validate_callback' => static fn( $value ): bool => 1 === preg_match( '/^[a-f0-9-]{36}$/', (string) $value ),
		];

		register_rest_route(
			$namespace,
			'/upload',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'upload' ],
				'permission_callback' => [ __CLASS__, 'may' ],
				'args'                => [ 'page' => $page ],
			]
		);

		register_rest_route(
			$namespace,
			'/file/(?P<uuid>[a-f0-9-]{36})',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'preview' ],
					'permission_callback' => [ __CLASS__, 'may' ],
					'args'                => [
						'page' => $page,
						'uuid' => $uuid,
					],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ __CLASS__, 'discard' ],
					'permission_callback' => [ __CLASS__, 'may' ],
					'args'                => [
						'page' => $page,
						'uuid' => $uuid,
					],
				],
			]
		);

		register_rest_route(
			$namespace,
			'/sample',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'sample' ],
				'permission_callback' => [ __CLASS__, 'may' ],
				'args'                => [
					'page' => $page,
					'operation' => $operation,
				],
			]
		);

		register_rest_route(
			$namespace,
			'/run',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'run' ],
				'permission_callback' => [ __CLASS__, 'may' ],
				'args'                => [
					'page'      => $page,
					'operation' => $operation,
					'uuid'      => $uuid,
					'mapping'   => [
						'required' => true,
						'type' => 'object',
					],
					'offset'    => [
						'type' => 'integer',
						'default' => 0,
						'minimum' => 0,
					],
					'commit'    => [
						'type' => 'boolean',
						'default' => true,
					],
				],
			]
		);

		register_rest_route(
			$namespace,
			'/progress',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'progress' ],
				'permission_callback' => [ __CLASS__, 'may' ],
				'args'                => [
					'page' => $page,
					'uuid' => $uuid,
				],
			]
		);
	}

	/**
	 * Whether this user may do what they are asking.
	 *
	 * The capability is the one the named screen declared. A request naming a
	 * screen that is not registered is refused rather than falling back to
	 * `manage_options` — an unregistered page is not a page this library can
	 * speak for, and answering anyway is how a request for one plugin's
	 * importer gets checked against another's rules.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return true|WP_Error
	 */
	public static function may( WP_REST_Request $request ): bool|WP_Error {
		$importer = Importers::get( (string) $request->get_param( 'page' ) );

		if ( null === $importer ) {
			return new WP_Error(
				'rest_no_such_importer',
				__( 'There is no import screen by that name.', 'sugarcommerce' ),
				[ 'status' => 404 ]
			);
		}

		if ( ! $importer->is_permitted() ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You are not allowed to import here.', 'sugarcommerce' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		return true;
	}

	/**
	 * The importer a request names.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return Importer|WP_Error
	 */
	private static function importer( WP_REST_Request $request ): Importer|WP_Error {
		$importer = Importers::get( (string) $request->get_param( 'page' ) );

		return null === $importer
			? new WP_Error( 'no_such_importer', __( 'There is no import screen by that name.', 'sugarcommerce' ) )
			: $importer;
	}

	/**
	 * The operation a request names.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return Operation|WP_Error
	 */
	private static function operation( WP_REST_Request $request ): Operation|WP_Error {
		$importer = self::importer( $request );

		if ( $importer instanceof WP_Error ) {
			return $importer;
		}

		$operation = $importer->operation( (string) $request->get_param( 'operation' ) );

		return null === $operation
			? new WP_Error( 'no_such_operation', __( 'That import screen has nothing by that name to import.', 'sugarcommerce' ) )
			: $operation;
	}
}
