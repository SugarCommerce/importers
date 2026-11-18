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

/**
 * The import screen, drawn.
 *
 * Core markup throughout: `.wrap`, `.nav-tab-wrapper`, `.postbox`,
 * `.form-table`, `.button`, `.notice`. The steps of an import —
 * choose a file, line the columns up, check it, run it — are `<section>`s the
 * script shows one at a time, so the page works as a form before any script
 * loads and the script only hides what is not needed yet.
 *
 * The mapping table is the part worth getting right. It is the only moment
 * where somebody has to understand what the importer wants, and a select per
 * column with the file's own headers in it is the whole of the explanation.
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

		echo '<div class="wrap">';

		printf( '<h1>%s</h1>', esc_html( (string) $this->importer->get( 'page_title' ) ) );

		if ( '' !== (string) $this->importer->get( 'description', '' ) ) {
			printf( '<p>%s</p>', esc_html( (string) $this->importer->get( 'description' ) ) );
		}

		$this->tabs( $tab );

		$operations = $this->importer->operations( $tab );

		if ( [] === $operations ) {
			printf(
				'<div class="notice notice-info inline"><p>%s</p></div>',
				esc_html__( 'There is nothing to import here yet.', 'sugarcommerce' )
			);
		}

		foreach ( $operations as $operation ) {
			$this->operation( $operation );
		}

		echo '</div>';
	}

	/**
	 * The tabs, when there is more than one.
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

		echo '<nav class="nav-tab-wrapper wp-clearfix" aria-label="' . esc_attr__( 'Import sections', 'sugarcommerce' ) . '">';

		foreach ( $tabs as $key => $tab ) {
			printf(
				'<a href="%s" class="nav-tab%s"%s>%s%s</a>',
				esc_url( $this->importer->url( (string) $key ) ),
				$key === $current ? ' nav-tab-active' : '',
				$key === $current ? ' aria-current="page"' : '',
				self::icon_before( $tab['icon'] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from icon(), escaped there.
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
			'<div class="postbox" id="%s" data-importer="%s" data-operation="%s" data-rest="%s" data-nonce="%s">',
			esc_attr( $id ),
			esc_attr( $this->importer->id() ),
			esc_attr( $operation->key() ),
			esc_url( rest_url( Runtime::rest_namespace() ) ),
			esc_attr( wp_create_nonce( 'wp_rest' ) )
		);

		$icon = (string) $operation->get( 'icon', '' );

		printf(
			'<h2 class="hndle">%s%s</h2>',
			self::icon_before( '' !== $icon ? $icon : self::default_icon() ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from icon(), escaped there.
			esc_html( (string) $operation->get( 'title' ) )
		);

		echo '<div class="inside">';

		if ( '' !== (string) $operation->get( 'description', '' ) ) {
			printf( '<p>%s</p>', esc_html( (string) $operation->get( 'description' ) ) );
		}

		if ( ! $operation->is_runnable() ) {
			printf(
				'<div class="notice notice-error inline"><p>%s</p></div>',
				esc_html__( 'This importer has no process callback, so there is nothing for it to do with a row. That is a mistake in the plugin rather than in your file.', 'sugarcommerce' )
			);
		}

		$this->columns( $operation );
		$this->choose( $operation );
		$this->mapping( $operation );
		$this->report();

		echo '</div></div>';
	}

	/**
	 * What the file has to contain.
	 *
	 * Shown before anything is uploaded, because it is what somebody needs in
	 * order to go and make the file.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function columns( Operation $operation ): void {
		echo '<table class="widefat striped"><thead><tr>';

		printf( '<th scope="col">%s</th>', esc_html__( 'Column', 'sugarcommerce' ) );
		printf( '<th scope="col">%s</th>', esc_html__( 'Holds', 'sugarcommerce' ) );
		printf( '<th scope="col">%s</th>', esc_html__( 'Needed', 'sugarcommerce' ) );

		echo '</tr></thead><tbody>';

		foreach ( $operation->fields() as $key => $field ) {
			printf(
				'<tr><td><strong>%s</strong><br><code>%s</code></td><td>%s</td><td>%s</td></tr>',
				esc_html( (string) $field['label'] ),
				esc_html( (string) $key ),
				esc_html( self::describe( $field ) ),
				empty( $field['required'] )
					? esc_html__( 'Optional', 'sugarcommerce' )
					: esc_html__( 'Required', 'sugarcommerce' )
			);
		}

		echo '</tbody></table>';

		printf(
			'<p><button type="button" class="button" data-action="sample">%s</button></p>',
			esc_html__( 'Download a sample file', 'sugarcommerce' )
		);
	}

	/**
	 * Choosing a file.
	 *
	 * A plain file input in a plain form. The script takes it over and
	 * uploads without leaving the page; without the script it is still a
	 * control somebody can use.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function choose( Operation $operation ): void {
		printf(
			'<section data-step="choose"><h3>%s</h3><p><input type="file" accept=".csv,text/csv" data-input="file"> <button type="button" class="button button-primary" data-action="upload"%s>%s</button></p><p class="description">%s</p></section>',
			esc_html__( 'Choose a file', 'sugarcommerce' ),
			$operation->is_runnable() ? '' : ' disabled',
			esc_html__( 'Upload', 'sugarcommerce' ),
			esc_html(
				sprintf(
					/* translators: %s: a file size. */
					__( 'A CSV file, up to %s.', 'sugarcommerce' ),
					size_format( wp_max_upload_size() )
				)
			)
		);
	}

	/**
	 * Lining the columns up.
	 *
	 * Rendered empty and filled in by the script once a file is uploaded and
	 * its headers are known.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function mapping( Operation $operation ): void {
		printf(
			'<section data-step="map" hidden><h3>%s</h3><table class="form-table" role="presentation"><tbody data-region="mapping"></tbody></table>',
			esc_html__( 'Match the columns', 'sugarcommerce' )
		);

		printf(
			'<p><button type="button" class="button" data-action="check">%s</button> <button type="button" class="button button-primary" data-action="import">%s</button></p>',
			esc_html__( 'Check without importing', 'sugarcommerce' ),
			esc_html__( 'Import', 'sugarcommerce' )
		);

		printf( '<p class="description">%s</p></section>', esc_html__( 'Checking reads the whole file and reports what would go wrong, without changing anything.', 'sugarcommerce' ) );
	}

	/**
	 * What happened.
	 *
	 * @return void
	 */
	private function report(): void {
		printf(
			'<section data-step="report" hidden><h3>%s</h3><p><progress data-region="bar" max="100" value="0"></progress> <span data-region="count" role="status"></span></p><div data-region="summary"></div><div data-region="errors"></div></section>',
			esc_html__( 'Progress', 'sugarcommerce' )
		);
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
	 * An icon and the space after it, or nothing.
	 *
	 * @param mixed $value An icon, in either form icon() reads.
	 *
	 * @return string
	 */
	private static function icon_before( mixed $value ): string {
		$icon = self::icon( $value );

		return '' !== $icon ? $icon . ' ' : '';
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
