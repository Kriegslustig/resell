module.exports = {
  use: [
    ['@neutrinojs/library', {
      name: 'resell-select',
      target: 'node',
      libraryTarget: 'commonjs2',
      babel: {
        presets: [ 'flow' ],
      },
    }],
    ['@neutrinojs/jest', {
      testRegex: '__tests__/.*.js'
    }],
  ]
}
