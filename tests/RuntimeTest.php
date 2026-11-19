<?php
/**
 * Runtime name derivation tests.
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Tests;

use PHPUnit\Framework\TestCase;
use SugarCommerce\Importers\Utils\Runtime;

/**
 * Routes, handles, hooks and keys come from the namespace this copy is
 * compiled under, so two plugins bundling the library never share them.
 */
final class RuntimeTest extends TestCase {

	/**
	 * A plugin that bundles the packages into its own Lib namespace is named
	 * for every segment before Lib, so two plugins of one vendor are two
	 * builds; a one-segment Lib, a prefix and an unprefixed copy keep their
	 * names.
	 */
	public function test_a_plugins_own_lib_namespace_names_the_build(): void {
		$this->assertSame( 'arraypress-edd-fraudfilter-sugarcommerce-importers', Runtime::prefix_for( 'ArrayPress\\EDD\\FraudFilter\\Lib\\Importers\\Utils' ) );
		$this->assertNotSame(
			Runtime::prefix_for( 'ArrayPress\\EDD\\FraudFilter\\Lib\\Importers\\Utils' ),
			Runtime::prefix_for( 'ArrayPress\\EDD\\SalePrices\\Lib\\Importers\\Utils' ),
			'Two plugins of one vendor share a name.'
		);
		$this->assertSame( 'playground-sugarcommerce-importers', Runtime::prefix_for( 'Playground\\Lib\\Importers\\Utils' ), 'A one-segment Lib changed its name.' );
		$this->assertSame( 'sugarcart-sugarcommerce-importers', Runtime::prefix_for( 'SugarCart\\Vendor\\SugarCommerce\\Importers\\Utils' ), 'A prefix changed its name.' );
		$this->assertSame( 'sugarcommerce-importers', Runtime::prefix_for( 'SugarCommerce\\Importers\\Utils' ), 'The unprefixed copy changed its name.' );
	}
}
