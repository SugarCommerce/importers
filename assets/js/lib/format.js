/**
 * Numbers, sizes and names, the way a person writes them.
 */

import { __, sprintf } from '@wordpress/i18n';

/**
 * A number as the reader writes numbers.
 *
 * @param {number} number The number.
 * @return {string} It, formatted.
 */
export const count = ( number ) => Number( number || 0 ).toLocaleString();

/**
 * A file's size, the way a file manager says it.
 *
 * @param {number} bytes Its size.
 * @return {string} The size.
 */
export function size( bytes ) {
	const one = { maximumFractionDigits: 1 };

	if ( bytes < 1024 ) {
		/* translators: %s: a number of bytes. */
		return sprintf( __( '%s bytes', 'sugarcommerce' ), count( bytes ) );
	}

	if ( bytes < 1024 * 1024 ) {
		return sprintf(
			/* translators: %s: a size in kilobytes. */
			__( '%s KB', 'sugarcommerce' ),
			( bytes / 1024 ).toLocaleString( undefined, one )
		);
	}

	return sprintf(
		/* translators: %s: a size in megabytes. */
		__( '%s MB', 'sugarcommerce' ),
		( bytes / 1024 / 1024 ).toLocaleString( undefined, one )
	);
}

/**
 * A name reduced to what matters when matching it to another: case, spaces
 * and punctuation are not what makes "E-mail" a different column from
 * "email".
 *
 * @param {string} name A column's name.
 * @return {string} Its letters and digits, lower case.
 */
export const squash = ( name ) =>
	String( name || '' )
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '' );

/**
 * A list of names, joined the way a sentence joins them.
 *
 * @param {string[]} names The names.
 * @param {string}   lang  The page's language; the document's by default.
 * @return {string} One string.
 */
export function sentence( names, lang = document.documentElement.lang ) {
	if ( window.Intl && window.Intl.ListFormat ) {
		return new window.Intl.ListFormat( lang || undefined, {
			type: 'conjunction',
		} ).format( names );
	}

	return names.join( ', ' );
}
