/**
 * Choosing a file: the input, the drop zone, and turning away what will
 * not do.
 *
 * The drop zone is the label of a real file input (Screen::choose()), so
 * choosing works without any of this. What this adds is a file dropped on
 * the zone put into that same input, the chosen file's name and size shown
 * before anything is sent, and a file that is not a CSV or is too big said
 * so at once rather than after an upload.
 */

import { __, sprintf } from '@wordpress/i18n';

import { size } from '../lib/format';

/**
 * What is wrong with a file, before it is sent.
 *
 * @param {File|null} file The file.
 * @param {number}    max  The largest file the site takes; 0 for no limit.
 * @return {string} Why it will not do, or '' when it will (or there is none).
 */
export function problemWith( file, max ) {
	if ( ! file ) {
		return '';
	}

	if ( ! /\.csv$/i.test( file.name ) ) {
		return sprintf(
			/* translators: %s: the name of the file that was chosen. */
			__(
				'“%s” isn’t a CSV file. Save your spreadsheet as CSV (the name ends in .csv) and choose that instead.',
				'sugarcommerce'
			),
			file.name
		);
	}

	if ( max && file.size > max ) {
		return sprintf(
			/* translators: %s: the largest file the site accepts. */
			__(
				'That file is larger than this site accepts (%s). Split it into smaller files and import them one at a time.',
				'sugarcommerce'
			),
			size( max )
		);
	}

	return '';
}

/**
 * The file an input holds.
 *
 * @param {HTMLInputElement} input The input.
 * @return {File|null} Its first file.
 */
export const picked = ( input ) => ( input.files && input.files[ 0 ] ) || null;

/**
 * Show the file that was chosen, or the drop zone when none is.
 *
 * @param {Object}           view  The operation's view.
 * @param {HTMLInputElement} input The file input.
 */
export function showChosen( view, input ) {
	const file = picked( input );

	view.region( 'chosen' ).hidden = ! file;
	view.region( 'drop' ).hidden = !! file;

	if ( file ) {
		view.region( 'file-name' ).textContent = file.name;
		view.region( 'file-size' ).textContent = size( file.size );
	}
}

/**
 * Listen for files dragged onto the zone, and put a dropped one into the
 * input.
 *
 * Dragging over the zone is counted rather than told by dragleave alone:
 * moving over the zone's own children fires a leave for the zone.
 *
 * @param {HTMLElement}      drop     The drop zone.
 * @param {HTMLInputElement} input    The file input.
 * @param {Function}         chosen   Called once a file is in the input.
 * @param {Function}         Transfer DataTransfer, or a stand-in.
 */
export function listenForDrops(
	drop,
	input,
	chosen,
	Transfer = window.DataTransfer
) {
	let depth = 0;

	drop.addEventListener( 'dragenter', ( event ) => {
		event.preventDefault();
		depth++;
		drop.classList.add( 'is-dragging' );
	} );

	drop.addEventListener( 'dragover', ( event ) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	} );

	drop.addEventListener( 'dragleave', () => {
		depth = Math.max( 0, depth - 1 );

		if ( ! depth ) {
			drop.classList.remove( 'is-dragging' );
		}
	} );

	drop.addEventListener( 'drop', ( event ) => {
		const files = event.dataTransfer && event.dataTransfer.files;

		event.preventDefault();
		depth = 0;
		drop.classList.remove( 'is-dragging' );

		if ( ! files || ! files.length ) {
			return;
		}

		// The input takes a FileList, and one file is all it wants.
		const transfer = new Transfer();

		transfer.items.add( files[ 0 ] );
		input.files = transfer.files;

		chosen();
	} );
}
