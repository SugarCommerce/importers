/**
 * Walking a file a batch at a time: each batch starts where the server said
 * the last one stopped, and the loop neither stops silently nor spins.
 */

import { describe, expect, test, vi } from 'vitest';

import { walk } from '../../src/js/importers/walk';

const BODY = {
	page: 'shop',
	operation: 'orders',
	uuid: 'u',
	mapping: { sku: 'SKU' },
	commit: true,
};

/**
 * A server that answers each batch from a list.
 *
 * @param {Array} answers Each batch's answer, or an Error to fail with.
 * @return {Function} ask, with its calls.
 */
function server( answers ) {
	let at = 0;

	return vi.fn( () => {
		const answer = answers[ at++ ];

		if ( undefined === answer ) {
			return Promise.reject( new Error( 'asked once too often' ) );
		}

		return answer instanceof Error
			? Promise.reject( answer )
			: Promise.resolve( answer );
	} );
}

const progress = ( done ) => ( { done, total: 7 } );

describe( 'walking a file', () => {
	test( 'batch after batch from where the server stopped, until it has finished', async () => {
		const ask = server( [
			{ offset: 3, finished: false, progress: progress( 3 ) },
			{ offset: 6, finished: false, progress: progress( 6 ) },
			{ offset: 7, finished: true, progress: progress( 7 ) },
		] );
		const seen = vi.fn();

		await expect( walk( ask, BODY, seen ) ).resolves.toEqual( {
			offset: 7,
			finished: true,
			progress: progress( 7 ),
		} );

		expect( ask.mock.calls ).toEqual( [
			[ 'run', { method: 'POST', json: { ...BODY, offset: 0 } } ],
			[ 'run', { method: 'POST', json: { ...BODY, offset: 3 } } ],
			[ 'run', { method: 'POST', json: { ...BODY, offset: 6 } } ],
		] );
		expect( seen.mock.calls ).toEqual( [
			[ progress( 3 ) ],
			[ progress( 6 ) ],
			[ progress( 7 ) ],
		] );
	} );

	test( 'what it sends keeps its order, with the offset last', async () => {
		const ask = server( [ { offset: 1, finished: true, progress: {} } ] );

		await walk( ask, BODY, () => {} );

		expect( JSON.stringify( ask.mock.calls[ 0 ][ 1 ].json ) ).toBe(
			'{"page":"shop","operation":"orders","uuid":"u","mapping":{"sku":"SKU"},"commit":true,"offset":0}'
		);
	} );

	test( 'the server’s offset, not a count of its own: a short batch is not a loop', async () => {
		// Asked for three, the server got through two.
		const ask = server( [
			{ offset: 2, finished: false, progress: progress( 2 ) },
			{ offset: 5, finished: false, progress: progress( 5 ) },
			{ offset: 7, finished: true, progress: progress( 7 ) },
		] );

		await walk( ask, BODY, () => {} );

		expect(
			ask.mock.calls.map( ( [ , { json } ] ) => json.offset )
		).toEqual( [ 0, 2, 5 ] );
	} );

	test( 'a batch that gets nowhere ends the walk rather than asking again', async () => {
		const stuck = { offset: 3, finished: false, progress: progress( 3 ) };
		const ask = server( [
			{ offset: 3, finished: false, progress: progress( 3 ) },
			stuck,
		] );

		await expect( walk( ask, BODY, () => {} ) ).resolves.toBe( stuck );
		expect( ask ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'a batch that goes backwards ends it too', async () => {
		const back = { offset: 1, finished: false, progress: progress( 1 ) };
		const ask = server( [
			{ offset: 4, finished: false, progress: progress( 4 ) },
			back,
		] );

		await expect( walk( ask, BODY, () => {} ) ).resolves.toBe( back );
		expect( ask ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'a first batch that gets nowhere is the end, and asks once', async () => {
		const ask = server( [
			{ offset: 0, finished: false, progress: progress( 0 ) },
		] );

		await walk( ask, BODY, () => {} );

		expect( ask ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'finished is the end, wherever the offset says', async () => {
		const ask = server( [
			{ offset: 3, finished: true, progress: progress( 3 ) },
		] );

		await walk( ask, BODY, () => {} );

		expect( ask ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'a batch that fails stops the walk, with what the batches before it did seen', async () => {
		const broken = new Error( 'down' );
		const ask = server( [
			{ offset: 3, finished: false, progress: progress( 3 ) },
			broken,
		] );
		const seen = vi.fn();

		await expect( walk( ask, BODY, seen ) ).rejects.toBe( broken );
		expect( seen.mock.calls ).toEqual( [ [ progress( 3 ) ] ] );
		expect( ask ).toHaveBeenCalledTimes( 2 );
	} );
} );
