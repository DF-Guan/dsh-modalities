# dsh-modalities

一个 DeepSeek Harness 插件，将端砚网关返回的 `input_modalities` 声明，映射为 DSH 能识别的 `input` 能力。

它修复了那个拒绝每张图片的关卡：路由上的 `input` 声明。

![Plugin logo](art/logo.svg)

## 解决的问题

DSH 核心 CLI 按以下逻辑读取模型 `input`：

```
entry input → 已安装目录           → 路由 defaultInput（默认是 [text]）
```

大多数网关不会返回 `input_modalities`。但有些会，而且返回的是**对象数组**：

```json
"input_modalities": [
  { "type": "text", "supported_inputs": { "max_context_length": { "value": 524288, "unit": "token" } } },
  { "type": "image", "supported_inputs": { "sources": { "type": "enum", "values": ["url", "base64"] } } }
]
```

DSH 原生命令无法识别这种写法，认为它什么都声明了。结果是：模型被接进系统时变成"纯文本"，`read_image` 报出：

```
model "Sage-A1.5" does not declare image input
```

## 它是做什么的

| 尖刀写法 | 对应写法 |
| --- | --- |
| 普通字符串 | `"input_modalities": ["text", "image"]` |
| 嵌套结构 | `"architecture": { "input_modalities": ["text", "image", "file"] }` |
| 驼峰 | `"inputModalities": ["text"]` |
| 对象数组 | `"input_modalities": [{ "type": "text" }, { "type": "image" }]` |

`file`/`audio`/`video` 等不需要的会被丢弃；适配器只承载它能发送的能力。

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

## 贡献

 DPDH 团队在 `packages/llm/llm-pi-ai/src/discovery.ts` 修复这个 gap 是核心方案。
 这个插件是一个独立于核心的公共贡献。

## 许可证

[MIT](LICENSE)

