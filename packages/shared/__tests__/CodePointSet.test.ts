import 'jest'
import { readFileSync } from 'fs'
import { parseCssUnicodeRangeString, CodePointSet } from "../src"

test.skip('foo', () => {

  // Load from JSON...
  const json = JSON.parse(readFileSync('./google-fonts-v2.json', {encoding: 'utf8'}))
  const fonts: Array<{ name: string, ranges: number[][] }> = []
  for (let name in json) {
    if (name.startsWith('noto-sans')) {
      for (let subset in json[name].unicodeRange) {
        // Exclude latin ranges from non-base fonts
        if (name !== 'noto-sans' && subset.startsWith('latin')) continue
        fonts.push({
          name: `${name} - ${subset}`,
          ranges: parseCssUnicodeRangeString(json[name].unicodeRange[subset]).filter(range =>
              // Some include latinish ranges, strip those out
              name === 'noto-sans' || (range[0] !== 0 && range[1] !== 0xff)
          )
        })
      }
    }
  }

  let totalArrays = 0
  let totalBytes = 0
  fonts.forEach(({name, ranges}) => {
    let testObj = new CodePointSet()

    console.log(`=== ${name} ===`)

    console.time('add')
    ranges.forEach(([start, end]) => {
      testObj.add(start, end)
    })
    console.timeEnd('add')

    console.log(`Min/max: ${testObj.min}-${testObj.max}`)

    // validate
    ranges.forEach(([start, end = start]) => {
      for (let i = start; i <= end; i++) {
        if (!testObj.has(i)) {
          throw `Oops - code point U+${i.toString(16)} not found`
        }
      }
    })

    console.time('read')
    // console.log(testObj.contains(0xfee3))
    for (let i = 0; i < 10000; i++) {
      if (testObj.has(i * 10)) {
        //console.log('match')
      }
    }
    console.timeEnd('read')
    console.log(JSON.stringify(testObj.data, (_key, val) =>
            (val && val.byteLength) ? `[${val.byteLength * 8 / val.length}]${val.join(',')}` : val
        , 0))
    console.log(testObj.data.length + ' arrays')
    const bytes = testObj.data.reduce((sum, arr) => sum + arr.byteLength, 0)
    console.log(`${bytes} bytes in memory`)
    totalArrays += testObj.data.length
    totalBytes += bytes
  })

  console.log(`== Total fonts: ${fonts.length} ==`)
  console.log(`== Total arrays: ${totalArrays} ==`)
  console.log(`== Total bytes: ${totalBytes} ==`)
})
