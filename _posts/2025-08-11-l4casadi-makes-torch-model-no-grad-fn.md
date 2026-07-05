---
layout: post
title: "L4CasADi makes torch model no grad_fn"
---
*Originally published on [Medium](https://medium.com/@twy359/l4casadi-makes-torch-model-no-grad-fn-1582be2fe8dd).*

When combining an optimal control problem (OCP) with a PyTorch model, [L4CasADi](https://github.com/Tim-Salzmann/l4casadi) offers a useful solution. However, compiling the OCP can trigger an error:

```
RuntimeError: element 0 of tensors does not require grad and does not have a grad_fn
```

This occurs after converting and compiling a PyTorch model in an OCP using L4CasADi. The problematic code pattern is:

```python
import l4casadi as l4c

l4casadi_model = l4c.L4CasADi(pytorch_model, device=device)
```

## The solution

Create a separate PyTorch model for the OCP instead:

```python
import l4casadi as l4c

# copy model weight and bias from the original model
pytorch_model.load_state_dict(original_model.state_dict())
l4casadi_model = l4c.L4CasADi(pytorch_model, device=device)
```

This approach preserves gradient tracking by keeping distinct model instances — one for optimization and one for training.
