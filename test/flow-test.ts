import {throws} from "assert";

import {transform, Options} from "../src";
import {ESMODULE_PREFIX, IMPORT_DEFAULT_PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertFlowResult(
  code: string,
  expectedResult: string,
  options: Partial<Options> = {},
): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "flow"], ...options});
}

function assertFlowESMResult(
  code: string,
  expectedResult: string,
  options: Partial<Options> = {},
): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "flow"], ...options});
}

describe("transform flow", () => {
  it("removes `import type` statements", () => {
    assertFlowResult(
      `
      import type {a} from 'b';
      import c from 'd';
      import type from 'e';
      import {f, type g} from 'h';
      import {type i, type j} from 'k';
      import type L from 'L';
    `,
      `${IMPORT_DEFAULT_PREFIX}
      
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      var _e = require('e'); var _e2 = _interopRequireDefault(_e);
      var _h = require('h');
      
      
    `,
    );
  });

  it("does not mistake ? in types for a ternary operator", () => {
    assertFlowResult(
      `
      type A<T> = ?number;
      const f = (): number => 3;
    `,
      `
      
      const f = () => 3;
    `,
    );
  });

  it("properly removes class property variance markers", () => {
    assertFlowResult(
      `
      class C {
        +foo: number;
        -bar: number;
      }
    `,
      `
      class C {
        
        
      }
    `,
    );
  });

  it("recognizes arrow function types in variable declarations", () => {
    assertFlowResult(
      `
      const x: a => b = 2;
    `,
      `
      const x = 2;
    `,
    );
  });

  it("recognizes arrow function types within parameters", () => {
    assertFlowResult(
      `
      function partition<T>(
        list: T[],
        test: (T, number, T[]) => ?boolean,
      ): [T[], T[]] {
        return [];
      }
    `,
      `
      function partition(
        list,
        test,
      ) {
        return [];
      }
    `,
    );
  });

  it("recognizes exact object types", () => {
    assertFlowResult(
      `
      function foo(): {| x: number |} {
        return 3;
      }
    `,
      `
      function foo() {
        return 3;
      }
    `,
    );
  });

  it("handles `export type * from`", () => {
    assertFlowResult(
      `
      export type * from "a";
    `,
      `
      
    `,
    );
  });

  it("handles `import ... typeof`", () => {
    assertFlowResult(
      `
      import {typeof a as b} from 'c';
      import typeof d from 'e';
    `,
      `
      
      
    `,
    );
  });

  it("handles export type for individual types", () => {
    assertFlowResult(
      `
      export type {foo};
    `,
      `
      
    `,
    );
  });

  it("handles plain default exports when parsing flow", () => {
    assertFlowResult(
      `
      export default 3;
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = 3;
    `,
    );
  });

  it("properly parses import aliases with the flow parser", () => {
    assertFlowResult(
      `
      import { a as b } from "c";
    `,
      `
      var _c = require('c');
    `,
    );
  });

  it("properly parses bounded type parameters", () => {
    assertFlowResult(
      `
      function makeWeakCache<A: B>(): void {
      }
    `,
      `
      function makeWeakCache() {
      }
    `,
    );
  });

  it("properly handles star as an arrow type param", () => {
    assertFlowResult(
      `
      const x: *=>3 = null;
    `,
      `
      const x = null;
    `,
    );
  });

  it("properly handles @@iterator in a declared class", () => {
    assertFlowResult(
      `
      declare class A {
        @@iterator(): Iterator<File>;
      }
    `,
      `
      


    `,
    );
  });

  it("supports the implements keyword", () => {
    assertFlowResult(
      `
      declare class A implements B, C {}
    `,
      `
      
    `,
    );
  });

  it("properly prunes flow imported names", () => {
    assertFlowESMResult(
      `
      import a, {type n as b, m as c, type d} from './e';
      import type f from './g';
    `,
      `
      import a, { m as c,} from './e';

    `,
    );
  });

  it("removes @flow directives", () => {
    assertFlowResult(
      `
      /* Hello @flow */
      // World @flow
      function foo(): number {
        return 3;
      }
      // @flow
    `,
      `
      /* Hello  */
      // World 
      function foo() {
        return 3;
      }
      // 
    `,
    );
  });

  it("handles internal slot syntax", () => {
    assertFlowResult(
      `
      type T = { [[foo]]: X }
    `,
      `
      
    `,
    );
  });

  it("handles optional internal slot syntax", () => {
    assertFlowResult(
      `
      type T = { [[foo]]?: X }
    `,
      `
      
    `,
    );
  });

  it("handles flow type arguments", () => {
    assertFlowResult(
      `
      f<T>();
      new C<T>();
    `,
      `
      f();
      new C();
    `,
    );
  });

  it("handles flow inline interfaces", () => {
    assertFlowResult(
      `
      type T = interface { p: string }
    `,
      `
      
    `,
    );
  });

  it("handles the proto keyword in class declarations", () => {
    assertFlowResult(
      `
      declare class A {
        proto x: T;
      }
    `,
      `
      


    `,
    );
  });

  it("allows interface methods named 'static'", () => {
    assertFlowResult(
      `
      type T = interface { static(): number }
    `,
      `
      
    `,
    );
  });

  // Note that we don't actually transform private fields at the moment, this just makes sure it
  // parses.
  it("allows private properties with type annotations", () => {
    assertFlowResult(
      `
      class A {
        #prop1: string;
        #prop2: number = value;
      }
    `,
      `
      class A {
        #prop1;
        #prop2 = value;
      }
    `,
    );
  });

  it("allows explicit inexact types", () => {
    assertFlowResult(
      `
      type T = {...};
      type U = {x: number, ...};
      type V = {x: number, ...V, ...U};
    `,
      `
      


    `,
    );
  });

  it("allows function types as type parameters", () => {
    assertFlowResult(
      `
      type T = Array<(string) => number> 
    `,
      `
       
    `,
    );
  });

  it("allows underscore type arguments in invocations", () => {
    assertFlowResult(
      `
      test<
        _,
        _,
        number,
        _,
        _,
      >();
      new test<_>(); 
    `,
      `
      test





();
      new test(); 
    `,
    );
  });

  it("allows type casts in function invocations", () => {
    assertFlowResult(
      `
      foo(n : number);
    `,
      `
      foo(n );
    `,
    );
  });

  it("does not infinite loop on declare module declarations", () => {
    throws(
      () =>
        transform(
          `
      declare module 'ReactFeatureFlags' {
        declare module.exports: any;
      }
    `,
          {transforms: ["flow"]},
        ),
      /SyntaxError: Unexpected token \(3:9\)/,
    );
  });

  it("correctly compiles class fields with flow `implements` classes", () => {
    assertFlowResult(
      `
      class Foo implements Bar {
        baz = () => {
      
        }
      }
    `,
      `
      class Foo  {constructor() { Foo.prototype.__init.call(this); }
        __init() {this.baz = () => {
      
        }}
      }
    `,
    );
  });

  it("recognizes flow indexed access types", () => {
    assertFlowResult(
      `
      type A = Obj['a'];
      type B = Array<string>[number];
    `,
      `
      

    `,
    );
  });

  it("recognizes flow optional indexed access types", () => {
    assertFlowResult(
      `
      type A = Obj?.['a'];
      type B = Array<string>?.[number];
    `,
      `
      

    `,
    );
  });

  it("properly removes class property with ES transforms disabled", () => {
    assertFlowResult(
      `
      class C {
        +foo: number;
        -bar: number;
      }
    `,
      `
      class C {
        ;
        ;
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("properly parses `as as` in an import statement", () => {
    assertFlowResult(
      `
      import {foo as as} from "./Foo";
    `,
      `"use strict";
      var _Foo = require('./Foo');
    `,
    );
  });
});
