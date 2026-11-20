/**
 * The results card: the bar, then how a check or an import went, in words,
 * and what comes next.
 */

import { beforeEach, describe, expect, test } from 'vitest';

import {
	bar,
	begin,
	finish,
	outcome,
	percent,
	problems,
	stopped,
} from '../../src/js/importers/report';
import { createView } from '../../src/js/importers/view';
import { loadScreen, said } from './support/screen';

let box;
let view;

beforeEach( () => {
	box = loadScreen();
	view = createView( box );
} );

const figures = () =>
	[
		...box.querySelectorAll( '[data-region="summary"] .importers__stat' ),
	].map( ( stat ) => [
		stat.querySelector( 'dt' ).textContent,
		stat.querySelector( 'dd' ).textContent,
		stat.className,
	] );

const reportButtons = () => {
	const actions = box.querySelector( '[data-region="report-actions"]' );

	return {
		shown: ! actions.hidden,
		import: ! actions.querySelector( '[data-action="import"]' ).hidden,
		back: ! actions.querySelector( '[data-action="back"]' ).hidden,
		restart: ! actions.querySelector( '[data-action="restart"]' ).hidden,
	};
};

describe( 'the bar', () => {
	test( 'a whole percentage, never past 100, nothing of nothing', () => {
		expect( percent( 0, 7 ) ).toBe( 0 );
		expect( percent( 1, 3 ) ).toBe( 33 );
		expect( percent( 2, 3 ) ).toBe( 67 );
		expect( percent( 1, 200 ) ).toBe( 1 );
		expect( percent( 1, 201 ) ).toBe( 0 );
		expect( percent( 7, 7 ) ).toBe( 100 );
		expect( percent( 9, 7 ) ).toBe( 100 );
		expect( percent( 3, 0 ) ).toBe( 0 );
	} );

	test( 'moved, and the count said for a check and an import', () => {
		const meter = box.querySelector( '[data-region="bar"]' );

		bar( view, 2, 3, false );
		expect( meter.getAttribute( 'aria-valuenow' ) ).toBe( '67' );
		expect( meter.firstElementChild.style.width ).toBe( '67%' );
		expect( said( box, 'count' ) ).toBe( 'Checked 2 of 3 rows' );

		bar( view, 1200, 1500, true );
		expect( meter.getAttribute( 'aria-valuenow' ) ).toBe( '80' );
		expect( said( box, 'count' ) ).toBe( 'Imported 1,200 of 1,500 rows' );

		bar( view, 0, 1, true );
		expect( said( box, 'count' ) ).toBe( 'Imported 0 of 1 row' );

		bar( view, 1, 1, false );
		expect( said( box, 'count' ) ).toBe( 'Checked 1 of 1 row' );
	} );
} );

describe( 'a run beginning', () => {
	test( 'clears the last result and starts the bar at nothing', () => {
		finish( view, { skipped: 2, failed: 1, errors: { 3: 'Bad.' } }, false );

		begin( view, 40, false );

		expect(
			box.querySelector( 'section[data-step="report"]' ).hidden
		).toBe( false );
		expect( box.dataset.state ).toBe( 'check' );
		expect( box.querySelector( '[data-region="mark"]' ).hidden ).toBe(
			true
		);
		expect( said( box, 'title' ) ).toBe( 'Checking Your File' );
		expect( said( box, 'lede' ) ).toBe(
			'This can take a minute for a big file. Keep this page open until it finishes.'
		);
		expect( box.querySelector( '[data-region="progress"]' ).hidden ).toBe(
			false
		);
		expect( said( box, 'summary' ) ).toBe( '' );
		expect( said( box, 'errors' ) ).toBe( '' );
		expect( reportButtons().shown ).toBe( false );
		expect( said( box, 'count' ) ).toBe( 'Checked 0 of 40 rows' );
		expect( document.activeElement ).toBe(
			box.querySelector( '[data-region="title"]' )
		);

		begin( view, 40, true );
		expect( said( box, 'title' ) ).toBe( 'Importing Your File' );
		expect( box.dataset.state ).toBe( 'import' );
		expect( said( box, 'count' ) ).toBe( 'Imported 0 of 40 rows' );
	} );
} );

describe( 'what a run comes to', () => {
	test( 'an import: created and updated are what was imported', () => {
		expect(
			outcome( { created: 3, updated: 2, skipped: 1, failed: 0 }, true )
		).toEqual( {
			good: 5,
			failed: 0,
			title: 'Import Complete',
			lede: '5 rows were imported.',
			figures: [
				[ 'Created', 3, '' ],
				[ 'Updated', 2, '' ],
				[ 'Skipped', 1, '' ],
				[ 'Failed', 0, '' ],
			],
		} );
	} );

	test( 'an import with failures says how many, and where', () => {
		const result = outcome( { created: 1, failed: 2 }, true );

		expect( result.title ).toBe( 'Import Finished, With Some Problems' );
		expect( result.lede ).toBe(
			'1 row was imported. 2 rows couldn’t be imported, and are listed below.'
		);
		expect( result.figures[ 3 ] ).toEqual( [ 'Failed', 2, 'bad' ] );
		expect( outcome( { updated: 4, failed: 1 }, true ).lede ).toBe(
			'4 rows were imported. 1 row couldn’t be imported, and is listed below.'
		);
	} );

	test( 'a check: skipped is what is ready, since nothing was written', () => {
		expect(
			outcome( { created: 9, updated: 9, skipped: 4, failed: 0 }, false )
		).toEqual( {
			good: 4,
			failed: 0,
			title: 'Your File Looks Good',
			lede: 'All 4 rows are ready to import. Nothing has been changed yet.',
			figures: [
				[ 'Ready to Import', 4, 'good' ],
				[ 'With Problems', 0, '' ],
			],
		} );
		expect( outcome( { skipped: 1 }, false ).lede ).toBe(
			'The row is ready to import. Nothing has been changed yet.'
		);
	} );

	test( 'a check with some rows that need attention', () => {
		const result = outcome( { skipped: 3, failed: 2 }, false );

		expect( result.title ).toBe( 'Some Rows Need Attention' );
		expect( result.lede ).toBe(
			'3 rows are ready to import and 2 rows have problems. Import the good rows now and the others are skipped, or fix your file and upload it again.'
		);
		expect( result.figures ).toEqual( [
			[ 'Ready to Import', 3, 'good' ],
			[ 'With Problems', 2, 'bad' ],
		] );
		expect( outcome( { skipped: 1, failed: 1 }, false ).lede ).toBe(
			'1 row is ready to import and 1 row has problems. Import the good rows now and the others are skipped, or fix your file and upload it again.'
		);
	} );

	test( 'a check where every row has a problem', () => {
		const result = outcome( { skipped: 0, failed: 5 }, false );

		expect( result.good ).toBe( 0 );
		expect( result.title ).toBe( 'None of the Rows Can Be Imported Yet' );
		expect( result.lede ).toBe(
			'Every row has a problem. Check the columns are matched correctly, or fix your file and upload it again.'
		);
		expect( result.figures[ 0 ] ).toEqual( [ 'Ready to Import', 0, '' ] );
	} );

	test( 'no progress at all is nothing done', () => {
		expect( outcome( null, true ) ).toMatchObject( {
			good: 0,
			failed: 0,
			title: 'Import Complete',
			lede: '0 rows were imported.',
		} );
		expect( outcome( null, false ) ).toMatchObject( {
			good: 0,
			title: 'Your File Looks Good',
		} );
	} );
} );

describe( 'the rows with problems', () => {
	test( 'listed by row number, in number order, with the reason as text', () => {
		problems( view, {
			errors: { 10: 'Ten.', 2: 'Two.', 33: '<b>bold</b>' },
		} );

		const list = box.querySelector(
			'[data-region="errors"] .importers__problems'
		);

		expect(
			list.querySelector( 'h4.importers__problems-title' ).textContent
		).toBe( 'Rows With Problems' );
		expect(
			[ ...list.querySelectorAll( 'ul.importers__problem-list li' ) ].map(
				( item ) => [
					item.querySelector( '.importers__problem-row' ).textContent,
					item.querySelector( '.importers__problem-reason' )
						.textContent,
				]
			)
		).toEqual( [
			[ 'Row 2', 'Two.' ],
			[ 'Row 10', 'Ten.' ],
			[ 'Row 33', '<b>bold</b>' ],
		] );
		expect( list.querySelector( 'b' ) ).toBeNull();
		expect( list.querySelector( '.importers__problems-more' ) ).toBeNull();
	} );

	test( 'how many more were left out', () => {
		problems( view, { errors: { 1: 'x' }, truncated: 40 } );
		expect(
			box.querySelector( '.importers__problems-more' ).textContent
		).toBe( 'And 40 more rows with problems, not listed here.' );

		problems( view, { errors: { 1: 'x' }, truncated: 1 } );
		expect(
			box.querySelector( '.importers__problems-more' ).textContent
		).toBe( 'And 1 more row with a problem, not listed here.' );
	} );

	test( 'none is an empty list, and takes the last one away', () => {
		problems( view, { errors: { 1: 'x' } } );
		problems( view, { errors: {} } );
		expect( said( box, 'errors' ) ).toBe( '' );

		problems( view, { errors: { 1: 'x' } } );
		problems( view, {} );
		expect( said( box, 'errors' ) ).toBe( '' );
	} );
} );

describe( 'finishing', () => {
	test( 'a clean check: a tick, the figures, and Import ready', () => {
		begin( view, 4, false );
		finish( view, { skipped: 4, failed: 0, errors: {} }, false );

		const mark = box.querySelector( '[data-region="mark"]' );

		expect( mark.hidden ).toBe( false );
		expect( mark.className ).toBe(
			'importers__mark importers__mark--success'
		);
		expect( mark.querySelector( 'svg' ) ).not.toBeNull();
		expect( box.querySelector( '[data-region="progress"]' ).hidden ).toBe(
			true
		);
		expect( said( box, 'title' ) ).toBe( 'Your File Looks Good' );
		expect( figures() ).toEqual( [
			[ 'Ready to Import', '4', 'importers__stat importers__stat--good' ],
			[ 'With Problems', '0', 'importers__stat' ],
		] );
		expect( reportButtons() ).toEqual( {
			shown: true,
			import: true,
			back: true,
			restart: false,
		} );
		expect( view.button( 'import' ).textContent ).toBe( 'Import 4 Rows' );
		expect( box.dataset.state ).toBe( 'check' );
		expect(
			box
				.querySelector( '[data-marker="check"]' )
				.classList.contains( 'is-done' )
		).toBe( true );
		expect( document.activeElement ).toBe(
			box.querySelector( '[data-region="title"]' )
		);
	} );

	test( 'a check with nothing to import offers another file instead', () => {
		finish( view, { skipped: 0, failed: 3, errors: { 2: 'x' } }, false );

		const again = view.button( 'restart', view.region( 'report-actions' ) );

		expect( reportButtons() ).toEqual( {
			shown: true,
			import: false,
			back: true,
			restart: true,
		} );
		expect( again.className ).toBe( 'button' );
		expect( again.textContent ).toBe( 'Choose a Different File' );
		expect( box.querySelector( '[data-region="mark"]' ).className ).toBe(
			'importers__mark importers__mark--warning'
		);
		expect( said( box, 'errors' ) ).toContain( 'Row 2' );
	} );

	test( 'one row ready says one', () => {
		finish( view, { skipped: 1, failed: 1, errors: {} }, false );

		expect( view.button( 'import' ).textContent ).toBe( 'Import 1 Row' );
		expect( reportButtons().import ).toBe( true );
		expect( reportButtons().restart ).toBe( false );
	} );

	test( 'an import: the figures, no going back, and another file first', () => {
		finish(
			view,
			{
				created: 2,
				updated: 1,
				skipped: 0,
				failed: 1,
				errors: { 4: 'No.' },
			},
			true
		);

		const again = view.button( 'restart', view.region( 'report-actions' ) );

		expect( figures() ).toEqual( [
			[ 'Created', '2', 'importers__stat' ],
			[ 'Updated', '1', 'importers__stat' ],
			[ 'Skipped', '0', 'importers__stat' ],
			[ 'Failed', '1', 'importers__stat importers__stat--bad' ],
		] );
		expect( reportButtons() ).toEqual( {
			shown: true,
			import: false,
			back: false,
			restart: true,
		} );
		expect( again.className ).toBe( 'button button-primary' );
		expect( again.textContent ).toBe( 'Import Another File' );
		expect( said( box, 'title' ) ).toBe(
			'Import Finished, With Some Problems'
		);
		expect( box.dataset.state ).toBe( 'import' );
		expect(
			box
				.querySelector( '[data-marker="import"]' )
				.classList.contains( 'is-done' )
		).toBe( true );
		expect(
			box
				.querySelector( '[data-marker="import"]' )
				.classList.contains( 'is-current' )
		).toBe( false );
	} );

	test( 'a run that finished without a word of progress', () => {
		finish( view, null, true );

		expect( said( box, 'title' ) ).toBe( 'Import Complete' );
		expect( said( box, 'errors' ) ).toBe( '' );
		expect( figures().map( ( [ , value ] ) => value ) ).toEqual( [
			'0',
			'0',
			'0',
			'0',
		] );
	} );
} );

describe( 'stopping part way', () => {
	test( 'an import says what stays imported, and offers the way back', () => {
		begin( view, 9, true );
		stopped( view, { done: 6, errors: { 5: 'Bad.' } }, true );

		const again = view.button( 'restart', view.region( 'report-actions' ) );

		expect( box.querySelector( '[data-region="progress"]' ).hidden ).toBe(
			true
		);
		expect( box.querySelector( '[data-region="mark"]' ).className ).toBe(
			'importers__mark importers__mark--warning'
		);
		expect( said( box, 'title' ) ).toBe( 'The Import Stopped' );
		expect( said( box, 'lede' ) ).toBe(
			'6 rows were done before it stopped, and stay imported.'
		);
		expect( said( box, 'errors' ) ).toContain( 'Row 5' );
		expect( reportButtons() ).toEqual( {
			shown: true,
			import: false,
			back: true,
			restart: true,
		} );
		expect( again.className ).toBe( 'button' );
		expect( again.textContent ).toBe( 'Choose a Different File' );

		stopped( view, { done: 1 }, true );
		expect( said( box, 'lede' ) ).toBe(
			'1 row was done before it stopped, and stays imported.'
		);
	} );

	test( 'nothing changed: a check, an import that did nothing, or no word at all', () => {
		stopped( view, { done: 6 }, false );
		expect( said( box, 'title' ) ).toBe( 'The Check Stopped' );
		expect( said( box, 'lede' ) ).toBe( 'Nothing has been changed.' );

		stopped( view, { done: 0 }, true );
		expect( said( box, 'lede' ) ).toBe( 'Nothing has been changed.' );

		problems( view, { errors: { 1: 'Kept.' } } );
		stopped( view, null, true );
		expect( said( box, 'lede' ) ).toBe( 'Nothing has been changed.' );
		// No word of progress leaves what was listed as it was.
		expect( said( box, 'errors' ) ).toContain( 'Kept.' );
	} );
} );
