# 验证记录与当前范围

## 当前版本 0.5.1

Web 与微信小游戏构建已完成，微信官方 CLI 已成功生成账号预览。0.5.1 包括白色半透明细像素按键、无底框单行 HUD、像素字体和选定图标。

按项目所有者要求，最近的界面和图标调整未重新运行游戏测试；初始化本 GitHub 仓库时也未运行测试。构建成功及预览包上传成功不等同于最新界面的运行验收。

微信模拟器已能加载场景。此前自动点击未触发微信触摸事件，模拟器触控验收未完成；物理手机上的触控手感仍以设备实测为准。

## 之前完成的验证

- 0.5.0 界面改色前，49 项自动测试与 TypeScript 检查通过。
- 规则模块的普通输入回放完成 50 个普通关卡和 9 个奖励关，共 272,319 个更新步，无死亡，得分 1,033,200。
- 密码向量覆盖 50 关，结局覆盖 769 个动画更新步及下一轮入口。
- 之前的浏览器触控检查覆盖同时移动和放弹、滑动换向、取消触点、暂停冻结、重开确认、遥控引爆与多种屏幕尺寸。

这些记录属于相应历史版本，不宣称是对最新界面的重新测试。

## 随仓库保留的数据

- `verification/stage1/original-vectors.json`
- `verification/stage1/playthrough.json`
- `verification/campaign/original-vectors.json`
- `verification/finale/original-vectors.json`
- `verification/finale/command-playthrough.json`

这些文件是测试夹具。临时二维码、模拟器截图、本机日志和构建缓存不纳入 Git。
