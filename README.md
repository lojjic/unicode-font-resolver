# Unicode Font Resolver

The Unicode standard defines upward of 150K characters, way too many to include in a single font file of reasonable size. This makes it difficult for web apps that perform custom text rendering to provide full Unicode support.

This project provides an online database of small subset font files, sourced from Google's [Noto Fonts](https://fonts.google.com/noto), and a collection of index and metadata JSON files which allow it to efficiently resolve any Unicode string to a set of fonts that cover all its characters.

-----

The [client](packages/client) package allows you to query for the fonts required to cover a given string of unicode characters. This is likely where you want to start.

The [data](packages/data) directory contains all the font files and the index files for resolving them. By default these files are served by the jsDelivr CDN, but you can also self-host them if you want.

