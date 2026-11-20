/**
 * Lining the file's columns up: the obvious ones chosen already, what the
 * first row holds under each, and a required one left empty marked.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	chosenColumns,
	columns,
	drawMapping,
	firstRowSays,
	match,
	matchedSummary,
	unmatched,
} from '../../src/js/importers/mapping';
import { createView } from '../../src/js/importers/view';
import { loadScreen, said } from './support/screen';

const FILE = {
	uuid: 'u',
	name: 'products.csv',
	rows: 12,
	headers: [ 'SKU', 'Cost', 'Released on', 'tags', 'Notes' ],
};

const PREVIEW = {
	rows: [
		{
			SKU: 'A-1',
			Cost: '  ',
			'Released on': null,
			tags: 'x'.repeat( 61 ),
			Notes: 'x'.repeat( 60 ),
		},
	],
};

let box;
let view;

beforeEach( () => {
	box = loadScreen();
	view = createView( box );
} );

const select = ( field ) =>
	box.querySelector(
		'[data-region="mapping"] select[data-field="' + field + '"]'
	);

describe( 'the importer’s columns', () => {
	test( 'read from the table the screen prints, badge and all', () => {
		const read = columns( box );

		expect( read.map( ( { badge, ...column } ) => column ) ).toEqual( [
			{ key: 'sku', label: 'Code', holds: 'Text', required: true },
			{
				key: 'price',
				label: 'Price',
				holds: 'A number',
				required: false,
			},
			{
				key: 'released',
				label: 'Released',
				holds: 'A date (written as d/m/Y)',
				required: false,
			},
			{
				key: 'tags',
				label: 'Tags',
				holds: 'Text (several, separated by |)',
				required: false,
			},
			{
				key: 'status',
				label: 'Status',
				holds: 'Text (one of draft, publish)',
				required: false,
			},
		] );

		// A copy, so drawing it elsewhere leaves the table's own.
		expect( read[ 0 ].badge.textContent ).toContain( 'Required' );
		expect( read[ 1 ].badge.textContent ).toContain( 'Optional' );
		expect( read[ 0 ].badge.isConnected ).toBe( false );
	} );
} );

describe( 'matching', () => {
	test( 'by key or by label, case, spaces and punctuation aside', () => {
		const column = { key: 'order_number', label: 'Order number' };

		expect( match( column, [ 'Name', 'ORDER NUMBER' ] ) ).toBe(
			'ORDER NUMBER'
		);
		expect( match( column, [ 'order-number' ] ) ).toBe( 'order-number' );
		expect( match( { key: 'email', label: 'Email' }, [ 'E-mail' ] ) ).toBe(
			'E-mail'
		);
		expect( match( { key: 'sku', label: 'Code' }, [ 'code' ] ) ).toBe(
			'code'
		);
		expect( match( column, [ 'Order', 'Number' ] ) ).toBeNull();
		expect( match( column, [] ) ).toBeNull();
	} );

	test( 'the first of two that match', () => {
		expect(
			match( { key: 'sku', label: 'Code' }, [ 'Code', 'SKU', 'sku' ] )
		).toBe( 'Code' );
	} );

	test( 'what is said about it', () => {
		expect( matchedSummary( 5, 5 ) ).toBe(
			'All 5 columns were matched for you. Check they look right.'
		);
		expect( matchedSummary( 1, 1 ) ).toBe(
			'The column was matched for you. Check it looks right.'
		);
		expect( matchedSummary( 2, 5 ) ).toBe(
			'We matched 2 of 5 columns for you. Choose the rest from your file.'
		);
		expect( matchedSummary( 4, 5 ) ).toBe(
			'We matched 4 of 5 columns for you. Choose the rest from your file.'
		);
		expect( matchedSummary( 0, 5 ) ).toBe(
			'None of your file’s column names matched, so choose a column from your file for each one below.'
		);
		expect( matchedSummary( 0, 0 ) ).toBe( matchedSummary( 0, 5 ) );
	} );
} );

describe( 'what the first row holds', () => {
	test( 'its value, cut at sixty characters', () => {
		expect( firstRowSays( PREVIEW, 'SKU' ) ).toBe( 'First row: A-1' );
		expect( firstRowSays( PREVIEW, 'Notes' ) ).toBe(
			'First row: ' + 'x'.repeat( 60 )
		);
		expect( firstRowSays( PREVIEW, 'tags' ) ).toBe(
			'First row: ' + 'x'.repeat( 60 ) + '…'
		);
	} );

	test( 'empty said as empty: blank, missing or null', () => {
		expect( firstRowSays( PREVIEW, 'Cost' ) ).toBe(
			'Empty in the first row'
		);
		expect( firstRowSays( PREVIEW, 'Released on' ) ).toBe(
			'Empty in the first row'
		);
		expect( firstRowSays( PREVIEW, 'Nowhere' ) ).toBe(
			'Empty in the first row'
		);
		expect( firstRowSays( { rows: [ { n: 0 } ] }, 'n' ) ).toBe(
			'First row: 0'
		);
		expect( firstRowSays( { rows: [ { n: false } ] }, 'n' ) ).toBe(
			'First row: false'
		);
	} );

	test( 'nothing at all with no column chosen, or no rows to show', () => {
		expect( firstRowSays( PREVIEW, '' ) ).toBeNull();
		expect( firstRowSays( null, 'SKU' ) ).toBeNull();
		expect( firstRowSays( {}, 'SKU' ) ).toBeNull();
		expect( firstRowSays( { rows: [] }, 'SKU' ) ).toBeNull();
	} );
} );

describe( 'the matching rows', () => {
	test( 'a select per column, the file’s headers in it, the obvious one chosen', () => {
		drawMapping( view, FILE, PREVIEW );

		const rows = box.querySelectorAll( '.importers__map-row' );

		expect( rows ).toHaveLength( 5 );

		const sku = select( 'sku' );

		expect( sku.id ).toBe( 'map-myplugin-products-sku' );
		expect( sku.required ).toBe( true );
		expect( sku.dataset.label ).toBe( 'Code' );
		expect( sku.getAttribute( 'aria-describedby' ) ).toBe(
			'map-myplugin-products-sku-holds map-myplugin-products-sku-value'
		);
		expect(
			[ ...sku.options ].map( ( o ) => [ o.value, o.textContent ] )
		).toEqual( [
			[ '', 'Choose a Column' ],
			[ 'SKU', 'SKU' ],
			[ 'Cost', 'Cost' ],
			[ 'Released on', 'Released on' ],
			[ 'tags', 'tags' ],
			[ 'Notes', 'Notes' ],
		] );
		expect( sku.value ).toBe( 'SKU' );

		expect( select( 'price' ).options[ 0 ].textContent ).toBe(
			'Don’t Import'
		);
		expect( select( 'price' ).value ).toBe( '' );
		expect( select( 'tags' ).value ).toBe( 'tags' );
		expect( select( 'released' ).value ).toBe( '' );

		const first = rows[ 0 ];

		expect(
			first.querySelector( 'label.importers__map-label' ).htmlFor
		).toBe( sku.id );
		expect(
			first.querySelector( '.importers__map-title' ).textContent
		).toContain( 'Required' );
		expect( first.querySelector( '.importers__map-holds' ).id ).toBe(
			'map-myplugin-products-sku-holds'
		);
		expect(
			first.querySelector( '.importers__map-holds' ).textContent
		).toBe( 'Text' );
		expect(
			[ ...first.children ].map( ( child ) => child.className )
		).toEqual( [ 'importers__map-about', 'importers__map-control' ] );

		expect( said( box, 'matched' ) ).toBe(
			'We matched 2 of 5 columns for you. Choose the rest from your file.'
		);
		expect( said( box, 'uploaded-name' ) ).toBe( 'products.csv' );
		expect( said( box, 'uploaded-rows' ) ).toBe( '12 rows' );
	} );

	test( 'what the first row holds, under each, and again on a change', () => {
		drawMapping( view, FILE, PREVIEW );

		const value = box.querySelector( '#map-myplugin-products-sku-value' );
		const price = box.querySelector( '#map-myplugin-products-price-value' );

		expect( value.hidden ).toBe( false );
		expect( value.textContent ).toBe( 'First row: A-1' );
		expect( price.hidden ).toBe( true );
		expect( price.textContent ).toBe( '' );

		select( 'price' ).value = 'Cost';
		select( 'price' ).dispatchEvent( new window.Event( 'change' ) );

		expect( price.hidden ).toBe( false );
		expect( price.textContent ).toBe( 'Empty in the first row' );

		select( 'price' ).value = '';
		select( 'price' ).dispatchEvent( new window.Event( 'change' ) );

		expect( price.hidden ).toBe( true );
		expect( price.textContent ).toBe( '' );
	} );

	test( 'no preview, nothing under the selects', () => {
		drawMapping( view, FILE, null );

		box.querySelectorAll( '.importers__map-value' ).forEach( ( value ) => {
			expect( value.hidden ).toBe( true );
		} );
	} );

	test( 'a file with one row says so', () => {
		drawMapping( view, { ...FILE, rows: 1 }, null );

		expect( said( box, 'uploaded-rows' ) ).toBe( '1 row' );
	} );

	test( 'every column matched, and none', () => {
		drawMapping(
			view,
			{
				...FILE,
				headers: [ 'Code', 'price', 'RELEASED', 'Tags', 'status', 'x' ],
			},
			null
		);
		expect( said( box, 'matched' ) ).toBe(
			'All 5 columns were matched for you. Check they look right.'
		);

		drawMapping( view, { ...FILE, headers: [ 'a', 'b' ] }, null );
		expect( said( box, 'matched' ) ).toBe(
			'None of your file’s column names matched, so choose a column from your file for each one below.'
		);
		expect( box.querySelectorAll( '.importers__map-row' ) ).toHaveLength(
			5
		);
	} );

	test( 'a file with the same column twice has the first chosen', () => {
		drawMapping(
			view,
			{ ...FILE, headers: [ 'Notes', 'Code', 'sku', 'Code' ] },
			null
		);

		expect( select( 'sku' ).selectedIndex ).toBe( 2 );
		expect(
			[ ...select( 'sku' ).options ].filter( ( o ) => o.selected )
		).toHaveLength( 1 );
		expect( said( box, 'matched' ) ).toBe(
			'We matched 1 of 5 columns for you. Choose the rest from your file.'
		);
	} );

	test( 'a header that would be markup is shown as text', () => {
		drawMapping(
			view,
			{
				...FILE,
				name: '<b>x</b>.csv',
				headers: [ '<img src=x onerror=alert(1)>' ],
			},
			{ rows: [ { '<img src=x onerror=alert(1)>': '<i>y</i>' } ] }
		);

		expect( box.querySelector( '[data-region="mapping"] img' ) ).toBeNull();
		expect( said( box, 'uploaded-name' ) ).toBe( '<b>x</b>.csv' );
		expect( select( 'sku' ).options[ 1 ].value ).toBe(
			'<img src=x onerror=alert(1)>'
		);
	} );
} );

describe( 'a required column left empty', () => {
	test( 'is marked, and named; a chosen one is not', () => {
		box.querySelector( 'tr[data-field="price"]' ).setAttribute(
			'data-required',
			''
		);
		drawMapping( view, { ...FILE, headers: [ 'Cost' ] }, null );

		const missing = unmatched( box );

		expect( missing.map( ( s ) => s.dataset.field ) ).toEqual( [
			'sku',
			'price',
		] );
		expect( select( 'sku' ).getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect(
			select( 'sku' ).closest( '.importers__map-row' ).classList
		).toContain( 'is-invalid' );
		expect( select( 'tags' ).hasAttribute( 'aria-invalid' ) ).toBe( false );
		expect(
			select( 'tags' ).closest( '.importers__map-row' ).classList
		).not.toContain( 'is-invalid' );

		select( 'price' ).value = 'Cost';

		expect( unmatched( box ).map( ( s ) => s.dataset.field ) ).toEqual( [
			'sku',
		] );
		expect( select( 'price' ).hasAttribute( 'aria-invalid' ) ).toBe(
			false
		);
		expect(
			select( 'price' ).closest( '.importers__map-row' ).classList
		).not.toContain( 'is-invalid' );
	} );

	test( 'choosing one clears its mark, and the warning once none is left', () => {
		box.querySelector( 'tr[data-field="price"]' ).setAttribute(
			'data-required',
			''
		);
		drawMapping( view, { ...FILE, headers: [ 'Cost' ] }, null );
		unmatched( box );

		const quiet = vi.spyOn( view, 'quiet' );

		view.alert( 'Choose a column from your file for Code and Price.' );

		select( 'sku' ).value = 'Cost';
		select( 'sku' ).dispatchEvent( new window.Event( 'change' ) );

		expect( select( 'sku' ).hasAttribute( 'aria-invalid' ) ).toBe( false );
		expect(
			select( 'sku' ).closest( '.importers__map-row' ).classList
		).not.toContain( 'is-invalid' );
		expect( quiet ).not.toHaveBeenCalled();
		expect( said( box, 'alert' ) ).not.toBe( '' );

		select( 'price' ).value = 'Cost';
		select( 'price' ).dispatchEvent( new window.Event( 'change' ) );

		expect( quiet ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'what the selects say', () => {
	test( 'field to the file’s column, for the chosen ones only', () => {
		drawMapping( view, FILE, null );
		select( 'released' ).value = 'Released on';

		expect( chosenColumns( box ) ).toEqual( {
			sku: 'SKU',
			released: 'Released on',
			tags: 'tags',
		} );
	} );
} );
