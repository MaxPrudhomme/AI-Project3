/**
 * LLM Service - Communicates with local LLM API (OpenAI-compatible)
 */

export interface LLMConfig {
  apiUrl: string; // e.g., "http://localhost:11434/v1" for Ollama
  model: string; // e.g., "llama3.2:3b"
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  action: string;
  reasoning: string;
  rawResponse: string;
}

export class LLMService {
  private config: LLMConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 500,
      ...config,
    };
  }

  /**
   * Initialize the LLM with game description (first message)
   */
  async initialize(gameDescription: string): Promise<void> {
    this.conversationHistory = [
      {
        role: 'system',
        content: `You are an AI playing a text-based exploration game. ${gameDescription}

IMPORTANT: Respond with your reasoning and then your action in this format:
REASONING: [your thought process]
ACTION: [move OR use_item X where X is inventory index]

Keep responses concise.`,
      },
    ];
  }

  /**
   * Get decision from LLM based on current game state
   */
  async getDecision(statePrompt: string): Promise<LLMResponse> {
    // Add user message with current state
    this.conversationHistory.push({
      role: 'user',
      content: statePrompt,
    });

    try {
      const response = await fetch(`${this.config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.conversationHistory,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content,
      });

      // Keep conversation history manageable (last 10 messages)
      if (this.conversationHistory.length > 11) {
        // Keep system message + last 10
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-10),
        ];
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('LLM Service error:', error);
      throw error;
    }
  }

  /**
   * Parse LLM response to extract action and reasoning
   */
  private parseResponse(response: string): LLMResponse {
    const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=ACTION:|$)/is);
    const actionMatch = response.match(/ACTION:\s*(.+?)$/is);

    let reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
    let action = actionMatch ? actionMatch[1].trim() : '';

    // If no structured format, try to extract action from raw text
    if (!action) {
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('move')) {
        action = 'move';
        reasoning = response;
      } else if (lowerResponse.includes('use')) {
        const itemMatch = response.match(/use.*?(\d+)/i);
        if (itemMatch) {
          action = `use_item ${itemMatch[1]}`;
          reasoning = response;
        }
      }
    }

    // Default to move if still no action
    if (!action) {
      action = 'move';
      reasoning = response || 'No clear action specified, defaulting to move';
    }

    return {
      action: action.trim(),
      reasoning: reasoning.trim(),
      rawResponse: response,
    };
  }

  /**
   * Add feedback to conversation (e.g., action result)
   */
  addFeedback(feedback: string): void {
    this.conversationHistory.push({
      role: 'user',
      content: feedback,
    });
  }

  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Default configurations for popular local LLM setups
 */
export const DEFAULT_LLM_CONFIGS = {
  ollama: {
    apiUrl: 'http://localhost:11434/v1',
    models: ['llama3.2:3b', 'llama3.2:1b', 'mistral:7b', 'phi3:mini', 'qwen2.5:3b'],
  },
  lmstudio: {
    apiUrl: 'http://localhost:1234/v1',
    models: [], // LM Studio uses loaded model
  },
  custom: {
    apiUrl: 'http://localhost:8080/v1',
    models: [],
  },
};
