<p align="center">
  <img src="https://raw.githubusercontent.com/connormanning/entwine/master/doc/logo/icons_favicons/favicon-128.png" alt="Entwine Icon">
</p>

# EPT Tools

A suite of tools for working with [Entwine Point Tile](entwine.io) data.

# Installation

Install the `ept` application via [npm](https://www.npmjs.com/):

```bash
npm install ept-tools -g
```

# Usage

```bash
ept --help
```

Individual tools are available as subcommands under the application `ept`:

```bash
ept <tool> [...options]
```

Usage for an individual tool can be viewed with:

```bash
ept <tool> --help
```

# Tools

Available tools are:

- [serve](doc/serve.md): serve EPT data as on-demand 3D Tiles over HTTP
- [tile](doc/tile.md): translate EPT to 3D Tiles on disk
- [validate](doc/validate.md): validate an EPT dataset
