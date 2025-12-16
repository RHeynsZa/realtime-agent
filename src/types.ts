// Client → Server message types
export interface ClientMessage {
  type: 'message';
  id: string;
  text: string;
}

export interface ClientCancel {
  type: 'cancel';
}

export interface ClientConfirmAction {
  type: 'confirm_action';
  suggestionId: string;
}

export type ClientPayload = ClientMessage | ClientCancel | ClientConfirmAction;

// Server → Client message types
export interface ServerStream {
  type: 'stream';
  delta: string;
}

export interface ServerStreamEnd {
  type: 'stream_end';
  reason: 'done' | 'cancelled';
}

export interface Citation {
  file: string;
  snippet: string;
}

export interface ServerResponse {
  type: 'response';
  text: string;
  citations: Citation[];
}

export interface ServerActionSuggestion {
  type: 'action_suggestion';
  suggestionId: string;
  action: 'schedule_callback' | 'send_sms' | 'create_ticket';
  payload: Record<string, unknown>;
}

export interface ServerActionExecuted {
  type: 'action_executed';
  suggestionId: string;
  result: Record<string, unknown>;
}

export interface ServerError {
  type: 'error';
  message: string;
}

export type ServerPayload =
  | ServerStream
  | ServerStreamEnd
  | ServerResponse
  | ServerActionSuggestion
  | ServerActionExecuted
  | ServerError;

// Knowledge Base types
export interface KBDocument {
  file: string;
  content: string;
}

export interface KBSearchResult {
  file: string;
  snippet: string;
  score: number;
}

// LLM types
export interface LLMResponse {
  text: string;
  citations: Citation[];
  suggestedAction?: {
    action: 'schedule_callback' | 'send_sms' | 'create_ticket';
    payload: Record<string, unknown>;
  };
}

// Session state
export interface SessionState {
  currentMessageId: string | null;
  isStreaming: boolean;
  isCancelled: boolean;
  pendingAction: {
    suggestionId: string;
    action: string;
    payload: Record<string, unknown>;
    timestamp: number;
  } | null;
  confirmedActions: Map<string, number>; // suggestionId -> timestamp
}
