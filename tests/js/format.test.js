/**
 * Numbers, sizes and names, and the operation's settings.
 */

import { describe, expect, test } from 'vitest';

import { settings } from '../../assets/js/lib/config';
import { count, sentence, size, squash } from '../../assets/js/lib/format';

describe( 'count', () => {
	test( 'a number as the reader writes it, nothing as 0', () => {
		expect( count( 1234567 ) ).toBe( ( 1234567 ).toLocaleString() );
		expect( count( '12' ) ).toBe( '12' );
		expect( count( undefined ) ).toBe( '0' );
		expect( count( null ) ).toBe( '0' );
	} );
} );

describe( 'size', () => {
	test( 'bytes under a kilobyte, kilobytes under a megabyte, then megabytes', () => {
		expect( size( 0 ) ).toBe( '0 bytes' );
		expect( size( 1023 ) ).toBe( '1,023 bytes' );
		expect( size( 1024 ) ).toBe( '1 KB' );
		expect( size( 1536 ) ).toBe( '1.5 KB' );
		expect( size( 1024 * 1024 - 1 ) ).toBe( '1,024 KB' );
		expect( size( 1024 * 1024 ) ).toBe( '1 MB' );
		expect( size( 8 * 1024 * 1024 + 300000 ) ).toBe( '8.3 MB' );
	} );
} );

describe( 'squash', () => {
	test( 'case, spaces and punctuation do not make a different column', () => {
		expect( squash( 'E-mail' ) ).toBe( 'email' );
		expect( squash( ' Order #' ) ).toBe( 'order' );
		expect( squash( 'Total ($)' ) ).toBe( 'total' );
		expect( squash( 'order_number' ) ).toBe( 'ordernumber' );
		expect( squash( 'Line 2' ) ).toBe( 'line2' );
		expect( squash( undefined ) ).toBe( '' );
	} );
} );

describe( 'sentence', () => {
	test( 'names joined the way the page’s language joins them', () => {
		expect( sentence( [ 'Code' ], 'en-US' ) ).toBe( 'Code' );
		expect( sentence( [ 'Code', 'Price' ], 'en-US' ) ).toBe(
			'Code and Price'
		);
		expect( sentence( [ 'Code', 'Price', 'Tags' ], 'en-US' ) ).toBe(
			'Code, Price, and Tags'
		);
		expect( sentence( [ 'Code', 'Price' ], 'fr' ) ).toBe( 'Code et Price' );
	} );

	test( 'the document’s language by default, the browser’s without one', () => {
		document.documentElement.lang = 'de';
		expect( sentence( [ 'A', 'B' ] ) ).toBe( 'A und B' );

		document.documentElement.lang = '';
		expect( sentence( [ 'A', 'B' ] ) ).toBe(
			new Intl.ListFormat( undefined, { type: 'conjunction' } ).format( [
				'A',
				'B',
			] )
		);
	} );

	test( 'commas where the browser cannot join a list', () => {
		const ListFormat = window.Intl.ListFormat;

		window.Intl.ListFormat = undefined;

		try {
			expect( sentence( [ 'Code', 'Price', 'Tags' ], 'en-US' ) ).toBe(
				'Code, Price, Tags'
			);
		} finally {
			window.Intl.ListFormat = ListFormat;
		}
	} );
} );

describe( 'settings', () => {
	test( 'read from the operation’s own element', () => {
		const box = document.createElement( 'div' );

		box.id = 'shop-orders';
		box.dataset.importer = 'shop';
		box.dataset.operation = 'orders';
		box.dataset.rest = 'https://example.test/wp-json/x-importers/v1';
		box.dataset.nonce = 'n0nce';
		box.dataset.maxSize = '8388608';

		expect( settings( box ) ).toEqual( {
			id: 'shop-orders',
			importer: 'shop',
			operation: 'orders',
			rest: 'https://example.test/wp-json/x-importers/v1/',
			nonce: 'n0nce',
			maxSize: 8388608,
		} );
	} );

	test( 'one slash on the end of the base, and no limit when none is said', () => {
		const box = document.createElement( 'div' );

		box.dataset.rest = 'https://example.test/wp-json/x/v1/';
		box.dataset.maxSize = 'none';

		expect( settings( box ) ).toMatchObject( {
			rest: 'https://example.test/wp-json/x/v1/',
			maxSize: 0,
			importer: '',
			operation: '',
			nonce: '',
		} );
	} );
} );
