/**
 * Choosing a file: what is turned away before it is sent, the chosen file
 * shown, and a file dropped on the zone put into the input.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	listenForDrops,
	picked,
	problemWith,
	showChosen,
} from '../../src/js/importers/choose';
import { createView } from '../../src/js/importers/view';
import {
	FakeTransfer,
	controlFiles,
	csv,
	dragEvent,
	loadScreen,
	said,
} from './support/screen';

const MB = 1024 * 1024;

describe( 'what is turned away', () => {
	test( 'a file that is not a CSV, by its name', () => {
		expect( problemWith( { name: 'sheet.xlsx', size: 10 }, 0 ) ).toBe(
			'“sheet.xlsx” isn’t a CSV file. Save your spreadsheet as CSV (the name ends in .csv) and choose that instead.'
		);
		expect(
			problemWith( { name: 'products.csv.txt', size: 10 }, 0 )
		).not.toBe( '' );
		expect( problemWith( { name: 'csv', size: 10 }, 0 ) ).not.toBe( '' );
		expect( problemWith( { name: 'PRODUCTS.CSV', size: 10 }, 0 ) ).toBe(
			''
		);
		expect( problemWith( { name: '.csv', size: 10 }, 0 ) ).toBe( '' );
	} );

	test( 'a file over the site’s limit, which is named', () => {
		expect(
			problemWith( { name: 'a.csv', size: 8 * MB + 1 }, 8 * MB )
		).toBe(
			'That file is larger than this site accepts (8 MB). Split it into smaller files and import them one at a time.'
		);
		expect( problemWith( { name: 'a.csv', size: 8 * MB }, 8 * MB ) ).toBe(
			''
		);
	} );

	test( 'no limit, or no file, is nothing to say', () => {
		expect( problemWith( { name: 'a.csv', size: 900 * MB }, 0 ) ).toBe(
			''
		);
		expect( problemWith( null, 8 * MB ) ).toBe( '' );
	} );

	test( 'the name is said before the size', () => {
		expect(
			problemWith( { name: 'a.xlsx', size: 9 * MB }, 8 * MB )
		).toContain( 'isn’t a CSV file' );
	} );
} );

describe( 'the chosen file', () => {
	let box;
	let view;
	let input;
	let files;

	beforeEach( () => {
		box = loadScreen();
		view = createView( box );
		input = box.querySelector( '[data-input="file"]' );
		files = controlFiles( input );
	} );

	test( 'its name and size in place of the drop zone, and the zone back without one', () => {
		input.files = [ csv( 'products.csv', 'x'.repeat( 2048 ) ) ];
		showChosen( view, input );

		expect( view.region( 'chosen' ).hidden ).toBe( false );
		expect( view.region( 'drop' ).hidden ).toBe( true );
		expect( said( box, 'file-name' ) ).toBe( 'products.csv' );
		expect( said( box, 'file-size' ) ).toBe( '2 KB' );

		input.value = '';
		showChosen( view, input );

		expect( view.region( 'chosen' ).hidden ).toBe( true );
		expect( view.region( 'drop' ).hidden ).toBe( false );
	} );

	test( 'picked is the first file, or none', () => {
		expect( picked( input ) ).toBeNull();
		expect( picked( { files: null } ) ).toBeNull();

		const first = csv( 'a.csv' );

		files.pick( first, csv( 'b.csv' ) );
		expect( picked( input ) ).toBe( first );
	} );
} );

describe( 'dropping a file', () => {
	let drop;
	let input;
	let chosen;

	beforeEach( () => {
		const box = loadScreen();

		drop = box.querySelector( '[data-region="drop"]' );
		input = box.querySelector( '[data-input="file"]' );
		controlFiles( input );
		chosen = vi.fn();

		listenForDrops( drop, input, chosen, FakeTransfer );
	} );

	test( 'over the zone it is a copy, and the zone says so', () => {
		const enter = dragEvent( 'dragenter' );
		const over = dragEvent( 'dragover' );

		drop.dispatchEvent( enter );
		drop.dispatchEvent( over );

		expect( enter.defaultPrevented ).toBe( true );
		expect( over.defaultPrevented ).toBe( true );
		expect( over.dataTransfer.dropEffect ).toBe( 'copy' );
		expect( drop.classList ).toContain( 'is-dragging' );
	} );

	test( 'leaving one of the zone’s own children does not leave the zone', () => {
		drop.dispatchEvent( dragEvent( 'dragenter' ) );
		drop.dispatchEvent( dragEvent( 'dragenter' ) );
		drop.dispatchEvent( dragEvent( 'dragleave' ) );

		expect( drop.classList ).toContain( 'is-dragging' );

		drop.dispatchEvent( dragEvent( 'dragleave' ) );

		expect( drop.classList ).not.toContain( 'is-dragging' );

		// A stray leave never takes the count below nothing.
		drop.dispatchEvent( dragEvent( 'dragleave' ) );
		drop.dispatchEvent( dragEvent( 'dragenter' ) );

		expect( drop.classList ).toContain( 'is-dragging' );

		drop.dispatchEvent( dragEvent( 'dragleave' ) );

		expect( drop.classList ).not.toContain( 'is-dragging' );
	} );

	test( 'the first file dropped goes into the input, and is taken', () => {
		const first = csv( 'a.csv' );
		const event = dragEvent( 'drop', [ first, csv( 'b.csv' ) ] );

		drop.dispatchEvent( dragEvent( 'dragenter' ) );
		drop.dispatchEvent( dragEvent( 'dragenter' ) );
		drop.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
		expect( [ ...input.files ] ).toEqual( [ first ] );
		expect( chosen ).toHaveBeenCalledTimes( 1 );
		expect( drop.classList ).not.toContain( 'is-dragging' );

		// The count started again from nothing.
		drop.dispatchEvent( dragEvent( 'dragenter' ) );
		drop.dispatchEvent( dragEvent( 'dragleave' ) );

		expect( drop.classList ).not.toContain( 'is-dragging' );
	} );

	test( 'a drop with no files in it is nothing', () => {
		const event = dragEvent( 'drop', [] );

		drop.dispatchEvent( event );

		const bare = new window.Event( 'drop', { cancelable: true } );

		drop.dispatchEvent( bare );

		expect( event.defaultPrevented ).toBe( true );
		expect( bare.defaultPrevented ).toBe( true );
		expect( chosen ).not.toHaveBeenCalled();
		expect( input.files ).toHaveLength( 0 );
	} );
} );
