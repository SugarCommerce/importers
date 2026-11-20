/**
 * The screen the script runs on, and what a browser would do to it.
 *
 * The markup is Screen.php's own, from the snapshot ScreenSnapshotTest
 * holds it to: the script is tested against what the PHP really prints, so
 * a change to one that the other did not follow fails here.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNAPSHOT = resolve(
	dirname( fileURLToPath( import.meta.url ) ),
	'../../snapshots/screen.html'
);

/**
 * Put the screen on the page.
 *
 * @return {HTMLElement} The operation's element.
 */
export function loadScreen() {
	document.documentElement.lang = 'en-US';
	document.body.innerHTML = readFileSync( SNAPSHOT, 'utf8' );

	return document.querySelector( '[data-importer][data-operation]' );
}

/**
 * Let every request and step that is waiting finish.
 *
 * @return {Promise} After them.
 */
export const settle = () => new Promise( ( done ) => setTimeout( done ) );

/**
 * A CSV file.
 *
 * @param {string} name     Its name.
 * @param {string} contents What it holds.
 * @return {File} The file.
 */
export const csv = (
	name = 'products.csv',
	contents = 'sku,price\nA-1,10\n'
) => new window.File( [ contents ], name, { type: 'text/csv' } );

/**
 * Make a file input's files something a test can set.
 *
 * jsdom's input takes only a FileList, which nothing but a browser makes.
 * This keeps a browser's rules: setting `value` to '' empties it, and the
 * value reads as the fake path a browser gives.
 *
 * @param {HTMLInputElement} input The input.
 * @return {Object} pick( ...files ), which chooses them as a person would.
 */
export function controlFiles( input ) {
	let list = [];

	Object.defineProperty( input, 'files', {
		configurable: true,
		get: () => list,
		set: ( files ) => {
			list = Array.from( files );
		},
	} );

	Object.defineProperty( input, 'value', {
		configurable: true,
		get: () => ( list.length ? 'C:\\fakepath\\' + list[ 0 ].name : '' ),
		set: ( value ) => {
			if ( '' === value ) {
				list = [];
			}
		},
	} );

	return {
		pick( ...files ) {
			list = files;
			input.dispatchEvent(
				new window.Event( 'change', { bubbles: true } )
			);
		},
	};
}

/**
 * A stand-in for DataTransfer, which jsdom does not have.
 */
export class FakeTransfer {
	constructor() {
		const files = [];

		this.files = files;
		this.items = { add: ( file ) => files.push( file ) };
	}
}

/**
 * A drag event carrying files.
 *
 * @param {string} type  dragenter, dragover, dragleave or drop.
 * @param {File[]} files What is being dragged.
 * @return {Event} The event.
 */
export function dragEvent( type, files = [] ) {
	const event = new window.Event( type, { bubbles: true, cancelable: true } );

	event.dataTransfer = { files, dropEffect: 'none' };

	return event;
}

/**
 * Press a button as a person would.
 *
 * @param {HTMLElement} box    The operation's element.
 * @param {string}      action The button's `data-action`.
 * @param {Element}     within Where to find it; the operation by default.
 */
export function press( box, action, within = box ) {
	within
		.querySelector( 'button[data-action="' + action + '"]' )
		.dispatchEvent(
			new window.MouseEvent( 'click', {
				bubbles: true,
				cancelable: true,
			} )
		);
}

/**
 * What a region says, its whitespace as a reader sees it.
 *
 * @param {HTMLElement} box  The operation's element.
 * @param {string}      name The region.
 * @return {string} Its text.
 */
export const said = ( box, name ) =>
	box
		.querySelector( '[data-region="' + name + '"]' )
		.textContent.replace( /\s+/g, ' ' )
		.trim();
