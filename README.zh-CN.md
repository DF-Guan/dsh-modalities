# dsh-modalities

将端砚（intern）网关返回的 `input_modalities` 对象数组声明，映射为 DeepSeek Harness 能识别的 `input` 能力表，让可以读取图片的模型重新接受附件图片。

<div align="center">

<em>👉 选择语言: <a href="./README.md">English</a> | <strong><a href="./README.zh-CN.md">中文</strong></em>

</div>

<h1 align="center">
  <img src="art/logo.svg" alt="dsh-modalities logo" width="96" height="96">
</h1>

<h3 align="center">
  把 <code>input_modalities</code> 映射为 <code>input</code> 能力
</h3>

<p align="center">
  <a href="#这是做什么的">这是做什么的</a> •
  <a href="#问题">问题</a> •
  <a href="#它转换什么">它转换什么</a> •
  <a href="#安装方式">安装方式</a> •
  <a href="#测试">测试</a> •
  <a href="https://github.com/DF-Guan/dsh-modalities"><strong>源码</strong></a>
</p>

<p align="center">
  <a href="https://github.com/DF-Guan/dsh-modalities"><img src="https://img.shields.io/badge/dsh-plugin-9a7919?style=for-the-badge&label=plugin&logo=github" alt="DSH 插件徽章"></a>
  <a href="https://github.com/DF-Guan/dsh-modalities/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT 许可证"></a>
</p>

---

## 这是做什么的

DSH 核心 CLI 按以下 3 级读取模型的 `input`：

```
entry input → 已安装目录 → 路由 defaultInput（默认是 [text]）
```

大多数网关不会返回 `input_modalities`。但端砚（intern）的发现接口会返回，而且返回的是 **对象数组**：

```json
"input_modalities": [
  { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
  { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
]
```

DSH 核心只接受扁平字符串（`["text", "image"]`），所以所有模型被当作 **纯文本** 模型接进系统，`read_image` 报出：

```
model "Sage-A1.5" does not declare image input
```

## 问题

| 端砚返回 | 核心看到 | 结果 |
|---|---|---|
| `input_modalities` 对象数组 | `input` 没有声明 | 图片附件被拒绝（当成纯文本模型） |

这在 **网关按原始对象格式返回模态** 时发生，是端砚发现接口的原生拼写。

## 它转换什么

| 尖刀写法 | 对应写法 |
|---|---|
| 普通字符串 | `"input_modalities": ["text", "image"]` |
| 嵌套结构 | `"architecture": { "input_modalities": ["text", "image", "file"] }` |
| 驼峰 | `"inputModalities": ["text"]` |
| 对象数组 | `"input_modalities": [{ "type": "text" }, { "type": "image" }]` |

`file` / `audio` / `video` 等不需要的会被丢弃；适配器只承载它能发送的能力。

## 为什么重要

- 网关按原始形状返回图像，附件就能正常打开
- 不需要按路由逐个写 `input` 字段
- 模型来自端砚 Listing，顺序与端砚一致
- 超出词汇表的模态不声明为能力

## 安装方式

在 profile 中添加：

```sh
dsh plugin --profile <name> add github:DF-Guan/dsh-modalities
```

## 配置

Row 注入 profile 的字段：

```yaml
- id: dsh-modalities
  name: dsh-modalities
  config:
    endpoint: 'https://api.example.com/v1'
    apiKey: !!js process.env.MODALITY_API_KEY
    providers: [intern-modalities]
```

适配器注入 `intern-modalities` 路由，每十分钟检查端砚 Listing 一次。

## 测试

```sh
node tests/modality.spec.mjs
```

20 条断言覆盖全部尖刀写法，包括插件修复的对象数组写法。

## 说明

- 修复 belongs 在核心：`packages/llm/llm-pi-ai/src/discovery.ts`
- 这个插件展示了一个出核心的路径，用于不跑核心补丁的用户
- 等价修复已推向 deepseek-harness fork 分支（见 Discussion #8876）
- 许可证：MIT

## 进度

| 事项 | 状态 |
|---|---|
| 插件安装在这里 | `main` 分支 |
| 核心补丁 (`discovery.ts`) | 已准备好，位于 fork 分支，指向 #8876 |

---

<p align="center">
  需要查看英文全称？请查看：<strong><a href="./README.md">English README</a></strong>
</p>
