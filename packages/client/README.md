# Unicode Font Resolver - Client

The Unicode standard defines upward of 150K characters, way too many to include in a single font file of reasonable size. This makes it difficult for web apps that perform custom text rendering to provide full Unicode support.

This project provides an online database of small subset font files, sourced from Google's [Noto Fonts](https://fonts.google.com/noto), and a collection of index and metadata JSON files which allow it to efficiently resolve any Unicode string to a set of fonts that cover all its characters.

-----

The client package lets you query for the set of `.woff` fonts to cover a Unicode string.

```shell
npm install @unicode-font-resolver/client
```

## Usage

```js
import {getFontsForString} from '@unicode-font-resolver/client'

//...

const {fontUrls, chars} = await getFontsForString(
  'Your string of text 🔥',
  {
    // ...options (see below)
  }
)

for (let i = 0; i < chars.length; i++) {
  const fontUrlForChar = fontUrls[chars[i]];
}
```

### Options

The `getFontsForString` function accepts the following options; they are all optional:

- `category` - A string `"sans-serif"` (the default),  `"serif"`, or `"monospace"`; a matching font will be chosen if available.
- `style` - If set to `"italic"`, an italic font file will be chosen if available; otherwise the `"normal"` font will be used.
- `weight` - A numerical font weight hint; the font file with the closest weight to this number will be chosen.
- `lang` - A [language code](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang), used as a hint for resolving particular characters that are covered by multiple language-specific fonts. Currently supports the following languages for CJK unicode blocks:
    - `"ja"` for Japanese
    - `"ko"` for Korean
    - `"zh-Hant"` for Traditional Chinese
    - Otherwise CJK characters will resolve to Simplified Chinese.
- `dataUrl` - A custom location for the unicode-font-resolver data and font files, if you don't want to use the default jsDelivr CDN. See the [instructions](https://github.com/lojjic/unicode-font-resolver/tree/main/packages/data) for how to self host.

### Response

The response is an object with these properties:

- `fontUrls` - an array of URLs to all the fonts needed by your input string. These URLs point to `.woff` files.
- `chars` - a `Uint8Array` of the same length as your input string. Each item is the index in `fontUrls` of the font for that character in the string.
