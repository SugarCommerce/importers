<?php
/**
 * Glyphs
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Traits\Screen;

use SugarCommerce\Fields\Icons\Icons;

/**
 * The screen's icons, and each field type's line saying what it takes.
 */
trait Glyphs {

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
