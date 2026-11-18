import { EventEmitter } from 'events';
import { Settings, AIModel, AIProvider, AIModelOption } from '@shared/types';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

export interface ProviderConfig {
  name: string;
  models: AIModelOption[];
  requiresApiKey: boolean;
  baseUrl?: string;
}

export class AIProviderManager extends EventEmitter {
  private settings: Settings;
  private providers: Map<string, BaseProvider> = new Map();
  private customModels: AIModel[] = [];

  // Built-in provider configurations
  private readonly BUILTIN_PROVIDERS: Record<AIProvider, ProviderConfig> = {
    openai: {
      name: 'OpenAI',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT-4 model', maxTokens: 4096 },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, affordable GPT-4', maxTokens: 4096 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance', maxTokens: 4096 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast, cost-effective', maxTokens: 4096 },
      ],
      requiresApiKey: true,
    },
    anthropic: {
      name: 'Anthropic',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent', maxTokens: 8192 },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, efficient', maxTokens: 8192 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful', maxTokens: 4096 },
      ],
      requiresApiKey: true,
    },
    google: {
      name: 'Google',
      models: [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Best for complex tasks', maxTokens: 8192 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast, versatile', maxTokens: 8192 },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Balanced performance', maxTokens: 2048 },
      ],
      requiresApiKey: true,
    },
    nvidia: {
      name: 'NVIDIA',
      models: [
        { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', description: 'Flagship reasoning model (tool-capable)', maxTokens: 4096 },
        { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', description: 'Fast, strong reasoning', maxTokens: 4096 },
        { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Llama 3.1 Nemotron Ultra 253B', description: 'NVIDIA-optimised Llama', maxTokens: 4096 },
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', description: 'Faster, lower cost', maxTokens: 4096 },
      ],
      requiresApiKey: true,
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    },
    custom: {
      name: 'Custom',
      models: [],
      requiresApiKey: true,
      baseUrl: '',
    },
  };

  constructor(settings: Settings) {
    super();
    this.settings = settings;
    this.customModels = settings.customModels || [];
    this.initializeProviders();
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
    this.customModels = settings.customModels || [];
    this.reinitializeProviders();
  }

  private initializeProviders(): void {
    // Initialize built-in providers with API keys
    this.initOpenAI();
    this.initAnthropic();
    this.initGoogle();
    this.initNVIDIA();
    this.initCustom();
  }

  private reinitializeProviders(): void {
    this.providers.clear();
    this.initializeProviders();
  }

  private initOpenAI(): void {
    if (this.settings.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider(this.settings.openaiApiKey));
    }
  }

  private initAnthropic(): void {
    if (this.settings.anthropicApiKey) {
      this.providers.set('anthropic', new AnthropicProvider(this.settings.anthropicApiKey));
    }
  }

  private initGoogle(): void {
    if (this.settings.googleApiKey) {
      this.providers.set('google', new GoogleProvider(this.settings.googleApiKey));
    }
  }

  private initNVIDIA(): void {
    if (this.settings.nvidiaApiKey) {
      this.providers.set('nvidia', new NVIDIAProvider(this.settings.nvidiaApiKey));
    }
  }

  private initCustom(): void {
    if (this.settings.customApiKey && this.settings.customBaseUrl) {
      this.providers.set('custom', new CustomProvider(this.settings.customApiKey, this.settings.customBaseUrl));
    }
    // Also add custom models as individual providers
    this.customModels.forEach(model => {
      if (model.enabled && model.apiKey && model.baseUrl) {
        this.providers.set(`custom_${model.id}`, new CustomProvider(model.apiKey, model.baseUrl, model.model));
      }
    });
  }

  getAvailableModels(): AIModelOption[] {
    const models: AIModelOption[] = [];

    // Built-in models
    Object.entries(this.BUILTIN_PROVIDERS).forEach(([providerId, config]) => {
      const hasKey = this.hasProviderKey(providerId as AIProvider);
      if (hasKey || !config.requiresApiKey) {
        config.models.forEach(model => {
          models.push({
            ...model,
            id: `${providerId}:${model.id}`,
            name: `${config.name} - ${model.name}`,
          });
        });
      }
    });

    // Custom models
    this.customModels
      .filter(m => m.enabled)
      .forEach(model => {
        models.push({
          id: `custom:${model.id}`,
          name: `${model.name} (${model.provider})`,
          description: model.provider,
          maxTokens: model.maxTokens,
        });
      });

    return models;
  }

  private resolveProvider(modelId: string): { provider: BaseProvider; modelName: string } {
    const idx = modelId.indexOf(':');
    const providerId = idx === -1 ? modelId : modelId.slice(0, idx);
    const modelName = idx === -1 ? '' : modelId.slice(idx + 1);

    // Direct provider match (openai, anthropic, google, nvidia, custom)
    const direct = this.providers.get(providerId);
    if (direct && providerId !== 'custom') {
      return { provider: direct, modelName };
    }

    // Custom model registered as custom_<modelId>
    const customModelProvider = this.providers.get(`custom_${modelName}`);
    if (customModelProvider) return { provider: customModelProvider, modelName };

    // Generic custom endpoint (only if it is usable for the requested model)
    if (direct) return { provider: direct, modelName };

    // A bare model name (no "provider:" prefix) with a generic custom endpoint
    // configured: treat the whole string as the model name.
    const genericCustom = this.providers.get('custom');
    if (genericCustom && idx === -1) {
      return { provider: genericCustom, modelName: modelId };
    }

    throw new Error(
      `Provider not available: ${providerId}. Add an API key or configure a custom API in Settings.`
    );
  }

  private hasProviderKey(provider: AIProvider): boolean {    switch (provider) {
      case 'openai': return !!this.settings.openaiApiKey;
      case 'anthropic': return !!this.settings.anthropicApiKey;
      case 'google': return !!this.settings.googleApiKey;
      case 'nvidia': return !!this.settings.nvidiaApiKey;
      case 'custom': return !!this.settings.customApiKey && !!this.settings.customBaseUrl;
      default: return false;
    }
  }

  async generateResponse(prompt: string, modelId: string): Promise<AIResponse> {
    const { provider, modelName } = this.resolveProvider(modelId);

    const systemPrompt = this.buildSystemPrompt();

    return provider.generateResponse(systemPrompt, prompt, modelName, {
      temperature: this.settings.temperature ?? 0.7,
      maxTokens: this.settings.maxTokens ?? 2048,
    });
  }

  async generateResponseStream(
    prompt: string,
    modelId: string,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const { provider, modelName } = this.resolveProvider(modelId);

    const systemPrompt = this.buildSystemPrompt();

    return provider.generateResponseStream(systemPrompt, prompt, modelName, {
      temperature: this.settings.temperature ?? 0.7,
      maxTokens: this.settings.maxTokens ?? 2048,
    }, onChunk);
  }

  async testModel(modelId: string, prompt: string): Promise<AIResponse> {
    return this.generateResponse(prompt, modelId);
  }

  async generateResponseStreamWithVision(
    prompt: string,
    modelId: string,
    imageDataUrl: string,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const { provider, modelName } = this.resolveProvider(modelId);

    const systemPrompt = this.buildSystemPrompt();

    // Check if provider supports vision
    if ('generateResponseStreamWithVision' in provider) {
      return (provider as any).generateResponseStreamWithVision(systemPrompt, prompt, modelName, imageDataUrl, {
        temperature: this.settings.temperature ?? 0.7,
        maxTokens: this.settings.maxTokens ?? 2048,
      }, onChunk);
    }

    // Fallback: use regular stream without vision
    return provider.generateResponseStream(systemPrompt, prompt, modelName, {
      temperature: this.settings.temperature ?? 0.7,
      maxTokens: this.settings.maxTokens ?? 2048,
    }, onChunk);
  }

  private buildSystemPrompt(): string {
    const context = this.buildContextPrompt();
    return `You are an expert interview assistant helping a candidate during a live interview.
Provide concise, accurate, and helpful responses to interview questions.
Focus on technical accuracy, clear communication, and practical examples.

${context}

Guidelines:
- Keep responses under 200 words unless detailed explanation is requested
- Use bullet points for clarity
- Provide code examples when relevant
- Be honest about uncertainty
- Adapt to the candidate's experience level`;
  }

  private buildContextPrompt(): string {
    const parts: string[] = [];

    if (this.settings.outputLanguage) {
      parts.push(`Respond in: ${this.settings.outputLanguage}`);
    }

    if (this.settings.resumeText) {
      parts.push(`CANDIDATE RESUME:\n${this.settings.resumeText.substring(0, 3000)}`);
    }

    if (this.settings.instructions) {
      parts.push(`CANDIDATE INSTRUCTIONS (follow strictly):\n${this.settings.instructions.substring(0, 2000)}`);
    }

    if (this.settings.jobDescription) {
      parts.push(`JOB DESCRIPTION:\n${this.settings.jobDescription.substring(0, 2000)}`);
    }

    if (this.settings.companyName) {
      parts.push(`COMPANY: ${this.settings.companyName}`);
    }

    return parts.join('\n\n');
  }

  // Get provider info for UI
  getProviderConfigs(): Record<string, ProviderConfig> {
    return this.BUILTIN_PROVIDERS;
  }

  getCustomModels(): AIModel[] {
    return this.customModels;
  }

  addCustomModel(model: AIModel): void {
    this.customModels.push(model);
    if (model.enabled && model.apiKey && model.baseUrl) {
      this.providers.set(`custom_${model.id}`, new CustomProvider(model.apiKey, model.baseUrl, model.model));
    }
  }

  removeCustomModel(modelId: string): void {
    this.customModels = this.customModels.filter(m => m.id !== modelId);
    this.providers.delete(`custom_${modelId}`);
  }
}

// Base provider interface
abstract class BaseProvider {
  abstract generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse>;
  abstract generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse>;
  abstract testConnection(): Promise<boolean>;
  
  // Optional vision support
  generateResponseStreamWithVision?(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse>;
}

// OpenAI Provider
class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse> {
    const completion = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    });

    return {
      text: completion.choices[0]?.message?.content || '',
      model,
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  async generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model, tokensUsed };
  }

  async generateResponseStreamWithVision(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model, tokensUsed };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

// Anthropic Provider
class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse> {
    const completion = await this.client.messages.create({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    const text = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    return {
      text,
      model,
      tokensUsed: completion.usage?.input_tokens + completion.usage?.output_tokens,
    };
  }

  async generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const stream = this.client.messages.stream({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
      if (event.type === 'message_start') {
        inputTokens = event.message.usage?.input_tokens || 0;
      }
      if (event.type === 'message_delta') {
        outputTokens = event.usage?.output_tokens || 0;
      }
    }

    return { text: fullText, model, tokensUsed: inputTokens + outputTokens };
  }

  async generateResponseStreamWithVision(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    // Extract base64 from data URL
    const base64Data = imageDataUrl.split(',')[1];
    
    const stream = this.client.messages.stream({
      model,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } } as any
        ]
      }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
      if (event.type === 'message_start') {
        inputTokens = event.message.usage?.input_tokens || 0;
      }
      if (event.type === 'message_delta') {
        outputTokens = event.usage?.output_tokens || 0;
      }
    }

    return { text: fullText, model, tokensUsed: inputTokens + outputTokens };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Google Provider
class GoogleProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse> {
    const generativeModel = this.client.getGenerativeModel({ model });
    const chat = generativeModel.startChat({
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help with interview responses.' }] },
      ],
    });

    const result = await chat.sendMessage(userPrompt);
    const text = result.response.text();

    return {
      text,
      model,
      tokensUsed: (result.response as any).usageMetadata?.totalTokenCount,
    };
  }

  async generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const generativeModel = this.client.getGenerativeModel({ model });
    const chat = generativeModel.startChat({
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help with interview responses.' }] },
      ],
    });

    const result = await chat.sendMessageStream(userPrompt);
    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return { text: fullText, model };
  }

  async generateResponseStreamWithVision(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const generativeModel = this.client.getGenerativeModel({ model });
    
    // Extract base64 from data URL
    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1];
    
    const result = await generativeModel.generateContentStream({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help with interview responses.' }] },
        { 
          role: 'user', 
          parts: [
            { text: userPrompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    });

    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return { text: fullText, model };
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-1.0-pro' });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }
}

// NVIDIA Provider (OpenAI-compatible API)
class NVIDIAProvider extends BaseProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
    });
  }

  async generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse> {
    const completion = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    });

    return {
      text: completion.choices[0]?.message?.content || '',
      model,
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  async generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model, tokensUsed };
  }

  async generateResponseStreamWithVision(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model, tokensUsed };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

// Custom Provider (OpenAI-compatible)
class CustomProvider extends BaseProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, baseUrl: string, defaultModel?: string) {
    super();
    this.defaultModel = defaultModel || 'custom-model';
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  async generateResponse(systemPrompt: string, userPrompt: string, model: string, options: { temperature: number; maxTokens: number }): Promise<AIResponse> {
    const useModel = model || this.defaultModel;
    const completion = await this.client.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    });

    return {
      text: completion.choices[0]?.message?.content || '',
      model: useModel,
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  async generateResponseStream(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const useModel = model || this.defaultModel;
    const stream = await this.client.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model: useModel, tokensUsed };
  }

  async generateResponseStreamWithVision(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    imageDataUrl: string,
    options: { temperature: number; maxTokens: number },
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const useModel = model || this.defaultModel;
    const stream = await this.client.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ]
        },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let fullText = '';
    let tokensUsed: number | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
    }

    return { text: fullText, model: useModel, tokensUsed };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}