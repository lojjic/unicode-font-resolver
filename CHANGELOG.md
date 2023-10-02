# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.2](https://github.com/lojjic/unicode-font-resolver/compare/v1.0.1...v1.0.2) (2023-10-02)

### Bug Fixes

- fallback to other langs when preferred lang doesn't have coverage ([c743aff](https://github.com/lojjic/unicode-font-resolver/commit/c743afffa4b9ed204128ddebb12a15166acf252f))

## [1.0.1](https://github.com/lojjic/unicode-font-resolver/compare/v1.0.0...v1.0.1) (2023-09-29)

### Bug Fixes

- better lang detection using regex unicode script classes ([c5c3d5f](https://github.com/lojjic/unicode-font-resolver/commit/c5c3d5f220039b22a4734f0f2907d7bd0d6cdb99))
- detect ko/jp when no lang is set ([bbc894c](https://github.com/lojjic/unicode-font-resolver/commit/bbc894c8e6a94f2d5d9132a288a9b3be55cc9cf5))
- exclude Korean/Japanese chars from Chinese unicode ranges ([b776496](https://github.com/lojjic/unicode-font-resolver/commit/b77649659829a09d658694e6fc59999063f3240b))
- use consistent uppercase in unicode ranges ([5324d88](https://github.com/lojjic/unicode-font-resolver/commit/5324d88f4f7f0e99bc2053a5a33e391cf1bba64d))

# [1.0.0](https://github.com/lojjic/unicode-font-resolver/compare/v0.4.0...v1.0.0) (2023-09-08)

**Note:** Version bump only for package unicode-font-resolver

# [0.4.0](https://github.com/lojjic/unicode-font-resolver/compare/v0.3.2...v0.4.0) (2023-09-07)

### Bug Fixes

- override incorrect unicode ranges for symbols fonts ([#2](https://github.com/lojjic/unicode-font-resolver/issues/2)) ([b4cea49](https://github.com/lojjic/unicode-font-resolver/commit/b4cea49ec220d11cb8579f98ffc3ff3f08c55ad3))

### Features

- add schema version to the data files and check it in the client ([900ff30](https://github.com/lojjic/unicode-font-resolver/commit/900ff305ade1ab765108dc5a5d347226c63970d8))

## [0.3.2](https://github.com/lojjic/unicode-font-resolver/compare/v0.3.1...v0.3.2) (2023-07-10)

### Bug Fixes

- fix font weight resolution ([58b1019](https://github.com/lojjic/unicode-font-resolver/commit/58b10193382d308ac54f680b035ee0a600f7b1af))
- remove unused exported function ([a45df5a](https://github.com/lojjic/unicode-font-resolver/commit/a45df5a4f6eb11d87e74a8006699eab79f911dd0))

## [0.3.1](https://github.com/lojjic/unicode-font-resolver/compare/v0.3.0...v0.3.1) (2023-06-28)

### Bug Fixes

- cache JSON requests in flight to avoid redundant fetches in parallel ([a053621](https://github.com/lojjic/unicode-font-resolver/commit/a053621278a649e50cc8b3d929976406464c14b7))

# [0.3.0](https://github.com/lojjic/unicode-font-resolver/compare/v0.2.3...v0.3.0) (2023-06-27)

### Features

- export CodePointSet ([1b756cb](https://github.com/lojjic/unicode-font-resolver/commit/1b756cbf5b5e1043c3cd7b5e96ec3e7f77dbc136))

### Performance Improvements

- experimental alternate CodePointSet implementations, use the simplest for now ([dc637ed](https://github.com/lojjic/unicode-font-resolver/commit/dc637ed66f6c2811e2a73d8cbb7c0a3aa1a16084))
- strip leading zeros in css range strings ([bf71487](https://github.com/lojjic/unicode-font-resolver/commit/bf71487b9826a1d01b8e5f883fe7ae49fc7753f4))

## [0.2.3](https://github.com/lojjic/unicode-font-resolver/compare/v0.2.2...v0.2.3) (2023-06-05)

### Performance Improvements

- parallelize bucket and font meta requests ([64f91eb](https://github.com/lojjic/unicode-font-resolver/commit/64f91ebdb3b8cc16f2b6ef4e90139ecb3459056c))

## [0.2.2](https://github.com/lojjic/unicode-font-resolver/compare/v0.2.1...v0.2.2) (2023-06-01)

**Note:** Version bump only for package unicode-font-resolver

## 0.2.1 (2023-06-01)

**Note:** Version bump only for package unicode-font-resolver
