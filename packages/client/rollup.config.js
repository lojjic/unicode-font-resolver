const ts = require('rollup-plugin-ts')
const json = require('@rollup/plugin-json')
const copy = require("rollup-plugin-copy");
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
      //terser(),
      copy({
        targets: [
          {src: '../data/schema-version.json', dest: 'dist'}
        ]
      })
    ]
  }
];
