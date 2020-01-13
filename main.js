/// <reference lib="esnext" />

const nodePath = require('path')

/**
 *
 * @param {BabelAutoImportPluginDeclaration} declaration
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 * @returns {[string, ImportDeclaration][]}
 */
const evaluate = (declaration, babel, path, state) => {
  const t = babel.types
  const filename = state.file.opts.filename

  /** @type {[string, ImportDeclaration][]} */
  const result = []

  const source = !declaration.path.includes('[name]') ? declaration.path
    : declaration.path.replace(
      /\[name\]/,
      nodePath.basename(filename).replace(
        new RegExp(declaration.nameReplacePattern || '\\.js$'),
        declaration.nameReplaceString || ''
      )
    )

  if (declaration.default) {
    result.push([
      declaration.default,
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(declaration.default))],
        t.stringLiteral(source)
      )
    ])
  }

  if (declaration.members) {
    result.push(...declaration.members
      .filter(member => member)
      .map(
        /** @returns {[string, ImportDeclaration]} */
        member => ([
          member,
          t.importDeclaration([
            t.importSpecifier(
              t.identifier(member),
              t.identifier(member)
            )], t.stringLiteral(source)
          )
        ])
      )
    )
  }

  return result
}

/**
 *
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 */
function* resolve (babel, path, state) {
  /** @type {BabelAutoImportPluginOption} */
  const options = state.opts

  for (const declaration of options.declarations) {
    yield* evaluate(declaration, babel, path, state)
  }
}

/** @type {BabelPlugin<any>} */
const plugin = function (babel) {
  const t = babel.types

  /**
   * @param {import('@babel/types').LVal} lval
   * @returns {IterableIterator<import('@babel/types').Identifier>}
   */
  function* variables (lval) {
    if (t.isIdentifier(lval)) {
      yield lval
    } else if (t.isArrayPattern(lval)) {
      for (const element of lval.elements) {
        if (element) {
          yield* variables(element)
        }
      }
    } else if (t.isRestElement(lval)) {
      yield* variables(lval.argument)
    } else if (t.isObjectPattern(lval)) {
      for (const property of lval.properties) {
        if (t.isObjectProperty(property)) {
          yield* variables(
            /** @type {import('@babel/types').PatternLike} */(property.value)
          )
        } else if (t.isRestElement(lval)) {
          yield* variables(lval.argument)
        }
      }
    } else if (t.isAssignmentPattern(lval)) {
      yield* variables(lval.left)
    }
  }

  return {
    pre () {
      /** @type {Set<string>} */
      const lvals = new Set()

      /** @param {string} gvar */
      this.hasGVar = gvar => lvals.has(gvar)

      /**
       * @param {string} gvar
       * @param {Scope} scope
       */
      this.isGVar = (gvar, scope) => !scope.hasBinding(gvar)

      /** @param {string} gvar */
      this.addGVar = gvar => lvals.add(gvar)
    },
    visitor: {
      AssignmentExpression (path) {
        for (const gvar of variables(path.node.left)) {
          if (this.isGVar(gvar.name, path.scope)) {
            this.addGVar(gvar.name)
          }
        }
      },
      Program: {
        exit (path, state) {
          path.node.body = (/** @type {babel.types.Statement[]} */(
            // eslint-disable-next-line no-extra-parens
            Array.from((function* () {
              for (const [id, statement] of resolve(babel, path, state)) {
                if (
                  path.scope.hasGlobal(id) &&
                  // @ts-ignore
                  !this.hasGVar(id)
                ) {
                  yield statement
                }
              }
            }).call(this))
          )).concat(path.node.body)
        }
      }
    }
  }
}

/**
 * @template T
 * @typedef {T & { default: T }} DefaultExportShim
 */

/** @typedef {import('@babel/core')} Babel */

/** @typedef {import('@babel/traverse').Scope} Scope */

/** @typedef {import('@babel/traverse').NodePath<import('@babel/types').Program>} ProgramPath */

/** @typedef {import('@babel/types').Node} Node */

/** @typedef {import('@babel/types').ImportDeclaration} ImportDeclaration */

/**
 * @template S
 * @callback BabelPlugin
 * @param {Babel} param0
 * @returns {import('@babel/core').PluginObj<S>}
 */

/**
 * @typedef BabelAutoImportPluginDeclaration
 * @property {string} path
 * @property {string} [default]
 * @property {string[]} [members]
 * @property {string} [nameReplacePattern]
 * @property {string} [nameReplaceString]
 */

/**
 * @typedef BabelAutoImportPluginOption
 * @property {BabelAutoImportPluginDeclaration[]} declarations
 */

module.exports = /** @type {DefaultExportShim<BabelPlugin<any>>} */(plugin)
module.exports.default = /** @type {DefaultExportShim<BabelPlugin<any>>} */(plugin)
