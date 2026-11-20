/**
 * Lining the file's columns up with the importer's.
 *
 * Each of the importer's columns gets a select holding the file's own
 * headers, and one whose name matches is chosen already -- which is most of
 * them, most of the time. Under it, what the first row has in the column
 * chosen: the quickest way to see a match is wrong.
 *
 * The importer's columns are read back from the table the screen prints
 * (Screen::columns()), so the two cannot disagree.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

import { all, make } from '../lib/dom';
import { count, squash } from '../lib/format';

/**
 * How much of a cell is shown under its select.
 */
const SHOWN = 60;

/**
 * The importer's columns, from the table that describes them.
 *
 * @param {HTMLElement} box The operation's element.
 * @return {Object[]} Each column's key, label, what it holds, whether it is
 *                    required, and a copy of its badge.
 */
export function columns( box ) {
	return all( '.importers__columns tbody tr[data-field]', box ).map(
		( row ) => {
			const needed = row.querySelector( '.importers__needed' );
			const badge = needed && needed.firstElementChild;

			return {
				key: row.dataset.field,
				label: row.dataset.label,
				holds: row.dataset.holds,
				required: row.hasAttribute( 'data-required' ),
				badge: badge ? badge.cloneNode( true ) : null,
			};
		}
	);
}

/**
 * The file's header that matches a column, by its key or its label.
 *
 * @param {Object}   column  The column: its key and label.
 * @param {string[]} headers The file's headers.
 * @return {string|null} The first that matches, or null.
 */
export function match( column, headers ) {
	const wanted = [ squash( column.key ), squash( column.label ) ];
	const found = headers.find(
		( header ) => wanted.indexOf( squash( header ) ) !== -1
	);

	return undefined === found ? null : found;
}

/**
 * What to say about the matching that was done for them.
 *
 * @param {number} matched How many columns were matched.
 * @param {number} total   How many there are.
 * @return {string} The sentence.
 */
export function matchedSummary( matched, total ) {
	if ( ! matched ) {
		return __(
			'None of your file’s column names matched, so choose a column from your file for each one below.',
			'sugarcommerce'
		);
	}

	if ( matched === total ) {
		// eslint-disable-next-line @wordpress/valid-sprintf -- the singular says "the column", not a number.
		return sprintf(
			/* translators: %s: how many columns there are. */
			_n(
				'The column was matched for you. Check it looks right.',
				'All %s columns were matched for you. Check they look right.',
				total,
				'sugarcommerce'
			),
			count( total )
		);
	}

	return sprintf(
		/* translators: 1: how many columns were matched, 2: how many there are. */
		_n(
			'We matched %1$s of %2$s column for you. Choose the rest from your file.',
			'We matched %1$s of %2$s columns for you. Choose the rest from your file.',
			total,
			'sugarcommerce'
		),
		count( matched ),
		count( total )
	);
}

/**
 * What the first row has in a column, in words.
 *
 * @param {Object|null} preview The file's first rows, as the server sent
 *                              them, or null when it did not.
 * @param {string}      header  The file's column; '' for none.
 * @return {string|null} What to say, or null to say nothing.
 */
export function firstRowSays( preview, header ) {
	const first = preview && preview.rows && preview.rows[ 0 ];

	if ( ! header || ! first ) {
		return null;
	}

	const value = first[ header ];
	const cell = String(
		null === value || undefined === value ? '' : value
	).trim();

	if ( '' === cell ) {
		return __( 'Empty in the first row', 'sugarcommerce' );
	}

	return sprintf(
		/* translators: %s: what the file's first row has in the chosen column. */
		__( 'First row: %s', 'sugarcommerce' ),
		cell.length > SHOWN ? cell.slice( 0, SHOWN ) + '…' : cell
	);
}

/**
 * Say what the first row has in the column a select points at.
 *
 * @param {HTMLSelectElement} select  The select.
 * @param {HTMLElement}       value   Where to say it.
 * @param {Object|null}       preview The file's first rows.
 */
function showValue( select, value, preview ) {
	const said = firstRowSays( preview, select.value );

	value.hidden = null === said;
	value.textContent = null === said ? '' : said;
}

/**
 * Build the column matching rows.
 *
 * @param {Object}      view    The operation's view.
 * @param {Object}      file    The upload: its name, rows and headers.
 * @param {Object|null} preview The file's first rows, when they came.
 */
export function drawMapping( view, file, preview ) {
	const rows = document.createDocumentFragment();
	const wanted = columns( view.box );
	let matched = 0;

	wanted.forEach( ( column ) => {
		const id = 'map-' + view.box.id + '-' + column.key;
		const row = make( 'div', 'importers__map-row' );
		const about = make( 'div', 'importers__map-about' );
		const title = make( 'div', 'importers__map-title' );
		const control = make( 'div', 'importers__map-control' );
		const label = make( 'label', 'importers__map-label', column.label );
		const select = document.createElement( 'select' );
		const holds = make( 'p', 'importers__map-holds', column.holds );
		const value = make( 'p', 'importers__map-value' );
		const found = match( column, file.headers );

		label.htmlFor = id;
		title.appendChild( label );

		if ( column.badge ) {
			title.appendChild( column.badge );
		}

		holds.id = id + '-holds';

		about.append( title, holds );

		select.id = id;
		select.dataset.field = column.key;
		select.dataset.label = column.label;
		select.required = column.required;
		select.setAttribute(
			'aria-describedby',
			holds.id + ' ' + id + '-value'
		);

		select.appendChild(
			make(
				'option',
				'',
				column.required
					? __( 'Choose a Column', 'sugarcommerce' )
					: __( 'Don’t Import', 'sugarcommerce' )
			)
		).value = '';

		let chosen = false;

		file.headers.forEach( ( header ) => {
			const option = make( 'option', '', header );

			option.value = header;

			// The first header that matches, and only that one: a file
			// with two columns called the same keeps the first.
			if ( ! chosen && null !== found && header === found ) {
				option.selected = true;
				chosen = true;
			}

			select.appendChild( option );
		} );

		matched += chosen ? 1 : 0;

		value.id = id + '-value';

		select.addEventListener( 'change', () => {
			select.removeAttribute( 'aria-invalid' );
			row.classList.remove( 'is-invalid' );
			showValue( select, value, preview );

			// The last column it asked for has one: what the warning
			// said is no longer true.
			if (
				! view.box.querySelector( '.importers__map-row.is-invalid' )
			) {
				view.quiet();
			}
		} );

		showValue( select, value, preview );

		control.append( select, value );
		row.append( about, control );
		rows.appendChild( row );
	} );

	view.region( 'mapping' ).replaceChildren( rows );
	view.region( 'matched' ).textContent = matchedSummary(
		matched,
		wanted.length
	);

	view.region( 'uploaded-name' ).textContent = file.name;
	view.region( 'uploaded-rows' ).textContent = sprintf(
		/* translators: %s: how many rows the file has. */
		_n( '%s row', '%s rows', file.rows, 'sugarcommerce' ),
		count( file.rows )
	);
}

/**
 * The required columns nobody has chosen a file column for, marked.
 *
 * @param {HTMLElement} box The operation's element.
 * @return {HTMLSelectElement[]} Their selects.
 */
export function unmatched( box ) {
	const missing = [];

	all( '[data-region="mapping"] select', box ).forEach( ( select ) => {
		const empty = select.required && ! select.value;

		if ( empty ) {
			select.setAttribute( 'aria-invalid', 'true' );
			missing.push( select );
		} else {
			select.removeAttribute( 'aria-invalid' );
		}

		select
			.closest( '.importers__map-row' )
			.classList.toggle( 'is-invalid', empty );
	} );

	return missing;
}

/**
 * What the selects say.
 *
 * @param {HTMLElement} box The operation's element.
 * @return {Object} Field key to the file's column name.
 */
export function chosenColumns( box ) {
	const chosen = {};

	all( '[data-region="mapping"] select', box ).forEach( ( select ) => {
		if ( select.value ) {
			chosen[ select.dataset.field ] = select.value;
		}
	} );

	return chosen;
}
