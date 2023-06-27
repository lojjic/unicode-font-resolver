import 'jest'
import { parseCssUnicodeRangeString, CodePointSet } from "../src"
import { getNotoFonts } from "../../data/src/noto-fonts";

test('CodePointSet', () => {

  const fonts = getNotoFonts()

  let totalQueryTime = 0
  let totalBuildTime = 0
  let totalTests = 0

  let totalArrays = 0
  let totalBytes = 0
  for (const fontName in fonts) {
    for (const rangeName in fonts[fontName].unicodeRange) {
      // if (fontName !== 'noto-sans' || rangeName !== 'latin') continue
      // if (rangeName !== 'math') continue

      totalTests++
      const cssRangeString = fonts[fontName].unicodeRange[rangeName]
      const ranges = parseCssUnicodeRangeString(cssRangeString)
      let testObj = new CodePointSet()

      // console.log(`=== ${fontName} ${rangeName} ===`)

      const buildStart = performance.now()
      ranges.forEach(([start, end = start]) => {
        for (let i = start; i <= end; i++) {
          testObj.add(i)
        }
      })
      totalBuildTime += performance.now() - buildStart

      // console.log(cssRangeString + '\n' + JSON.stringify(testObj.data))
      // console.log(`Min/max: ${testObj.min}-${testObj.max}`)

      // validate
      ranges.forEach(([start, end = start]) => {
        for (let i = start; i <= end; i++) {
          expect(testObj.has(i)).toBe(true);
        }
      })

      // query perf test
      const queryStart = performance.now()
      for (let i = 0; i < 0xffff; i++) {
        if (testObj.has(i * 10)) {
          //console.log('match')
        }
      }
      totalQueryTime += performance.now() - queryStart

      // const serialized = testObj.serialize()
      // const testObj2 = new CodePointSet()
      // testObj2.deserialize(serialized)
      // expect(testObj2.serialize()).toEqual(serialized);

      // const css = cssRangeString.replace(/U\+/g, '')
      // if (serialized.length > css.length) {
      //   console.log(serialized + '\n' + css)
      // }

      // console.log(fontName + '\n' + testObj.serialize() + '\n' + cssRangeString.replace(/U\+/g, ''))
      // console.log(JSON.stringify(testObj.data, (_key, val) =>
      //         (val && val.byteLength) ? `[${val.byteLength * 8 / val.length}]${val.join(',')}` : val
      //     , 0))
      // console.log(testObj.data.length + ' arrays')
      // const bytes = testObj.data.reduce((sum, arr) => sum + arr.byteLength, 0)
      // console.log(`${bytes} bytes in memory`)
      // totalArrays += testObj.data.length
      // totalBytes += bytes
    }
  }

  console.log(`== Average build time: ${totalBuildTime / totalTests} ==`)
  console.log(`== Average query time: ${totalQueryTime / totalTests} ==`)
  // console.log(`== Total fonts: ${fonts.length} ==`)
  // console.log(`== Total arrays: ${totalArrays} ==`)
  // console.log(`== Total bytes: ${totalBytes} ==`)
})
