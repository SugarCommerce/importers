/**
 * One operation from end to end, on the screen's own markup, against a
 * stand-in for the site: choose, upload, match, check, import, and every
 * way back.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { setupOperation } from '../../assets/js/importers/operation';
import {
	FakeTransfer,
	controlFiles,
	csv,
	dragEvent,
	loadScreen,
	press,
	said,
	settle,
} from './support/screen';
import { REST, fakeSite, importing, refuse } from './support/site';

const UUID = '0f0e0d0c-0b0a-4908-8706-050403020100';

let box;
let files;
let input;

/**
 * Wire the operation up against a site.
 *
 * @param {Object} routes What the site answers.
 * @return {Object} apiFetch and save, to assert on.
 */
function start( routes ) {
	const apiFetch = fakeSite( routes );
	const save = vi.fn();

	setupOperation( box, { apiFetch, save, DataTransfer: FakeTransfer } );

	return { apiFetch, save };
}

/**
 * Choose a file and upload it.
 *
 * @param {File} file The file.
 */
async function upload( file = csv() ) {
	files.pick( file );
	press( box, 'upload' );
	await settle();
}

const routes = ( apiFetch ) => apiFetch.requests.map( ( r ) => r.route );
const shown = () =>
	[ ...box.querySelectorAll( 'section[data-step]' ) ]
		.filter( ( section ) => ! section.hidden )
		.map( ( section ) => section.dataset.step );
const alerted = () => said( box, 'alert' );
const select = ( field ) =>
	box.querySelector(
		'[data-region="mapping"] select[data-field="' + field + '"]'
	);

beforeEach( () => {
	box = loadScreen();
	input = box.querySelector( '[data-input="file"]' );
	files = controlFiles( input );
} );

describe( 'choosing a file', () => {
	test( 'a CSV is shown, and Upload is next', () => {
		start( importing() );

		files.pick( csv( 'products.csv', 'x'.repeat( 100 ) ) );

		expect( said( box, 'file-name' ) ).toBe( 'products.csv' );
		expect( said( box, 'file-size' ) ).toBe( '100 bytes' );
		expect( box.querySelector( '[data-region="drop"]' ).hidden ).toBe(
			true
		);
		expect( document.activeElement ).toBe(
			box.querySelector( '[data-action="upload"]' )
		);
		expect( alerted() ).toBe( '' );
	} );

	test( 'anything else is turned away there and then, and the input emptied', () => {
		start( importing() );

		files.pick( csv( 'products.xlsx' ) );

		expect( alerted() ).toBe(
			'“products.xlsx” isn’t a CSV file. Save your spreadsheet as CSV (the name ends in .csv) and choose that instead.'
		);
		expect( input.files ).toHaveLength( 0 );
		expect( box.querySelector( '[data-region="chosen"]' ).hidden ).toBe(
			true
		);
		expect( box.querySelector( '[data-region="drop"]' ).hidden ).toBe(
			false
		);

		// A good one takes the warning back.
		files.pick( csv() );
		expect( alerted() ).toBe( '' );
	} );

	test( 'a file over the site’s limit too', () => {
		box.dataset.maxSize = '10';
		start( importing() );

		files.pick( csv( 'big.csv', 'x'.repeat( 11 ) ) );

		expect( alerted() ).toBe(
			'That file is larger than this site accepts (10 bytes). Split it into smaller files and import them one at a time.'
		);
		expect( input.files ).toHaveLength( 0 );
	} );

	test( 'a dropped file is chosen like a picked one', () => {
		start( importing() );

		const drop = box.querySelector( '[data-region="drop"]' );

		drop.dispatchEvent( dragEvent( 'drop', [ csv( 'dropped.csv' ) ] ) );

		expect( said( box, 'file-name' ) ).toBe( 'dropped.csv' );
		expect( input.files ).toHaveLength( 1 );

		drop.dispatchEvent( dragEvent( 'drop', [ csv( 'dropped.txt' ) ] ) );

		expect( alerted() ).toContain( '“dropped.txt” isn’t a CSV file.' );
		expect( input.files ).toHaveLength( 0 );
	} );

	test( 'the remove button puts it back', async () => {
		start( importing() );
		files.pick( csv() );

		press( box, 'clear' );
		await settle();

		expect( input.files ).toHaveLength( 0 );
		expect( box.querySelector( '[data-region="drop"]' ).hidden ).toBe(
			false
		);
		expect( document.activeElement ).toBe( input );
	} );

	test( 'Upload with nothing chosen says what to do, and sends nothing', async () => {
		const { apiFetch } = start( importing() );

		press( box, 'upload' );
		await settle();

		expect( alerted() ).toBe(
			'Choose a CSV file first, or drag one onto the box.'
		);
		expect( apiFetch ).not.toHaveBeenCalled();
		expect( box.querySelector( '[data-action="upload"]' ).disabled ).toBe(
			false
		);
	} );
} );

describe( 'uploading', () => {
	test( 'the file goes as import_file, then its first rows are asked for, then the columns', async () => {
		const { apiFetch } = start( importing( { rows: 12 } ) );
		const file = csv();

		await upload( file );

		expect( routes( apiFetch ) ).toEqual( [
			'POST upload',
			'GET file/:uuid',
		] );

		const [ sent, first ] = apiFetch.requests;

		expect( sent.url ).toBe( REST + 'upload?page=myplugin' );
		expect( sent.headers[ 'X-WP-Nonce' ] ).toBe( 'nonce' );
		expect( sent.body ).toBeInstanceOf( window.FormData );
		expect( [ ...sent.body.keys() ] ).toEqual( [ 'import_file' ] );
		expect( sent.body.get( 'import_file' ).name ).toBe( file.name );
		expect( first.url ).toBe( REST + 'file/' + UUID + '?page=myplugin' );

		expect( shown() ).toEqual( [ 'map' ] );
		expect( box.dataset.state ).toBe( 'map' );
		expect( said( box, 'uploaded-name' ) ).toBe( 'products.csv' );
		expect( said( box, 'uploaded-rows' ) ).toBe( '12 rows' );
		expect( select( 'sku' ).value ).toBe( 'SKU' );
		expect( said( box, 'mapping' ) ).toContain( 'First row: A-1' );
		expect( document.activeElement ).toBe(
			box.querySelector( '#myplugin-products-map-title' )
		);
		expect(
			box.querySelector( '[data-action="upload"]' ).textContent
		).toBe( 'Upload and Continue' );
		expect( box.getAttribute( 'aria-busy' ) ).toBe( 'false' );
	} );

	test( 'every button waits, and Upload says it is uploading, until the answer', async () => {
		let answer;
		const { apiFetch } = start( {
			...importing(),
			'POST upload': () =>
				new Promise( ( resolve ) => {
					answer = resolve;
				} ),
		} );

		files.pick( csv() );
		press( box, 'upload' );
		await settle();

		const button = box.querySelector( '[data-action="upload"]' );

		expect( button.textContent ).toBe( 'Uploading…' );
		expect(
			[ ...box.querySelectorAll( 'button[data-action]' ) ].every(
				( b ) => b.disabled
			)
		).toBe( true );
		expect( box.getAttribute( 'aria-busy' ) ).toBe( 'true' );

		answer( importing()[ 'POST upload' ] );
		await settle();

		expect( button.textContent ).toBe( 'Upload and Continue' );
		expect( button.disabled ).toBe( false );
		expect( routes( apiFetch ) ).toHaveLength( 2 );
	} );

	test( 'no preview is no reason to stop: the columns come without it', async () => {
		start( {
			...importing(),
			'GET file/:uuid': () => refuse( 'x', 'Gone.', 500 ),
		} );

		await upload();

		expect( shown() ).toEqual( [ 'map' ] );
		expect( alerted() ).toBe( '' );
		expect( said( box, 'mapping' ) ).not.toContain( 'First row' );
	} );

	test( 'a file of names and no rows is said, thrown away, and stays on the first step', async () => {
		const { apiFetch } = start( {
			...importing(),
			'POST upload': {
				uuid: UUID,
				name: 'empty.csv',
				rows: 0,
				headers: [ 'a' ],
			},
		} );

		await upload();

		expect( alerted() ).toBe(
			'That file has column names but no rows under them. Add a row for each thing to import, then upload it again.'
		);
		expect( routes( apiFetch ) ).toEqual( [
			'POST upload',
			'DELETE file/:uuid',
		] );
		expect( apiFetch.requests[ 1 ].url ).toBe(
			REST + 'file/' + UUID + '?page=myplugin'
		);
		expect( shown() ).toEqual( [ 'choose' ] );
	} );

	test( 'the server’s refusal is said in its words', async () => {
		start( {
			...importing(),
			'POST upload': () =>
				refuse( 'importers_type', 'Only CSV files can be imported.' ),
		} );

		await upload();

		expect( alerted() ).toBe( 'Only CSV files can be imported.' );
		expect( shown() ).toEqual( [ 'choose' ] );
		expect(
			box.querySelector( '[data-action="upload"]' ).textContent
		).toBe( 'Upload and Continue' );
	} );

	test( 'no answer at all is the connection, not "Failed to fetch"', async () => {
		start( {
			...importing(),
			'POST upload': () =>
				Promise.reject( {
					code: 'fetch_error',
					message: 'Failed to fetch',
				} ),
		} );

		await upload();

		expect( alerted() ).toBe(
			'We couldn’t reach your site. Check your connection and try again.'
		);
	} );
} );

describe( 'checking', () => {
	test( 'a required column left empty is named, focused, and nothing is sent', async () => {
		const { apiFetch } = start( {
			...importing(),
			'POST upload': {
				uuid: UUID,
				name: 'p.csv',
				rows: 3,
				headers: [ 'Cost' ],
			},
		} );

		await upload();
		press( box, 'check' );
		await settle();

		expect( alerted() ).toBe( 'Choose a column from your file for Code.' );
		expect( document.activeElement ).toBe( select( 'sku' ) );
		expect( select( 'sku' ).getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect( routes( apiFetch ) ).not.toContain( 'POST run' );
		expect( shown() ).toEqual( [ 'map' ] );

		// Choosing it takes the warning back.
		select( 'sku' ).value = 'Cost';
		select( 'sku' ).dispatchEvent( new window.Event( 'change' ) );

		expect( alerted() ).toBe( '' );
	} );

	test( 'every required column left empty is named in one sentence', async () => {
		box.querySelector( 'tr[data-field="price"]' ).setAttribute(
			'data-required',
			''
		);
		box.querySelector( 'tr[data-field="status"]' ).setAttribute(
			'data-required',
			''
		);
		start( {
			...importing(),
			'POST upload': {
				uuid: UUID,
				name: 'p.csv',
				rows: 3,
				headers: [ 'x' ],
			},
		} );

		await upload();
		press( box, 'check' );
		await settle();

		expect( alerted() ).toBe(
			'Choose a column from your file for Code, Price, and Status.'
		);
	} );

	test( 'the file walked a batch at a time, without changing anything, then the result', async () => {
		const { apiFetch } = start(
			importing( { rows: 7, batch: 3, errors: { 3: 'No code.' } } )
		);

		await upload();
		select( 'price' ).value = 'Cost';
		press( box, 'check' );
		await settle();

		const runs = apiFetch.requests.filter(
			( r ) => 'POST run' === r.route
		);

		expect( runs.map( ( r ) => r.body ) ).toEqual(
			[ 0, 3, 6 ].map( ( offset ) => ( {
				page: 'myplugin',
				operation: 'products',
				uuid: UUID,
				mapping: {
					sku: 'SKU',
					price: 'Cost',
					released: 'Released',
					tags: 'Tags',
				},
				commit: false,
				offset,
			} ) )
		);
		expect( runs[ 0 ].url ).toBe( REST + 'run' );
		expect( runs[ 0 ].headers ).toEqual( {
			'X-WP-Nonce': 'nonce',
			'Content-Type': 'application/json',
		} );

		expect( shown() ).toEqual( [ 'report' ] );
		expect( box.dataset.state ).toBe( 'check' );
		expect( said( box, 'title' ) ).toBe( 'Some Rows Need Attention' );
		expect( said( box, 'count' ) ).toBe( 'Checked 7 of 7 rows' );
		expect(
			[ ...box.querySelectorAll( '.importers__problem-list li' ) ].map(
				( item ) =>
					[ ...item.children ].map( ( part ) => part.textContent )
			)
		).toEqual( [ [ 'Row 3', 'No code.' ] ] );
		expect(
			box.querySelector( '[data-action="import"]' ).textContent
		).toBe( 'Import 6 Rows' );
		expect( box.querySelector( '[data-action="import"]' ).hidden ).toBe(
			false
		);
	} );

	test( 'a batch that fails stops the check, and says so in words', async () => {
		let batches = 0;
		const routesFor = importing( { rows: 9, batch: 3 } );

		start( {
			...routesFor,
			'POST run': ( request ) =>
				++batches === 2
					? Promise.reject( {
							code: 'invalid_json',
							message:
								'The response is not a valid JSON response.',
						} )
					: routesFor[ 'POST run' ]( request ),
		} );

		await upload();
		press( box, 'check' );
		await settle();

		expect( said( box, 'title' ) ).toBe( 'The Check Stopped' );
		expect( said( box, 'lede' ) ).toBe( 'Nothing has been changed.' );
		expect( alerted() ).toBe(
			'Something went wrong on the server. Try again, and if it keeps happening, ask whoever looks after your site.'
		);
		expect( box.querySelector( '[data-action="back"]' ).hidden ).toBe(
			false
		);
		expect( box.getAttribute( 'aria-busy' ) ).toBe( 'false' );
	} );
} );

describe( 'importing', () => {
	test( 'after a check, Import walks it again for real, and offers another file', async () => {
		const { apiFetch } = start( importing( { rows: 4, batch: 3 } ) );

		await upload();
		press( box, 'check' );
		await settle();
		press( box, 'import' );
		await settle();

		const runs = apiFetch.requests.filter(
			( r ) => 'POST run' === r.route
		);

		expect( runs.map( ( r ) => [ r.body.commit, r.body.offset ] ) ).toEqual(
			[
				[ false, 0 ],
				[ false, 3 ],
				[ true, 0 ],
				[ true, 3 ],
			]
		);
		expect( box.dataset.state ).toBe( 'import' );
		expect( said( box, 'title' ) ).toBe( 'Import Complete' );
		expect( said( box, 'lede' ) ).toBe( '4 rows were imported.' );
		expect( said( box, 'count' ) ).toBe( 'Imported 4 of 4 rows' );

		const again = box.querySelector(
			'[data-region="report-actions"] [data-action="restart"]'
		);

		expect( again.hidden ).toBe( false );
		expect( again.textContent ).toBe( 'Import Another File' );
		expect( box.querySelector( '[data-action="back"]' ).hidden ).toBe(
			true
		);
		expect( box.querySelector( '[data-action="import"]' ).hidden ).toBe(
			true
		);
	} );

	test( 'an import that stops says what stays imported', async () => {
		let batches = 0;
		const routesFor = importing( { rows: 9, batch: 3 } );

		start( {
			...routesFor,
			'POST run': ( request ) =>
				request.body.commit && ++batches === 3
					? refuse(
							'importers_gone',
							'The file has gone. Upload it again.',
							410
						)
					: routesFor[ 'POST run' ]( request ),
		} );

		await upload();
		press( box, 'import' );
		await settle();

		expect( said( box, 'title' ) ).toBe( 'The Import Stopped' );
		expect( said( box, 'lede' ) ).toBe(
			'6 rows were done before it stopped, and stay imported.'
		);
		expect( alerted() ).toBe( 'The file has gone. Upload it again.' );
	} );

	test( 'what was said before a new run is taken back', async () => {
		start( importing() );

		await upload();
		box.querySelector( '[data-region="alert"]' ).textContent = 'Old news.';
		press( box, 'check' );
		await settle();

		expect( alerted() ).toBe( '' );
	} );
} );

describe( 'going back', () => {
	test( 'Back to Matching keeps the file and the choices', async () => {
		const { apiFetch } = start( importing( { errors: { 2: 'x' } } ) );

		await upload();
		select( 'price' ).value = 'Cost';
		press( box, 'check' );
		await settle();
		box.querySelector( '[data-region="alert"]' ).textContent = 'Old news.';
		press( box, 'back' );
		await settle();

		expect( shown() ).toEqual( [ 'map' ] );
		expect( select( 'price' ).value ).toBe( 'Cost' );
		expect( alerted() ).toBe( '' );
		expect( document.activeElement ).toBe(
			box.querySelector( '#myplugin-products-map-title' )
		);
		expect( routes( apiFetch ) ).not.toContain( 'DELETE file/:uuid' );
	} );

	test( 'another file throws this one away and starts again', async () => {
		const { apiFetch } = start( importing() );

		await upload();
		press( box, 'restart' );
		await settle();

		expect( shown() ).toEqual( [ 'choose' ] );
		expect( input.files ).toHaveLength( 0 );
		expect( box.querySelector( '[data-region="drop"]' ).hidden ).toBe(
			false
		);
		expect( document.activeElement ).toBe( input );
		expect( routes( apiFetch ).slice( -1 ) ).toEqual( [
			'DELETE file/:uuid',
		] );
		expect( apiFetch.requests.slice( -1 )[ 0 ].method ).toBe( 'DELETE' );

		// The next upload is a new file, not the old one.
		const { 'POST upload': uploaded } = importing();

		await upload( csv( 'second.csv' ) );
		expect( said( box, 'uploaded-name' ) ).toBe( uploaded.name );
		expect( shown() ).toEqual( [ 'map' ] );
	} );

	test( 'after an import too, from the results card', async () => {
		const { apiFetch } = start( importing() );

		await upload();
		press( box, 'import' );
		await settle();
		press(
			box,
			'restart',
			box.querySelector( '[data-region="report-actions"]' )
		);
		await settle();

		expect( shown() ).toEqual( [ 'choose' ] );
		expect(
			box
				.querySelector( '[data-marker="choose"]' )
				.classList.contains( 'is-current' )
		).toBe( true );
		expect( routes( apiFetch ).slice( -1 ) ).toEqual( [
			'DELETE file/:uuid',
		] );
	} );

	test( 'with no file uploaded there is nothing to throw away', async () => {
		const { apiFetch } = start( importing() );

		press( box, 'restart' );
		await settle();

		expect( apiFetch ).not.toHaveBeenCalled();
	} );

	test( 'a file that cannot be thrown away is no one’s problem', async () => {
		start( {
			...importing(),
			'DELETE file/:uuid': () => refuse( 'x', 'Nope.', 500 ),
		} );

		await upload();
		press( box, 'restart' );
		await settle();

		expect( alerted() ).toBe( '' );
		expect( shown() ).toEqual( [ 'choose' ] );
	} );
} );

describe( 'the sample file', () => {
	test( 'asked for by importer and operation, and handed over', async () => {
		const { apiFetch, save } = start( {
			'GET sample': {
				filename: 'products-sample.csv',
				contents: 'sku\nA-1\n',
			},
		} );

		box.querySelector( '[data-region="alert"]' ).textContent = 'Old news.';
		press( box, 'sample' );
		await settle();

		expect( apiFetch.requests[ 0 ].url ).toBe(
			REST + 'sample?page=myplugin&operation=products'
		);
		expect( save ).toHaveBeenCalledWith(
			'sku\nA-1\n',
			'products-sample.csv'
		);
		expect( alerted() ).toBe( '' );
	} );

	test( 'a refusal is said', async () => {
		const { save } = start( {
			'GET sample': () =>
				refuse(
					'rest_forbidden',
					'Sorry, you are not allowed to do that.',
					403
				),
		} );

		press( box, 'sample' );
		await settle();

		expect( save ).not.toHaveBeenCalled();
		expect( alerted() ).toBe( 'Sorry, you are not allowed to do that.' );
	} );
} );

describe( 'clicks', () => {
	test( 'a click inside a button counts as the button', async () => {
		const { save } = start( {
			'GET sample': { filename: 'a.csv', contents: '' },
		} );

		box.querySelector( '[data-action="sample"] svg' ).dispatchEvent(
			new window.MouseEvent( 'click', { bubbles: true } )
		);
		await settle();

		expect( save ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'anything that is not an action is left alone', async () => {
		const { apiFetch } = start( importing() );
		const stray = document.createElement( 'button' );
		const named = document.createElement( 'button' );
		const plain = new window.MouseEvent( 'click', {
			bubbles: true,
			cancelable: true,
		} );
		const odd = new window.MouseEvent( 'click', {
			bubbles: true,
			cancelable: true,
		} );

		named.dataset.action = 'toString';
		box.append( stray, named );
		stray.dispatchEvent( plain );
		named.dispatchEvent( odd );
		await settle();

		expect( plain.defaultPrevented ).toBe( false );
		expect( odd.defaultPrevented ).toBe( false );
		expect( box.hasAttribute( 'aria-busy' ) ).toBe( false );
		expect( apiFetch ).not.toHaveBeenCalled();
	} );

	test( 'an action’s click goes no further than the action', async () => {
		start( importing() );

		const click = new window.MouseEvent( 'click', {
			bubbles: true,
			cancelable: true,
		} );

		box.querySelector( '[data-action="clear"]' ).dispatchEvent( click );
		await settle();

		expect( click.defaultPrevented ).toBe( true );
	} );
} );
