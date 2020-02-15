# babel-plugin-auto-import

Convert global variables to import statements

This is an replacement for [babel-plugin-auto-import](https://github.com/PavelDymkov/babel-plugin-auto-import 'PavelDymkov/babel-plugin-auto-import') but in another configuration style.

## Known differences

This plugin fails test case 14 where it transforms...

```javascript
let a = {
  b: x,
  y,
  z: c
}
```

...into...

```diff
 import { x } from "some-path"
+import { y } from "some-path"

 let a = {
   b: x,
   y,
   z: c
 }
```

...which I believe is expected.

## Examples

### Example 1

```javascript
{
  plugins: [
    [
      '@xymopen/babel-plugin-auto-import',
      /** @type {import('@xymopen/babel-plugin-auto-import').BabelAutoImportPluginOption} */
      ({
        Vue: { from: 'vue', default: true }
      })
    ]
  ]
}
```

...will transform...

```javascript
Vue.component('my-component', { /* ... */ })
```

...into...

```javascript
import Vue from 'vue'

Vue.component('my-component', { /* ... */ })
```

### Example 2

```javascript
{
  plugins: [
    [
      '@xymopen/babel-plugin-auto-import',
      /** @type {import('@xymopen/babel-plugin-auto-import').BabelAutoImportPluginOption} */
      ({
        // You can defer the configuration generation
        factory(babel, program, state) {
          return {
            Vue: { from: 'vue-class-component' },
            Component: { from: 'vue-class-component', default: true }
          }
        }
      })
    ]
  ]
}
```

...will transform...

```javascript
@Component
class MyComponent extends Vue { }
```

...into...

```javascript
import Component from 'vue-class-component'
import { Vue } from 'vue-class-component'

@Component
class MyComponent extends Vue { }
```

### Example 3

Suitable for injecting peer dependency.

```javascript
{
  plugins: [
    [
      '@xymopen/babel-plugin-auto-import',
      /** @type {import('@xymopen/babel-plugin-auto-import').BabelAutoImportPluginOption} */
      ({
        Vue: { from: 'vue-property-decorator' },
        Component: { from: 'vue-property-decorator' },
        Prop: [
          { from: 'reflect-metadata', sideEffect: true },
          { from: 'vue-property-decorator' }
        ]
      })
    ]
  ]
}
```

...will transform...

```javascript
@Component
class MyComponent extends Vue {
  @Prop() age!: number
}
```

...into...

```javascript
import { Component } from 'vue-property-decorator'
import { Vue } from 'vue-property-decorator'
import 'reflect-metadata'
import { Prop } from 'vue-property-decorator'

@Component
class MyComponent extends Vue {
  @Prop() age!: number
}
```

**WARNING:** The plugin doesn't check if the import is `sideEffect` and misconfiguration could result in conflict or be tree shaked.

### Example 4

Suitable for polyfilling browser built-ins (eg. `window.fetch`).

```javascript
{
  plugins: [
    [
      '@xymopen/babel-plugin-auto-import',
      /** @type {import('@xymopen/babel-plugin-auto-import').BabelAutoImportPluginOption} */
      ({
        fetch: { from: 'whatwg-fetch', sideEffect: true }
      })
    ]
  ]
}
```

...will transform...

```javascript
fetch('http://example.com/qwe')
```

...into...

```javascript
import 'whatwg-fetch'

fetch('http://example.com/qwe')
```

### Example 5

```javascript
{
  plugins: [
    [
      '@xymopen/babel-plugin-auto-import',
      /** @type {import('@xymopen/babel-plugin-auto-import').BabelAutoImportPluginOption} */
      ({
        styles (babel, program, state) {
          return {
            from: `./${path.relative(state.cwd, state.filename).replace(/\.js$/, '.css')}`,
            default: true
          }
        }
      })
    ]
  ]
}
```

...will transform `component-name.js`...

```javascript
// ...
<input className={styles.className} />
// ...
```

...into...

```javascript
import styles from './component-name.css';
// ...
<input className={styles.className} />
// ...
```
