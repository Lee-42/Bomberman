# 第三方资源说明

## NES Bomberman 研究资源

原版程序、图像、声音、名称等的权利归各自权利人所有。

当前研究基准为 **NES-BM-USA**。参考工程：

- [emu-russia/bomberman-nes](https://github.com/emu-russia/bomberman-nes)，提交 `61b62c8d35e6972d5e11abeec876dfd558b7510d`。
- [picosonic/bomberman-nes](https://github.com/picosonic/bomberman-nes)，提交 `7fbe678062398f6ae438963721ca893ee61564ef`。

`assets/resources/original/` 包含提取和转换后的研究素材；`assets/content/original/` 包含研究得到的配置与数据。两份上游游戏工程在提取时未发现 LICENSE / COPYING 文件，公开可访问不表示已授予素材使用或商业发行许可。本仓库不附带完整 NES ROM。

原始提取阶段的来源提交、ROM / CHR 校验和与资源记录保存在 [reference-assets-manifest.json](docs/reference-assets-manifest.json)。其中的验证限制是当时提取阶段的记录；后续游戏回放覆盖范围另见 [verification-status.md](docs/verification-status.md)。

## Fusion Pixel Font

`assets/resources/ui/hud-pixel.ttf` 是 [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.10.16) 的 12px 等宽简体中文字体子集，版本 `2026.10.16`。

字体采用 **SIL Open Font License 1.1**。字体及其上游许可保留在 [hud-pixel-OFL.txt](assets/resources/ui/hud-pixel-OFL.txt)，子集字表与来源校验和见 [hud-pixel-source.json](assets/resources/ui/hud-pixel-source.json)。

## 项目图标与设计稿

`branding/app-icon.png` 以及 `designs/` 下的界面和图标方案在本项目设计迭代中通过 imagegen 生成；相应提示词在同目录保存。游戏界面设计稿可能包含原版研究素材，其权利状态与原版资源相同。
