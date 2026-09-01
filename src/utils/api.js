import axios from 'axios';

export const DEFAULT_MCVRA_URL = 'http://localhost:8000';
export const DEFAULT_CHATBOT_URL = 'http://localhost:8080';
export const DEFAULT_RAG_TOKEN = 'secret-token';

// Health checks
export async function checkMcvraHealth(baseUrl = DEFAULT_MCVRA_URL) {
  try {
    const res = await axios.get(`${baseUrl}/health`, { timeout: 3000 });
    return res.status === 200 && res.data?.status === 'healthy';
  } catch (e) {
    return false;
  }
}

export async function checkChatbotHealth(baseUrl = DEFAULT_CHATBOT_URL) {
  try {
    const res = await axios.get(`${baseUrl}/health`, { timeout: 3000 });
    return res.status === 200 && res.data?.status === 'healthy';
  } catch (e) {
    return false;
  }
}

// MCVRA Generator endpoints
export async function fetchMcvraFrameworks(baseUrl = DEFAULT_MCVRA_URL) {
  try {
    const res = await axios.get(`${baseUrl}/frameworks`);
    return res.data;
  } catch (e) {
    console.error('Error fetching MCVRA frameworks:', e);
    return [];
  }
}

export async function generateMcvraGraph(baseUrl = DEFAULT_MCVRA_URL, { prompt, frameworkId, file, facilityType, assessmentType, surveyFileColumnNames }) {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (prompt) formData.append('prompt', prompt);

  const facility = facilityType || frameworkId || 'health_facility';
  const assessment = assessmentType || 'flood';

  const defaultCols = [
    {
      name: 'flood_zone_status',
      datatype: 'boolean',
      description: 'Yes=1  No=0'
    },
    {
      name: 'school_closure_days',
      datatype: 'range',
      description: 'no_closure=0 ;  1 day = 0.3 ;  2–3 day =0.6 ;  4–7 day =0.8 ;  >7day =1'
    }
  ];

  let rawCols = surveyFileColumnNames;
  let parsedCols = [];

  if (typeof rawCols === 'string' && rawCols.trim()) {
    const trimmed = rawCols.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        parsedCols = JSON.parse(trimmed);
      } catch (e) {
        parsedCols = [];
      }
    } else {
      parsedCols = trimmed
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((colName) => ({
          name: colName,
          column_name: colName,
          datatype: 'categorical',
          data_type: 'categorical',
          description: ''
        }));
    }
  } else if (Array.isArray(rawCols)) {
    parsedCols = rawCols;
  }

  const cols = (Array.isArray(parsedCols) && parsedCols.length > 0) ? parsedCols : defaultCols;
  const colsParam = encodeURIComponent(JSON.stringify(cols));

  const res = await axios.post(
    `${baseUrl}/generate-mcvra?facility_type=${encodeURIComponent(facility)}&assessment_type=${encodeURIComponent(assessment)}&survey_file_column_names=${colsParam}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
  return res.data;
}

export async function generateMcvraGraphStream(
  baseUrl = DEFAULT_MCVRA_URL,
  { prompt, frameworkId, file, facilityType, assessmentType, surveyFileColumnNames },
  onProgress
) {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (prompt) formData.append('prompt', prompt);

  const facility = facilityType || frameworkId || 'health_facility';
  const assessment = assessmentType || 'flood';

  const defaultCols = [
    {
      name: 'flood_zone_status',
      datatype: 'boolean',
      description: 'Yes=1  No=0'
    },
    {
      name: 'school_closure_days',
      datatype: 'range',
      description: 'no_closure=0 ;  1 day = 0.3 ;  2–3 day =0.6 ;  4–7 day =0.8 ;  >7day =1'
    }
  ];

  let rawCols = surveyFileColumnNames;
  let parsedCols = [];

  if (typeof rawCols === 'string' && rawCols.trim()) {
    const trimmed = rawCols.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        parsedCols = JSON.parse(trimmed);
      } catch (e) {
        parsedCols = [];
      }
    } else {
      parsedCols = trimmed
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((colName) => ({
          name: colName,
          column_name: colName,
          datatype: 'categorical',
          data_type: 'categorical',
          description: ''
        }));
    }
  } else if (Array.isArray(rawCols)) {
    parsedCols = rawCols;
  }

  const cols = (Array.isArray(parsedCols) && parsedCols.length > 0) ? parsedCols : defaultCols;
  const colsParam = encodeURIComponent(JSON.stringify(cols));

  const url = `${baseUrl}/generate-mcvra?facility_type=${encodeURIComponent(facility)}&assessment_type=${encodeURIComponent(assessment)}&survey_file_column_names=${colsParam}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCVRA streaming request failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.slice(5).trim();
      if (!dataStr) continue;

      try {
        const payload = JSON.parse(dataStr);
        if (payload.event === 'progress' || payload.event === 'start') {
          if (onProgress) onProgress(payload);
        } else if (payload.event === 'complete') {
          finalResult = payload.result;
        } else if (payload.event === 'error') {
          throw new Error(payload.detail || 'LangGraph pipeline streaming error');
        }
      } catch (err) {
        if (err.message.includes('LangGraph pipeline streaming error') || err.message.includes('MCVRA streaming request failed')) {
          throw err;
        }
        console.warn('Error parsing SSE chunk:', err);
      }
    }
  }

  if (buffer.trim().startsWith('data:')) {
    try {
      const payload = JSON.parse(buffer.trim().slice(5).trim());
      if (payload.event === 'complete') finalResult = payload.result;
      if (payload.event === 'error') throw new Error(payload.detail || 'LangGraph streaming error');
    } catch (e) {
      // trailing chunk parse bypass
    }
  }

  if (!finalResult) {
    throw new Error('No final graph payload received from streaming endpoint.');
  }

  return finalResult;
}

export async function chatWithMcvra(
  baseUrl = DEFAULT_MCVRA_URL,
  { message, graph, assessmentName, domain, history, layoutOptions }
) {
  const payload = {
    message,
    graph: Array.isArray(graph) ? graph : (graph ? [graph] : []),
    assessment_name: assessmentName,
    domain: domain || 'health_facility',
    history: history || [],
    layout_options: layoutOptions || null,
  };

  const res = await axios.post(`${baseUrl}/chat-with-mcvra`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });
  return res.data;
}


// Chatbot endpoints
export async function fetchChatSuggestions(baseUrl = DEFAULT_CHATBOT_URL, apiKey = DEFAULT_RAG_TOKEN, limit = 4) {
  try {
    const res = await axios.get(`${baseUrl}/chat-suggestions?limit=${limit}`, {
      headers: { 'api-key': apiKey }
    });
    return res.data;
  } catch (e) {
    return { suggestions: [] };
  }
}

export async function fetchIndexInfo(baseUrl = DEFAULT_CHATBOT_URL, apiKey = DEFAULT_RAG_TOKEN) {
  try {
    const res = await axios.get(`${baseUrl}/index-info`, {
      headers: { 'api-key': apiKey }
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

export async function clearPipelineCache(baseUrl = DEFAULT_CHATBOT_URL, apiKey = DEFAULT_RAG_TOKEN) {
  const res = await axios.post(`${baseUrl}/clear-cache`, {}, {
    headers: { 'api-key': apiKey }
  });
  return res.data;
}

// Documents admin endpoints
export async function uploadAdminDocument({ baseUrl = DEFAULT_CHATBOT_URL, apiKey, file, documentId, jobId, title, version }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_id', documentId);
  formData.append('job_id', jobId);
  formData.append('title', title);
  formData.append('version', String(version || 1));

  const res = await axios.post(`${baseUrl}/admin/documents`, formData, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
}

export async function reindexAdminDocument({ baseUrl = DEFAULT_CHATBOT_URL, apiKey, documentId, jobId, title }) {
  const res = await axios.post(`${baseUrl}/admin/documents/${documentId}/reindex`, {
    job_id: jobId,
    title
  }, {
    headers: { 'api-key': apiKey }
  });
  return res.data;
}

export async function deleteAdminDocument({ baseUrl = DEFAULT_CHATBOT_URL, apiKey, documentId, jobId }) {
  const res = await axios.delete(`${baseUrl}/admin/documents/${documentId}`, {
    data: { job_id: jobId },
    headers: { 'api-key': apiKey }
  });
  return res.data;
}

export async function rebuildAdminIndex({ baseUrl = DEFAULT_CHATBOT_URL, apiKey, jobId }) {
  const res = await axios.post(`${baseUrl}/admin/index/rebuild`, {
    job_id: jobId
  }, {
    headers: { 'api-key': apiKey }
  });
  return res.data;
}

// SSE Chat Streaming
export async function sendChatStream({ baseUrl, apiKey, query, conversationId, messagesHistory, isChatMode, onChunk, onMetadata, onError, onComplete }) {
  try {
    const response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey || DEFAULT_RAG_TOKEN
      },
      body: JSON.stringify({
        query,
        conversation_id: conversationId,
        messages_history: isChatMode ? messagesHistory : [],
        is_chat_mode: isChatMode
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      onError(`Server HTTP error ${response.status}: ${errText}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;
        const line = block.replace(/^data:\s*/, '').trim();

        if (line === '[DONE]') {
          onComplete();
          return;
        }

        try {
          const parsed = JSON.parse(line);

          if (parsed.error) {
            onError(parsed.error);
            return;
          }

          if (parsed.event === 'metadata') {
            onMetadata(parsed);
          } else if (parsed.event === 'references' && parsed.references) {
            onMetadata({ sources: parsed.references });
          } else if (parsed.event === 'content' && parsed.text) {
            onChunk(parsed.text);
          }

        } catch (e) {
          // If non-JSON text line
          if (line) onChunk(line);
        }
      }
    }
    onComplete();
  } catch (e) {
    onError(e.message || 'Stream network connection failed');
  }
}
