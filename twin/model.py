"""VarshaTwin neural architectures: Level1TwinNet (local 3x3 conv) and VarshaTwinNet (Terrain-Gated Residual Graph-CNN).

All spatial operations are strictly local (3x3 convolutions, max 3 hops per daily step) with zero global
pooling or global spatial attention, ensuring Day-1 shock responses remain localized within dilate=3 cells
and propagate outward physically over Days 2-10.
"""
from __future__ import annotations
import math
import torch
import torch.nn as nn
from twin.data import NC, build_step_features_torch


class HorizonClimatologyGate(nn.Module):
    """Per-channel horizon-aware relaxation gate blending damped persistence with seasonal climatology."""

    def __init__(self) -> None:
        super().__init__()
        # Initial logits chosen so sigmoid(base_logit) ~ 0.22 at step 0, rising with lead step k
        self.base_logit = nn.Parameter(torch.tensor([-1.20, -0.50, -1.05, -1.05, -1.15, -1.20], dtype=torch.float32))
        self.step_slope = nn.Parameter(torch.tensor([0.38, 0.50, 0.42, 0.42, 0.38, 0.38], dtype=torch.float32))
        # Residual damping factor so neural delta dominates at Days 1-4 and decays smoothly at Days 5-10
        self.res_decay_logit = nn.Parameter(torch.tensor([1.6, 1.4, 1.6, 1.6, 1.6, 1.6], dtype=torch.float32))
        self.res_decay_slope = nn.Parameter(torch.tensor([-0.52, -0.60, -0.55, -0.55, -0.52, -0.52], dtype=torch.float32))

    def get_alpha(self, step_k: int = 0) -> torch.Tensor:
        """Relaxation weight toward target day's climatology [1, 6, 1, 1]."""
        return torch.sigmoid(self.base_logit + self.step_slope * float(step_k)).view(1, NC, 1, 1)

    def get_res_scale(self, step_k: int = 0) -> torch.Tensor:
        """Horizon damping weight on the neural residual delta [1, 6, 1, 1]."""
        return torch.sigmoid(self.res_decay_logit + self.res_decay_slope * float(step_k)).view(1, NC, 1, 1)

    def forward(self, last_norm: torch.Tensor, clim_next_norm: torch.Tensor, step_k: int = 0) -> torch.Tensor:
        """Compute base next-day normalized state before neural residual delta."""
        alpha = self.get_alpha(step_k)
        return last_norm + alpha * (clim_next_norm - last_norm)


class Level1TwinNet(nn.Module):
    """Level 1 model: single local 3x3 convolution over 32 physics channels + horizon climatology gate."""

    def __init__(self, in_channels: int = 32) -> None:
        super().__init__()
        self.clim_gate = HorizonClimatologyGate()
        self.conv = nn.Conv2d(in_channels, NC, kernel_size=3, padding=1, padding_mode="replicate")
        nn.init.zeros_(self.conv.weight)
        nn.init.zeros_(self.conv.bias)

    def forward_step(
        self,
        window_norm: torch.Tensor,
        clim_next_norm: torch.Tensor,
        static_norm: torch.Tensor,
        doy_sincos: torch.Tensor,
        step_k: int = 0,
    ) -> torch.Tensor:
        """Predict next day's normalized state [B, 6, 32, 36]."""
        feat = build_step_features_torch(window_norm, clim_next_norm, static_norm, doy_sincos)
        base_next = self.clim_gate(window_norm[:, -1], clim_next_norm, step_k=step_k)
        res_scale = self.clim_gate.get_res_scale(step_k)
        delta = self.conv(feat)
        return base_next + res_scale * delta

    forward = forward_step


class TerrainGatedLocalBlock(nn.Module):
    """1-hop (3x3) local spatial message-passing block gated by static terrain & land-sea geography."""

    def __init__(self, hidden_dim: int = 32) -> None:
        super().__init__()
        self.norm = nn.GroupNorm(math.gcd(8, hidden_dim), hidden_dim)
        self.conv1 = nn.Conv2d(hidden_dim, hidden_dim, kernel_size=1)
        self.act = nn.GELU()
        self.spatial_conv = nn.Conv2d(
            hidden_dim, hidden_dim, kernel_size=3, padding=1, padding_mode="replicate"
        )
        self.terrain_gate = nn.Conv2d(2, hidden_dim, kernel_size=1)
        self.scale = nn.Parameter(torch.full((1, hidden_dim, 1, 1), 0.25))

    def forward(self, x: torch.Tensor, static_norm: torch.Tensor) -> torch.Tensor:
        h = self.act(self.norm(x))
        h = self.act(self.conv1(h))
        h = self.spatial_conv(h)
        gate = torch.sigmoid(self.terrain_gate(static_norm.unsqueeze(0)))
        return x + self.scale * (h * gate)


class VarshaTwinNet(nn.Module):
    """Levels 2 & 3: Per-Pixel Temporal Attention Stem + 3 Terrain-Gated Local 3x3 Blocks + Heavy-Rain CSI Head.

    Spatial receptive field per daily step is strictly 3 grid cells (3 layers of 3x3 conv),
    guaranteeing Day-1 shock energy stays inside dilate=3 cells while advecting outward over Days 2-10.
    """

    def __init__(self, in_channels: int = 32, hidden_dim: int = 32, num_blocks: int = 3) -> None:
        super().__init__()
        self.clim_gate = HorizonClimatologyGate()
        # Stage A: Per-pixel (1x1) temporal attention / channel mixer across the 3-day window + physics channels
        self.temporal_stem = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dim, kernel_size=1),
            nn.GELU(),
            nn.Conv2d(hidden_dim, hidden_dim, kernel_size=1),
        )
        self.temporal_gate = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dim, kernel_size=1),
            nn.Sigmoid(),
        )
        # Stage B: 3 local 3x3 terrain-gated spatial graph-conv blocks (radius = 3 cells/day)
        self.blocks = nn.ModuleList([TerrainGatedLocalBlock(hidden_dim) for _ in range(num_blocks)])
        # Stage C: Zero-initialized residual delta head + dedicated Heavy-Rain moisture-convergence head
        self.head_norm = nn.GroupNorm(math.gcd(8, hidden_dim), hidden_dim)
        self.head_act = nn.GELU()
        self.head = nn.Conv2d(hidden_dim, NC, kernel_size=1)
        self.rain_head = nn.Sequential(
            nn.Conv2d(hidden_dim + 4, 16, kernel_size=1),
            nn.GELU(),
            nn.Conv2d(16, 1, kernel_size=1),
        )
        nn.init.zeros_(self.head.weight)
        nn.init.zeros_(self.head.bias)
        nn.init.zeros_(self.rain_head[-1].weight)
        nn.init.zeros_(self.rain_head[-1].bias)

    def forward_step(
        self,
        window_norm: torch.Tensor,
        clim_next_norm: torch.Tensor,
        static_norm: torch.Tensor,
        doy_sincos: torch.Tensor,
        step_k: int = 0,
    ) -> torch.Tensor:
        """Predict next day's normalized state [B, 6, 32, 36]."""
        feat = build_step_features_torch(window_norm, clim_next_norm, static_norm, doy_sincos)
        base_next = self.clim_gate(window_norm[:, -1], clim_next_norm, step_k=step_k)
        res_scale = self.clim_gate.get_res_scale(step_k)

        h = self.temporal_stem(feat) * self.temporal_gate(feat)
        for blk in self.blocks:
            h = blk(h, static_norm)
        h_out = self.head_act(self.head_norm(h))
        delta = self.head(h_out)

        phys_rain_ctx = feat[:, 24:28]  # [adv_t, adv_q, conv_uv, oro_lift]
        rain_delta = self.rain_head(torch.cat([h_out, phys_rain_ctx], dim=1))
        delta = delta.clone()
        delta[:, 1:2] = delta[:, 1:2] + rain_delta

        return base_next + res_scale * delta

    forward = forward_step


def build_model(level: int = 1, hidden_dim: int = 32) -> nn.Module:
    """Factory returning Level1TwinNet (level=1) or VarshaTwinNet (level>=2)."""
    if level == 1:
        return Level1TwinNet(in_channels=32)
    return VarshaTwinNet(in_channels=32, hidden_dim=hidden_dim, num_blocks=3)
