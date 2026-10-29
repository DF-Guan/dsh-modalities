# dsh-modalities

你的模型明明写着能看图，DSH 发现它时却没拿到这个信息。这个插件补上这段缺口。

<div align="center">

👉 选择语言：[English](./README.md) · **[中文](./README.zh-CN.md)**

</div>

<h1 align="center">
  <img src="art/logo.svg" alt="dsh-modalities logo" width="96" height="96">
</h1>

<h3 align="center">让能看图的模型真正收到图片</h3>

<p align="center">
  <a href="#你看到的">你看到的</a> ·
  <a href="#缺口在哪">缺口在哪</a> ·
  <a href="#它做了什么">它做了什么</a> ·
  <a href="#安装">安装</a> ·
  <a href="#配置">配置</a> ·
  <a href="#测试">测试</a> ·
  <a href="https://github.com/DF-Guan/dsh-modalities"><strong>源码</strong></a>
</p>

<p align="center">
  <a href="https://github.com/DF-Guan/dsh-modalities"><img src="https://img.shields.io/badge/dsh-plugin-9a7919?style=for-the-badge&label=plugin&logo=github" alt="DSH 插件"></a>
  <a href="https://github.com/DF-Guan/dsh-modalities/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT 许可证"></a>
</p>

---

## 你看到的

在书生·端砚的模型页面上，**Sage-A1.5**、**Intern-S2**、**Qwen3.8-27B** 这些模型的「输入类型」一栏写的是 `Text, Image` —— 它们能看图：

![书生·端砚模型列表，"Input Type"一列写着 Text, Image](art/model-list-screenshot.png)

这张截图就是你实际会看到的页面。这张表是证据，不是装饰：这三行，以及每一个标着 `Multimodal` 的行，都声明了自己能接收图片。

## 缺口在哪

当 DSH 通过网关 API 发现这些模型时，它拿到的回包长这样。这是书生·端砚发现接口的真实记录回包（我的 workspace 里 `_pr/deepseek-harness/fixtures/model-listings/intern-2026-10-28.json`，287 行，3 个模型）。这是从一个更大的回包里裁剪出来的——我保留了三个模型，让测试数据保持小巧，`Sage-A1.5` 就在其中。（原始回包里有 13 个模型；这个数字来自最早报告这个缺口的讨论串，不是我手里还留着的文件，因为我把源文件裁剪成这三个了。）

```json
{
  "id": "Sage-A1.5",
  "input_modalities": [
    { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
    { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
  ]
}
```

字段是存在的，而且声明了 `image`。问题只在于：**你跑的那个 DSH 版本，知不知道该怎么读这种写法。**

**这一部分我在这次会话里无法验证，我直接说清楚，不猜：** DSH 的安装副本打包在 `app.asar` 里，我没有办法读取它。所以我无法告诉你你用的 DSH 已经能处理这个、还是不能。我能指给你看的只有源码本身：

- `packages/llm/llm-pi-ai/src/discovery.ts` —— 里面的 `readListing()` 函数决定网关回包被转成什么。如果这个函数能读对象数组形状的 `input_modalities`，你的 DSH 就能处理；如果不能，这个字段会被丢弃，模型到达时没有任何输入能力声明。
- 针对这个函数的一个等价修复已经放在 fork 分支上，讨论见 [deepseek-harness Discussion #8876](https://github.com/deepseek-ai/deepseek-harness/discussions/8876)。

这个插件是另一种选择——适用于那个修复还没进你正在跑的版本的情况。

## 它做了什么

这个插件站在网关和 DSH 之间。它读取网关可能使用的任何一种能力声明格式，翻译成 DSH 能听懂的那串简单的词：

| 网关返回的格式 | DSH 最终收到的 |
|---|---|
| `["text", "image"]`（普通词列表） | `["text", "image"]` |
| `[{ "type": "text" }, { "type": "image" }]`（对象数组——书生·端砚的格式） | `["text", "image"]` |
| `{"architecture": {"input_modalities": ["text", "image", "file"]}}`（嵌套写法） | `["text", "image"]` |
| `{"inputModalities": ["text"]}`（驼峰写法） | `["text"]` |

它遵守两条规矩：

- **不编造能力。** 如果网关说某个模型支持 `file`、`audio` 或 `video`，这些会被丢弃——DSH 本来也发不了这些类型，声明了就是骗人。
- **不默认当纯文本。** 什么都没声明的模型保持"未知"，而不是静默降级成纯文本。你拿到的是诚实的"我不知道"，而不是一个错误的答案。

这套逻辑跟核心修复用的是同一套——同样的四种写法、同样的词表、同样的"承载不了就丢弃"规则。区别只在于**它跑在哪里**：在适配器里面，而不是在 `discovery.ts` 里面。

## 安装

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

就这一句。没有编译步骤，没有打包产物——插件就是纯 JavaScript，直接从源码运行。

## 配置

装完之后，在你的 profile 补丁文件（`cordis.patch.yml`）里加一行：

```yaml
- id: modality-gateway
  name: dsh-modalities
  config:
    endpoint: 'https://api.example.com/v1'
    apiKey: '${MODALITY_API_KEY}'
    providers: [intern-modalities]
```

| 字段 | 含义 |
|---|---|
| `endpoint` | 网关的基础地址，就是那个能回答 `GET {endpoint}/v1/models` 的地址 |
| `apiKey` | 该网关的 API 密钥。设到 `MODALITY_API_KEY` 环境变量里，在配置里引用它，不要把真实值提交到仓库 |
| `providers` | 这个适配器负责的路线名称。`intern-modalities` 就是书生·端砚那条路线 |

适配器获取一次模型列表，缓存十分钟，期间所有请求都复用这份缓存——所以每十分钟一次网络请求，而不是每次生成都要请求。

## 测试

```sh
npm test
```

**47 条断言**，分布在三个文件，全部通过：

| 文件 | 测什么 | 断言数 |
|---|---|---|
| `tests/modality.spec.mjs` | 四种写法格式，加上容量字段和空输入 | 20 |
| `tests/provider.spec.mjs` | 列表解析、缓存命中/未命中、未知模型报错、流式输出 | 15 |
| `tests/sse.spec.mjs` | SSE 行解析、文本流、工具调用块 | 12 |

`tests/fixtures/gateway.json` 里的测试数据是照着书生·端砚的真实回包格式写的。这些测试证明的是**对象数组这个写法能跑通**——也就是这个插件存在要解决的那个情况。

## 这是什么，以及这不是什么

**这是绕路，不是正解。** 这段逻辑本该放在 DSH 内部的 `packages/llm/llm-pi-ai/src/discovery.ts` 里，那样每条网关路线都不用装任何东西就能受益。一份等价的补丁已经做好，放在 fork 分支上，讨论见 [Discussion #8876](https://github.com/deepseek-ai/deepseek-harness/discussions/8876)。如果你的 DSH 版本落入了这个修复，这个插件就多余了——你应该把它卸掉，而不是两个同时跑。

**这个插件适合这样的人：** 你想让图片附件今天就跑起来，而你跑的 DSH 版本还不认识对象数组写法。它是一个能用的适配器，不是概念验证——有测试、有缓存、有错误处理、有流式输出支持。

## 进度

| 事项 | 状态 |
|---|---|
| 插件 | `main` 分支，47 条测试通过 |
| 核心补丁（`discovery.ts`） | 已在 fork 分支准备好，讨论见 #8876 |
| 社区帖子 | [Discussion #11364](https://github.com/deepseek-ai/deepseek-harness/discussions/11364) |

---

<h2 align="center">🇬🇧 English version</h2>

<p align="center">
  Your model says it can read pictures. DSH discovers it without that information. This plugin fills the gap.
</p>

<p align="center">
  <strong><a href="./README.md">Read the full English version →</a></strong>
</p>
