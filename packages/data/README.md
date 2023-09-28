# Unicode Font Resolver - Data

This directory holds all the font files and the generated metadata and codepoint index files required to efficiently resolve any Unicode string to a set of fonts that cover all its characters.

### CDN Hosting

By default, the [`client`](../client) package will load these data files via the jsDelivr CDN, which simply proxies them straight from this Github repo.

### Self Hosting

If you don't want to use the jsDelivr CDN, you can self host:

- Find the [git branch](https://github.com/lojjic/unicode-font-resolver/branches) that matches the major version of the `@unicode-font-resolver/client` you're using. (The data schema will remain stable within major versions so this will give you the latest compatible data and fonts.)
- Clone that branch locally, or download the [.zip for the branch](https://github.com/lojjic/unicode-font-resolver/archive/refs/heads/1.x.zip) and unpack it.
- Copy the `packages/data` directory to your server files.
- In your client queries, pass the `dataUrl` option pointing to the public URL of that data directory on your server.
