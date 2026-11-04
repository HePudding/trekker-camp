# 路线图

各任务的顺序仅供参考，会根据情况调整。
越靠后的任务越不确定，也会随开发进展而变化。

## （1）提高可维护性 \<当前阶段\>

我们目前处于这个阶段，需要构建易于维护、能够支持未来开发的环境。

- ~~将后端类型错误数量降至零~~ → 已完成 ✔️
- ~~将前端类型错误数量降至零~~ → 已完成 ✔️
- 改进 CI
	- ~~修复测试~~ → 已完成 ✔️
	- 修复随机测试失败 - https://github.com/misskey-dev/misskey/issues/7985 和 https://github.com/misskey-dev/misskey/issues/7986
	- 增加测试
		- ~~可能需要实现支持依赖注入的机制~~ → 已完成 ✔️
			- https://github.com/misskey-dev/misskey/pull/9085
	- ~~统计覆盖率~~ → 已完成 ✔️
		- https://github.com/misskey-dev/misskey/pull/9081
- 改进文档
- 重构
	- 将各端点定义中的逻辑提取到服务中，由端点调用

## （2）完善功能

第一阶段完成、具备有利于稳定系统开发的环境后，逐步开始实现新功能。

- 改进内容管理功能
- ~~支持 OAuth2 https://github.com/misskey-dev/misskey/issues/8262~~ → 已完成 ✔️
- 支持 GraphQL？

## （3）提高可扩展性

功能开发趋于稳定后，可以考虑更大规模的修改。

- 用 Rust 重写？

## （4）改变世界

推广 Misskey、改变世界的时刻到了。

- 超越 Twitter 等服务，成为全球重要基础设施
- 开发 MiOS 并将其整合进各类系统——MiOS 是什么？
- 让小蓝参与现实世界
- 让 Misskey 加入 GAFA；Misskey 的办公室必须是带庭院的钢筋混凝土粗野主义建筑。
