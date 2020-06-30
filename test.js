const { assert } = require('chai')
const path = require('path')
const babel = require('@babel/core')
const plugin = require('./main.js').default

/**
 * @param {string} input
 * @param {string} expected
 * @param {BabelAutoImportPluginOption} pluginOption
 * @param {Partial<TransformOptions>} [transformOption]
 * @returns {[string, string]}
 */
function isEqual (input, expected, pluginOption, transformOption) {
  /** @type {import('@babel/core').TransformOptions} */
  const babelOptions = {
    code: true,
    root: undefined,
    configFile: false,
    babelrc: false,
    babelrcRoots: undefined,
    sourceType: 'module',
    ...transformOption
  }

  const output = /** @type {string} */(
    (/** @type {babel.BabelFileResult} */(
      babel.transform(input, {
        ...babelOptions,
        plugins: [[plugin, pluginOption]]
      }))
    ).code
  )

  expected = /** @type {string} */(
    (/** @type {babel.BabelFileResult} */(
      babel.transform(expected, babelOptions))
    ).code
  )

  return [output, expected]
}

describe('Tests', () => {
  it('should insert default import for global reference', () => {
    const input = `
      someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      someVariable: { from: 'some-path/some-module.js', default: true }
    }
    const output = `
      import someVariable from "some-path/some-module.js"

      someVariable
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not overwrite existing import', () => {
    const input = `
      import someVariable from "some-path/other-module.js"

      someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      someVariable: { from: 'some-path/some-module.js', default: true }
    }

    assert.strictEqual(...isEqual(input, input, option))
  })

  it('should insert member import for global reference', () => {
    const input = `
      someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      someVariable: { from: 'some-path/some-module.js' }
    }
    const output = `
      import { someVariable } from "some-path/some-module.js"

      someVariable
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for assigment right value access in function', () => {
    const input = `
      import z from "some-path/y.js"

      let a

      (function () {
        let b

        (function () {
          let c = a
          let d = x()
          let e = a
          let f = y
          let g = z
        })()
      })()
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path/x.js', default: true },
      y: { from: 'some-path/y.js' }
    }
    const output = `
      import x from "some-path/x.js"
      import z, { y } from "some-path/y.js"

      let a

      (function () {
        let b

        (function () {
          let c = a
          let d = x()
          let e = a
          let f = y
          let g = z
        })()
      })()
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for global variable', () => {
    const input = `
      let someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      someVariable: { from: 'some-path/some-module.js', default: true }
    }
    const output = `
      let someVariable
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for local variable', () => {
    const input = `
      import { q } from "some-path"

      let a

      (function () {
        let b

        (function () {
          let c = a
          let d = x()
          let e = a
          let f = y
          let g = z
        })()
      })()
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path', default: true },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import x, { q, y, z } from "some-path"

      let a

      (function () {
        let b

        (function () {
          let c = a
          let d = x()
          let e = a
          let f = y
          let g = z
        })()
      })()
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for property access', () => {
    const input = `
      x.y.z
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x } from "some-path"

      x.y.z
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for assigment right value access in globe', () => {
    const input = `
      let a = x.b()
      let c = d.b()
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path', default: true }
    }
    const output = `
      import x from "some-path"

      let a = x.b()
      let c = d.b()
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for label', () => {
    const input = `
      x:
      for (let i = 0; i < 10; i++) {
        if (i) break x

        y:
        for (let i = 0; i < 10; i++) {
          if (i) continue y
        }
      }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' }
    }
    const output = input

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for class declaration', () => {
    const input = `
      try {
        class x {
          y () { }
        }

        a = class z { }
      } catch (q) { }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' },
      q: { from: 'some-path' }
    }
    const output = input

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for function declaration', () => {
    const input = `
      function x () { }

      let a = function y () { }
      let b = {
        c: function z () { }
      }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = input

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for destruction', () => {
    const input = `
      ({ x } = a);

      [y] = b
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = input

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for export declaration', () => {
    const input = `
      export default x
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path', default: true }
    }
    const output = `
      import x from "some-path"

      export default x
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for object property', () => {
    const input = `
      let a = {
        b: x,
        y,
        z: c
      }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x } from "some-path"

      let a = {
        b: x,
        y,
        z: c
      }
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for IIFE', () => {
    const input = `
      (function () {
        let a = x
        let b = x
      }())
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path', default: true }
    }
    const output = `
      import x from "some-path"

      (function () {
        let a = x
        let b = x
      })()
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not insert import for binary expression', () => {
    const input = `
      let a = b + x
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path', default: true }
    }
    const output = `
      import x from "some-path"

      let a = b + x
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for conditional expression', () => {
    const input = `
      let a = x ? y : z
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, y, z } from "some-path"

      let a = x ? y : z
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for arrow function expr, call expr and if stat', () => {
    const input = `
      let a = b => x

      let c = d(y)

      if (z) { }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, y, z } from "some-path"

      let a = b => x

      let c = d(y)

      if (z) { }
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for for stat', () => {
    const input = `
      for (let a in x) { }

      for (let i = 0; y; z) { }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, y, z } from "some-path"

      for (let a in x) { }

      for (let i = 0; y; z) { }
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for new stat', () => {
    const input = `
      new x
      new a.y()
      new z()
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, z } from "some-path"

      new x()
      new a.y()
      new z()
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for return stat, tagged template expr and switch stat', () => {
    const input = `
      function a () {
        return x
      }

      y\`\`

      switch (z) { }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, y, z } from "some-path"

      function a () {
        return x
      }

      y\`\`

      switch (z) { }
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for throw stat and unary expr', () => {
    const input = `
      throw x
      +y
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path' },
      y: { from: 'some-path' },
      z: { from: 'some-path' }
    }
    const output = `
      import { x, y } from "some-path"

      throw x
      +y
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert import for super class reference', () => {
    const input = `
      class A extends X { }

      let B = class B extends Y { }
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      X: { from: 'some-path' },
      Y: { from: 'some-path' }
    }
    const output = `
      import { X, Y } from "some-path"

      class A extends X { }

      let B = class B extends Y { }
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should support side effect import', () => {
    const input = `
      someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      someVariable: { from: 'some-path/some-module.js', sideEffect: true }
    }
    const output = `
      import "some-path/some-module.js"

      someVariable
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should not duplicate side effect import', () => {
    const input = `
      let x = a + b
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      a: { from: 'some-path/some-module.js', sideEffect: true },
      b: { from: 'some-path/some-module.js', sideEffect: true }
    }
    const output = `
      import "some-path/some-module.js"

      let x = a + b
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should support callback config 1', () => {
    const input = `
      styles.className
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      styles (babel, program, state) {
        return {
          from: `./${path.relative(state.cwd, state.filename).replace(/\.js$/, '.css')}`,
          default: true
        }
      }
    }
    const output = `
      import styles from "./componentName.css"

      styles.className
    `

    assert.strictEqual(...isEqual(input, output, option, {
      filename: './componentName.js'
    }))
  })

  it('should support callback config 2', () => {
    const input = `
      styles.className
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      styles (babel, program, state) {
        return {
          from: `./${path.relative(state.cwd, state.filename).replace(/\.component\.js$/, '.styles.css')}`,
          default: true
        }
      }
    }
    const output = `
      import styles from "./name.styles.css"

      styles.className
    `

    assert.strictEqual(...isEqual(input, output, option, {
      filename: './name.component.js'
    }))
  })

  it('should support factory config', () => {
    const input = `
      someVariable
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      factory (babel, program, state) {
        return {
          someVariable: [{ from: 'some-path/some-module.js', default: true }]
        }
      }
    }
    const output = `
      import someVariable from "some-path/some-module.js"

      someVariable
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should append specificer to side effect import', () => {
    const input = `
      x
      y
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path/some-module.js', sideEffect: true },
      y: { from: 'some-path/some-module.js' }
    }
    const output = `
      import { y } from "some-path/some-module.js"

      x
      y
    `

    assert.strictEqual(...isEqual(input, output, option))
  })

  it('should insert side effect import before other imports', () => {
    const input = `
      x
      y
    `
    /** @type {BabelAutoImportPluginOption} */
    const option = {
      x: { from: 'some-path/some-module.js' },
      y: [
        { from: 'some-path/other-module.js', sideEffect: true },
        { from: 'some-path/some-module.js' }
      ]
    }
    const output = `
      import "some-path/other-module.js"
      import { x, y } from "some-path/some-module.js"

      x
      y
    `

    assert.strictEqual(...isEqual(input, output, option))
  })
})

/** @typedef {import('@babel/core').TransformOptions} TransformOptions */
/** @typedef {import('./main').BabelAutoImportPluginOption} BabelAutoImportPluginOption */
