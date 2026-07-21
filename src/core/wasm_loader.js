// Loads the Go/WASM drawing core (scene, tools, WebGL renderer).
// After this resolves, the bridge is available on window.hostdraw.
export async function loadWasmCore() {
    const go = new Go();

    let result;
    try {
        result = await WebAssembly.instantiateStreaming(
            fetch('web/main.wasm?v=37'),
            go.importObject
        );
    } catch (e) {
        // Fallback when the server doesn't send application/wasm
        const resp = await fetch('web/main.wasm?v=37');
        const bytes = await resp.arrayBuffer();
        result = await WebAssembly.instantiate(bytes, go.importObject);
    }

    go.run(result.instance);

    // Expose the core's linear memory for the on-screen RAM meter.
    window.hostdrawWasmMemory = result.instance.exports.mem || result.instance.exports.memory;

    if (!window.hostdraw) {
        throw new Error('WASM core did not register window.hostdraw');
    }
    return window.hostdraw;
}
