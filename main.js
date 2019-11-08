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
  const traverse = babel.traverse

  /**
   * @template {Node} T
   * @callback CollectGVar
   * @param {T} node
   * @param {Scope} scope
   * @returns {void}
   */

  /** @type {CollectGVar<Node>} */
  function testGVar (node, scope) {
    if (t.isIdentifier(node) && this.isGVar(node.name, scope)) {
      this.addGVar(node.name)
    }
  }

  const gvarExtractor = {
    /** @type {CollectGVar<import('@babel/types').ArrayPattern>} */
    ArrayPattern (node, scope) {
      node.elements.forEach(e => testGVar.call(this, e, scope))
    },

    /** @type {CollectGVar<import('@babel/types').RestElement>} */
    RestElement (node, scope) {
      testGVar.call(this, node.argument, scope)
    },

    /** @type {CollectGVar<import('@babel/types').ObjectProperty>} */
    ObjectProperty (node, scope) {
      testGVar.call(this, node.value, scope)
    },

    /** @type {CollectGVar<import('@babel/types').AssignmentPattern>} */
    AssignmentPattern (node, scope) {
      testGVar.call(this, node.left, scope)
    }
  }

  const patternVisitor =
    Object.fromEntries(Object.entries(gvarExtractor).map(
      /** @returns {[string, import('@babel/traverse').VisitNodeFunction<any, Node>]} */
      ([type, collect]) =>
        [type, function (path) { collect.call(this, path.node, path.scope) }]
    ))

  /** @type {CollectGVar<Node>} */
  function visit (node, scope) {
    return Object.keys(gvarExtractor).forEach(
      type => {
        if (t.is(type, node)) {
          gvarExtractor[type].call(this, node, scope)
        }
      })
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
      AssignmentExpression (path, state) {
        const lval = path.node.left

        if (t.isIdentifier(lval) && this.isGVar(lval.name, path.scope)) {
          this.addGVar(lval.name)
        } else if (t.isPattern(lval)) {
          // traverse() won't visit parent node
          visit.call(this, lval, path.scope, state)
          traverse(lval, patternVisitor, path.scope, state, path.parentPath)
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
