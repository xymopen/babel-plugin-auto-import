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
 * @param {string} id
 * @param {BabelAutoImportPluginImport} resolution
 * @returns {ImportDeclaration}
 */
function evaluate (babel, id, resolution) {
  const t = babel.types

  if (isDefaultImport(resolution)) {
    return t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(id))],
      t.stringLiteral(resolution.from)
    )
  } else if (isSideEffectImport(resolution)) {
    return t.importDeclaration([], t.stringLiteral(resolution.from)
    )
  } else {
    return t.importDeclaration([
      t.importSpecifier(
        t.identifier(id),
        t.identifier(resolution.export || id)
      )], t.stringLiteral(resolution.from))
  }
}

/**
 *
 * @param {Babel} babel
 * @param {ProgramPath} path
 * @param {any} state
 * @returns {IterableIterator<[string, ImportDeclaration]>}
 */
function* resolve (babel, path, state) {
  /** @type {BabelAutoImportPluginOption} */
  const factory = state.opts

  if (isFactory(factory)) {
    const option = factory.factory(babel, path, state)

    for (const [id, resolutions] of Object.entries(option)) {
      for (const resolution of every(resolutions)) {
        yield [id, evaluate(babel, id, resolution)]
      }
    }
  } else {
    const option = factory

    for (const [id, resolutionFactory] of Object.entries(option)) {
      const resolutions = typeof resolutionFactory === 'function'
        ? resolutionFactory(babel, path, state)
        : resolutionFactory

      for (const resolution of every(resolutions)) {
        yield [id, evaluate(babel, id, resolution)]
      }
    }
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
      const importedSources = new Set()
      /** @type {Set<string>} */
      const lvals = new Set()

      /** De-duplicate side effect import */
      this.isSideEffectImported =
        /** @param {ImportDeclaration} statement */
        statement => {
          const source = statement.source.value

          if (statement.specifiers.length === 0 &&
            importedSources.has(source)) {
            return true
          } else {
            importedSources.add(source)

            return false
          }
        }

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
                  !this.isSideEffectImported(statement) &&
                  // @ts-ignore
                  !this.hasGVar(id)
                ) {
                  yield statement
                }
              }
            }).call(this))
          )).concat(path.node.body
            .filter(statement =>
              !t.isImportDeclaration(statement) ||
              !this.isSideEffectImported(statement)))
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

module.exports = /** @type {DefaultExportShim<BabelPlugin<any>>} */(plugin)
module.exports.default = /** @type {DefaultExportShim<BabelPlugin<any>>} */(plugin)
