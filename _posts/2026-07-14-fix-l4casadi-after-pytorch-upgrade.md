---
layout: post
title: "Fixing l4casadi After a PyTorch Upgrade: Tracking Down a Removed C++ Symbol"
---

**Environment:** Ubuntu 22.04, Python 3.10, `torch 2.6.0+cu124` → `torch 2.13.0+cu130`, `l4casadi 2.0.0`

---

## The Error

After upgrading PyTorch from `2.6.0+cu124` to `2.13.0+cu130` in a virtual environment, importing `l4casadi` immediately crashed:

```
Traceback (most recent call last):
  File "./eval/eval_elev.py", line 42, in <module>
    from controls.mpc import MPC
  File ".../controls/mpc.py", line 6, in <module>
    from controls.OCP import OCP
  File ".../controls/OCP.py", line 12, in <module>
    import l4casadi as l4c
  File ".../l4casadi/__init__.py", line 15, in <module>
    ctypes.CDLL(str(lib_path), mode=ctypes.RTLD_GLOBAL)
OSError: .../l4casadi/lib/libl4casadi.so: undefined symbol:
  _ZN5torch3jit22optimize_for_inferenceERNS0_6ModuleERKSt6vectorISsSaISsEE
```

It died the moment Python tried to load `libl4casadi.so` — before any user code ran.

---

## Root Cause: C++ ABI Incompatibility

The mangled symbol `_ZN5torch3jit22optimize_for_inferenceERNS0_6ModuleERKSt6vectorISsSaISsEE` demangles to:

```
torch::jit::optimize_for_inference(torch::jit::Module&, std::vector<std::string> const&)
```

This is a C++ function from PyTorch's JIT subsystem. The pre-built `libl4casadi.so` wheel on PyPI was compiled against `torch 2.6.0`'s `libtorch`, which exported this symbol. In `torch 2.13.0`, the function was **removed** — the JIT compiler now folds those optimizations in automatically. When the dynamic linker tried to load `libl4casadi.so` at runtime, it couldn't resolve the symbol against the new `libtorch`, and the process died.

This is a classic **ABI mismatch**: the `.so` encoded a dependency on a specific internal symbol that no longer exists in the upgraded library.

---

## Thought Process

### Step 1 — Confirm the diagnosis

The first thing to check was whether this was really an ABI issue or something else (wrong Python version, missing package, etc.). The traceback made it clear: `ctypes.CDLL` failing with `undefined symbol` is the unmistakable signature of a compiled extension that was linked against a different version of a shared library.

```bash
$ pip show l4casadi
Version: 2.0.0
Location: .../site-packages

$ python -c "import torch; print(torch.__version__)"
2.13.0+cu130
```

`l4casadi 2.0.0` is the only version on PyPI. It ships as a pre-built wheel with a compiled `.so`, not a source-only package — so it was built against whatever torch version the maintainer had at release time.

### Step 2 — Weigh the options

Two paths forward:

| Option | Pros | Cons |
|---|---|---|
| Downgrade torch back to 2.6.0 | Simple, guaranteed to work | Reverts a deliberate upgrade; may lose CUDA 13.0 support |
| Rebuild l4casadi from source against torch 2.13.0 | Keeps the new torch | Requires the C++ source to actually compile against 2.13.0 |

Since the torch upgrade was intentional, the goal was to keep `2.13.0` and fix `l4casadi`.

### Step 3 — Inspect the source before attempting a build

Before blindly trying to build from source, it was worth checking whether `optimize_for_inference` appears in l4casadi's own C++ code. If it does, a fresh build will fail for the same reason — the symbol simply doesn't exist in the new torch headers.

The pip download had already extracted the source to a temp directory:

```bash
$ grep -r "optimize_for_inference" /tmp/pip-download-*/l4casadi_*/
libl4casadi/src/l4casadi.cpp:  this->forward_model = torch::jit::optimize_for_inference(this->forward_model);
libl4casadi/src/l4casadi.cpp:  this->adj1_model = torch::jit::optimize_for_inference(this->adj1_model);
libl4casadi/src/l4casadi.cpp:  this->jac_adj1_model = torch::jit::optimize_for_inference(this->jac_adj1_model);
libl4casadi/src/l4casadi.cpp:  this->jac_model = torch::jit::optimize_for_inference(this->jac_model);
libl4casadi/src/l4casadi.cpp:  this->hess_model = torch::jit::optimize_for_inference(this->hess_model);
l4casadi/ts_compiler.py:       f = torch.jit.optimize_for_inference(f)
```

Confirmed: the calls are in the source itself, not just baked into the old binary. A straight rebuild would also fail. The source needed to be patched first.

### Step 4 — Understand what optimize_for_inference actually does

`torch::jit::optimize_for_inference` and `torch.jit.optimize_for_inference` apply a set of graph-level optimization passes (constant folding, dead code elimination, op fusion) to a TorchScript module before inference. In newer PyTorch versions, these passes are applied automatically when a module is frozen via `torch.jit.freeze`. Since l4casadi calls `model.eval()` and `torch.jit.freeze()` already, removing `optimize_for_inference` is safe — the models will still run correctly, just without that explicit extra pass.

### Step 5 — Patch and build

Three patches were needed, each uncovering the next blocker:

**Patch 1 — Remove `optimize_for_inference` calls**

In `libl4casadi/src/l4casadi.cpp`, inside `L4CasADiScriptedImpl::load_model_from_disk()`, the five reassignment lines were removed. Each block went from:

```cpp
this->forward_model = torch::jit::load(...);
this->forward_model.to(this->device);
this->forward_model.eval();
this->forward_model = torch::jit::optimize_for_inference(this->forward_model);  // removed
```

to just the three-line load/transfer/eval sequence. The same change was applied to `adj1_model`, `jac_adj1_model`, `jac_model`, and `hess_model`.

In `l4casadi/ts_compiler.py`, the final line of `ts_compile()` was removed:

```python
f = torch.jit.freeze(f.eval())
f = torch.jit.optimize_for_inference(f)  # removed
```

**Patch 2 — Fix cmake_minimum_required for CMake 4.x**

Running the build hit a second wall:

```
CMake Error at CMakeLists.txt:1 (cmake_minimum_required):
  Compatibility with CMake < 3.5 has been removed from CMake.
```

The system cmake was `4.3.1`, which dropped support for the `VERSION 3.0` declaration in `CMakeLists.txt`. The fix was a one-line change:

```cmake
# before
cmake_minimum_required(VERSION 3.0 FATAL_ERROR)
# after
cmake_minimum_required(VERSION 3.5 FATAL_ERROR)
```

**Patch 3 — Point the build at CUDA 12.6 instead of system CUDA 11.5**

The third blocker came from torch's own cmake module:

```
CMake Error at .../torch/share/cmake/Caffe2/public/cuda.cmake:74 (message):
  PyTorch requires CUDA 12.1 or above.
```

The system `/usr/bin/nvcc` was CUDA 11.5 (too old). But CUDA 12.6 was also installed at `/usr/local/cuda-12.6`. The fix was to prepend that path before invoking the build:

```bash
PATH=/usr/local/cuda-12.6/bin:$PATH \
CUDA_HOME=/usr/local/cuda-12.6 \
CUDA_PATH=/usr/local/cuda-12.6 \
pip install . --no-build-isolation --force-reinstall
```

With `--no-build-isolation`, pip reuses the already-installed `scikit-build`, `cmake`, and other build tools in the virtual environment rather than spinning up a new isolated environment (which is what caused the multi-minute hang on "Installing build dependencies" in the initial attempt with `pip download --no-binary`).

---

## The Final Build Command

```bash
cd /tmp/l4casadi-build          # patched source directory
source ~/env/<your-venv>/bin/activate

PATH=/usr/local/cuda-12.6/bin:$PATH \
CUDA_HOME=/usr/local/cuda-12.6 \
CUDA_PATH=/usr/local/cuda-12.6 \
pip install . --no-build-isolation --force-reinstall
```

Output:
```
Successfully built l4casadi
Successfully installed l4casadi-2.0.0 torch-2.13.0 ...
```

Verification:
```bash
$ python -c "import l4casadi; print('l4casadi imported OK')"
l4casadi imported OK
```

---

## Summary of Changes

| File | Change |
|---|---|
| `libl4casadi/src/l4casadi.cpp` | Removed 5 `torch::jit::optimize_for_inference(...)` reassignments |
| `l4casadi/ts_compiler.py` | Removed `torch.jit.optimize_for_inference(f)` call |
| `libl4casadi/CMakeLists.txt` | Bumped `cmake_minimum_required` from `3.0` to `3.5` |
| Build invocation | Set `PATH`, `CUDA_HOME`, `CUDA_PATH` to point at CUDA 12.6; used `--no-build-isolation` |

---

## Key Takeaways

1. **`undefined symbol` at `.so` load time always means an ABI mismatch.** The dynamic linker is telling you that the compiled extension was linked against a different version of a shared library than what is currently installed.

2. **Check the source before attempting a rebuild.** If the removed/changed symbol is called directly in the package's own C++ source, rebuilding against the new library will fail at compile time for the same reason it failed at link time. Patch first, then build.

3. **`optimize_for_inference` was removed in recent PyTorch.** If you maintain a package that calls this function (C++ or Python), replace it with `torch.jit.freeze(model.eval())` — freeze now incorporates those optimization passes.

4. **`pip install --no-build-isolation` is much faster for packages with system build dependencies.** The default isolated environment forces pip to download and install every build tool from scratch (cmake, ninja, scikit-build), which can hang for many minutes. If those tools are already in the environment, `--no-build-isolation` skips that entirely.

5. **Multiple CUDA versions on one machine require careful PATH management.** When building against a torch that was compiled with CUDA 13.0, cmake must find a CUDA toolkit >= 12.1 — not the system default (which may be older). Always check `which nvcc && nvcc --version` before a CUDA-dependent build.
