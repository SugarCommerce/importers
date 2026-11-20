/**
 * One step at a time: the section shown, the segments moved along, every
 * button waiting while something is under way, and a warning above.
 */

import { beforeEach, describe, expect, test } from 'vitest';

import { icon } from '../../assets/js/lib/dom';
import { STEPS, createView } from '../../assets/js/importers/view';
import { loadScreen, said } from './support/screen';

let box;
let view;

beforeEach( () => {
	box = loadScreen();
	view = createView( box );
} );

const shown = () =>
	[ ...box.querySelectorAll( 'section[data-step]' ) ]
		.filter( ( section ) => ! section.hidden )
		.map( ( section ) => section.dataset.step );

const markers = () =>
	Object.fromEntries(
		[ ...box.querySelectorAll( '[data-marker]' ) ].map( ( marker ) => [
			marker.dataset.marker,
			[
				marker.classList.contains( 'is-done' ) ? 'done' : '',
				marker.classList.contains( 'is-current' ) ? 'current' : '',
				marker.getAttribute( 'aria-current' ) || '',
			].join( '|' ),
		] )
	);

describe( 'the steps', () => {
	test( 'the screen’s own four, in order', () => {
		expect( STEPS ).toEqual( [ 'choose', 'map', 'check', 'import' ] );
		expect(
			[ ...box.querySelectorAll( '[data-marker]' ) ].map(
				( marker ) => marker.dataset.marker
			)
		).toEqual( STEPS );
	} );

	test( 'matching: its section, the first segment done, its own current', () => {
		view.step( 'map' );

		expect( shown() ).toEqual( [ 'map' ] );
		expect( markers() ).toEqual( {
			choose: 'done||',
			map: '|current|step',
			check: '||',
			import: '||',
		} );
		expect( said( box, 'step-number' ) ).toBe( '2' );
		expect( said( box, 'step-name' ) ).toBe( 'Match Columns' );
		expect( box.dataset.state ).toBe( 'map' );
	} );

	test( 'the check and the import share the results card', () => {
		view.step( 'check' );
		expect( shown() ).toEqual( [ 'report' ] );
		expect( said( box, 'step-number' ) ).toBe( '3' );
		expect( said( box, 'step-name' ) ).toBe( 'Check' );

		view.step( 'import' );
		expect( shown() ).toEqual( [ 'report' ] );
		expect( markers() ).toEqual( {
			choose: 'done||',
			map: 'done||',
			check: 'done||',
			import: '|current|step',
		} );
		expect( box.dataset.state ).toBe( 'import' );
	} );

	test( 'a step that is over is done, and still the one the page is on', () => {
		view.step( 'check', true );

		expect( markers() ).toEqual( {
			choose: 'done||',
			map: 'done||',
			check: 'done||step',
			import: '||',
		} );
	} );

	test( 'back to the start puts everything back', () => {
		view.step( 'import', true );
		view.step( 'choose' );

		expect( shown() ).toEqual( [ 'choose' ] );
		expect( markers() ).toEqual( {
			choose: '|current|step',
			map: '||',
			check: '||',
			import: '||',
		} );
		expect( said( box, 'step-number' ) ).toBe( '1' );
		expect( said( box, 'step-name' ) ).toBe( 'Upload' );
	} );

	test( 'the heading of a step, to move focus to', () => {
		expect( view.heading( 'map' ).id ).toBe(
			'myplugin-products-map-title'
		);
	} );
} );

describe( 'busy', () => {
	test( 'every button waits, and the operation says so', () => {
		const buttons = [ ...box.querySelectorAll( 'button[data-action]' ) ];

		view.busy( true );
		expect( buttons.every( ( b ) => b.disabled ) ).toBe( true );
		expect( box.getAttribute( 'aria-busy' ) ).toBe( 'true' );

		view.busy( false );
		expect( buttons.some( ( b ) => b.disabled ) ).toBe( false );
		expect( box.getAttribute( 'aria-busy' ) ).toBe( 'false' );
	} );

	test( 'the buttons the screen draws, by what they do', () => {
		expect( view.button( 'upload' ).textContent ).toBe(
			'Upload and Continue'
		);
		expect(
			view.button( 'restart', view.region( 'report-actions' ) )
				.textContent
		).toBe( 'Import Another File' );
		expect( view.button( 'restart' ).textContent ).toBe(
			'Choose a Different File'
		);
	} );
} );

describe( 'saying something went wrong', () => {
	test( 'a warning with the screen’s icon, and taken back', () => {
		view.alert( 'That <b>file</b> is empty.' );

		const notice = box.querySelector(
			'[data-region="alert"] .importers__alert'
		);

		expect( notice.querySelector( 'svg' ) ).not.toBeNull();
		expect( notice.querySelector( 'p' ).textContent ).toBe(
			'That <b>file</b> is empty.'
		);
		expect( notice.querySelector( 'b' ) ).toBeNull();

		view.alert( 'Another.' );
		expect(
			box.querySelectorAll( '[data-region="alert"] .importers__alert' )
		).toHaveLength( 1 );

		view.quiet();
		expect(
			box.querySelector( '[data-region="alert"]' ).children
		).toHaveLength( 0 );
	} );
} );

describe( 'icons', () => {
	test( 'a copy of the one the screen printed, or nothing', () => {
		const success = icon( 'success' );
		const printed = document
			.querySelector( 'template.importers__icons' )
			.content.querySelector( '[data-icon="success"]' ).firstElementChild;

		expect( success.outerHTML ).toBe( printed.outerHTML );
		expect( success ).not.toBe( printed );
		expect( icon( 'warning' ).nodeName.toLowerCase() ).toBe( 'svg' );

		const none = icon( 'nothing' );

		expect( none.nodeType ).toBe( window.Node.TEXT_NODE );
		expect( none.textContent ).toBe( '' );

		document.querySelector( 'template.importers__icons' ).remove();
		expect( icon( 'success' ).nodeType ).toBe( window.Node.TEXT_NODE );
	} );
} );
