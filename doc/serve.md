# ept serve

Create an HTTP server that creates on-demand [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) from EPT datasets.

```bash
ept serve --help
```

# Usage

```bash
ept serve <project-root>
```

For example, with EPT data stored in `~/entwine`:

```bash
~/entwine
├── red-rocks
│   ├── ...
│   └── ept.json
└── st-helens
    ├── ...
    └── ept.json
```

Serving the Entwine Point Tiles project directory `~/entwine`:

```bash
$ ept serve ~/entwine
# Serves on the default port of 3000.
```

The on-demand tileset endpoints then mirror the project directory structure, at a virtual subpath `ept-tileset`, e.g. http://localhost:3000/red-rocks/ept-tileset/tileset.json.

# Quickstart

Follow the steps from the Entwine [quickstart](https://entwine.io/quickstart.html) to build a small EPT dataset at `~/entwine/red-rocks`:
```bash
conda create -n entwine -c conda-forge entwine
conda activate entwine
entwine build -i https://data.entwine.io/red-rocks.laz -o ~/entwine/red-rocks
```

Then `serve` the Entwine project directory `~/entwine`:
```bash
ept serve ~/entwine
```

And browse to a sample viewer pointing at the on-demand virtual tileset endpoint:
- http://cesium.entwine.io?url=http://localhost:3000/red-rocks/ept-tileset/tileset.json

# Notes

- Only EPT data with UTM spatial references codes are currently supported (a more robust set of SRS codes could be added).
- This translation is capable of being run as an [AWS Lambda](https://aws.amazon.com/lambda/) serverless endpoint.

