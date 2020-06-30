/// <reference lib="esnext" />

/**
 * @param {BabelAutoImportPluginOption} option
 * @returns {option is BabelAutoImportPluginImportFactoryOption}
 */
const isFactory = option => typeof option.factory === 'function'

/**
 * @param {BabelAutoImportPluginImport} resolution
 * @returns {resolution is BabelAutoImportPluginDefaultImport}
 */
const isDefaultImport = resolution =>
  // @ts-ignore
  Boolean(resolution.default)

/**
 * @param {BabelAutoImportPluginImport} resolution
 * @returns {resolution is BabelAutoImportPluginSideEffectImport}
 */
const isSideEffectImport = resolution =>
  // @ts-ignore
  Boolean(resolution.sideEffect)

/**
 * @template T
 * @param {T | Iterable<T>} values
 * @returns {IterableIterator<T>}
 */
function* every (values) {
  if (Symbol.iterator in values) {
    yield* /** @type {Iterable<T>} */ (values)
  } else {
    yield /** @type {T} */ (values)
  }
}

/**
 * @param {import('@babel/core')} babel
 * @param {import('@babel/core').types.LVal} lval
 * @returns {IterableIterator<import('@babel/core').types.Identifier>}
 */
function* variables (babel, lval) {
  const t = babel.types

  if (t.isIdentifier(lval)) {
    yield lval
  } else if (t.isArrayPattern(lval)) {
    for (const element of lval.elements) {
      if (element) {
        if (t.isRestElement(element)) {
          yield* variables(babel, element.argument)
        } else if (t.isAssignmentPattern(element)) {
          yield* variables(babel, element.left)
        } else {
          yield* variables(babel, element)
        }
      }
    }
  } else if (t.isObjectPattern(lval)) {
    for (const property of lval.properties) {
      if (t.isRestElement(property)) {
        yield* variables(babel, property.argument)
      } else if (t.isObjectProperty(property)) {
        yield* variables(
          babel,
          // Expression is not allowed in LVal
          /** @type {import('@babel/core').types.PatternLike} */(property.value)
        )
      }
    }
  }
}

/**
 *
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 * @returns {IterableIterator<[string, BabelAutoImportPluginImport]>}
 */
function* resolve (babel, path, state) {
  /** @type {BabelAutoImportPluginOption} */
  const factory = state.opts

  if (isFactory(factory)) {
    const option = factory.factory(babel, path, state)

    for (const [id, resolutions] of Object.entries(option)) {
      for (const resolution of every(resolutions)) {
        yield [id, resolution]
      }
    }
  } else {
    const option = factory

    for (const [id, resolutionFactory] of Object.entries(option)) {
      const resolutions = typeof resolutionFactory === 'function'
        ? resolutionFactory(babel, path, state)
        : resolutionFactory

      for (const resolution of every(resolutions)) {
        yield [id, resolution]
      }
    }
  }
}

/** @type {BabelPlugin<BabelAutoImportPluginState>} */
const plugin = function (babel) {
  const t = babel.types

  return {
    pre () {
      this.assignedGlobals = new Set()
      this.implicitImportDecls = new Map()
      this.explicitImportDecls = new Map()
    },
    visitor: {
      ImportDeclaration (path) {
        this.explicitImportDecls.set(path.node.source.value, path.node)
        path.remove()
      },
      AssignmentExpression (path) {
        for (const vari of variables(babel, path.node.left)) {
          if (path.scope.hasGlobal(vari.name)) {
            this.assignedGlobals.add(vari.name)
          }
        }
      },
      Program: {
        exit (path) {
          for (const [id, resolution] of resolve(babel, path, this)) {
            if (path.scope.hasGlobal(id) && !this.assignedGlobals.has(id)) {
              const decl = this.implicitImportDecls.get(resolution.from) ||
                this.explicitImportDecls.get(resolution.from) ||
                (() => {
                  const decl = t.importDeclaration([], t.stringLiteral(resolution.from))
                  this.implicitImportDecls.set(resolution.from, decl)
                  return decl
                })()

              if (isDefaultImport(resolution)) {
                decl.specifiers.unshift(t.importDefaultSpecifier(t.identifier(id)))
              } else if (!isSideEffectImport(resolution)) {
                decl.specifiers.push(t.importSpecifier(
                  t.identifier(id), t.identifier(resolution.export || id)
                ))
              }
            }
          }

          path.node.body.unshift(
            ...this.implicitImportDecls.values(),
            ...this.explicitImportDecls.values()
          )
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

/** @typedef {import('@babel/traverse').NodePath<import('@babel/core').types.Program>} ProgramPath */

/** @typedef {import('@babel/core').types.Node} Node */

/** @typedef {import('@babel/core').types.ImportDeclaration} ImportDeclaration */

/**
 * @template S
 * @callback BabelPlugin
 * @param {Babel} param0
 * @returns {import('@babel/core').PluginObj<S>}
 */

/**
 * @typedef BabelAutoImportPluginState
 * @property {Set<string>} assignedGlobals
 * @property {Map<string, ImportDeclaration>} implicitImportDecls
 * @property {Map<string, ImportDeclaration>} explicitImportDecls
 */

/**
 * @typedef BabelAutoImportPluginDefaultImport
 * @property {string} from
 * @property {true} default
 */

/**
 * @typedef BabelAutoImportPluginExportImport
 * @property {string} from
 * @property {string} [export]
 */

/**
 * @typedef BabelAutoImportPluginSideEffectImport
 * @property {string} from
 * @property {true} sideEffect
 */

/**
 * @typedef {BabelAutoImportPluginDefaultImport |
 *  BabelAutoImportPluginExportImport |
 *  BabelAutoImportPluginSideEffectImport} BabelAutoImportPluginImport
 */

/**
 * @typedef {BabelAutoImportPluginImport |
 *  BabelAutoImportPluginImport[]} BabelAutoImportPluginImports
 */

/**
 * @callback BabelAutoImportPluginImportCallback
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 * @returns {BabelAutoImportPluginImports}
 */

/**
 * @callback BabelAutoImportPluginImportFactory
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 * @returns {{
 *  [identifier: string]: BabelAutoImportPluginImports
 * }}
 */

/**
 * @typedef BabelAutoImportPluginImportFactoryOption
 * @property {BabelAutoImportPluginImportFactory} factory
 */

/**
 * @typedef {BabelAutoImportPluginImportFactoryOption | {
 *  [identifier: string]: BabelAutoImportPluginImports | BabelAutoImportPluginImportCallback
 * }} BabelAutoImportPluginOption
 */

module.exports = /** @type {DefaultExportShim<typeof plugin>} */(plugin)
module.exports.default = /** @type {DefaultExportShim<typeof plugin>} */(plugin)
