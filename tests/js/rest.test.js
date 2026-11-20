/**
 * Requests go through wp.apiFetch, and every failure comes back as words a
 * person can act on.
 */

import { describe, expect, test, vi } from 'vitest';

import {
	createAsk,
	failure,
	friendly,
	refusal,
} from '../../assets/js/lib/rest';

const REST = 'https://example.test/wp-json/sugarcommerce-importers/v1/';

const SERVER =
	'Something went wrong on the server. Try again, and if it keeps happening, ask whoever looks after your site.';
const UNREACHABLE =
	'We couldn’t reach your site. Check your connection and try again.';
const EXPIRED =
	'This page has been open a long time and your session has expired. Reload the page and try again.';

const ask = ( apiFetch ) =>
	createAsk( apiFetch, { rest: REST, nonce: 'n0nce' } );

describe( 'a request', () => {
	test( 'a GET carries its arguments on the address, with the nonce, parsed', async () => {
		const apiFetch = vi.fn( () => Promise.resolve( { ok: 1 } ) );

		await expect(
			ask( apiFetch )( 'sample', {
				params: { page: 'my shop', operation: 'a&b' },
			} )
		).resolves.toEqual( { ok: 1 } );

		expect( apiFetch ).toHaveBeenCalledWith( {
			url: REST + 'sample?page=my+shop&operation=a%26b',
			method: 'GET',
			headers: { 'X-WP-Nonce': 'n0nce' },
			parse: true,
		} );
	} );

	test( 'nothing to ask adds nothing to the address', async () => {
		const apiFetch = vi.fn( () => Promise.resolve( {} ) );

		await ask( apiFetch )( 'run' );

		expect( apiFetch.mock.calls[ 0 ][ 0 ].url ).toBe( REST + 'run' );
	} );

	test( 'a form is sent as it is, for the browser to encode', async () => {
		const apiFetch = vi.fn( () => Promise.resolve( {} ) );
		const body = new window.FormData();

		await ask( apiFetch )( 'upload', {
			params: { page: 'shop' },
			method: 'POST',
			body,
		} );

		expect( apiFetch.mock.calls[ 0 ][ 0 ] ).toEqual( {
			url: REST + 'upload?page=shop',
			method: 'POST',
			headers: { 'X-WP-Nonce': 'n0nce' },
			body,
			parse: true,
		} );
	} );

	test( 'JSON is sent with its type', async () => {
		const apiFetch = vi.fn( () => Promise.resolve( {} ) );

		await ask( apiFetch )( 'run', {
			method: 'POST',
			json: { page: 'shop', offset: 0 },
		} );

		expect( apiFetch.mock.calls[ 0 ][ 0 ] ).toEqual( {
			url: REST + 'run',
			method: 'POST',
			headers: {
				'X-WP-Nonce': 'n0nce',
				'Content-Type': 'application/json',
			},
			body: '{"page":"shop","offset":0}',
			parse: true,
		} );
	} );

	test( 'a relative base is resolved against the page', async () => {
		const apiFetch = vi.fn( () => Promise.resolve( {} ) );

		await createAsk(
			apiFetch,
			{ rest: '/wp-json/x/v1/', nonce: 'n' },
			'https://shop.test'
		)( 'file/abc', { method: 'DELETE' } );

		expect( apiFetch.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			url: 'https://shop.test/wp-json/x/v1/file/abc',
			method: 'DELETE',
		} );
	} );

	test( 'an answer of nothing is a failure, not a file', async () => {
		const error = await ask( () => Promise.resolve( null ) )(
			'upload'
		).catch( ( e ) => e );

		expect( error ).toBeInstanceOf( Error );
		expect( friendly( error ) ).toBe( SERVER );
	} );

	test( 'a refusal comes back readable', async () => {
		const error = await ask( () =>
			Promise.reject( {
				code: 'importers_bad_file',
				message: 'That file is empty.',
				data: { status: 400 },
			} )
		)( 'upload' ).catch( ( e ) => e );

		expect( error ).toBeInstanceOf( Error );
		expect( error.readable ).toBe( true );
		expect( friendly( error ) ).toBe( 'That file is empty.' );
	} );
} );

describe( 'what a failure says', () => {
	test( 'the server’s own reason, when it gave one', () => {
		expect(
			friendly( failure( { code: 'x', message: 'No such file.' } ) )
		).toBe( 'No such file.' );

		// A plugin's own JSON with a message and no code is still a reason.
		expect( friendly( failure( { message: 'Too big.' } ) ) ).toBe(
			'Too big.'
		);
	} );

	test( 'an expired nonce asks for a reload, whatever the server said', () => {
		const error = failure( {
			code: 'rest_cookie_invalid_nonce',
			message: 'Cookie check failed',
			data: { status: 403 },
		} );

		expect( error.readable ).toBe( true );
		expect( friendly( error ) ).toBe( EXPIRED );
	} );

	test( 'no answer at all is the connection, offline or not', () => {
		[ 'fetch_error', 'offline_error' ].forEach( ( code ) => {
			const error = failure( {
				code,
				message: 'Could not get a valid response from the server.',
			} );

			expect( error.unreachable ).toBe( true );
			expect( error.readable ).toBeUndefined();
			expect( friendly( error ) ).toBe( UNREACHABLE );
		} );
	} );

	test( 'a page that was not JSON, or a refusal with nothing to read, is the server', () => {
		[
			{
				code: 'invalid_json',
				message: 'The response is not a valid JSON response.',
			},
			{ code: 'rest_error', data: { status: 500 } },
			{ code: 'rest_error', message: '' },
			'Internal Server Error',
			null,
			undefined,
			[ 'a' ],
		].forEach( ( rejected ) => {
			const error = failure( rejected );

			expect( error ).toBeInstanceOf( Error );
			expect( error.readable ).toBeUndefined();
			expect( error.unreachable ).toBeUndefined();
			expect( friendly( error ) ).toBe( SERVER );
		} );
	} );

	test( 'an exception is not a reason: its words were written for a developer', () => {
		const bug = new TypeError( 'Cannot read properties of undefined' );
		const abort = {
			name: 'AbortError',
			message: 'The user aborted a request.',
		};

		expect( failure( bug ) ).toBe( bug );
		expect( friendly( failure( bug ) ) ).toBe( SERVER );
		expect( friendly( failure( abort ) ) ).toBe( SERVER );
	} );

	test( 'a refusal already made is passed on as it is', () => {
		const made = refusal( 'Choose a CSV file first.' );

		expect( failure( made ) ).toBe( made );
		expect( friendly( made ) ).toBe( 'Choose a CSV file first.' );
	} );

	test( 'nothing at all is the server', () => {
		expect( friendly( undefined ) ).toBe( SERVER );
		expect( friendly( new Error( 'x' ) ) ).toBe( SERVER );
	} );
} );

describe( 'through the real apiFetch', () => {
	const respond = ( status, body, type = 'application/json' ) =>
		Promise.resolve(
			new Response(
				typeof body === 'string' ? body : JSON.stringify( body ),
				{
					status,
					headers: { 'Content-Type': type },
				}
			)
		);

	test( 'a stale nonce is renewed and the request sent again', async () => {
		const { default: apiFetch } = await import( '@wordpress/api-fetch' );
		const nonce = apiFetch.createNonceMiddleware( 'old' );
		const sent = [];

		apiFetch.use( nonce );
		apiFetch.nonceMiddleware = nonce;
		apiFetch.nonceEndpoint =
			'https://example.test/wp-admin/admin-ajax.php?action=rest-nonce';

		const fetch = vi
			.spyOn( globalThis, 'fetch' )
			.mockImplementation( ( url, init = {} ) => {
				sent.push( [
					String( url ),
					init.headers && init.headers[ 'X-WP-Nonce' ],
				] );

				if ( String( url ).includes( 'rest-nonce' ) ) {
					return respond( 200, 'fresh', 'text/plain' );
				}

				return 'fresh' === init.headers[ 'X-WP-Nonce' ]
					? respond( 200, { uuid: 'u', rows: 2 } )
					: respond( 403, {
							code: 'rest_cookie_invalid_nonce',
							message: 'Cookie check failed',
						} );
			} );

		try {
			await expect(
				createAsk( apiFetch, { rest: REST, nonce: 'old' } )( 'upload', {
					method: 'POST',
					body: new window.FormData(),
				} )
			).resolves.toEqual( { uuid: 'u', rows: 2 } );

			expect(
				sent.map( ( [ url, sentNonce ] ) => [
					url.replace( /\?.*/, '' ),
					sentNonce,
				] )
			).toEqual( [
				[ REST + 'upload', 'old' ],
				[ 'https://example.test/wp-admin/admin-ajax.php', undefined ],
				[ REST + 'upload', 'fresh' ],
			] );
		} finally {
			fetch.mockRestore();
			apiFetch.unregister( nonce );
		}
	} );

	test( 'a page of PHP errors, and no answer at all, are said plainly', async () => {
		const { default: apiFetch } = await import( '@wordpress/api-fetch' );
		const fetch = vi
			.spyOn( globalThis, 'fetch' )
			.mockImplementationOnce( () =>
				respond( 500, '<b>Fatal error</b>: oops', 'text/html' )
			)
			.mockImplementationOnce( () =>
				respond( 200, 'Warning: x {"uuid":1}', 'text/html' )
			)
			.mockImplementationOnce( () =>
				Promise.reject( new TypeError( 'Failed to fetch' ) )
			);

		try {
			const run = createAsk( apiFetch, { rest: REST, nonce: 'n' } );

			expect( friendly( await run( 'run' ).catch( ( e ) => e ) ) ).toBe(
				SERVER
			);
			expect( friendly( await run( 'run' ).catch( ( e ) => e ) ) ).toBe(
				SERVER
			);
			expect( friendly( await run( 'run' ).catch( ( e ) => e ) ) ).toBe(
				UNREACHABLE
			);
		} finally {
			fetch.mockRestore();
		}
	} );
} );
