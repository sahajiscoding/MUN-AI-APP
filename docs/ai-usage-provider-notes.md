# AI usage provider notes

The official NVIDIA NIM API reference describes `/v1/chat/completions` as OpenAI-compatible and supports streaming; NIM also exposes tokenization/counting endpoints, but the current app uses the streaming chat endpoint and conservative fallback accounting.

OpenRouter's official Usage Accounting documentation states that streaming responses include a final usage object automatically and that `stream_options: { include_usage: true }` is deprecated and has no effect. The OpenRouter streaming documentation confirms that the final chunk includes usage statistics, that SSE comments beginning with `:` must be ignored, and that mid-stream provider errors arrive as top-level SSE error events. The adapter therefore keeps the optional `stream_options` request field for OpenAI-compatible interoperability, normalizes any usage event that is present, ignores malformed/comment lines, and charges the full reservation when usage metadata is unavailable.

Sources:
- https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html
- https://openrouter.ai/docs/cookbook/administration/usage-accounting
- https://openrouter.ai/docs/api_reference/streaming
