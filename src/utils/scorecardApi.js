import axios from 'axios';
import { DEFAULT_MCVRA_URL } from './api';

// The scorecard endpoints are mounted on the same MCVRA Generator FastAPI
// service (main.py includes both api/router.py and api/scorecard_router.py).

export async function fetchScorecardRegistry(baseUrl = DEFAULT_MCVRA_URL) {
  const res = await axios.get(`${baseUrl}/scorecard-registry`);
  return res.data;
}

export async function generateScorecard(baseUrl = DEFAULT_MCVRA_URL, payload) {
  const res = await axios.post(`${baseUrl}/generate-scorecard`, payload);
  return res.data;
}

export async function fetchScorecard(baseUrl = DEFAULT_MCVRA_URL, assessmentId, { domain, userId, versionType } = {}) {
  const res = await axios.get(`${baseUrl}/scorecard/${encodeURIComponent(assessmentId)}`, {
    params: { domain, user_id: userId, version_type: versionType },
  });
  return res.data;
}

export async function fetchScorecardVersions(baseUrl = DEFAULT_MCVRA_URL, assessmentId, { domain, userId } = {}) {
  const res = await axios.get(`${baseUrl}/scorecard/${encodeURIComponent(assessmentId)}/versions`, {
    params: { domain, user_id: userId },
  });
  return res.data;
}

export async function fetchScorecardVersion(baseUrl = DEFAULT_MCVRA_URL, assessmentId, versionId, { domain, userId } = {}) {
  const res = await axios.get(`${baseUrl}/scorecard/${encodeURIComponent(assessmentId)}/versions/${versionId}`, {
    params: { domain, user_id: userId },
  });
  return res.data;
}

export async function deleteScorecardVersions(baseUrl = DEFAULT_MCVRA_URL, assessmentId, { domain, userId } = {}) {
  const res = await axios.delete(`${baseUrl}/scorecard/${encodeURIComponent(assessmentId)}/versions`, {
    params: { domain, user_id: userId },
  });
  return res.data;
}

// Returns response data even on a 422-style validation failure (the backend
// returns HTTP 200 with status:"error" + an errors[] array for both
// structural and semantic validation failures, so the caller can render
// inline validation messages rather than a generic network error).
export async function saveScorecard(baseUrl = DEFAULT_MCVRA_URL, assessmentId, { domain, userId, document, editMetadata }) {
  const res = await axios.put(`${baseUrl}/scorecard/${encodeURIComponent(assessmentId)}`, {
    domain,
    user_id: userId,
    document,
    edit_metadata: editMetadata,
  });
  return res.data;
}
