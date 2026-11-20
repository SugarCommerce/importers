/**
 * The results card: the bar while a check or an import runs, then how it
 * went, in words a person would use, and what comes next.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

import { icon, make } from '../lib/dom';
import { count } from '../lib/format';

/**
 * How far along, as a whole percentage no greater than 100.
 *
 * @param {number} done  Rows done.
 * @param {number} total Rows in all.
 * @return {number} The percentage.
 */
export const percent = ( done, total ) =>
	total ? Math.min( 100, Math.round( ( done / total ) * 100 ) ) : 0;

/**
 * Move the bar.
 *
 * @param {Object}  view   The operation's view.
 * @param {number}  done   Rows done.
 * @param {number}  total  Rows in all.
 * @param {boolean} commit Whether this is an import.
 */
export function bar( view, done, total, commit ) {
	const meter = view.region( 'bar' );
	const at = percent( done, total );

	meter.setAttribute( 'aria-valuenow', String( at ) );
	meter.firstElementChild.style.width = at + '%';

	view.region( 'count' ).textContent = commit
		? sprintf(
				/* translators: 1: rows imported so far, 2: rows in the file. */
				_n(
					'Imported %1$s of %2$s row',
					'Imported %1$s of %2$s rows',
					total,
					'sugarcommerce'
				),
				count( done ),
				count( total )
			)
		: sprintf(
				/* translators: 1: rows checked so far, 2: rows in the file. */
				_n(
					'Checked %1$s of %2$s row',
					'Checked %1$s of %2$s rows',
					total,
					'sugarcommerce'
				),
				count( done ),
				count( total )
			);
}

/**
 * Get the card ready for a run: no result yet, the bar at nothing.
 *
 * @param {Object}  view   The operation's view.
 * @param {number}  total  Rows in the file.
 * @param {boolean} commit Whether this is an import.
 */
export function begin( view, total, commit ) {
	view.step( commit ? 'import' : 'check' );

	view.region( 'mark' ).hidden = true;
	view.region( 'title' ).textContent = commit
		? __( 'Importing Your File', 'sugarcommerce' )
		: __( 'Checking Your File', 'sugarcommerce' );
	view.region( 'lede' ).textContent = __(
		'This can take a minute for a big file. Keep this page open until it finishes.',
		'sugarcommerce'
	);
	view.region( 'progress' ).hidden = false;
	view.region( 'summary' ).replaceChildren();
	view.region( 'errors' ).replaceChildren();
	view.region( 'report-actions' ).hidden = true;

	bar( view, 0, total, commit );
	view.region( 'title' ).focus();
}

/**
 * What a finished run comes to.
 *
 * A check passes a row as "skipped": everything was done to it except the
 * one thing that writes.
 *
 * @param {Object|null} state  The last progress, or null for none.
 * @param {boolean}     commit Whether this was an import.
 * @return {Object} good, failed, title, lede and figures (label, number
 *                  and tone of each).
 */
export function outcome( state, commit ) {
	state = state || {
		created: 0,
		updated: 0,
		skipped: 0,
		failed: 0,
		errors: {},
	};

	const failed = state.failed || 0;
	const good = commit
		? ( state.created || 0 ) + ( state.updated || 0 )
		: state.skipped || 0;

	if ( commit ) {
		let lede = sprintf(
			/* translators: %s: how many rows were imported. */
			_n(
				'%s row was imported.',
				'%s rows were imported.',
				good,
				'sugarcommerce'
			),
			count( good )
		);

		if ( failed ) {
			lede +=
				' ' +
				sprintf(
					/* translators: %s: how many rows could not be imported. */
					_n(
						'%s row couldn’t be imported, and is listed below.',
						'%s rows couldn’t be imported, and are listed below.',
						failed,
						'sugarcommerce'
					),
					count( failed )
				);
		}

		return {
			good,
			failed,
			title: failed
				? __( 'Import Finished, With Some Problems', 'sugarcommerce' )
				: __( 'Import Complete', 'sugarcommerce' ),
			lede,
			figures: [
				[ __( 'Created', 'sugarcommerce' ), state.created, '' ],
				[ __( 'Updated', 'sugarcommerce' ), state.updated, '' ],
				[ __( 'Skipped', 'sugarcommerce' ), state.skipped, '' ],
				[
					__( 'Failed', 'sugarcommerce' ),
					failed,
					failed ? 'bad' : '',
				],
			],
		};
	}

	const figures = [
		[ __( 'Ready to Import', 'sugarcommerce' ), good, good ? 'good' : '' ],
		[ __( 'With Problems', 'sugarcommerce' ), failed, failed ? 'bad' : '' ],
	];

	if ( ! failed ) {
		return {
			good,
			failed,
			title: __( 'Your File Looks Good', 'sugarcommerce' ),
			// eslint-disable-next-line @wordpress/valid-sprintf -- the singular says "the row", not a number.
			lede: sprintf(
				/* translators: %s: how many rows are ready. */
				_n(
					'The row is ready to import. Nothing has been changed yet.',
					'All %s rows are ready to import. Nothing has been changed yet.',
					good,
					'sugarcommerce'
				),
				count( good )
			),
			figures,
		};
	}

	if ( good ) {
		return {
			good,
			failed,
			title: __( 'Some Rows Need Attention', 'sugarcommerce' ),
			lede: sprintf(
				/* translators: 1: "3 rows are", how many rows are ready, 2: "2 rows", how many have problems. */
				__(
					'%1$s ready to import and %2$s problems. Import the good rows now and the others are skipped, or fix your file and upload it again.',
					'sugarcommerce'
				),
				sprintf(
					/* translators: %s: how many rows are ready. */
					_n( '%s row is', '%s rows are', good, 'sugarcommerce' ),
					count( good )
				),
				sprintf(
					/* translators: %s: how many rows have problems. */
					_n( '%s row has', '%s rows have', failed, 'sugarcommerce' ),
					count( failed )
				)
			),
			figures,
		};
	}

	return {
		good,
		failed,
		title: __( 'None of the Rows Can Be Imported Yet', 'sugarcommerce' ),
		lede: __(
			'Every row has a problem. Check the columns are matched correctly, or fix your file and upload it again.',
			'sugarcommerce'
		),
		figures,
	};
}

/**
 * The mark over a result: a tick, or a warning.
 *
 * @param {Object} view The operation's view.
 * @param {string} name success or warning.
 */
function mark( view, name ) {
	const element = view.region( 'mark' );

	element.className = 'importers__mark importers__mark--' + name;
	element.replaceChildren( icon( name, view.box.ownerDocument ) );
	element.hidden = false;
}

/**
 * A row of figures.
 *
 * @param {Object}  view    The operation's view.
 * @param {Array[]} figures Label, number and tone of each.
 */
function stats( view, figures ) {
	const list = make( 'dl', 'importers__stats' );

	figures.forEach( ( [ label, number, tone ] ) => {
		const item = make(
			'div',
			'importers__stat' + ( tone ? ' importers__stat--' + tone : '' )
		);

		item.append(
			make( 'dt', '', label ),
			make( 'dd', '', count( number ) )
		);
		list.appendChild( item );
	} );

	view.region( 'summary' ).replaceChildren( list );
}

/**
 * List what went wrong, by row.
 *
 * @param {Object} view  The operation's view.
 * @param {Object} state What has happened: `errors` by row number, and how
 *                       many more were left out (`truncated`).
 */
export function problems( view, state ) {
	const rows = Object.keys( state.errors || {} );

	if ( ! rows.length ) {
		view.region( 'errors' ).replaceChildren();

		return;
	}

	const wrapper = make( 'div', 'importers__problems' );
	const items = make( 'ul', 'importers__problem-list' );

	rows.sort( ( a, b ) => a - b ).forEach( ( row ) => {
		const item = make( 'li' );

		item.append(
			make(
				'span',
				'importers__problem-row',
				/* translators: %s: a row number in the file. */
				sprintf( __( 'Row %s', 'sugarcommerce' ), count( row ) )
			),
			make( 'span', 'importers__problem-reason', state.errors[ row ] )
		);
		items.appendChild( item );
	} );

	wrapper.append(
		make(
			'h4',
			'importers__problems-title',
			__( 'Rows With Problems', 'sugarcommerce' )
		),
		items
	);

	if ( state.truncated ) {
		wrapper.appendChild(
			make(
				'p',
				'importers__problems-more',
				sprintf(
					/* translators: %s: how many more rows had problems. */
					_n(
						'And %s more row with a problem, not listed here.',
						'And %s more rows with problems, not listed here.',
						state.truncated,
						'sugarcommerce'
					),
					count( state.truncated )
				)
			)
		);
	}

	view.region( 'errors' ).replaceChildren( wrapper );
}

/**
 * Say how it went, and offer what comes next.
 *
 * @param {Object}      view   The operation's view.
 * @param {Object|null} state  What happened.
 * @param {boolean}     commit Whether this was an import.
 */
export function finish( view, state, commit ) {
	const result = outcome( state, commit );
	const importing = view.button( 'import' );
	const again = view.button( 'restart', view.region( 'report-actions' ) );

	view.region( 'progress' ).hidden = true;

	stats( view, result.figures );
	mark( view, result.failed ? 'warning' : 'success' );
	view.region( 'title' ).textContent = result.title;
	view.region( 'lede' ).textContent = result.lede;

	problems( view, state || { errors: {} } );

	importing.hidden = commit || ! result.good;
	importing.textContent = sprintf(
		/* translators: %s: how many rows will be imported. */
		_n( 'Import %s Row', 'Import %s Rows', result.good, 'sugarcommerce' ),
		count( result.good )
	);

	view.button( 'back' ).hidden = commit;

	again.hidden = ! commit && !! result.good;
	again.className = commit ? 'button button-primary' : 'button';
	again.textContent = commit
		? __( 'Import Another File', 'sugarcommerce' )
		: __( 'Choose a Different File', 'sugarcommerce' );

	view.region( 'report-actions' ).hidden = false;

	view.step( commit ? 'import' : 'check', true );
	view.region( 'title' ).focus();
}

/**
 * Say a run stopped part way, and what it managed.
 *
 * @param {Object}      view   The operation's view.
 * @param {Object|null} state  What happened before it stopped.
 * @param {boolean}     commit Whether this was an import.
 */
export function stopped( view, state, commit ) {
	const again = view.button( 'restart', view.region( 'report-actions' ) );

	view.region( 'progress' ).hidden = true;

	mark( view, 'warning' );

	view.region( 'title' ).textContent = commit
		? __( 'The Import Stopped', 'sugarcommerce' )
		: __( 'The Check Stopped', 'sugarcommerce' );

	view.region( 'lede' ).textContent =
		commit && state && state.done
			? sprintf(
					/* translators: %s: how many rows were done before it stopped. */
					_n(
						'%s row was done before it stopped, and stays imported.',
						'%s rows were done before it stopped, and stay imported.',
						state.done,
						'sugarcommerce'
					),
					count( state.done )
				)
			: __( 'Nothing has been changed.', 'sugarcommerce' );

	if ( state ) {
		problems( view, state );
	}

	view.button( 'import' ).hidden = true;
	view.button( 'back' ).hidden = false;

	again.hidden = false;
	again.className = 'button';
	again.textContent = __( 'Choose a Different File', 'sugarcommerce' );

	view.region( 'report-actions' ).hidden = false;
}
