# ept serve

Create an HTTP server that creates on-demand [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) from EPT datasets. The only restriction for
EPT data is that the spatial reference must contain an EPSG code.

```bash
ept serve --help

Serve 3D Tiles on the fly from EPT resources

Options:
      --roots     Allowed endpoint roots - "*" for anything
                                                        [array] [default: ["*"]]
  -p, --port      Server port                           [number] [default: 3000]
      --origins   Access-Control-Allow-Origin list      [array] [default: ["*"]]
      --keyfile   SSL key file                                          [string]
      --certfile  SSL cert file                                         [string]
      --cafile    SSL CA file                                           [string]
```

# Usage

```bash
ept serve
```

By default, this application allows any accessible EPT data to be proxied to
3D Tiles.  The selection of a dataset is controlled via the `ept` query
parameter.  For example, after running `ept serve`, we should be able to access
[this public dataset](http://na.entwine.io/red-rocks/ept.json) in 3D Tiles
format
[here](http://localhost:3000/tileset.json?ept=http://na.entwine.io/red-rocks/ept.json).

We can also place restrictions on which locations may be proxied using the
`--roots` option.  By default, this is set to `*`, meaning to allow all
endpoints, but with an invocation like `ept serve --roots http://na.entwine.io`
we can restrict the proxy to serve only this one endpoint.  Multiple roots may
be passed to allow more than one specific endpoint.

Some aspects of the resulting tileset may be controlled by query parameters, for
example the selection of additional dimensions beyond XYZ/RGB. See the
[tiling options](tiling-options.md).

Other query parameters, aside from `ept` and any tiling options specifications,
will be forwarded to the target EPT root.
