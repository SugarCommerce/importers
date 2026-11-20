<?php
/**
 * Screen
 *
 * @package     SugarCommerce\Importers
 * @copyright   Copyright (c) 2026, ArrayPress Limited
 * @license     GPL2+
 * @since       1.0.0
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers;

use SugarCommerce\Importers\Traits\Screen\Glyphs;
use SugarCommerce\Importers\Traits\Screen\Steps;
use SugarCommerce\Importers\Utils\Runtime;

/**
 * The import screen, drawn.
 *
 * The look the settings, reports, onboarding and flyout panels already have,
 * so an import reads as part of the same product: white cards on the
 * admin's grey, pills for the tabs, a row of segments for the steps, and
 * colour from the user's own admin scheme.
 *
 * An import is four steps — upload a file, match its columns, check it,
 * import it — shown as three `<section>`s the script reveals one at a time
 * (the check and the import share the results card). The segments over them
 * say which step this is. Everything the script draws later is built from
 * what is printed here, so the words a person reads are in PHP or in the
 * script's own translated strings, never assembled from an API's keys.
 *
 * The part worth getting right is what the file has to contain. It is the
 * one moment somebody has to understand what the importer wants, so every
 * column says what it holds, whether it is needed and, where the plugin
 * gave one, an example.
 */
final class Screen {

	use Steps;
	use Glyphs;

	/**
	 * The class every icon carries, SVG or Dashicon.
	 *
	 * The same as sugarcommerce/fields' own (`Icons::ICON_CLASS`), so one
	 * rule sizes either kind, drawn by the kit or not.
	 */
	public const string ICON_CLASS = 'sugarcommerce-icon';

	/**
	 * The steps of an import, in order.
	 */
	private const array STEPS = [ 'choose', 'map', 'check', 'import' ];

	/**
	 * The screen's own icons: Heroicons, and the Dashicon each stands in for
	 * when sugarcommerce/fields is not there to draw SVG.
	 */
	private const array ICONS = [
		'upload'   => [ 'heroicons-outline:arrow-up-tray', 'upload' ],
		'file'     => [ 'heroicons-outline:document-text', 'media-spreadsheet' ],
		'download' => [ 'heroicons-outline:arrow-down-tray', 'download' ],
		'success'  => [ 'heroicons-outline:check-circle', 'yes-alt' ],
		'warning'  => [ 'heroicons-outline:exclamation-triangle', 'warning' ],
		'remove'   => [ 'heroicons-outline:x-mark', 'no-alt' ],
		'done'     => [ 'heroicons-outline:check', 'yes' ],
	];

	/**
	 * The screen.
	 *
	 * @var Importer
	 */
	private Importer $importer;

	/**
	 * Construct.
	 *
	 * @param Importer $importer The screen.
	 */
	public function __construct( Importer $importer ) {
		$this->importer = $importer;
	}

	/**
	 * Draw it.
	 *
	 * @return void
	 */
	public function render(): void {
		if ( ! $this->importer->is_permitted() ) {
			wp_die( esc_html__( 'You are not allowed to import here.', 'sugarcommerce' ), '', [ 'response' => 403 ] );
		}

		$tab = $this->importer->current_tab();

		echo '<div class="wrap importers">';

		printf( '<h1>%s</h1>', esc_html( (string) $this->importer->get( 'page_title' ) ) );

		if ( '' !== (string) $this->importer->get( 'description', '' ) ) {
			printf( '<p class="importers__intro">%s</p>', esc_html( (string) $this->importer->get( 'description' ) ) );
		}

		// Core moves notices to just after this, so they sit under the
		// heading rather than above it.
		echo '<hr class="wp-header-end">';

		$this->tabs( $tab );

		$operations = $this->importer->operations( $tab );

		if ( [] === $operations ) {
			printf(
				'<div class="importers__card importers__empty"><p>%s</p></div>',
				esc_html__( 'There is nothing to import here yet.', 'sugarcommerce' )
			);
		}

		foreach ( $operations as $operation ) {
			$this->operation( $operation );
		}

		$this->icons();

		echo '</div>';
	}

	/**
	 * The tabs, when there is more than one: a row of pills.
	 *
	 * @param string $current The tab being looked at.
	 *
	 * @return void
	 */
	private function tabs( string $current ): void {
		$tabs = $this->importer->tabs();

		if ( count( $tabs ) < 2 ) {
			return;
		}

		echo '<nav class="importers__tabs" aria-label="' . esc_attr__( 'Import sections', 'sugarcommerce' ) . '">';

		foreach ( $tabs as $key => $tab ) {
			printf(
				'<a href="%s" class="importers__tab%s"%s>%s<span class="importers__tab-label">%s</span></a>',
				esc_url( $this->importer->url( (string) $key ) ),
				$key === $current ? ' is-current' : '',
				$key === $current ? ' aria-current="page"' : '',
				self::icon( $tab['icon'] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from icon(), escaped there.
				esc_html( (string) $tab['label'] )
			);
		}

		echo '</nav>';
	}

	/**
	 * One operation, from choosing a file to running it.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function operation( Operation $operation ): void {
		$id = sprintf( '%s-%s', $this->importer->id(), $operation->key() );

		printf(
			'<div class="importers__operation" id="%s" data-importer="%s" data-operation="%s" data-rest="%s" data-nonce="%s" data-max-size="%d">',
			esc_attr( $id ),
			esc_attr( $this->importer->id() ),
			esc_attr( $operation->key() ),
			esc_url( rest_url( Runtime::rest_namespace() ) ),
			esc_attr( wp_create_nonce( 'wp_rest' ) ),
			(int) wp_max_upload_size()
		);

		$this->head( $operation, $id );

		if ( ! $operation->is_runnable() ) {
			printf(
				'<div class="importers__alert">%s<p>%s</p></div>',
				self::ui_icon( 'warning' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
				esc_html__( 'This importer has no process callback, so there is nothing for it to do with a row. That is a mistake in the plugin rather than in your file.', 'sugarcommerce' )
			);
		}

		// Where anything that goes wrong is said, whichever step it is on.
		// Empty until then, and an empty alert region is announced by
		// nothing.
		echo '<div data-region="alert" role="alert"></div>';

		$this->choose( $operation, $id );
		$this->mapping( $id );
		$this->report( $id );

		echo '</div>';
	}

	/**
	 * The operation's card: its icon, title and description, and the steps.
	 *
	 * @param Operation $operation The operation.
	 * @param string    $id        The operation's element id.
	 *
	 * @return void
	 */
	private function head( Operation $operation, string $id ): void {
		$icon = (string) $operation->get( 'icon', '' );

		echo '<div class="importers__card importers__head"><div class="importers__head-row">';

		printf(
			'<span class="importers__head-icon">%s</span>',
			self::icon( '' !== $icon ? $icon : self::default_icon() ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from icon(), escaped there.
		);

		printf(
			'<div class="importers__head-text"><h2 class="importers__title">%s</h2>%s</div>',
			esc_html( (string) $operation->get( 'title' ) ),
			'' !== (string) $operation->get( 'description', '' )
				? sprintf( '<p class="importers__description">%s</p>', esc_html( (string) $operation->get( 'description' ) ) )
				: ''
		);

		echo '</div>';

		$this->steps( $id );

		echo '</div>';
	}

	/**
	 * The steps, as segments: done, current, skipped or still to come.
	 *
	 * The shapes differ, not only the colours, as they do in onboarding: a
	 * done step is a full bar with a tick, the current one half full, a
	 * skipped one hatched. The script moves them along; before it does, the
	 * first is current, which is where a page that has just loaded is.
	 *
	 * @param string $id The operation's element id.
	 *
	 * @return void
	 */
	private function steps( string $id ): void {
		$names = [
			'choose' => __( 'Upload', 'sugarcommerce' ),
			'map'    => __( 'Match Columns', 'sugarcommerce' ),
			'check'  => __( 'Check', 'sugarcommerce' ),
			'import' => __( 'Import', 'sugarcommerce' ),
		];

		// The format is escaped before the spans go in, so a translation
		// cannot add markup and the spans are the only markup there is.
		printf(
			'<p class="importers__count" id="%s-steps">%s</p>',
			esc_attr( $id ),
			sprintf(
				/* translators: 1: the step's number, 2: how many steps there are, 3: the step's name. */
				esc_html__( 'Step %1$s of %2$s: %3$s', 'sugarcommerce' ),
				'<span class="importers__count-number" data-region="step-number">1</span>',
				(int) count( self::STEPS ),
				'<span class="importers__count-name" data-region="step-name">' . esc_html( $names['choose'] ) . '</span>'
			) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped as it is built.
		);

		printf( '<ol class="importers__steps" aria-labelledby="%s-steps">', esc_attr( $id ) );

		foreach ( self::STEPS as $index => $step ) {
			printf(
				'<li class="importers__step%s" data-marker="%s"%s><span class="importers__step-bar" aria-hidden="true"></span><span class="importers__step-label"><span class="importers__step-tick" aria-hidden="true">%s</span>%s</span></li>',
				0 === $index ? ' is-current' : '',
				esc_attr( $step ),
				0 === $index ? ' aria-current="step"' : '',
				self::ui_icon( 'done', 14 ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
				esc_html( $names[ $step ] )
			);
		}

		echo '</ol>';
	}
}
