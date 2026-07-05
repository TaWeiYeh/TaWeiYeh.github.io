---
layout: post
title: "Install PyTorch and CUDA on Windows"
---
*Originally published on [Medium](https://medium.com/@twy359/install-pytorch-and-cuda-on-windows-9319deb4ce49).*

## My environment

- Windows 11
- PyTorch 2.5.1
- CUDA 12.4

## Download CUDA

Download CUDA 12.4 from NVIDIA. There are two installer types: the local installer downloads the entire CUDA package (about 3.0 GB), while the network installer is a lightweight version that downloads CUDA as you install.

Note: attempting to install CUDA via Conda produced errors and was unsuccessful.

## Install PyTorch

Using Conda is the easiest route on Windows. For CUDA 12.4 compatibility:

```bash
conda install pytorch torchvision torchaudio pytorch-cuda=12.4 -c pytorch -c nvidia
```

## Testing

Verify the installation succeeded:

```python
import torch
torch.cuda.is_available()
# True
```

## Conclusion

Make sure the version matches between `pytorch-cuda` and your CUDA version. If you need a different CUDA version, make sure your `pytorch-cuda` version changes accordingly.
