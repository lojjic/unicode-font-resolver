const ts = require('rollup-plugin-ts')
const json = require('@rollup/plugin-json')
// const terser = require('@rollup/plugin-terser')

module.exports = [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/client.esm.js',
        format: 'es'
      },
      {
        file: 'dist/client.umd.js',
        format: 'umd',
        name: 'UnicodeFontLoader'
      }
    ],
    plugins: [
      json(),
      ts({tsconfig: '../../tsconfig.json'}),
      //terser()
    ]
  }
];
