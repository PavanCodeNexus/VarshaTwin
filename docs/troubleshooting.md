# Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Loss is NaN | Learning rate too high, unnormalized data | Lower lr to 1e-4, check normalization, clip gradients |
| Model does worse than "repeat yesterday" | Not predicting residual, or overfitting | Predict delta, zero-init last layer, early stop on validation |
| Rollout explodes after a few steps | Single-step training only | Multi-step training, clamp channels, lower lr |
| Predictions look blurry / flat | MSE averaging | Add gradient loss, check spatial-std ratio, train rollouts |
| Negative rain | Predicting raw tp | Use log1p space, expm1, clamp >= 0 |
| Zero shock changes output | Randomness or adding noise | `model.eval()`, no dropout/noise, fixed threads |
| Shock spreads everywhere instantly | Global layer in model | Convolution only; remove pooling/attention |
| `/simulate` too slow | Model too big, threads | Fewer channels, `torch.set_num_threads(4)`, `torch.no_grad()` |
| Dashboard can't reach API | CORS | Enable CORS in `serve.py` |
| Weights missing after clone | Git LFS not pushed | `git lfs install`, `git lfs track "weights/*.pt"`, `git lfs push --all origin` |
| Validator fails on shape | Wrong order or axes | Check `[steps, 6, 32, 36]` and channel order |
| Out of memory in training | Batch too big | Batch 8-16, fewer channels |
| Training too slow on laptop | CPU | Use free Kaggle/Colab GPU for training only |

## When stuck for 30 minutes
1. Write the exact error and what you changed last.
2. Revert to the last tagged working version.
3. Ask the AI assistant with the error text + `rules.md` + the relevant doc.
