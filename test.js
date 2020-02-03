const { assert } = require('chai')
const babel = require('@babel/core')
const plugin = require('./main.js').default

/**
 * @param {string} input
 * @param {string} expected
 * @param {*} declarations
 * @param {string} [filename]
 */
function isEqual (input, expected, declarations, filename) {
  const spaces = /\s+/g

  /** @type {import('@babel/core').TransformOptions} */
  const babelOptions = {
    root: undefined,
    configFile: false,
    babelrc: false,
    babelrcRoots: undefined,
    sourceType: 'module',
    code: true,
    plugins: [[plugin, { declarations }]]
  }

  if (!babelOptions.filename) {
    babelOptions.filename = filename || 'default.js'
  }

  const output = /** @type {string} */(
    (/** @type {babel.BabelFileResult} */(
      babel.transform(input, babelOptions))
    ).code
  )

  return output.replace(spaces, '') === expected.replace(spaces, '')
}

describe('Tests', () => {
  it('case 1', () => {
    const input = `
      someVariable
    `
    const declaration = {
      default: 'someVariable', path: 'some-path/some-module.js'
    }
    const output = `
      import someVariable from "some-path/some-module.js"

      someVariable
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 2', () => {
    const input = `
      import someVariable from "some-path/some-module.js"

      someVariable
    `
    const declaration = {
      default: 'someVariable', path: 'some-path/some-module.js'
    }
    const output = `
      import someVariable from "some-path/some-module.js"

      someVariable
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 3', () => {
    const input = `
      someVariable
    `
    const declaration = {
      members: ['someVariable'], path: 'some-path/some-module.js'
    }
    const output = `
      import { someVariable } from "some-path/some-module.js"

      someVariable
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 4', () => {
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
    const declarations = [
      { default: 'x', path: 'some-path/x.js' },
      { members: ['y'], path: 'some-path/y.js' }
    ]
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

    assert.isTrue(isEqual(input, output, declarations))
  })

  it('case 5', () => {
    const input = `
      let someVariable
    `
    const declaration = {
      default: 'someVariable', path: 'some-path/some-module.js'
    }
    const output = `
      let someVariable
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 6', () => {
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
    const declaration = {
      path: 'some-path',
      default: 'x',
      members: ['y', 'z']
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

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 7', () => {
    const input = `
      x.y.z
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x } from "some-path"

      x.y.z
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 8', () => {
    const input = `
      let a = x.b()
      let c = d.b()
    `
    const declaration = {
      default: 'x', path: 'some-path'
    }
    const output = `
      import x from "some-path"

      let a = x.b()
      let c = d.b()
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 9', () => {
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
    const declaration = {
      members: ['x', 'y'], path: 'some-path'
    }
    const output = input

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 10', () => {
    const input = `
      try {
        class x {
          y () { }
        }

        a = class z { }
      } catch (q) { }
    `
    const declaration = {
      members: ['x', 'y', 'z', 'q'], path: 'some-path'
    }
    const output = input

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 11', () => {
    const input = `
      function x () { }

      let a = function y () { }
      let b = {
        c: function z () { }
      }
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = input

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 12', () => {
    const input = `
      ({ x } = a);

      [y] = b
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = input

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 13', () => {
    const input = `
      export default x
    `
    const declaration = {
      default: 'x', path: 'some-path'
    }
    const output = `
      import x from "some-path"

      export default x
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 14', () => {
    const input = `
      let a = {
        b: x,
        y,
        z: c
      }
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x } from "some-path"

      let a = {
        b: x,
        y,
        z: c
      }
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 15', () => {
    const input = `
      (function () {
        let a = x
        let b = x
      }())
    `
    const declaration = {
      default: 'x', path: 'some-path'
    }
    const output = `
      import x from "some-path"

      (function () {
        let a = x
        let b = x
      })()
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 16', () => {
    const input = `
      let a = b + x
    `
    const declaration = {
      default: 'x', path: 'some-path'
    }
    const output = `
      import x from "some-path"

      let a = b + x
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 17', () => {
    const input = `
      let a = x ? y : z
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, y, z } from "some-path"

      let a = x ? y : z
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 18', () => {
    const input = `
      let a = b => x

      let c = d(y)

      if (z) { }
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, y, z } from "some-path"

      let a = b => x

      let c = d(y)

      if (z) { }
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 19', () => {
    const input = `
      for (let a in x) { }

      for (let i = 0; y; z) { }
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, y, z } from "some-path"

      for (let a in x) { }

      for (let i = 0; y; z) { }
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 20', () => {
    const input = `
      new x
      new a.y()
      new z()
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, z } from "some-path"

      new x()
      new a.y()
      new z()
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 21', () => {
    const input = `
      function a () {
        return x
      }

      y\`\`

      switch (z) { }
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, y, z } from "some-path"

      function a () {
        return x
      }

      y\`\`

      switch (z) { }
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 22', () => {
    const input = `
      throw x
      +y
    `
    const declaration = {
      members: ['x', 'y', 'z'], path: 'some-path'
    }
    const output = `
      import { x, y } from "some-path"

      throw x
      +y
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 23', () => {
    const input = `
      class A extends X { }

      let B = class B extends Y { }
    `
    const declaration = {
      members: ['X', 'Y'], path: 'some-path'
    }
    const output = `
      import { X, Y } from "some-path"

      class A extends X { }

      let B = class B extends Y { }
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 24', () => {
    const input = `
      someVariable
    `
    const declaration = {
      anonymous: ['someVariable'], path: 'some-path/some-module.js'
    }
    const output = `
      import "some-path/some-module.js"

      someVariable
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 25', () => {
    const input = `
      let x = a + b
    `
    const declaration = {
      anonymous: ['a', 'b'], path: 'some-path/some-module.js'
    }
    const output = `
      import "some-path/some-module.js"

      let x = a + b
    `

    assert.isTrue(isEqual(input, output, [declaration]))
  })

  it('case 26', () => {
    const input = `
      styles.className
    `
    const filename = './componentName.js'
    const declaration = {
      default: 'styles', path: './[name].css'
    }
    const output = `
      import styles from "./componentName.css"

      styles.className
    `

    assert.isTrue(isEqual(input, output, [declaration], filename))
  })

  it('case 27', () => {
    const input = `
      styles.className
    `
    const filename = './name.component.js'
    const declaration = {
      default: 'styles',
      path: './[name].css',
      nameReplacePattern: '.component.js$',
      nameReplaceString: '.styles'
    }
    const output = `
      import styles from "./name.styles.css"

      styles.className
    `

    assert.isTrue(isEqual(input, output, [declaration], filename))
  })
})
