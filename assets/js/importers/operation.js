/**
 * One operation, from choosing a file to running it.
 *
 * Choose a file, upload it, line its columns up, check it, then import it
 * a batch at a time. Each button names what it does with `data-action`;
 * while one is under way every button waits, and whatever goes wrong is
 * said in words above the step it went wrong in.
 */

import { __, sprintf } from '@wordpress/i18n';

import { settings } from '../lib/config';
import { sentence } from '../lib/format';
import { createAsk, friendly, refusal } from '../lib/rest';
import { listenForDrops, picked, problemWith, showChosen } from './choose';
import { chosenColumns, drawMapping, unmatched } from './mapping';
import { begin, bar, finish, stopped } from './report';
import { save } from './sample';
import { createView } from './view';
import { walk } from './walk';

/**
 * The actions that start afresh: whatever was said before is taken back
 * when one is pressed.
 */
const FRESH = [ 'upload', 'check', 'import', 'sample' ];

/**
 * Wire up one operation.
 *
 * @param {HTMLElement} box     The operation's element.
 * @param {Object}      options apiFetch (wp.apiFetch, or a stand-in) and,
 *                              for the tests, `save` and `DataTransfer`.
 * @return {Object} The operation's view.
 */
export function setupOperation( box, options ) {
	const config = settings( box );
	const view = createView( box );
	const ask = createAsk( options.apiFetch, config );
	const download = options.save || save;
	const input = box.querySelector( '[data-input="file"]' );
	const page = { page: config.importer };
	let file = null;
	let preview = null;

	/**
	 * Throw a file away on the server. Swept within the day anyway, so
	 * nobody waits on this and a failure is not worth saying.
	 *
	 * @param {string} uuid The upload.
	 */
	const discard = ( uuid ) =>
		ask( 'file/' + uuid, { params: page, method: 'DELETE' } ).catch(
			() => {}
		);

	/**
	 * Take a file that has just been chosen or dropped, or say why not.
	 */
	function chosen() {
		const problem = problemWith( picked( input ), config.maxSize );

		view.quiet();

		if ( problem ) {
			view.alert( problem );
			input.value = '';
		}

		showChosen( view, input );

		if ( picked( input ) ) {
			view.button( 'upload' ).focus();
		}
	}

	/**
	 * Run the file through the importer, as a check or for real.
	 *
	 * @param {boolean} commit Whether to import or only report.
	 * @return {Promise} When it has finished.
	 */
	function run( commit ) {
		let last = null;

		begin( view, file.rows, commit );

		return walk(
			ask,
			{
				page: config.importer,
				operation: config.operation,
				uuid: file.uuid,
				mapping: chosenColumns( box ),
				commit,
			},
			( progress ) => {
				last = progress;
				bar( view, last.done, last.total, commit );
			}
		).then(
			() => finish( view, last, commit ),
			( error ) => {
				stopped( view, last, commit );

				throw error;
			}
		);
	}

	const actions = {
		/**
		 * Hand back a file showing what the importer expects.
		 *
		 * @return {Promise} When it has been handed over.
		 */
		sample: () =>
			ask( 'sample', {
				params: { page: config.importer, operation: config.operation },
			} ).then( ( body ) => download( body.contents, body.filename ) ),

		/**
		 * Put the chosen file back.
		 */
		clear() {
			input.value = '';
			view.quiet();
			showChosen( view, input );
			input.focus();
		},

		/**
		 * Send the chosen file, then line its columns up.
		 *
		 * @return {Promise} When the columns are drawn.
		 */
		upload() {
			if ( ! picked( input ) ) {
				throw refusal(
					__(
						'Choose a CSV file first, or drag one onto the box.',
						'sugarcommerce'
					)
				);
			}

			const body = new window.FormData();
			const button = view.button( 'upload' );
			const label = button.textContent;

			body.append( 'import_file', picked( input ) );

			button.textContent = __( 'Uploading…', 'sugarcommerce' );

			return ask( 'upload', { params: page, method: 'POST', body } )
				.then( ( uploaded ) => {
					// Names and nothing under them: nothing to match or
					// import, and better said now than after matching.
					if ( ! uploaded.rows ) {
						discard( uploaded.uuid );

						throw refusal(
							__(
								'That file has column names but no rows under them. Add a row for each thing to import, then upload it again.',
								'sugarcommerce'
							)
						);
					}

					file = uploaded;

					// The first rows, to show what each column holds. The
					// screen works without them, so a failure here is not
					// one worth stopping for.
					return ask( 'file/' + uploaded.uuid, {
						params: page,
					} ).catch( () => null );
				} )
				.then( ( first ) => {
					preview = first;

					drawMapping( view, file, preview );
					view.step( 'map' );
					view.heading( 'map' ).focus();
				} )
				.finally( () => {
					button.textContent = label;
				} );
		},

		/**
		 * Read the whole file and report, without changing anything.
		 *
		 * @return {Promise} When the check has finished.
		 */
		check() {
			const missing = unmatched( box );

			if ( missing.length ) {
				missing[ 0 ].focus();

				throw refusal(
					sprintf(
						/* translators: %s: the columns that still need one from the file, as a list. */
						__(
							'Choose a column from your file for %s.',
							'sugarcommerce'
						),
						sentence(
							missing.map( ( select ) => select.dataset.label )
						)
					)
				);
			}

			return run( false );
		},

		/**
		 * Do it.
		 *
		 * @return {Promise} When the import has finished.
		 */
		import: () => run( true ),

		/**
		 * Back to the columns, to change something.
		 */
		back() {
			view.quiet();
			view.step( 'map' );
			view.heading( 'map' ).focus();
		},

		/**
		 * Start again with another file, throwing this one away.
		 */
		restart() {
			const uuid = file && file.uuid;

			file = null;
			preview = null;
			input.value = '';

			view.quiet();
			showChosen( view, input );
			view.step( 'choose' );
			input.focus();

			if ( uuid ) {
				discard( uuid );
			}
		},
	};

	input.addEventListener( 'change', chosen );

	listenForDrops(
		view.region( 'drop' ),
		input,
		chosen,
		options.DataTransfer || window.DataTransfer
	);

	box.addEventListener( 'click', ( event ) => {
		const pressed = event.target.closest( 'button[data-action]' );
		const action = pressed && pressed.dataset.action;

		if (
			! pressed ||
			! Object.prototype.hasOwnProperty.call( actions, action )
		) {
			return;
		}

		event.preventDefault();

		if ( FRESH.indexOf( action ) !== -1 ) {
			view.quiet();
		}

		view.busy( true );

		Promise.resolve()
			.then( actions[ action ] )
			.catch( ( error ) => {
				view.alert( friendly( error ) );
			} )
			.finally( () => {
				view.busy( false );
			} );
	} );

	return view;
}
