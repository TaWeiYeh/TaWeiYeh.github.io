---
layout: post
title: "Build PyTorch Wheel on Jetson Xavier"
---
*Originally published on [Medium](https://medium.com/@twy359/build-pytorch-wheel-on-jetson-xavier-cb0ff685f294).*

Building PyTorch from source becomes necessary when using Python 3.8 on JetPack 4.6.3, since Nvidia doesn't provide pre-built wheels for this configuration. Downgrading to Python 3.6 was possible, but ROS Foxy requires Python 3.8, which made building from source the only viable option.

## Setup specifications

- Python 3.8
- PyTorch 1.10.2
- Jetson Xavier with JetPack 4.6.3 and L4T 32.7.3
- CUDA 10.2

## Build steps

**Clone and checkout:**

```bash
git clone --recursive https://github.com/pytorch/pytorch
cd pytorch
git checkout tags/v1.10.2
git submodule sync
git submodule update --init --recursive --jobs 0
```

**Maximize performance:**

```bash
sudo nvpmodel -m 0
sudo jetson_clocks
```

**Configure the build environment:**

```bash
export USE_NCCL=1
export USE_DISTRIBUTED=1
export USE_QNNPACK=0
export USE_PYTORCH_QNNPACK=0
export TORCH_CUDA_ARCH_LIST="7.2"
export PYTORCH_BUILD_VERSION=1.10.2
export PYTORCH_BUILD_NUMBER=1
```

**Install dependencies:**

```bash
sudo apt-get install cmake libopenblas-dev libopenmpi-dev
python3 -m pip install -r requirements.txt
python3 -m pip install scikit-build ninja
python3 -m pip install setuptools==59.5.0
```

**Set the compiler version:**

```bash
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-8 1
sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-8 1
```

**Build and install:**

```bash
python3 setup.py bdist_wheel
cd dist
python3 -m pip install --no-cache <wheel_name>
python3 -c "import torch; torch.cuda.is_available()"
```

## Checking the CUDA architecture

To verify CUDA capability using the `deviceQuery` utility:

1. Navigate to `/usr/local/cuda/samples/1_Utilities/deviceQuery`
2. Run `sudo make` to build
3. Run `./deviceQuery` to display the specifications

Jetson Xavier should report compute capability 7.2.
