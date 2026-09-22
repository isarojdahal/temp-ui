import {
  DEFAULT_MCVRA_URL,
  DEFAULT_SCORECARD_URL,
  DEFAULT_CHATBOT_URL,
  DEFAULT_RAG_TOKEN
} from './api';

export const CONFIG_STORAGE_KEYS = {
  ASSESSMENT_ID: 'drishti_assessment_id',
  DOMAIN: 'drishti_domain',
  USER_ID: 'drishti_user_id',
  MCVRA_URL: 'drishti_mcvra_url',
  SCORECARD_URL: 'drishti_scorecard_url',
  CHATBOT_URL: 'drishti_chatbot_url',
  API_KEY: 'drishti_api_key',
};

export const DEFAULT_CONFIG = {
  assessmentId: 'demo-assessment',
  domain: 'health_facility',
  userId: 'analyst-1',
  mcvraUrl: DEFAULT_MCVRA_URL,
  scorecardUrl: DEFAULT_SCORECARD_URL,
  chatbotUrl: DEFAULT_CHATBOT_URL,
  apiKey: DEFAULT_RAG_TOKEN,
};

export function getGlobalConfig() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CONFIG };
  }
  return {
    assessmentId: localStorage.getItem(CONFIG_STORAGE_KEYS.ASSESSMENT_ID) || DEFAULT_CONFIG.assessmentId,
    domain: localStorage.getItem(CONFIG_STORAGE_KEYS.DOMAIN) || DEFAULT_CONFIG.domain,
    userId: localStorage.getItem(CONFIG_STORAGE_KEYS.USER_ID) || DEFAULT_CONFIG.userId,
    mcvraUrl: localStorage.getItem(CONFIG_STORAGE_KEYS.MCVRA_URL) || DEFAULT_CONFIG.mcvraUrl,
    scorecardUrl: localStorage.getItem(CONFIG_STORAGE_KEYS.SCORECARD_URL) || DEFAULT_CONFIG.scorecardUrl,
    chatbotUrl: localStorage.getItem(CONFIG_STORAGE_KEYS.CHATBOT_URL) || DEFAULT_CONFIG.chatbotUrl,
    apiKey: localStorage.getItem(CONFIG_STORAGE_KEYS.API_KEY) || DEFAULT_CONFIG.apiKey,
  };
}

export function saveGlobalConfig(newConfig) {
  if (typeof window === 'undefined') return;
  if (newConfig.assessmentId !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.ASSESSMENT_ID, newConfig.assessmentId);
  }
  if (newConfig.domain !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.DOMAIN, newConfig.domain);
  }
  if (newConfig.userId !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.USER_ID, newConfig.userId);
  }
  if (newConfig.mcvraUrl !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.MCVRA_URL, newConfig.mcvraUrl);
  }
  if (newConfig.scorecardUrl !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.SCORECARD_URL, newConfig.scorecardUrl);
  }
  if (newConfig.chatbotUrl !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.CHATBOT_URL, newConfig.chatbotUrl);
  }
  if (newConfig.apiKey !== undefined) {
    localStorage.setItem(CONFIG_STORAGE_KEYS.API_KEY, newConfig.apiKey);
  }
  window.dispatchEvent(new Event('drishti_config_changed'));
}
