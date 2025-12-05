# renderer_wgpu_wasm

This is a implementation of the OpenGraphica renderer using WebGPU/WebGL2 with web assembly interface. Theoretically it should be the fastest way to render, but it's also by far the most difficult to code.

## Commands


Build the web assembly bundle (development):

```
wasm-pack build --target web --dev
```

Build the web assembly bundle (release):

```
wasm-pack build --target web
```
