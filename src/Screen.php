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

use SugarCommerce\Fields\Icons\Icons;
use SugarCommerce\Importers\Utils\Runtime;
use SugarCommerce\StatusBadge\StatusBadge;

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

	/**
	 * The class every icon carries, SVG or Dashicon.
	 *
	 * The same as sugarcommerce/fields' own (`Icons::ICON_CLASS`), so one
	 * rule sizes either kind, drawn by the kit or not.
	 */
	public const ICON_CLASS = 'sugarcommerce-icon';

	/**
	 * The steps of an import, in order.
	 */
	private const STEPS = [ 'choose', 'map', 'check', 'import' ];

	/**
	 * The screen's own icons: Heroicons, and the Dashicon each stands in for
	 * when sugarcommerce/fields is not there to draw SVG.
	 */
	private const ICONS = [
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

	/**
	 * Choosing a file, and what it has to contain.
	 *
	 * The drop zone is a label for a real file input, so it is one control:
	 * pressed, it opens the file picker; tabbed to, it is the input, which a
	 * keyboard and a screen reader already know how to use; and a file
	 * dropped on it is put into that same input. Without the script it is
	 * still the input and its label.
	 *
	 * @param Operation $operation The operation.
	 * @param string    $id        The operation's element id.
	 *
	 * @return void
	 */
	private function choose( Operation $operation, string $id ): void {
		echo '<section class="importers__section" data-step="choose"><div class="importers__card">';

		printf(
			'<div class="importers__card-header"><h3 class="importers__card-title">%s</h3><p class="importers__card-description">%s</p></div>',
			esc_html__( 'Upload Your File', 'sugarcommerce' ),
			esc_html__( 'A spreadsheet saved as CSV, with the column names in the first row.', 'sugarcommerce' )
		);

		printf(
			'<div class="importers__drop" data-region="drop">' .
			'<input type="file" class="importers__file" id="%1$s-file" accept=".csv,text/csv" data-input="file" aria-describedby="%1$s-hint">' .
			'<label class="importers__drop-label" for="%1$s-file">' .
			'<span class="importers__drop-icon">%2$s</span>' .
			'<span class="importers__drop-title">%3$s</span>' .
			'<span class="importers__drop-or">%4$s</span>' .
			'<span class="importers__drop-button">%5$s</span>' .
			'</label>' .
			'<p class="importers__drop-hint" id="%1$s-hint">%6$s</p>' .
			'</div>',
			esc_attr( $id ),
			self::ui_icon( 'upload', 24 ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Drag and drop your CSV file here', 'sugarcommerce' ),
			esc_html__( 'or', 'sugarcommerce' ),
			esc_html__( 'Choose File', 'sugarcommerce' ),
			esc_html(
				sprintf(
					/* translators: %s: a file size. */
					__( 'CSV files up to %s', 'sugarcommerce' ),
					size_format( wp_max_upload_size() )
				)
			)
		);

		printf(
			'<div class="importers__file-bar" data-region="chosen" role="status" hidden>' .
			'<span class="importers__file-icon">%1$s</span>' .
			'<span class="importers__file-text"><span class="importers__file-name" data-region="file-name"></span><span class="importers__file-meta" data-region="file-size"></span></span>' .
			'<button type="button" class="importers__icon-button" data-action="clear" aria-label="%2$s">%3$s</button>' .
			'</div>',
			self::ui_icon( 'file' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_attr__( 'Remove This File', 'sugarcommerce' ),
			self::ui_icon( 'remove', 18 ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
		);

		printf(
			'<div class="importers__actions"><button type="button" class="button button-primary" data-action="upload"%s>%s</button></div>',
			$operation->is_runnable() ? '' : ' disabled',
			esc_html__( 'Upload and Continue', 'sugarcommerce' )
		);

		echo '</div>';

		$this->columns( $operation );

		echo '</section>';
	}

	/**
	 * What the file has to contain.
	 *
	 * Shown before anything is uploaded, because it is what somebody needs in
	 * order to go and make the file. The script reads it back to build the
	 * matching rows: one declaration, so the two cannot disagree.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function columns( Operation $operation ): void {
		$badges = new StatusBadge();

		echo '<div class="importers__card importers__columns">';

		printf(
			'<div class="importers__card-header importers__card-header--split"><div><h3 class="importers__card-title">%s</h3><p class="importers__card-description">%s</p></div><button type="button" class="button importers__sample" data-action="sample">%s%s</button></div>',
			esc_html__( 'What Your File Needs', 'sugarcommerce' ),
			esc_html__( 'Columns can be in any order and named however you like: you match them up after uploading.', 'sugarcommerce' ),
			self::ui_icon( 'download', 16 ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Download Sample File', 'sugarcommerce' )
		);

		echo '<table class="importers__table"><thead><tr>';

		printf( '<th scope="col">%s</th>', esc_html__( 'Column', 'sugarcommerce' ) );
		printf( '<th scope="col">%s</th>', esc_html__( 'What Goes In It', 'sugarcommerce' ) );
		printf( '<th scope="col" class="importers__needed">%s</th>', esc_html__( 'Needed', 'sugarcommerce' ) );

		echo '</tr></thead><tbody>';

		foreach ( $operation->fields() as $key => $field ) {
			$required = ! empty( $field['required'] );
			$badge    = $badges->render(
				$required ? 'required' : 'optional',
				$required ? StatusBadge::INFO : StatusBadge::DEFAULT,
				$required ? __( 'Required', 'sugarcommerce' ) : __( 'Optional', 'sugarcommerce' )
			);
			$example  = '' !== (string) ( $field['example'] ?? '' )
				? sprintf(
					'<span class="importers__example">%s</span>',
					esc_html(
						sprintf(
							/* translators: %s: an example value for the column. */
							__( 'Example: %s', 'sugarcommerce' ),
							(string) $field['example']
						)
					)
				)
				: '';

			printf(
				'<tr data-field="%1$s" data-label="%2$s" data-holds="%3$s"%4$s><th scope="row"><span class="importers__label">%2$s</span><code>%5$s</code></th><td><span class="importers__holds">%3$s</span>%6$s</td><td class="importers__needed">%7$s</td></tr>',
				esc_attr( (string) $key ),
				esc_html( (string) $field['label'] ),
				esc_html( self::describe( $field ) ),
				$required ? ' data-required' : '',
				esc_html( (string) $key ),
				$example, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped as it is built.
				$badge // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the badge escapes its own markup.
			);
		}

		echo '</tbody></table></div>';
	}

	/**
	 * Lining the columns up.
	 *
	 * The rows are drawn by the script once a file is uploaded and its
	 * headers are known.
	 *
	 * @param string $id The operation's element id.
	 *
	 * @return void
	 */
	private function mapping( string $id ): void {
		printf(
			'<section class="importers__section" data-step="map" hidden><div class="importers__card">' .
			'<div class="importers__card-header"><h3 class="importers__card-title" id="%1$s-map-title" tabindex="-1">%2$s</h3><p class="importers__card-description" data-region="matched"></p></div>' .
			'<div class="importers__file-bar"><span class="importers__file-icon">%3$s</span><span class="importers__file-text"><span class="importers__file-name" data-region="uploaded-name"></span><span class="importers__file-meta" data-region="uploaded-rows"></span></span><button type="button" class="button-link importers__link" data-action="restart">%4$s</button></div>' .
			'<div class="importers__map" data-region="mapping" role="group" aria-labelledby="%1$s-map-title"></div>' .
			'<div class="importers__actions"><button type="button" class="button button-primary" data-action="check">%5$s</button><p class="importers__actions-note">%6$s</p></div>' .
			'</div></section>',
			esc_attr( $id ),
			esc_html__( 'Match Columns', 'sugarcommerce' ),
			self::ui_icon( 'file' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Choose a Different File', 'sugarcommerce' ),
			esc_html__( 'Check File', 'sugarcommerce' ),
			esc_html__( 'Checking reads every row and reports any problems, without changing anything.', 'sugarcommerce' )
		);
	}

	/**
	 * What happened: the check, the import, and the end of it.
	 *
	 * @param string $id The operation's element id.
	 *
	 * @return void
	 */
	private function report( string $id ): void {
		printf(
			'<section class="importers__section" data-step="report" hidden><div class="importers__card importers__report">' .
			'<div class="importers__mark" data-region="mark" hidden></div>' .
			'<div class="importers__card-header"><h3 class="importers__card-title" id="%1$s-report-title" data-region="title" tabindex="-1"></h3><p class="importers__card-description" data-region="lede"></p></div>' .
			'<div class="importers__progress" data-region="progress"><div class="importers__bar" role="progressbar" aria-labelledby="%1$s-report-title" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-region="bar"><span class="importers__bar-fill"></span></div><p class="importers__progress-count" data-region="count"></p></div>' .
			'<div data-region="summary"></div>' .
			'<div data-region="errors"></div>' .
			'<div class="importers__actions" data-region="report-actions" hidden>' .
			'<button type="button" class="button button-primary" data-action="import">%2$s</button>' .
			'<button type="button" class="button" data-action="back">%3$s</button>' .
			'<button type="button" class="button" data-action="restart">%4$s</button>' .
			'</div>' .
			'</div></section>',
			esc_attr( $id ),
			esc_html__( 'Import Now', 'sugarcommerce' ),
			esc_html__( 'Back to Matching', 'sugarcommerce' ),
			esc_html__( 'Import Another File', 'sugarcommerce' )
		);
	}

	/**
	 * The icons the script draws, once for the page.
	 *
	 * Printed here so the script never builds SVG of its own: it clones
	 * these, and they are whatever this screen's icons are.
	 *
	 * @return void
	 */
	private function icons(): void {
		echo '<template class="importers__icons">';

		foreach ( [ 'success', 'warning' ] as $name ) {
			printf( '<span data-icon="%s">%s</span>', esc_attr( $name ), self::ui_icon( $name ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
		}

		echo '</template>';
	}

	/**
	 * What a column holds, in words.
	 *
	 * @param array<string, mixed> $field The field's declaration.
	 *
	 * @return string
	 */
	private static function describe( array $field ): string {
		$type = (string) ( $field['type'] ?? 'string' );

		$described = match ( $type ) {
			'number'     => __( 'A number', 'sugarcommerce' ),
			'integer'    => __( 'A whole number', 'sugarcommerce' ),
			'boolean'    => __( 'Yes or no', 'sugarcommerce' ),
			'email'      => __( 'An email address', 'sugarcommerce' ),
			'url'        => __( 'A web address', 'sugarcommerce' ),
			'currency'   => __( 'A currency code', 'sugarcommerce' ),
			'country'    => __( 'A country code', 'sugarcommerce' ),
			'date'       => __( 'A date', 'sugarcommerce' ),
			'datetime'   => __( 'A date and a time', 'sugarcommerce' ),
			'post'       => __( 'The name, slug or id of an existing entry', 'sugarcommerce' ),
			'term'       => __( 'A category or tag name', 'sugarcommerce' ),
			'user'       => __( 'A username or email address', 'sugarcommerce' ),
			'attachment' => __( 'The URL or filename of a file in the media library', 'sugarcommerce' ),
			default      => __( 'Text', 'sugarcommerce' ),
		};

		$notes = [];

		if ( '' !== (string) ( $field['date_format'] ?? '' ) ) {
			/* translators: %s: a date format such as d/m/Y. */
			$notes[] = sprintf( __( 'written as %s', 'sugarcommerce' ), (string) $field['date_format'] );
		}

		if ( '' !== (string) ( $field['separator'] ?? '' ) ) {
			/* translators: %s: the characters that separate several values in one column. */
			$notes[] = sprintf( __( 'several, separated by %s', 'sugarcommerce' ), (string) $field['separator'] );
		}

		if ( is_array( $field['options'] ?? null ) && [] !== $field['options'] ) {
			/* translators: %s: the values the column accepts. */
			$notes[] = sprintf( __( 'one of %s', 'sugarcommerce' ), implode( ', ', array_map( 'strval', $field['options'] ) ) );
		}

		return [] === $notes
			? $described
			: sprintf( '%s (%s)', $described, implode( '; ', $notes ) );
	}

	/**
	 * One of the screen's own icons, ready to print.
	 *
	 * @param string $name A key of self::ICONS.
	 * @param int    $size Its size in pixels, for the SVG.
	 *
	 * @return string
	 */
	private static function ui_icon( string $name, int $size = 20 ): string {
		$pair = self::ICONS[ $name ];

		return class_exists( Icons::class )
			? Icons::render( $pair[0], [ 'size' => $size ] )
			: self::icon( $pair[1] );
	}

	/**
	 * An icon, ready to print.
	 *
	 * Takes either form: a `set:name` value (`heroicons-outline:users`),
	 * drawn as inline SVG, or a bare Dashicons name (`cart`, or the whole
	 * class `dashicons-cart`), drawn as the font's span it always was. Both
	 * carry the `sugarcommerce-icon` class (`self::ICON_CLASS`).
	 *
	 * The SVG comes from sugarcommerce/fields, which this library suggests
	 * rather than requires. Without it a bare name still draws -- the span needs
	 * nothing but the font -- and a `set:name` value draws nothing rather
	 * than a broken span.
	 *
	 * @param mixed $value An icon.
	 *
	 * @return string Markup, or '' when there is no icon to draw.
	 */
	private static function icon( mixed $value ): string {
		if ( class_exists( Icons::class ) ) {
			return Icons::render( $value );
		}

		if ( ! is_string( $value ) ) {
			return '';
		}

		// Not ltrim(): that takes a set of characters rather than a prefix,
		// so `dashicons-chart-bar` would come back as `rt-bar`.
		$value = strtolower( trim( $value ) );
		$name  = str_starts_with( $value, 'dashicons-' ) ? substr( $value, strlen( 'dashicons-' ) ) : $value;

		if ( 1 !== preg_match( '/^[a-z0-9][a-z0-9-]*$/', $name ) ) {
			return '';
		}

		if ( function_exists( 'wp_enqueue_style' ) ) {
			wp_enqueue_style( 'dashicons' );
		}

		return sprintf( '<span class="%s" aria-hidden="true"></span>', esc_attr( 'dashicons dashicons-' . $name . ' ' . self::ICON_CLASS ) );
	}

	/**
	 * The icon an operation has when it names none.
	 *
	 * Heroicons' upload tray, or the Dashicon it replaced when
	 * sugarcommerce/fields is not there to draw it.
	 *
	 * @return string
	 */
	private static function default_icon(): string {
		return class_exists( Icons::class ) ? 'heroicons-outline:arrow-up-tray' : 'upload';
	}
}
