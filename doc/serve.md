# ept serve

Create an HTTP server that creates on-demand [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) from EPT datasets.

```bash
ept serve --help

Serve 3D Tiles on the fly from EPT resources

Options:
      --version   Show version number                                  [boolean]
      --help      Show help                                            [boolean]
      --root      EPT project directory to serve         [string] [default: "."]
  -p, --port      Server port                           [number] [default: 3000]
      --origins   Access-Control-Allow-Origin list       [string] [default: "*"]
      --keyfile   SSL key file                                          [string]
      --certfile  SSL cert file                                         [string]
      --cafile    SSL CA file                                           [string]
```

# Usage

```bash
ept serve [root] # Default: serve current directory on port 3000.
```

For example, with EPT data stored in `~/entwine`:

```bash
~/entwine
├── red-rocks
│   ├── ...
│   └── ept.json
└── st-helens
    ├── ...
    └── ept.json
```

Serving the Entwine Point Tiles project directory `~/entwine`:

```bash
$ ept serve ~/entwine
```

The on-demand tileset endpoints then mirror the project directory structure, at a virtual subpath `ept-tileset`, e.g. http://localhost:3000/red-rocks/ept-tileset/tileset.json.

Some aspects of the resulting tileset may be controlled by query parameters, for example the selection of additional dimensions beyond XYZ/RGB. See the [tiling options](tiling-options.md).

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

- Only EPT data with recognized EPSG spatial reference codes are supported
- This translation is capable of being run as an [AWS Lambda](https://aws.amazon.com/lambda/) serverless endpoint.
