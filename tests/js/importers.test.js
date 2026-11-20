/**
 * The entry: every operation on the page wired up once the page is ready,
 * each with its own settings, through the imported apiFetch. And the sample
 * file handed over as a download.
 */

import { describe, expect, test, vi } from 'vitest';

import { save } from '../../assets/js/importers/sample';
import { loadScreen, press, settle } from './support/screen';

const ready = vi.hoisted( () => ( { run: null } ) );
const apiFetch = vi.hoisted( () => vi.fn() );

vi.mock( '@wordpress/dom-ready', () => ( {
	default: ( callback ) => {
		ready.run = callback;
	},
} ) );

vi.mock( '@wordpress/api-fetch', () => ( { default: apiFetch } ) );

describe( 'the entry', () => {
	test( 'waits for the page, then wires every operation with its own settings', async () => {
		const box = loadScreen();
		const other = box.cloneNode( true );

		other.id = 'shop-orders';
		other.dataset.importer = 'shop';
		other.dataset.operation = 'orders';
		other.dataset.nonce = 'other';
		box.after( other );

		await import( '../../assets/js/importers.js' );

		expect( typeof ready.run ).toBe( 'function' );

		apiFetch.mockResolvedValue( { filename: 'a.csv', contents: 'a' } );
		press( other, 'sample' );
		await settle();

		// Not wired until the page is ready.
		expect( apiFetch ).not.toHaveBeenCalled();

		ready.run();

		const createObjectURL = vi.fn( () => 'blob:x' );

		window.URL.createObjectURL = createObjectURL;
		window.URL.revokeObjectURL = vi.fn();
		vi.spyOn(
			window.HTMLAnchorElement.prototype,
			'click'
		).mockImplementation( () => {} );

		press( other, 'sample' );
		press( box, 'sample' );
		await settle();

		expect(
			apiFetch.mock.calls.map( ( [ request ] ) => [
				request.url,
				request.headers[ 'X-WP-Nonce' ],
			] )
		).toEqual( [
			[
				'https://example.test/wp-json/sugarcommerce-importers/v1/sample?page=shop&operation=orders',
				'other',
			],
			[
				'https://example.test/wp-json/sugarcommerce-importers/v1/sample?page=myplugin&operation=products',
				'nonce',
			],
		] );
		expect( createObjectURL ).toHaveBeenCalledTimes( 2 );
	} );
} );

describe( 'the sample file', () => {
	test( 'saved as a CSV under the name the server gave, and the address let go', async () => {
		const created = [];
		const click = vi
			.spyOn( window.HTMLAnchorElement.prototype, 'click' )
			.mockImplementation( function () {
				created.push( [ this.href, this.download ] );
			} );

		window.URL.createObjectURL = vi.fn( ( blob ) => {
			created.push( blob );

			return 'blob:https://example.test/1';
		} );
		window.URL.revokeObjectURL = vi.fn();

		try {
			save( 'sku,price\nA-1,10\n', 'products-sample.csv' );

			const [ blob, link ] = created;

			expect( blob.type ).toBe( 'text/csv' );
			expect( await blob.text() ).toBe( 'sku,price\nA-1,10\n' );
			expect( link ).toEqual( [
				'blob:https://example.test/1',
				'products-sample.csv',
			] );
			expect( window.URL.revokeObjectURL ).toHaveBeenCalledWith(
				'blob:https://example.test/1'
			);
		} finally {
			click.mockRestore();
		}
	} );
} );
