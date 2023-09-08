# Unicode Font Resolver - Data

This directory holds all the font files and the generated metadata and codepoint index files required to efficiently resolve any Unicode string to a set of fonts that cover all its characters.

### CDN Hosting

By default, the [`client`](../client) package will load these data files via the jsDelivr CDN, which simply proxies them straight from this Github repo.

### Self Hosting

If you don't want to use the jsDelivr CDN, you can self host:

- Find a [git tag](https://github.com/lojjic/unicode-font-resolver/tags) that's appropriate for the version of the `@unicode-font-resolver/client` you're using; the data schema will remain stable within major versions so you can choose the latest tag with the same major version as your client.
- Download the .zip or .tar.gz file for that tag and unpack it.
- Copy the `packages/data` directory to your server files.
- In your client queries, pass the `dataUrl` option pointing to the public URL of that data directory on your server.
